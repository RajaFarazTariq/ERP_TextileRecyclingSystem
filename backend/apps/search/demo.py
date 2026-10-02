"""
One demo lot whose records agree with each other from delivery to payment.

The main demo data is random per stage, so no single lot there tells a
believable story. This lot does, which makes the Traceability page worth
looking at on a demo database. Called by the seed_module_data command.
"""
from datetime import timedelta
from decimal import Decimal as D

from django.utils import timezone

from apps.decolorization.models import ChemicalIssuance, ChemicalStock, DecolorizationSession, RecipeVersion, Tank
from apps.drying.models import Dryer, DryingSession
from apps.quality.models import Inspection
from apps.sales import services as sales
from apps.sales.models import Customer, DispatchTracking, Payment, SalesOrder
from apps.sorting.models import FabricStock, SortingSession
from apps.users.models import CustomUser
from apps.warehouse.models import FactoryUnit, Stock, Vendor

SLIP = 'WS-SHOWCASE'


def wipe_demo_search():
    """Nothing to do: the lot's records are removed with the main demo data."""


def add_demo_search(admin):
    if Stock.objects.filter(vendor_weight_slip=SLIP).exists():
        return
    vendor, unit = Vendor.objects.order_by('id').first(), FactoryUnit.objects.order_by('id').first()
    tank, dryer = Tank.objects.order_by('id').first(), Dryer.objects.order_by('id').first()
    customer = Customer.objects.order_by('id').first()
    if not all((vendor, unit, tank, dryer, customer)):
        return
    user = lambda role: CustomUser.objects.filter(role=role).first() or admin   # noqa: E731
    now = timezone.now()
    day = lambda back: now - timedelta(days=back)                               # noqa: E731

    delivery = Stock.objects.create(
        vendor=vendor, unit=unit, fabric_type='Cotton offcuts', vendor_weight_slip=SLIP, vehicle_no='LEB-2291',
        our_weight=D('5000'), unloading_weight=D('4990'), status='Approved')
    Inspection.objects.create(stage='Incoming', stock=delivery, inspector=user('warehouse_supervisor'),
                              inspected_on=day(20).date(), sample_kg=D('5'), composition='100% cotton, white and light shades',
                              result='Pass')
    lot = FabricStock.objects.create(stock=delivery, material_type='Cotton offcuts (white)', initial_quantity=D('4990'),
                                     sorted_quantity=D('4990'), remaining_quantity=D('0'), status='Sent to Decolorization')

    sorting = SortingSession.objects.create(
        fabric=lot, supervisor=user('sorting_supervisor'), unit=unit.name, quantity_taken=D('4990'),
        quantity_sorted=D('4690'), waste_quantity=D('300'), status='Completed', end_date=day(17))
    SortingSession.objects.filter(pk=sorting.pk).update(start_date=day(18))

    decolor = DecolorizationSession.objects.create(
        tank=tank, fabric=lot, supervisor=user('decolorization_supervisor'), input_quantity=D('4690'),
        output_quantity=D('4500'), waste_quantity=D('190'), status='Completed', end_date=day(13),
        recipe_version=RecipeVersion.objects.order_by('-id').first(), temperature_c=D('80'), duration_minutes=90,
        water_liters=D('14070'), approved_by=admin, approved_at=day(12))
    DecolorizationSession.objects.filter(pk=decolor.pk).update(start_date=day(14))
    for chemical, quantity in zip(ChemicalStock.objects.order_by('id')[:2], (D('165'), D('115'))):
        issue = ChemicalIssuance.objects.create(chemical=chemical, tank=tank, issued_by=user('decolorization_supervisor'),
                                                quantity=quantity, session=decolor, unit_cost=chemical.unit_cost)
        ChemicalIssuance.objects.filter(pk=issue.pk).update(issued_at=day(14))
        chemical.issued_quantity += quantity
        chemical.remaining_stock = max(chemical.remaining_stock - quantity, D('0'))
        chemical.save()

    DryingSession.objects.create(
        dryer=dryer, fabric=lot, decolor_session=decolor, supervisor=user('drying_supervisor'), input_quantity=D('4500'),
        output_quantity=D('4050'), waste_quantity=D('60'), temperature_celsius=D('85'), duration_minutes=140,
        status='Completed', start_date=day(11), end_date=day(10))
    Inspection.objects.create(stage='Finished', fabric=lot, inspector=user('drying_supervisor'),
                              inspected_on=day(9).date(), sample_kg=D('2'), result='Pass')

    order = SalesOrder.objects.create(
        customer=customer, buyer_name=customer.name, buyer_contact=customer.contact, fabric=lot,
        fabric_quality='Grade A', weight_sold=D('3000'), price_per_kg=D('185'), total_price=D('555000'),
        status='Confirmed', created_by=admin)
    SalesOrder.objects.filter(pk=order.pk).update(created_at=day(7))
    for weight, vehicle, back in ((D('1800'), 'LES-7102', 6), (D('1200'), 'LES-7340', 4)):
        dispatch = DispatchTracking.objects.create(sales_order=order, vehicle_number=vehicle, driver_name='Akram',
                                                   dispatched_weight=weight, dispatch_status='Delivered',
                                                   dispatched_by=admin, delivery_date=day(back - 1))
        DispatchTracking.objects.filter(pk=dispatch.pk).update(dispatch_date=day(back))
    order.status = 'Completed'
    order.save()
    sales.create_invoice(order, admin, invoice_date=day(4).date())
    payment = Payment.objects.create(sales_order=order, amount=D('400000'), payment_method='Bank Transfer',
                                     received_by=admin, reference_number='TT-88213')
    Payment.objects.filter(pk=payment.pk).update(payment_date=day(2))
    sales.refresh_payment_status(order)
