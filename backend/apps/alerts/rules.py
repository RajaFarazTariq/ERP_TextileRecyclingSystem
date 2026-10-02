"""
What each notification rule looks for.

Every rule has a collector: a function that reads another module's records
and yields the items that need attention now. A collector runs a fixed, small
number of queries however many records there are.

Who sees a rule's items: admins always; another role only when the rule lists
it AND the user has the page the rule is about (`RULE_PAGES`). So adding a role to a
rule can never show it records its own pages would refuse.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import F, Q, Sum
from django.utils import timezone
from django.utils.functional import cached_property

from apps.core.permissions import get_role, has_page, is_admin
from apps.decolorization.models import ChemicalStock
from apps.documents import services as documents
from apps.documents.models import Document
from apps.inventory import services as inventory
from apps.inventory.models import StockMovement
from apps.maintenance.models import MaintenanceSchedule, SparePart, WorkOrder
from apps.procurement.models import PurchaseOrder, PurchaseRequisition, SupplierInvoice
from apps.production.models import ProductionOrder
from apps.quality.models import CorrectiveAction, Inspection
from apps.sales import services as sales
from apps.sales.models import Customer, SalesInvoice, SalesReturn
from apps.sorting.models import FabricStock
from apps.workforce.models import LeaveRequest
from .models import NotificationRule

ZERO = Decimal('0')
# The page behind each rule. A rule's items reach a user who has that page;
# the roles that can be chosen for a rule are the roles that have it.
RULE_PAGES = {
    'chemical-low': 'decolorization',
    'spare-part-low': 'maintenance',
    'dried-stock-low': 'drying',
    'stock-oversold': 'sales',
    'purchase-approval': 'procurement',
    'production-delayed': 'production',
    'quality-quarantine': 'quality',
    'quality-action-overdue': 'quality',
    'machine-breakdown': 'maintenance',
    'maintenance-overdue': 'maintenance',
    'invoice-overdue': 'sales',
    'credit-limit': 'sales',
    'supplier-invoice-due': 'procurement',
    'document-expiry': 'documents',      # and only documents in the categories the role may see
    'stock-adjustment': 'sales',
    'sales-return-pending': 'sales',
    'leave-pending': 'workforce',
}


def allowed_roles(rule_key):
    """Roles (besides admin) that can be given a rule: those whose pages include the rule's page."""
    from apps.access.services import roles_with
    page = RULE_PAGES.get(rule_key)
    return roles_with(page) if page else set()


SEVERITY_ORDER = {'danger': 0, 'warning': 1, 'info': 2}
ADJUSTMENT_WINDOW_DAYS = 7


class Context:
    """Who is asking and what day it is. `user=None` is the e-mail digest, which sees what an admin sees."""

    def __init__(self, user=None, today=None):
        self.user = user
        self.admin = user is None or is_admin(user)
        self.role = None if user is None else get_role(user)
        self.today = today or timezone.localdate()

    def receives(self, rule):
        if self.admin:
            return True
        page = RULE_PAGES.get(rule.key)
        return self.role in (rule.roles or []) and bool(page) and has_page(self.user, page)

    def approvals(self, fallback):
        """Admins decide on the Approvals page; other roles follow the item in its own module."""
        return '/approvals' if self.admin else fallback

    @cached_property
    def availability(self):
        return inventory.availability_map()

    @cached_property
    def lot_names(self):
        return dict(FabricStock.objects.filter(pk__in=self.availability).values_list('pk', 'material_type'))


# ── Wording ─────────────────────────────────────────────────────────────────

def num(value):
    """1250.50 -> '1,250.5', 25.00 -> '25'."""
    text = f'{value:,.2f}'
    return text.rstrip('0').rstrip('.') if '.' in text else text


def days_text(count):
    return f'{count} day' if count == 1 else f'{count} days'


def money(value):
    return f'Rs. {value:,.0f}'


def number_of(rule, default):
    return rule.threshold if rule.threshold is not None else Decimal(default)


def item(rule, pk, title, message, severity, href, created=None, action='View', share=None):
    """One notification. Title and message read as one sentence: "Caustic soda" + "is below 25%"."""
    return {
        'id': f'{rule.key}:{pk}', 'rule': rule.key, 'title': title, 'message': message, 'severity': severity,
        'href': href, 'created': created, 'escalated': False, 'action': action, 'share': share,
    }


# ── Collectors ──────────────────────────────────────────────────────────────

def chemical_low(rule, ctx):
    limit = number_of(rule, 25)
    for c in ChemicalStock.objects.filter(total_stock__gt=0):
        share = c.remaining_stock / c.total_stock * 100
        if share < limit:
            yield item(rule, c.pk, c.chemical_name,
                       f'is below {num(limit)}% ({num(c.remaining_stock)} {c.unit_of_measure} left)',
                       'danger' if share < limit * Decimal('0.4') else 'warning', '/decolorization',
                       action='Restock', share=round(float(share), 1))


def spare_part_low(rule, ctx):
    for p in SparePart.objects.filter(stock_quantity__lte=F('reorder_level')):
        yield item(rule, p.pk, p.name,
                   f'is at or below its reorder level ({num(p.stock_quantity)} {p.unit} left, '
                   f'reorder at {num(p.reorder_level)})',
                   'danger' if p.stock_quantity <= 0 else 'warning', '/maintenance', action='Reorder')


def dried_stock_low(rule, ctx):
    limit = number_of(rule, 100)
    for fabric_id, v in sorted(ctx.availability.items()):
        if v['on_hand'] > 0 and ZERO <= v['available'] < limit:
            yield item(rule, fabric_id, f'{ctx.lot_names.get(fabric_id, "Lot")} (lot #{fabric_id})',
                       f'has {num(v["available"])} kg free to sell (below {num(limit)} kg)', 'warning', '/drying')


def stock_oversold(rule, ctx):
    for fabric_id, v in sorted(ctx.availability.items()):
        if v['available'] < 0:
            yield item(rule, fabric_id, ctx.lot_names.get(fabric_id, f'Lot #{fabric_id}'),
                       f'has more reserved than on hand ({num(-v["available"])} kg short)', 'danger', '/sales')


def purchase_approval(rule, ctx):
    href = ctx.approvals('/procurement')
    for r in PurchaseRequisition.objects.filter(status='Submitted').select_related('requested_by'):
        yield item(rule, f'request-{r.pk}', r.number,
                   f'is waiting for approval (requested by {r.requested_by.username})', 'info', href,
                   created=timezone.localdate(r.created_at), action='Review')
    orders = PurchaseOrder.objects.filter(status='Submitted').select_related('vendor').prefetch_related('lines')
    for o in orders:
        yield item(rule, f'order-{o.pk}', o.number,
                   f'for {o.vendor.name} is waiting for approval ({money(o.total_amount)})', 'info', href,
                   created=timezone.localdate(o.created_at), action='Review')


def production_delayed(rule, ctx):
    grace = int(number_of(rule, 0))
    late = ProductionOrder.objects.filter(status__in=ProductionOrder.OPEN_STATUSES,
                                          planned_end__lt=ctx.today - timedelta(days=grace))
    for o in late:
        days = (ctx.today - o.planned_end).days
        yield item(rule, o.pk, o.number, f'({o.product_name}) is {days_text(days)} past its planned end',
                   'danger' if days >= 7 else 'warning', '/production', created=o.planned_end)


def quality_quarantine(rule, ctx):
    held = Inspection.objects.filter(result='Fail', released_at__isnull=True).select_related('stock', 'fabric')
    for i in held:
        material = i.fabric.material_type if i.fabric else i.stock.fabric_type
        target = f'lot #{i.fabric_id}' if i.fabric_id else f'delivery #{i.stock_id}'
        yield item(rule, i.pk, f'{material} ({target})', f'is in quarantine after failing {i.number}', 'danger',
                   '/quality', created=i.inspected_on, action='Review')


def quality_action_overdue(rule, ctx):
    overdue = CorrectiveAction.objects.filter(status='Open', due_date__lt=ctx.today).select_related('inspection')
    for a in overdue:
        days = (ctx.today - a.due_date).days
        yield item(rule, a.pk, f'Action for {a.inspection.number}',
                   f'is {days_text(days)} overdue: {a.description[:80]}', 'warning', '/quality', created=a.due_date)


def machine_breakdown(rule, ctx):
    broken = (WorkOrder.objects.filter(is_breakdown=True).exclude(status__in=WorkOrder.CLOSED)
              .select_related('machine'))
    for o in broken:
        yield item(rule, o.pk, o.machine.name, f'is broken down ({o.number}: {o.title})', 'danger', '/maintenance',
                   created=timezone.localdate(o.reported_at))


def maintenance_overdue(rule, ctx):
    grace = int(number_of(rule, 0))
    overdue = (MaintenanceSchedule.objects.filter(is_active=True, next_due_on__lt=ctx.today - timedelta(days=grace))
               .select_related('machine'))
    for s in overdue:
        days = (ctx.today - s.next_due_on).days
        yield item(rule, s.pk, f'{s.task} ({s.machine.code})', f'is {days_text(days)} overdue', 'warning',
                   '/maintenance', created=s.next_due_on)


def invoice_overdue(rule, ctx):
    grace = int(number_of(rule, 0))
    invoices = list(SalesInvoice.objects.filter(due_date__lt=ctx.today - timedelta(days=grace))
                    .select_related('order__customer'))
    if not invoices:
        return
    states = sales.invoice_states(invoices)
    for inv in invoices:
        state = states[inv.pk]
        if state['status'] != 'Overdue':
            continue
        customer = inv.order.customer.name if inv.order.customer else inv.order.buyer_name
        days = (ctx.today - inv.due_date).days
        yield item(rule, inv.pk, inv.number,
                   f'from {customer} is {days_text(days)} overdue ({money(inv.total - state["paid"])} unpaid)',
                   'danger', '/sales', created=inv.due_date)


def credit_limit(rule, ctx):
    customers = list(Customer.objects.filter(credit_limit__gt=0))
    if not customers:
        return
    balances = sales.customer_balances([c.pk for c in customers])
    for c in customers:
        balance = balances[c.pk]['balance']
        if balance > c.credit_limit:
            yield item(rule, c.pk, c.name,
                       f'owes {money(balance)}, over the credit limit of {money(c.credit_limit)}', 'warning', '/sales')


def supplier_invoice_due(rule, ctx):
    ahead = int(number_of(rule, 7))
    unpaid = (SupplierInvoice.objects.exclude(status='Paid')
              .filter(due_date__isnull=False, due_date__lte=ctx.today + timedelta(days=ahead))
              .select_related('vendor').annotate(paid=Sum('payments__amount')))
    for inv in unpaid:
        left = inv.total - (inv.paid or ZERO)
        if left <= 0:
            continue
        days = (inv.due_date - ctx.today).days
        if days < 0:
            yield item(rule, inv.pk, f'Invoice {inv.invoice_number}',
                       f'from {inv.vendor.name} is {days_text(-days)} overdue ({money(left)} to pay)',
                       'danger', '/procurement', created=inv.due_date, action='Pay')
        else:
            when = 'today' if days == 0 else f'in {days_text(days)}'
            yield item(rule, inv.pk, f'Invoice {inv.invoice_number}',
                       f'from {inv.vendor.name} is due {when} ({money(left)} to pay)', 'warning', '/procurement',
                       action='Pay')


def document_expiry(rule, ctx):
    ahead = int(number_of(rule, documents.EXPIRING_DAYS))
    # The same access filter the Documents page uses: a role sees its categories only
    visible = Document.objects.all() if ctx.user is None else documents.visible_documents(ctx.user)
    expiring = (visible.prefetch_related(None).filter(expires_on__lte=ctx.today + timedelta(days=ahead))
                .order_by('expires_on', 'id'))
    for d in expiring:
        days = (d.expires_on - ctx.today).days
        if days < 0:
            yield item(rule, d.pk, d.title, f'expired {days_text(-days)} ago', 'danger', '/documents',
                       created=d.expires_on, action='Renew')
        else:
            when = 'today' if days == 0 else f'in {days_text(days)}'
            yield item(rule, d.pk, d.title, f'expires {when}', 'warning', '/documents', action='Renew')


def stock_adjustment(rule, ctx):
    limit = number_of(rule, 500)
    since = timezone.now() - timedelta(days=ADJUSTMENT_WINDOW_DAYS)
    large = (StockMovement.objects.filter(movement_type=StockMovement.ADJUSTMENT, created_at__gte=since)
             .filter(Q(quantity__gt=limit) | Q(quantity__lt=-limit)).select_related('fabric', 'created_by'))
    for m in large:
        who = m.created_by.username if m.created_by else 'someone'
        yield item(rule, m.pk, f'{m.fabric.material_type} (lot #{m.fabric_id})',
                   f'was adjusted by {m.quantity:+,.2f} kg by {who}: {m.note}', 'warning', '/sales',
                   created=timezone.localdate(m.created_at))


def sales_return_pending(rule, ctx):
    for r in SalesReturn.objects.filter(status='Requested').select_related('order__customer'):
        customer = r.order.customer.name if r.order.customer else r.order.buyer_name
        yield item(rule, r.pk, r.number, f'from {customer} is waiting for approval ({num(r.weight)} kg)', 'info',
                   ctx.approvals('/sales'), created=timezone.localdate(r.created_at), action='Review')


def leave_pending(rule, ctx):
    for leave in LeaveRequest.objects.filter(status='Pending').select_related('employee'):
        yield item(rule, leave.pk, leave.employee.full_name,
                   f'asked for {days_text(leave.days)} of {leave.leave_type.lower()} leave from '
                   f'{leave.start_date:%d %b %Y}', 'info', ctx.approvals('/workforce'),
                   created=timezone.localdate(leave.created_at), action='Review')


COLLECTORS = {
    'chemical-low': chemical_low,
    'spare-part-low': spare_part_low,
    'dried-stock-low': dried_stock_low,
    'stock-oversold': stock_oversold,
    'purchase-approval': purchase_approval,
    'production-delayed': production_delayed,
    'quality-quarantine': quality_quarantine,
    'quality-action-overdue': quality_action_overdue,
    'machine-breakdown': machine_breakdown,
    'maintenance-overdue': maintenance_overdue,
    'invoice-overdue': invoice_overdue,
    'credit-limit': credit_limit,
    'supplier-invoice-due': supplier_invoice_due,
    'document-expiry': document_expiry,
    'stock-adjustment': stock_adjustment,
    'sales-return-pending': sales_return_pending,
    'leave-pending': leave_pending,
}


# ── Running the rules ───────────────────────────────────────────────────────

def _sort_key(entry):
    return (not entry['escalated'], SEVERITY_ORDER[entry['severity']], entry['created'] or date.max, entry['title'])


def rule_items(rule, ctx):
    """The current items of one rule for this caller, with escalation worked out."""
    collect = COLLECTORS.get(rule.key)
    if collect is None or not rule.is_enabled or not ctx.receives(rule):
        return []
    found = list(collect(rule, ctx))
    if rule.escalate_after_days is not None:
        for entry in found:
            created = entry['created']
            entry['escalated'] = created is not None and (ctx.today - created).days >= rule.escalate_after_days
    return sorted(found, key=_sort_key)


def current_items(user):
    """Everything this user should see: escalated first, then by severity, oldest first."""
    ctx = Context(user)
    found = []
    for rule in NotificationRule.objects.filter(is_enabled=True):
        found.extend(rule_items(rule, ctx))
    return sorted(found, key=_sort_key)


def digest():
    """[(rule, items)] for the e-mail digest: enabled rules marked "send e-mail" that have something to report."""
    ctx = Context()
    sections = []
    for rule in NotificationRule.objects.filter(is_enabled=True, send_email=True):
        found = rule_items(rule, ctx)
        if found:
            sections.append((rule, found))
    return sections
