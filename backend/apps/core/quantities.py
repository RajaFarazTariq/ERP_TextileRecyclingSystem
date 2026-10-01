# core/quantities.py
"""Parsing and sanity checks for kg quantities entered when completing a process step."""
from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError


def parse_kg(data, field, default='0'):
    """Read a non-negative Decimal from request data, or raise a 400."""
    raw = data.get(field, default)
    if raw in (None, ''):
        raw = default
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        raise ValidationError({field: ['Enter a valid number.']})
    if not value.is_finite() or value < 0:
        raise ValidationError({field: ['Must be zero or more.']})
    return value


def check_not_more_than_input(input_kg, output_kg, waste_kg, output_field='output_quantity'):
    """Output plus waste cannot exceed what went in."""
    if output_kg + waste_kg > input_kg:
        raise ValidationError({output_field: [
            f'Output ({output_kg:,.2f} kg) plus waste ({waste_kg:,.2f} kg) is more than '
            f'the input ({input_kg:,.2f} kg).'
        ]})
