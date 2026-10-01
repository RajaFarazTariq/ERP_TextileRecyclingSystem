# core/filters.py
"""Shared query-param filters used by several module ViewSets."""

from datetime import date, timedelta

from django.db.models import DateTimeField


def filter_by_date_params(queryset, params, field):
    """
    Apply the DateFilter component's query params to `queryset` on `field`.

      ?date_filter=today | this_week | this_month | this_year
      ?year=2025
      ?month=2025-03  (YYYY-MM)
      ?start=2025-01-01&end=2025-03-31

    Invalid values are ignored.
    """
    today       = date.today()
    date_filter = params.get('date_filter')
    # Compare by calendar day: DateTimeFields need __date, DateFields are days already
    is_datetime = isinstance(queryset.model._meta.get_field(field), DateTimeField)
    day = f'{field}__date' if is_datetime else field

    if date_filter == 'today':
        queryset = queryset.filter(**{day: today})
    elif date_filter == 'this_week':
        week_start = today - timedelta(days=today.weekday())
        queryset = queryset.filter(**{f'{day}__gte': week_start})
    elif date_filter == 'this_month':
        queryset = queryset.filter(**{f'{field}__year': today.year, f'{field}__month': today.month})
    elif date_filter == 'this_year':
        queryset = queryset.filter(**{f'{field}__year': today.year})

    if yr := params.get('year'):
        try:
            queryset = queryset.filter(**{f'{field}__year': int(yr)})
        except ValueError:
            pass

    if mo := params.get('month'):
        try:
            y, m = mo.split('-')
            queryset = queryset.filter(**{f'{field}__year': int(y), f'{field}__month': int(m)})
        except (ValueError, AttributeError):
            pass

    if st := params.get('start'):
        try:
            queryset = queryset.filter(**{f'{day}__gte': date.fromisoformat(st)})
        except ValueError:
            pass

    if en := params.get('end'):
        try:
            queryset = queryset.filter(**{f'{day}__lte': date.fromisoformat(en)})
        except ValueError:
            pass

    return queryset
