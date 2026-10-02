"""
Page access: who may open which page, and what that means for the API.

  pages a user has = the pages of their role
                     + pages given to them personally
                     - pages taken away from them personally
  An admin has every page. That can't be changed, so there is always someone
  who can reach everything, including the Users page where access is managed.

The API follows the pages. Every request to a module's API needs a page that
uses that module: to read it, one of READERS; to change it, one of WRITERS.
`check_api_access` runs before each view's own permission checks, so those
(for example "only an admin approves") still apply on top.
"""
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import ALL_ROLES, get_role

ADMIN = 'admin'
ROLES = ['admin', 'warehouse_supervisor', 'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor']
ROLE_LABELS = {
    'admin': 'Admin', 'warehouse_supervisor': 'Warehouse Supervisor', 'sorting_supervisor': 'Sorting Supervisor',
    'decolorization_supervisor': 'Decolorization Supervisor', 'drying_supervisor': 'Drying Supervisor',
}

# key, title, menu group, and whether only admins may ever have it
PAGES = [
    ('dashboard', 'Dashboard', 'Overview', False),
    ('approvals', 'Approvals', 'Overview', False),
    ('traceability', 'Traceability', 'Overview', False),
    ('warehouse', 'Warehouse', 'Operations', False),
    ('sorting', 'Sorting', 'Operations', False),
    ('decolorization', 'Decolorization', 'Operations', False),
    ('drying', 'Drying', 'Operations', False),
    ('quality', 'Quality', 'Operations', False),
    ('production', 'Production', 'Operations', False),
    ('maintenance', 'Maintenance', 'Operations', False),
    ('sustainability', 'Sustainability', 'Operations', False),
    ('procurement', 'Purchasing', 'Commercial', False),
    ('sales', 'Sales', 'Commercial', False),
    ('finance', 'Finance', 'Commercial', False),
    ('documents', 'Documents', 'Administration', False),
    ('workforce', 'Workforce', 'Administration', False),
    ('reports', 'Reports', 'Administration', False),
    # Managing users and access stays with admins: anyone else holding it could give themselves everything
    ('users', 'Users', 'Administration', True),
]
PAGE_KEYS = [key for key, *_ in PAGES]
ADMIN_ONLY_PAGES = {key for key, _, _, locked in PAGES if locked}

# The access each role had before it became configurable (the web app's old ROUTE_ROLES table)
SUPERVISORS = ROLES[1:]
EVERY_SUPERVISOR = {'quality', 'maintenance', 'sustainability', 'documents', 'traceability'}
DEFAULT_ROLE_PAGES = {
    'warehouse_supervisor': EVERY_SUPERVISOR | {'warehouse', 'procurement'},
    'sorting_supervisor': EVERY_SUPERVISOR | {'sorting', 'production'},
    'decolorization_supervisor': EVERY_SUPERVISOR | {'decolorization', 'production'},
    'drying_supervisor': EVERY_SUPERVISOR | {'drying', 'production'},
}

# What each page reads and changes through the API: a whole module (the first
# part of the URL after /api/v1/) or, with a slash, only the endpoints under that path.
PAGE_API = {
    'dashboard': {'read': {'reports', 'audit', 'alerts', 'warehouse', 'sorting', 'decolorization', 'drying', 'sales', 'inventory'}},
    # The inbox itself. Deciding an item calls the module that owns it, which admins reach through that module's page
    'approvals': {'read': {'alerts'}, 'write': {'alerts'}},
    'traceability': {'read': {'search'}},
    # A delivery can be booked against an open purchase order line: that list only, not the rest of Purchasing
    'warehouse': {'read': {'warehouse', 'procurement/open-lines'}, 'write': {'warehouse'}},
    'sorting': {'read': {'sorting', 'warehouse'}, 'write': {'sorting'}},
    'decolorization': {'read': {'decolorization'}, 'write': {'decolorization'}},
    'drying': {'read': {'drying'}, 'write': {'drying'}},
    'quality': {'read': {'quality', 'warehouse', 'sorting'}, 'write': {'quality'}},
    'production': {'read': {'production', 'sorting', 'decolorization', 'warehouse'}, 'write': {'production'}},
    'maintenance': {'read': {'maintenance', 'decolorization', 'drying'}, 'write': {'maintenance'}},
    'sustainability': {'read': {'sustainability', 'sorting'}, 'write': {'sustainability'}},
    'procurement': {'read': {'procurement', 'warehouse'}, 'write': {'procurement'}},
    'sales': {'read': {'sales', 'sorting', 'inventory'}, 'write': {'sales', 'inventory'}},
    'finance': {'read': {'finance'}, 'write': {'finance'}},
    'documents': {'read': {'documents'}, 'write': {'documents'}},
    'workforce': {'read': {'workforce'}, 'write': {'workforce'}},
    'reports': {'read': {'reports', 'audit'}},
    'users': {'read': {'users', 'access'}, 'write': {'users', 'access'}},
}


def _users_of(kind):
    result = {}
    for page, uses in PAGE_API.items():
        for api in uses.get(kind, ()):
            result.setdefault(api, set()).add(page)
    return result


READERS = _users_of('read')      # {'warehouse': {'warehouse', 'sorting', 'quality', ...}, ...}
WRITERS = _users_of('write')


def pages_using(api, rest, read):
    """Pages that give access to this request: those using the whole module, or an endpoint the path falls under."""
    table = READERS if read else WRITERS
    pages = set(table.get(api, ()))
    for target, users in table.items():
        if '/' in target and (rest == target or rest.startswith(target + '/')):
            pages |= users
    return pages


SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')
# Open to every signed-in user whatever their pages: signing in and out, the
# names behind "supervisor" dropdowns, their own access, the bell and the
# search box (both show only what the user's pages allow), and the audit log,
# which itself shows a non-admin only their own entries.
OPEN_READS = ('users/list', 'users/detail', 'access/me', 'alerts/notifications', 'search', 'audit/logs')
NOT_OPEN = ('search/trace',)      # following a lot is the Traceability page
OPEN_ANY = ('users/login', 'users/logout', 'users/token')


# ─────────────────────────────────────────────────────────────────────────────
# A user's pages
# ─────────────────────────────────────────────────────────────────────────────

def role_pages(role):
    """Pages of a role, straight from the table (admins: everything)."""
    from .models import RolePage
    if role == ADMIN:
        return set(PAGE_KEYS)
    return set(RolePage.objects.filter(role=role).values_list('page', flat=True)) - ADMIN_ONLY_PAGES


def _request_cache():
    """A place to remember answers for the length of the current request (None outside a request)."""
    from apps.audit.middleware import get_current_request
    request = get_current_request()
    if request is None:
        return None
    if not hasattr(request, '_page_access'):
        request._page_access = {}
    return request._page_access


def pages_for(user):
    """The pages this user may open. Read from the tables once per request, so a change applies to the next one."""
    if not user or not user.is_authenticated:
        return set()
    cache = _request_cache()
    if cache is not None and user.pk in cache:
        return cache[user.pk]
    role = get_role(user)
    if role == ADMIN:
        pages = set(PAGE_KEYS)
    elif role not in ALL_ROLES:
        pages = set()
    else:
        pages = role_pages(role)
        for page, allowed in user.page_overrides.values_list('page', 'allowed'):
            if page in ADMIN_ONLY_PAGES or page not in PAGE_KEYS:
                continue
            pages.add(page) if allowed else pages.discard(page)
    if cache is not None:
        cache[user.pk] = pages
    return pages


def forget(user):
    """Drop the remembered pages of a user whose access was just changed in this request."""
    cache = _request_cache()
    if cache is not None:
        cache.pop(user.pk, None)


def has_page(user, *pages):
    """True when the user has at least one of these pages."""
    return bool(pages_for(user) & set(pages))


def roles_with(*pages):
    """Roles (besides admin) whose own pages include one of these."""
    from .models import RolePage
    return set(RolePage.objects.filter(page__in=pages).values_list('role', flat=True)) - {ADMIN}


# ─────────────────────────────────────────────────────────────────────────────
# The API gate
# ─────────────────────────────────────────────────────────────────────────────

def api_of(path):
    """'/api/v1/sales/orders/5/' -> ('sales', 'sales/orders/5'). None for anything that isn't a module API."""
    parts = [p for p in path.split('/') if p]
    if not parts or parts[0] != 'api':
        return None, ''
    parts = parts[1:]
    if parts and parts[0] == 'v1':
        parts = parts[1:]
    if not parts or parts[0] in ('health', 'docs', 'schema'):
        return None, ''
    return parts[0], '/'.join(parts)


def check_api_access(request):
    """Refuse a request to a module the user has no page for. Runs before the view's own permissions."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return                       # not signed in: the view's own rules answer (401, or a public endpoint)
    api, rest = api_of(request.path)
    if api is None:
        return
    read = request.method in SAFE_METHODS
    if rest.startswith(OPEN_ANY) or (read and rest.startswith(OPEN_READS) and not rest.startswith(NOT_OPEN)):
        return
    if not has_page(user, *pages_using(api, rest, read)):
        raise PermissionDenied('You do not have access to this part of the system. Ask an admin if you need it.')


# ─────────────────────────────────────────────────────────────────────────────
# Managing access
# ─────────────────────────────────────────────────────────────────────────────

def catalogue():
    return [{'key': key, 'title': title, 'group': group, 'admin_only': locked} for key, title, group, locked in PAGES]


def matrix():
    """{role: [pages]} for every role, admin included (always everything)."""
    return {role: sorted(role_pages(role), key=PAGE_KEYS.index) for role in ROLES}


def set_role_pages(role, pages):
    """Replace a role's pages. Returns (added, removed)."""
    from .models import RolePage
    wanted = set(pages)
    current = set(RolePage.objects.filter(role=role).values_list('page', flat=True))
    added, removed = wanted - current, current - wanted
    RolePage.objects.filter(role=role, page__in=removed).delete()
    RolePage.objects.bulk_create([RolePage(role=role, page=page) for page in added])
    return sorted(added), sorted(removed)


def user_access(user):
    """A user's role pages, personal exceptions and the result."""
    overrides = {} if get_role(user) == ADMIN else {
        page: allowed for page, allowed in user.page_overrides.values_list('page', 'allowed')
        if page in PAGE_KEYS and page not in ADMIN_ONLY_PAGES
    }
    forget(user)
    return {
        'user': user.pk, 'username': user.username, 'role': get_role(user),
        'role_pages': sorted(role_pages(get_role(user)), key=PAGE_KEYS.index),
        'overrides': overrides,
        'pages': sorted(pages_for(user), key=PAGE_KEYS.index),
    }


def set_user_overrides(user, overrides):
    """Replace a user's exceptions with {page: True|False}. Returns the changes as {page: {'old', 'new'}}."""
    from .models import UserPageOverride
    current = dict(user.page_overrides.values_list('page', 'allowed'))
    changes = {page: {'old': current.get(page), 'new': overrides.get(page)}
               for page in set(current) | set(overrides) if current.get(page) != overrides.get(page)}
    user.page_overrides.all().delete()
    UserPageOverride.objects.bulk_create([UserPageOverride(user=user, page=p, allowed=a) for p, a in overrides.items()])
    forget(user)
    return changes
