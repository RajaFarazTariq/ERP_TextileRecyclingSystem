from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.core.testing import client_for, make_chemical, make_fabric, make_tank, make_user
from apps.sales.models import Customer
from apps.users.models import CustomUser
from . import services
from .models import RolePage, UserPageOverride

SUPERVISORS = services.SUPERVISORS


def pages_of(user):
    return services.pages_for(user)


class DefaultAccessTests(TestCase):
    """After the migration every role has exactly the pages it had while access was fixed in code."""

    def test_roles_start_with_their_old_pages(self):
        shared = {'quality', 'maintenance', 'sustainability', 'documents', 'traceability'}
        expected = {
            'warehouse_supervisor': shared | {'warehouse', 'procurement'},
            'sorting_supervisor': shared | {'sorting', 'production'},
            'decolorization_supervisor': shared | {'decolorization', 'production'},
            'drying_supervisor': shared | {'drying', 'production'},
        }
        for role, pages in expected.items():
            self.assertEqual(pages_of(make_user(role)), pages, role)
        self.assertEqual(pages_of(make_user('admin')), set(services.PAGE_KEYS))

    def test_every_api_has_a_page_that_reads_it(self):
        from config.urls import api_patterns
        mounted = {str(p.pattern).strip('/') for p in api_patterns if str(p.pattern)} | {'audit'}
        self.assertEqual(mounted - set(services.READERS), set())

    def test_user_without_a_known_role_has_nothing(self):
        user = CustomUser.objects.create_user(username='norole', password='x', role='')
        self.assertEqual(pages_of(user), set())
        self.assertEqual(client_for(user).get('/api/quality/inspections/').status_code, 403)


class ApiGateTests(TestCase):
    """The API follows the pages: reading and changing a module both need a page that uses it."""

    def setUp(self):
        self.admin = make_user('admin')
        self.warehouse = make_user('warehouse_supervisor')
        self.sorting = make_user('sorting_supervisor')

    def test_modules_without_a_page_are_refused(self):
        client = client_for(self.sorting)
        for path in ('sales/orders/', 'finance/accounts/', 'workforce/employees/', 'procurement/orders/',
                     'inventory/movements/', 'reports/catalogue/', 'access/matrix/'):
            self.assertEqual(client.get(f'/api/{path}').status_code, 403, path)

    def test_modules_behind_a_page_are_readable(self):
        client = client_for(self.sorting)
        for path in ('sorting/fabric-stock/', 'warehouse/stock/', 'quality/inspections/', 'production/orders/',
                     'maintenance/machines/', 'sustainability/waste-records/', 'documents/documents/'):
            self.assertEqual(client.get(f'/api/{path}').status_code, 200, path)

    def test_reading_a_module_does_not_allow_changing_it(self):
        # The Sorting page reads deliveries; changing them belongs to the Warehouse page
        res = client_for(self.sorting).post('/api/warehouse/vendors/', {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, 403)
        res = client_for(self.warehouse).post('/api/warehouse/vendors/', {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_open_endpoints_need_no_page(self):
        user = make_user('sorting_supervisor')
        RolePage.objects.filter(role='sorting_supervisor').delete()
        client = client_for(user)
        self.assertEqual(pages_of(user), set())
        for path in ('users/list/', 'access/me/', 'alerts/notifications/', 'search/?q=cot'):
            self.assertEqual(client.get(f'/api/{path}').status_code, 200, path)
        self.assertEqual(client.get('/api/search/trace/?lot=1').status_code, 403)
        self.assertEqual(client.get('/api/quality/inspections/').status_code, 403)

    def test_both_url_prefixes_are_guarded(self):
        client = client_for(self.sorting)
        self.assertEqual(client.get('/api/v1/sales/orders/').status_code, 403)
        self.assertEqual(client.get('/api/v1/sorting/sessions/').status_code, 200)

    def test_health_check_and_login_stay_public(self):
        self.assertEqual(APIClient().get('/api/health/').status_code, 200)
        self.assertEqual(APIClient().post('/api/users/login/', {}, format='json').status_code, 400)

    def test_login_answers_with_the_pages_and_tokens_are_checked_too(self):
        user = CustomUser.objects.create_user(username='real', password='Str0ng!pass9', role='drying_supervisor')
        res = APIClient().post('/api/users/login/', {'username': 'real', 'password': 'Str0ng!pass9'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(set(res.data['user']['pages']), pages_of(user))
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['token']['access']}")
        self.assertEqual(client.get('/api/v1/drying/dryers/').status_code, 200)
        self.assertEqual(client.get('/api/v1/sales/orders/').status_code, 403)
        self.assertEqual(set(client.get('/api/v1/access/me/').data['pages']), pages_of(user))


class GrantAndRevokeTests(TestCase):
    """Giving a page makes its module work for that role or person; taking it away closes it."""

    def setUp(self):
        self.admin = client_for(make_user('admin'))
        self.user = make_user('warehouse_supervisor')
        self.client = client_for(self.user)

    def set_role(self, role, pages):
        matrix = self.admin.get('/api/access/matrix/').data['matrix']
        matrix[role] = pages
        return self.admin.put('/api/access/matrix/', {'roles': matrix}, format='json')

    def override(self, user, **pages):
        return self.admin.put(f'/api/access/users/{user.id}/', {'overrides': pages}, format='json')

    def test_page_given_to_a_role_opens_its_module(self):
        self.assertEqual(self.client.get('/api/finance/accounts/').status_code, 403)
        current = sorted(pages_of(self.user))
        res = self.set_role('warehouse_supervisor', current + ['finance', 'sales'])
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.client.get('/api/finance/accounts/').status_code, 200)
        # not just reading: the module is theirs to use
        res = self.client.post('/api/finance/tax-rates/', {'name': 'GST', 'rate': '18'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        res = self.client.post('/api/sales/customers/', {'name': 'New Buyer'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_page_taken_from_a_role_closes_its_module(self):
        self.assertEqual(self.client.get('/api/quality/inspections/').status_code, 200)
        self.set_role('warehouse_supervisor', sorted(pages_of(self.user) - {'quality'}))
        self.assertEqual(self.client.get('/api/quality/inspections/').status_code, 403)
        self.assertEqual(self.client.post('/api/quality/standards/', {}, format='json').status_code, 403)
        # the warehouse page still works
        self.assertEqual(self.client.get('/api/warehouse/stock/').status_code, 200)

    def test_one_person_can_be_given_or_denied_a_page(self):
        other = make_user('warehouse_supervisor')
        res = self.override(self.user, workforce=True, procurement=False)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['overrides'], {'workforce': True, 'procurement': False})
        self.assertIn('workforce', res.data['pages'])
        self.assertNotIn('procurement', res.data['pages'])
        self.assertEqual(self.client.get('/api/workforce/employees/').status_code, 200)
        self.assertEqual(self.client.post('/api/workforce/departments/', {'name': 'Stores'}, format='json').status_code, 201)
        self.assertEqual(self.client.get('/api/procurement/requisitions/').status_code, 403)
        # the Warehouse page still gets the one list it needs from Purchasing
        self.assertEqual(self.client.get('/api/procurement/open-lines/').status_code, 200)
        # only this person: a colleague with the same role is unchanged
        colleague = client_for(other)
        self.assertEqual(colleague.get('/api/workforce/employees/').status_code, 403)
        self.assertEqual(colleague.get('/api/procurement/requisitions/').status_code, 200)

    def test_exceptions_that_repeat_the_role_are_not_kept(self):
        res = self.override(self.user, warehouse=True, sales=False)
        self.assertEqual(res.data['overrides'], {})
        self.assertFalse(UserPageOverride.objects.exists())

    def test_clearing_exceptions_returns_to_the_role(self):
        self.override(self.user, finance=True)
        self.assertEqual(self.client.get('/api/finance/accounts/').status_code, 200)
        self.override(self.user)
        self.assertEqual(self.client.get('/api/finance/accounts/').status_code, 403)

    def test_business_rules_stay_with_admins(self):
        """A page lets someone use the module; it doesn't make them the approver."""
        current = sorted(pages_of(self.user))
        self.set_role('warehouse_supervisor', current + ['sales', 'approvals'])
        order_fabric = make_fabric()
        customer = Customer.objects.create(name='Buyer')
        order = self.client.post('/api/sales/orders/', {
            'customer': customer.id, 'fabric': order_fabric.id, 'fabric_quality': 'A',
            'weight_sold': '10', 'price_per_kg': '50'}, format='json')
        self.assertEqual(order.status_code, 201, order.data)
        ret = self.admin.post('/api/sales/returns/', {
            'order': order.data['id'], 'return_date': '2026-10-02', 'reason': 'x', 'weight': '1'}, format='json')
        self.assertEqual(ret.status_code, 400)                       # nothing dispatched: the sales rule still applies
        self.assertEqual(self.client.get('/api/alerts/approvals/').status_code, 200)
        self.assertEqual(self.client.get('/api/workforce/employees/').status_code, 403)   # the inbox opens no other module
        # approving a purchase request is still an admin's decision
        req = self.client.post('/api/procurement/requisitions/', {
            'lines': [{'material': 'Cotton', 'quantity_kg': '100'}]}, format='json')
        self.assertEqual(req.status_code, 201, req.data)
        self.client.post(f"/api/procurement/requisitions/{req.data['id']}/submit/")
        self.assertEqual(self.client.post(f"/api/procurement/requisitions/{req.data['id']}/approve/").status_code, 403)
        self.assertEqual(self.admin.post(f"/api/procurement/requisitions/{req.data['id']}/approve/").status_code, 200)
        # and the notification rules stay an admin setting
        self.assertEqual(self.client.get('/api/alerts/rules/').status_code, 403)

    def test_restricted_chemical_still_needs_an_admin(self):
        user = make_user('sorting_supervisor')
        self.override(user, decolorization=True)
        chemical = make_chemical(total='100', is_restricted=True)
        body = {'chemical': chemical.id, 'tank': make_tank().id, 'quantity': '1'}
        self.assertEqual(client_for(user).post('/api/decolorization/issuances/', body, format='json').status_code, 403)
        chemical.is_restricted = False
        chemical.save()
        self.assertEqual(client_for(user).post('/api/decolorization/issuances/', body, format='json').status_code, 201)

    def test_search_and_trace_follow_the_pages(self):
        Customer.objects.create(name='Zenith Mills')
        find = lambda: [g['type'] for g in self.client.get('/api/search/?q=zenith').data['groups']]   # noqa: E731
        self.assertEqual(find(), [])
        self.override(self.user, sales=True)
        self.assertEqual(find(), ['customers'])
        lot = make_fabric()
        trace = self.client.get(f'/api/search/trace/?lot={lot.id}').data
        self.assertNotEqual(trace['sales'], {'restricted': True})
        self.assertEqual(trace['drying'], {'restricted': True})
        self.override(self.user, traceability=False)
        self.assertEqual(self.client.get(f'/api/search/trace/?lot={lot.id}').status_code, 403)

    def test_notifications_follow_the_pages(self):
        make_chemical(total='1000', remaining='10')
        low = lambda client: [i for i in client.get('/api/alerts/notifications/').data if i['rule'] == 'chemical-low']   # noqa: E731
        decolor = make_user('decolorization_supervisor')
        self.assertEqual(len(low(client_for(decolor))), 1)
        self.override(decolor, decolorization=False)
        self.assertEqual(low(client_for(decolor)), [])


class SafeguardTests(TestCase):
    def setUp(self):
        self.admin_user = make_user('admin')
        self.admin = client_for(self.admin_user)
        self.user = make_user('sorting_supervisor')

    def test_only_admins_manage_access(self):
        client = client_for(self.user)
        self.assertEqual(client.get('/api/access/matrix/').status_code, 403)
        self.assertEqual(client.put('/api/access/matrix/', {'roles': {}}, format='json').status_code, 403)
        self.assertEqual(client.put(f'/api/access/users/{self.user.id}/', {'overrides': {'finance': True}}, format='json').status_code, 403)
        self.assertEqual(client.get('/api/access/me/').status_code, 200)

    def test_users_page_cannot_be_given_away(self):
        res = self.admin.put('/api/access/matrix/', {'roles': {'sorting_supervisor': ['users']}}, format='json')
        self.assertEqual(res.status_code, 400)
        res = self.admin.put(f'/api/access/users/{self.user.id}/', {'overrides': {'users': True}}, format='json')
        self.assertEqual(res.status_code, 400)
        # even a row put in the tables by hand gives nothing
        RolePage.objects.create(role='sorting_supervisor', page='users')
        UserPageOverride.objects.create(user=self.user, page='users', allowed=True)
        self.assertNotIn('users', pages_of(self.user))
        self.assertEqual(client_for(self.user).get('/api/access/matrix/').status_code, 403)

    def test_admins_always_keep_every_page(self):
        res = self.admin.put('/api/access/matrix/', {'roles': {'admin': []}}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['matrix']['admin'], services.PAGE_KEYS)
        res = self.admin.put(f'/api/access/users/{self.admin_user.id}/', {'overrides': {'finance': False}}, format='json')
        self.assertEqual(res.status_code, 400)
        UserPageOverride.objects.create(user=self.admin_user, page='finance', allowed=False)
        self.assertEqual(pages_of(self.admin_user), set(services.PAGE_KEYS))

    def test_bad_input_is_refused_and_changes_nothing(self):
        before = self.admin.get('/api/access/matrix/').data['matrix']
        for body in ({'roles': 'x'}, {'roles': {'manager': []}}, {'roles': {'sorting_supervisor': ['nowhere']}},
                     {'roles': {'sorting_supervisor': 'sorting'}}):
            self.assertEqual(self.admin.put('/api/access/matrix/', body, format='json').status_code, 400, body)
        for body in ({'overrides': []}, {'overrides': {'nowhere': True}}, {'overrides': {'finance': 'yes'}}):
            self.assertEqual(self.admin.put(f'/api/access/users/{self.user.id}/', body, format='json').status_code, 400, body)
        self.assertEqual(self.admin.get('/api/access/matrix/').data['matrix'], before)

    def test_last_active_admin_cannot_be_removed(self):
        other = make_user('admin')
        other_client = client_for(other)
        # with two admins, one can be demoted by the other
        res = other_client.patch(f'/api/users/detail/{self.admin_user.id}/', {'role': 'sorting_supervisor'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        # now `other` is the only admin left: they can't be demoted, deactivated or deleted
        second = make_user('admin')
        CustomUser.objects.filter(pk=second.pk).update(is_active=False)      # an inactive admin doesn't count
        helper = client_for(second)
        for call in (lambda: helper.patch(f'/api/users/detail/{other.id}/', {'role': 'drying_supervisor'}, format='json'),
                     lambda: helper.patch(f'/api/users/detail/{other.id}/', {'is_active': False}, format='json'),
                     lambda: helper.post(f'/api/users/toggle-active/{other.id}/'),
                     lambda: helper.delete(f'/api/users/detail/{other.id}/')):
            self.assertEqual(call().status_code, 400)
        other.refresh_from_db()
        self.assertEqual((other.role, other.is_active), ('admin', True))

    def test_changes_are_written_to_the_audit_log(self):
        self.admin.put('/api/access/matrix/', {'roles': {'sorting_supervisor': ['sorting', 'finance']}}, format='json')
        entry = AuditLog.objects.filter(model_name='RolePage').latest('id')
        self.assertEqual(entry.username, self.admin_user.username)
        self.assertIn('finance', entry.changes['added'])
        self.assertIn('quality', entry.changes['removed'])
        self.admin.put(f'/api/access/users/{self.user.id}/', {'overrides': {'sales': True}}, format='json')
        entry = AuditLog.objects.filter(model_name='CustomUser', object_id=str(self.user.id)).latest('id')
        self.assertEqual(entry.changes['page:sales'], {'old': None, 'new': True})
        # saving the same thing again writes nothing
        count = AuditLog.objects.count()
        self.admin.put(f'/api/access/users/{self.user.id}/', {'overrides': {'sales': True}}, format='json')
        self.admin.put('/api/access/matrix/', {'roles': {'sorting_supervisor': ['sorting', 'finance']}}, format='json')
        self.assertEqual(AuditLog.objects.count(), count)

    def test_matrix_lists_pages_roles_and_original_access(self):
        data = self.admin.get('/api/access/matrix/').data
        self.assertEqual([p['key'] for p in data['pages']], services.PAGE_KEYS)
        self.assertEqual([r['key'] for r in data['roles']], services.ROLES)
        self.assertEqual({p['key'] for p in data['pages'] if p['admin_only']}, {'users'})
        self.assertEqual(set(data['defaults']['drying_supervisor']), set(data['matrix']['drying_supervisor']))
