"""
Sales rules beyond the order itself: quotations, invoices, returns, and what a
customer owes.

  owed by a customer = orders that are Confirmed, Dispatched or Completed
                       - payments received - credits for approved returns

Payments stay recorded against an order. An invoice is the document for
dispatched goods; it counts as paid in the order its invoices were raised.
"""
from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.permissions import has_duty
from apps.inventory import services as inventory

ZERO = Decimal('0')
CENT = Decimal('0.01')
HUNDRED = Decimal('100')
BILLED_STATUSES = ('Confirmed', 'Dispatched', 'Completed')


def amounts(weight, price_per_kg, discount_pct=ZERO, tax_pct=ZERO):
    """(subtotal, discount, tax, total) for a weight at a price, discount first and tax on the rest."""
    subtotal = (weight * price_per_kg).quantize(CENT)
    discount = (subtotal * (discount_pct or ZERO) / HUNDRED).quantize(CENT)
    tax = ((subtotal - discount) * (tax_pct or ZERO) / HUNDRED).quantize(CENT)
    return subtotal, discount, tax, subtotal - discount + tax


# ─────────────────────────────────────────────────────────────────────────────
# What is owed
# ─────────────────────────────────────────────────────────────────────────────

def order_credit(order):
    """Credits from this order's approved returns."""
    from .models import SalesReturn
    return SalesReturn.objects.filter(order=order, status='Approved').aggregate(t=Sum('credit_amount'))['t'] or ZERO


def refresh_payment_status(order):
    """Paid / Partial / Pending from payments against the order total less return credits."""
    paid = order.payments.aggregate(t=Sum('amount'))['t'] or ZERO
    due = order.total_price - order_credit(order)
    if paid >= due:
        order.payment_status = 'Paid'
    elif paid > 0:
        order.payment_status = 'Partial'
    else:
        order.payment_status = 'Pending'
    order.save()


def customer_balances(customer_ids=None):
    """{customer_id: {'billed', 'paid', 'credited', 'balance'}} in three queries."""
    from .models import Payment, SalesOrder, SalesReturn

    orders = SalesOrder.objects.filter(status__in=BILLED_STATUSES, customer__isnull=False)
    payments = Payment.objects.filter(sales_order__customer__isnull=False)
    returns = SalesReturn.objects.filter(status='Approved', order__customer__isnull=False)
    if customer_ids is not None:
        customer_ids = list(customer_ids)
        orders = orders.filter(customer_id__in=customer_ids)
        payments = payments.filter(sales_order__customer_id__in=customer_ids)
        returns = returns.filter(order__customer_id__in=customer_ids)

    figures = defaultdict(lambda: {'billed': ZERO, 'paid': ZERO, 'credited': ZERO, 'balance': ZERO})
    for cid, total in orders.values_list('customer_id').annotate(t=Sum('total_price')):
        figures[cid]['billed'] = total or ZERO
    for cid, total in payments.values_list('sales_order__customer_id').annotate(t=Sum('amount')):
        figures[cid]['paid'] = total or ZERO
    for cid, total in returns.values_list('order__customer_id').annotate(t=Sum('credit_amount')):
        figures[cid]['credited'] = total or ZERO
    for f in figures.values():
        f['balance'] = f['billed'] - f['paid'] - f['credited']
    return figures


def credit_warning(order):
    """A message when confirming this order takes its customer past their credit limit; never blocks."""
    customer = order.customer
    if customer is None or not customer.credit_limit:
        return None
    balance = customer_balances([customer.pk])[customer.pk]['balance']
    if order.status not in BILLED_STATUSES:
        balance += order.total_price
    if balance <= customer.credit_limit:
        return None
    return (f'{customer.name} now owes Rs. {balance:,.0f}, which is over their credit limit of '
            f'Rs. {customer.credit_limit:,.0f}.')


# ─────────────────────────────────────────────────────────────────────────────
# Quotations
# ─────────────────────────────────────────────────────────────────────────────

def _move(quotation, allowed, to, verb):
    if quotation.status not in allowed:
        raise ValidationError(f'A quotation that is {quotation.status.lower()} can\'t be {verb}.')
    quotation.status = to
    quotation.decided_at = timezone.now() if to in ('Accepted', 'Rejected') else quotation.decided_at


def send_quotation(quotation):
    _move(quotation, ('Draft',), 'Sent', 'sent')
    quotation.save()


def accept_quotation(quotation):
    _move(quotation, ('Draft', 'Sent'), 'Accepted', 'accepted')
    quotation.save()


def reject_quotation(quotation, reason=''):
    _move(quotation, ('Draft', 'Sent'), 'Rejected', 'rejected')
    quotation.rejection_reason = (reason or '').strip()
    quotation.save()


@transaction.atomic
def convert_quotation(quotation, user, fabric=None):
    """An accepted quotation becomes a Draft sales order with the quoted terms."""
    from .models import SalesOrder
    if quotation.status != 'Accepted':
        raise ValidationError('The customer has to accept the quotation before it becomes an order.')
    fabric = fabric or quotation.fabric
    if fabric is None:
        raise ValidationError({'fabric': ['Choose the fabric lot to sell from.']})
    order = SalesOrder.objects.create(
        customer=quotation.customer, buyer_name=quotation.customer.name,
        buyer_contact=quotation.customer.contact, buyer_address=quotation.customer.address,
        fabric=fabric, product=quotation.product, fabric_quality=quotation.fabric_quality,
        weight_sold=quotation.weight, price_per_kg=quotation.price_per_kg,
        discount_pct=quotation.discount_pct, tax_pct=quotation.tax_pct, total_price=quotation.total,
        created_by=user, notes=f'From quotation {quotation.number}',
    )
    quotation.status = 'Converted'
    quotation.order = order
    quotation.fabric = fabric
    quotation.save()
    return order


# ─────────────────────────────────────────────────────────────────────────────
# Invoices
# ─────────────────────────────────────────────────────────────────────────────

def invoiced_weight(order, exclude_id=None):
    qs = order.invoices.all()
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.aggregate(t=Sum('weight'))['t'] or ZERO


@transaction.atomic
def create_invoice(order, user, weight=None, invoice_date=None, notes=''):
    """Invoice dispatched goods. Without a weight it covers everything dispatched and not yet invoiced."""
    from .models import SalesInvoice
    inventory.lock_fabric(order.fabric_id)
    open_weight = inventory.dispatched_for_order(order.pk) - invoiced_weight(order)
    if weight is None:
        weight = open_weight
    if weight <= 0:
        raise ValidationError({'weight': ['Nothing is left to invoice: dispatch goods first.']}
                              if open_weight <= 0 else {'weight': ['Must be greater than zero.']})
    if weight > open_weight:
        raise ValidationError({'weight': [f'Only {open_weight:,.2f} kg has been dispatched and not yet invoiced.']})
    subtotal, discount, tax, total = amounts(weight, order.price_per_kg, order.discount_pct, order.tax_pct)
    day = invoice_date or timezone.localdate()
    terms = order.customer.payment_terms_days if order.customer else 0
    return SalesInvoice.objects.create(
        order=order, invoice_date=day, due_date=day + timezone.timedelta(days=terms), weight=weight,
        price_per_kg=order.price_per_kg, subtotal=subtotal, discount_amount=discount, tax_amount=tax, total=total,
        notes=notes or '', created_by=user,
    )


def invoice_states(invoices):
    """
    {invoice_id: {'paid', 'status'}}. An order's payments and return credits
    settle its invoices oldest first. Status: Paid, Partial, Unpaid or Overdue.
    """
    from .models import Payment, SalesReturn
    invoices = list(invoices)
    order_ids = {i.order_id for i in invoices}
    settled = defaultdict(lambda: ZERO)
    for oid, total in Payment.objects.filter(sales_order_id__in=order_ids).values_list('sales_order_id').annotate(t=Sum('amount')):
        settled[oid] += total or ZERO
    for oid, total in (SalesReturn.objects.filter(order_id__in=order_ids, status='Approved')
                       .values_list('order_id').annotate(t=Sum('credit_amount'))):
        settled[oid] += total or ZERO
    today = timezone.localdate()
    states = {}
    # Every invoice of these orders takes part, so one shown alone still gets its fair share
    from .models import SalesInvoice
    for invoice in SalesInvoice.objects.filter(order_id__in=order_ids).order_by('invoice_date', 'id'):
        paid = min(invoice.total, max(settled[invoice.order_id], ZERO))
        settled[invoice.order_id] -= paid
        if paid >= invoice.total:
            state = 'Paid'
        elif invoice.due_date < today:
            state = 'Overdue'
        else:
            state = 'Partial' if paid > 0 else 'Unpaid'
        states[invoice.pk] = {'paid': paid, 'status': state}
    return states


# ─────────────────────────────────────────────────────────────────────────────
# Returns
# ─────────────────────────────────────────────────────────────────────────────

def returned_weight(order, exclude_id=None):
    qs = order.returns.exclude(status='Rejected')
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    return qs.aggregate(t=Sum('weight'))['t'] or ZERO


def check_return(order, weight, exclude_id=None):
    if weight is None or weight <= 0:
        raise ValidationError({'weight': ['Must be greater than zero.']})
    returnable = inventory.dispatched_for_order(order.pk) - returned_weight(order, exclude_id)
    if weight > returnable:
        raise ValidationError({'weight': [
            f'Only {max(returnable, ZERO):,.2f} kg of this order has been dispatched and not already returned.'
        ]})


def _decide(sales_return, user, status):
    if not has_duty(user, 'approve_sales_returns'):
        raise PermissionDenied('Your role is not allowed to approve or reject a return.')
    if sales_return.status != 'Requested':
        raise ValidationError(f'This return is already {sales_return.status.lower()}.')
    sales_return.status = status
    sales_return.decided_by = user
    sales_return.decided_at = timezone.now()


@transaction.atomic
def approve_return(sales_return, user):
    """Credits the customer for the returned weight and, if chosen, puts it back into sellable stock."""
    _decide(sales_return, user, 'Approved')
    order = sales_return.order
    inventory.lock_fabric(order.fabric_id)
    check_return(order, sales_return.weight, exclude_id=sales_return.pk)
    sales_return.credit_amount = amounts(sales_return.weight, order.price_per_kg, order.discount_pct, order.tax_pct)[3]
    sales_return.save()            # the stock ledger follows through the inventory signal
    refresh_payment_status(order)


def reject_return(sales_return, user, reason=''):
    _decide(sales_return, user, 'Rejected')
    sales_return.rejection_reason = (reason or '').strip()
    sales_return.save()
