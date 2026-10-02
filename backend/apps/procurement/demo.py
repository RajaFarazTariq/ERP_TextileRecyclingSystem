"""Demo purchasing records (called by the seed_module_data command)."""
from datetime import timedelta
from decimal import Decimal as D

from django.utils import timezone

from apps.users.models import CustomUser
from apps.warehouse.models import FactoryUnit, Stock, Vendor
from . import services
from .models import (
    PurchaseOrder, PurchaseOrderLine, PurchaseRequisition, PurchaseReturn, RequisitionLine,
    SupplierInvoice, SupplierPayment, SupplierQuotation,
)


def wipe_demo_procurement():
    SupplierPayment.objects.all().delete()
    SupplierInvoice.objects.all().delete()
    SupplierQuotation.objects.all().delete()
    PurchaseReturn.objects.all().delete()
    Stock.objects.filter(po_line__isnull=False, fabric_stocks__isnull=True).delete()
    Stock.objects.filter(po_line__isnull=False).update(po_line=None)
    PurchaseOrder.objects.all().delete()
    PurchaseRequisition.objects.all().delete()


def add_demo_procurement(admin):
    """Requests and orders at each stage, deliveries against orders, invoices part paid, and quotations."""
    today = timezone.localdate()
    requester = CustomUser.objects.filter(role='warehouse_supervisor').first() or admin
    unit = FactoryUnit.objects.first()
    vendors = list(Vendor.objects.order_by('id')[:4])
    if not vendors:
        return

    def request(material, kg, status):
        r = PurchaseRequisition.objects.create(requested_by=requester, unit=unit, needed_by=today + timedelta(days=10))
        RequisitionLine.objects.create(requisition=r, material=material, quantity_kg=D(kg))
        if status != 'Draft':
            services.submit_requisition(r)
        if status == 'Approved':
            services.decide_requisition(r, admin, True)
        return r

    def order(vendor, lines, status, requisition=None, days_ago=0):
        o = PurchaseOrder.objects.create(vendor=vendor, requisition=requisition, created_by=admin,
                                         order_date=today - timedelta(days=days_ago),
                                         expected_date=today + timedelta(days=7 - days_ago))
        for material, kg, price in lines:
            PurchaseOrderLine.objects.create(order=o, material=material, quantity_kg=D(kg), unit_price=D(price))
        if status != 'Draft':
            services.submit_order(o)
        if status == 'Approved':
            services.approve_order(o, admin)
        return o

    def receive(o, kg, n):
        line = o.lines.first()
        Stock.objects.create(vendor=o.vendor, fabric_type=line.material, vendor_weight_slip=f'VS-{n}',
                             vehicle_no=f'LES-{4400 + n}', our_weight=D(kg), unloading_weight=D(kg) - 2,
                             unit=unit, po_line=line)

    ordered = request('Cotton waste (white)', 2500, 'Approved')
    request('Denim offcuts', 1800, 'Submitted')
    request('Polyester blend', 1200, 'Approved')
    request('Knitwear scraps', 900, 'Draft')

    part = order(vendors[0], [('Cotton waste (white)', 2500, 48)], 'Approved', ordered, days_ago=12)
    receive(part, 1200, 1)
    late = order(vendors[1 % len(vendors)], [('Denim offcuts', 1500, 52), ('Cotton waste (mixed)', 800, 41)], 'Approved', days_ago=20)
    receive(late, 1500, 2)
    order(vendors[2 % len(vendors)], [('Polyester blend', 1200, 38)], 'Submitted', days_ago=1)
    order(vendors[3 % len(vendors)], [('Knitwear scraps', 900, 35)], 'Draft')
    done = order(vendors[0], [('Cotton waste (mixed)', 1000, 42)], 'Approved', days_ago=30)
    receive(done, 1000, 3)

    for o, number, amount, paid, due_in in ((done, 'AT-2291', 42000, 42000, 25), (late, 'KF-0187', 78000, 30000, 4),
                                            (part, 'AT-2310', 57600, 0, -3)):
        invoice = SupplierInvoice.objects.create(
            vendor=o.vendor, purchase_order=o, invoice_number=number, invoice_date=today - timedelta(days=12),
            due_date=today + timedelta(days=due_in), amount=D(amount), tax_amount=D(amount) * D('0.17'))
        if paid:
            SupplierPayment.objects.create(invoice=invoice, amount=D(paid), method='Bank Transfer',
                                           payment_date=today - timedelta(days=2), paid_by=admin)
        invoice.refresh_status()

    for vendor, price in zip(vendors, ('48', '50.5', '46', '51')):
        SupplierQuotation.objects.create(vendor=vendor, material='Cotton waste (white)', price_per_kg=D(price),
                                         quoted_on=today - timedelta(days=15))
