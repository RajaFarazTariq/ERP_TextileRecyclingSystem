# core/testing.py
"""Factories shared by the module test suites."""

from decimal import Decimal
from itertools import count

from rest_framework.test import APIClient

from apps.users.models import CustomUser
from apps.warehouse.models import Vendor, FactoryUnit, Stock
from apps.sorting.models import FabricStock, SortingSession
from apps.decolorization.models import ChemicalStock, Tank, DecolorizationSession
from apps.drying.models import Dryer, DryingSession
from apps.sales.models import SalesOrder

ROLES = [
    'admin',
    'warehouse_supervisor',
    'sorting_supervisor',
    'decolorization_supervisor',
    'drying_supervisor',
]

_seq = count(1)


def make_user(role='admin', **kwargs):
    n = next(_seq)
    kwargs.setdefault('username', f'{role}_{n}')
    kwargs.setdefault('password', 'Pass@12345')
    return CustomUser.objects.create_user(role=role, **kwargs)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def make_stock(**kwargs):
    n = next(_seq)
    if 'vendor' not in kwargs:
        kwargs['vendor'] = Vendor.objects.create(name=f'Vendor {n}')
    if 'unit' not in kwargs:
        kwargs['unit'] = FactoryUnit.objects.create(name=f'Unit {n}')
    kwargs.setdefault('fabric_type', 'Cotton')
    kwargs.setdefault('vendor_weight_slip', f'SLIP-{n}')
    kwargs.setdefault('vehicle_no', f'LHR-{n}')
    kwargs.setdefault('our_weight', Decimal('1000'))
    kwargs.setdefault('unloading_weight', Decimal('990'))
    return Stock.objects.create(**kwargs)


def make_fabric(qty='500', **kwargs):
    if 'stock' not in kwargs:
        kwargs['stock'] = make_stock()
    kwargs.setdefault('material_type', 'Cotton')
    kwargs.setdefault('initial_quantity', Decimal(qty))
    kwargs.setdefault('remaining_quantity', Decimal(qty))
    return FabricStock.objects.create(**kwargs)


def make_sorting_session(fabric=None, supervisor=None, **kwargs):
    kwargs.setdefault('unit', 'Unit 1')
    kwargs.setdefault('quantity_taken', Decimal('100'))
    return SortingSession.objects.create(
        fabric=fabric or make_fabric(), supervisor=supervisor or make_user(), **kwargs
    )


def make_chemical(total='1000', remaining=None, **kwargs):
    kwargs.setdefault('chemical_name', f'Chemical {next(_seq)}')
    return ChemicalStock.objects.create(
        total_stock=Decimal(total),
        remaining_stock=Decimal(remaining if remaining is not None else total),
        **kwargs,
    )


def make_tank(**kwargs):
    n = next(_seq)
    kwargs.setdefault('name', f'Tank {n}')
    kwargs.setdefault('capacity', Decimal('500'))
    kwargs.setdefault('batch_id', f'B-{n}')
    return Tank.objects.create(**kwargs)


def make_decolor_session(tank=None, fabric=None, supervisor=None, **kwargs):
    kwargs.setdefault('input_quantity', Decimal('100'))
    return DecolorizationSession.objects.create(
        tank=tank or make_tank(), fabric=fabric or make_fabric(),
        supervisor=supervisor or make_user(), **kwargs,
    )


def make_dryer(**kwargs):
    kwargs.setdefault('name', f'Dryer {next(_seq)}')
    kwargs.setdefault('capacity', Decimal('300'))
    return Dryer.objects.create(**kwargs)


def make_drying_session(dryer=None, fabric=None, supervisor=None, **kwargs):
    kwargs.setdefault('input_quantity', Decimal('100'))
    return DryingSession.objects.create(
        dryer=dryer or make_dryer(), fabric=fabric or make_fabric(),
        supervisor=supervisor or make_user(), **kwargs,
    )


def make_order(fabric=None, created_by=None, weight='10', price='100', **kwargs):
    kwargs.setdefault('buyer_name', 'Buyer')
    kwargs.setdefault('fabric_quality', 'A')
    return SalesOrder.objects.create(
        fabric=fabric or make_fabric(), created_by=created_by or make_user(),
        weight_sold=Decimal(weight), price_per_kg=Decimal(price),
        total_price=Decimal(weight) * Decimal(price), **kwargs,
    )
