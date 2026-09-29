# core/pagination.py
from rest_framework.pagination import PageNumberPagination


class OptionalPageNumberPagination(PageNumberPagination):
    """
    Paginate only when the client asks with ?page= or ?page_size=.
    Without them, list endpoints return a plain array as they always have,
    which the current frontend relies on.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500

    def paginate_queryset(self, queryset, request, view=None):
        if 'page' not in request.query_params and 'page_size' not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
