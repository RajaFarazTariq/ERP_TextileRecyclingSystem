"""
Page access: who may open which page, how far, and what that means for the API.

  A page is held at a level: "view" (look only) or "full" (look and change).
  a user's level for a page = their own exception for it, if they have one,
                              otherwise their role's level
  An admin has every page in full. That can't be changed, so there is always
  someone who can reach everything, including the Users page where access is
  managed.

The API follows the pages. Every request to a module's API needs a page that
uses that module: to read it, one of READERS at any level; to change it, one
of WRITERS in full.
`check_api_access` runs before each view's own permission checks, so those
(for example "only an admin approves") still apply on top.
"""
from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import get_role

ADMIN = 'admin'
# The roles the system started with. Their keys are used by the default access
# below; admins can add more roles under Users -> Access.
SYSTEM_ROLES = ['admin', 'warehouse_supervisor', 'sorting_supervisor', 'decolorization_supervisor', 'drying_supervisor']
SUPERVISORS = SYSTEM_ROLES[1:]

# Things a role may be trusted to do beyond opening a page. An admin carries
# every duty. key: (title, what it allows, the page it is done on)
DUTIES = {
    'approve_purchases': ('Approve purchases', 'Approve or reject purchase requests and orders, and close orders.', 'procurement'),
    'pay_suppliers': ('Record supplier payments', 'Record, change and delete payments to suppliers.', 'procurement'),
    'inspect_incoming': ('Inspect incoming material', 'Record quality inspections of deliveries.', 'quality'),
    'inspect_in_process': ('Inspect in-process material', 'Record quality inspections of lots being processed.', 'quality'),
    'inspect_finished': ('Inspect finished goods', 'Record quality inspections of finished lots.', 'quality'),
    'release_quarantine': ('Release quarantine', 'Release failed material, and change a failed inspection.', 'quality'),
    'plan_production': ('Plan production', 'Create, change, release and cancel production orders, and maintain stages, routings and bills of materials.', 'production'),
    'run_production': ('Run production stages', 'Start and complete the stages of a production order and record materials used.', 'production'),
    'approve_batches': ('Approve decolorization batches', 'Sign off a completed decolorization batch.', 'decolorization'),
    'issue_restricted_chemicals': ('Issue restricted chemicals', 'Issue chemicals marked as restricted.', 'decolorization'),
    'approve_sales_returns': ('Approve sales returns', 'Approve or reject goods returned by customers.', 'sales'),
    'adjust_stock': ('Adjust stock', 'Correct sellable stock by hand, with a reason.', 'sales'),
    'manage_maintenance': ('Manage maintenance', 'Register machines, plan preventive work, manage spare parts, and assign or cancel work orders.', 'maintenance'),
}
DUTY_KEYS = list(DUTIES)
DEFAULT_ROLE_DUTIES = {
    'warehouse_supervisor': {'inspect_incoming'},
    'sorting_supervisor': {'inspect_in_process', 'run_production'},
    'decolorization_supervisor': {'inspect_in_process', 'run_production'},
    'drying_supervisor': {'inspect_in_process', 'inspect_finished', 'run_production'},
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
VIEW, FULL, NONE = 'view', 'full', 'none'
LEVELS = (VIEW, FULL)
ADMIN_ONLY_PAGES = {key for key, _, _, locked in PAGES if locked}

# The access each role had before it became configurable (the web app's old ROUTE_ROLES table)
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
    # The machine form links a machine to a tank or a dryer: those two lists, not the sessions
    'maintenance': {'read': {'maintenance', 'decolorization', 'drying/dryers'}, 'write': {'maintenance'}},
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
OPEN_READS = ('users/list', 'users/detail', 'access/me', 'access/role-names', 'alerts/notifications', 'search', 'audit/logs')
NOT_OPEN = ('search/trace',)      # following a lot is the Traceability page
OPEN_ANY = ('users/login', 'users/logout', 'users/token')


# ─────────────────────────────────────────────────────────────────────────────
# A user's pages
# ─────────────────────────────────────────────────────────────────────────────

def _request_cache():
    """A place to remember answers for the length of the current request (None outside a request)."""
    from apps.audit.middleware import get_current_request
    request = get_current_request()
    if request is None:
        return None
    if not hasattr(request, '_page_access'):
        request._page_access = {}
    return request._page_access


def _remember(key, compute):
    cache = _request_cache()
    if cache is None:
        return compute()
    if key not in cache:
        cache[key] = compute()
    return cache[key]


def roles():
    """[(key, name)] of every role, built-in first."""
    from .models import Role
    return _remember('roles', lambda: list(Role.objects.values_list('key', 'name')))


def role_keys():
    return [key for key, _ in roles()]


def role_label(key):
    return dict(roles()).get(key, (key or '').replace('_', ' ').title())


def forget_roles():
    cache = _request_cache()
    if cache is not None:
        cache.pop('roles', None)
        for key in [k for k in cache if isinstance(k, tuple)]:
            cache.pop(key, None)


def role_duties(role):
    """Duties of a role, straight from the table (admins: every duty)."""
    from .models import RoleDuty
    if role == ADMIN:
        return set(DUTY_KEYS)
    return _remember(('duties', role), lambda: set(
        RoleDuty.objects.filter(role=role, duty__in=DUTY_KEYS).values_list('duty', flat=True)))


def duties_for(user):
    if not user or not user.is_authenticated:
        return set()
    return role_duties(get_role(user))


def has_duty(user, *duties):
    """True when the user's role carries at least one of these duties. Admins carry all of them."""
    return bool(duties_for(user) & set(duties))


def role_levels(role):
    """{page: level} of a role, straight from the table (admins: everything in full)."""
    from .models import RolePage
    if role == ADMIN:
        return {page: FULL for page in PAGE_KEYS}
    return {page: level for page, level in RolePage.objects.filter(role=role).values_list('page', 'level')
            if page in PAGE_KEYS and page not in ADMIN_ONLY_PAGES and level in LEVELS}


def role_pages(role):
    return set(role_levels(role))


def levels_for(user):
    """{page: 'view' | 'full'} for this user. Read once per request, so a change applies to the next one."""
    if not user or not user.is_authenticated:
        return {}
    cache = _request_cache()
    if cache is not None and user.pk in cache:
        return cache[user.pk]
    role = get_role(user)
    if role == ADMIN:
        levels = {page: FULL for page in PAGE_KEYS}
    elif role not in role_keys():
        levels = {}
    else:
        levels = role_levels(role)
        for page, level in user.page_overrides.values_list('page', 'level'):
            if page in ADMIN_ONLY_PAGES or page not in PAGE_KEYS:
                continue
            if level in LEVELS:
                levels[page] = level
            else:
                levels.pop(page, None)
    if cache is not None:
        cache[user.pk] = levels
    return levels


def pages_for(user):
    """The pages this user may open, at any level."""
    return set(levels_for(user))


def forget(user):
    """Drop the remembered access of a user whose access was just changed in this request."""
    cache = _request_cache()
    if cache is not None:
        cache.pop(user.pk, None)


def has_page(user, *pages):
    """True when the user may open at least one of these pages (view or full)."""
    return bool(pages_for(user) & set(pages))


def can_edit(user, *pages):
    """True when the user has at least one of these pages in full."""
    levels = levels_for(user)
    return any(levels.get(page) == FULL for page in pages)


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
    pages = pages_using(api, rest, read)
    if read and has_page(user, *pages):
        return
    if not read and can_edit(user, *pages):
        return
    if not read and has_page(user, *pages):
        raise PermissionDenied('You have view-only access here, so you can look but not change anything.')
    raise PermissionDenied('You do not have access to this part of the system. Ask an admin if you need it.')


# ─────────────────────────────────────────────────────────────────────────────
# Managing access
# ─────────────────────────────────────────────────────────────────────────────

def catalogue():
    return [{'key': key, 'title': title, 'group': group, 'admin_only': locked,
             # A page that changes nothing has no "full" beyond viewing
             'read_only': not PAGE_API[key].get('write')}
            for key, title, group, locked in PAGES]


def _ordered(levels):
    return {page: levels[page] for page in PAGE_KEYS if page in levels}


def matrix():
    """{role: {page: level}} for every role, admin included (always everything in full)."""
    return {role: _ordered(role_levels(role)) for role in role_keys()}


def duty_catalogue():
    return [{'key': key, 'title': title, 'description': text, 'page': page} for key, (title, text, page) in DUTIES.items()]


def duty_matrix():
    """{role: [duties]} for every role, admin included (always every duty)."""
    return {role: [d for d in DUTY_KEYS if d in role_duties(role)] for role in role_keys()}


def set_role_duties(role, duties):
    """Replace a role's duties. Returns (added, removed)."""
    from .models import RoleDuty
    wanted = set(duties)
    current = set(RoleDuty.objects.filter(role=role).values_list('duty', flat=True))
    added, removed = wanted - current, current - wanted
    RoleDuty.objects.filter(role=role, duty__in=removed).delete()
    RoleDuty.objects.bulk_create([RoleDuty(role=role, duty=duty) for duty in added])
    forget_roles()
    return sorted(added), sorted(removed)


def default_matrix():
    return {role: _ordered({page: FULL for page in pages}) for role, pages in DEFAULT_ROLE_PAGES.items()}


def set_role_levels(role, levels):
    """Replace a role's pages with {page: level}. Returns the changes as {page: {'old', 'new'}}."""
    from .models import RolePage
    current = dict(RolePage.objects.filter(role=role).values_list('page', 'level'))
    changes = {page: {'old': current.get(page, NONE), 'new': levels.get(page, NONE)}
               for page in set(current) | set(levels) if current.get(page) != levels.get(page)}
    if changes:
        forget_roles()
        RolePage.objects.filter(role=role).delete()
        RolePage.objects.bulk_create([RolePage(role=role, page=page, level=level) for page, level in levels.items()])
    return changes


def user_access(user):
    """A user's role levels, personal exceptions and the result."""
    overrides = {} if get_role(user) == ADMIN else {
        page: level for page, level in user.page_overrides.values_list('page', 'level')
        if page in PAGE_KEYS and page not in ADMIN_ONLY_PAGES
    }
    forget(user)
    levels = levels_for(user)
    return {
        'user': user.pk, 'username': user.username, 'role': get_role(user),
        'role_levels': _ordered(role_levels(get_role(user))),
        'overrides': _ordered(overrides),
        'levels': _ordered(levels),
        'pages': list(_ordered(levels)),
    }


def set_user_overrides(user, overrides):
    """Replace a user's exceptions with {page: 'none' | 'view' | 'full'}. Returns the changes as {page: {'old', 'new'}}."""
    from .models import UserPageOverride
    current = dict(user.page_overrides.values_list('page', 'level'))
    changes = {page: {'old': current.get(page), 'new': overrides.get(page)}
               for page in set(current) | set(overrides) if current.get(page) != overrides.get(page)}
    user.page_overrides.all().delete()
    UserPageOverride.objects.bulk_create([UserPageOverride(user=user, page=p, level=v) for p, v in overrides.items()])
    forget(user)
    return changes
