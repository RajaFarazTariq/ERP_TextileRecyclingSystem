from rest_framework.test import APITestCase

from .models import CustomUser


class RoleAssignmentTests(APITestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            username='admin_user', password='Pass@12345', role='admin'
        )
        self.client.force_authenticate(self.admin)

    def test_register_without_role_is_rejected(self):
        res = self.client.post('/api/users/register/', {
            'username': 'no_role', 'password': 'Pass@12345',
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('role', res.data)
        self.assertFalse(CustomUser.objects.filter(username='no_role').exists())

    def test_register_with_role_keeps_that_role(self):
        res = self.client.post('/api/users/register/', {
            'username': 'sorter', 'password': 'Pass@12345', 'role': 'sorting_supervisor',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(CustomUser.objects.get(username='sorter').role, 'sorting_supervisor')

    def test_superuser_gets_admin_role(self):
        su = CustomUser.objects.create_superuser('root', 'root@example.com', 'Pass@12345')
        self.assertEqual(su.role, 'admin')


class LoginTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()   # login is rate limited per client
        self.user = CustomUser.objects.create_user(
            username='Sorter', email='sorter@example.com', password='Pass@12345',
            role='sorting_supervisor',
        )

    def login(self, identifier, password='Pass@12345'):
        return self.client.post('/api/users/login/', {'username': identifier, 'password': password})

    def test_login_by_username_or_email_case_insensitive(self):
        for identifier in ('Sorter', 'sorter', 'SORTER@example.com'):
            with self.subTest(identifier=identifier):
                res = self.login(identifier)
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res.data['user']['role'], 'sorting_supervisor')
                self.assertIn('access', res.data['token'])
                self.assertIn('refresh', res.data['token'])

    def test_login_records_last_login(self):
        self.login('Sorter')
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_bad_credentials_and_inactive_user(self):
        self.assertEqual(self.login('Sorter', 'wrong').status_code, 400)
        self.assertEqual(self.login('nobody').status_code, 400)
        self.assertEqual(self.client.post('/api/users/login/', {}).status_code, 400)
        self.user.is_active = False
        self.user.save()
        res = self.login('Sorter')
        self.assertEqual(res.status_code, 400)
        self.assertIn('inactive', str(res.data))

    def test_access_token_authenticates_requests(self):
        token = self.login('Sorter').data['token']['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(self.client.get('/api/sorting/sessions/').status_code, 200)


class UserManagementTests(APITestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(username='boss', password='Pass@12345', role='admin')
        self.other = CustomUser.objects.create_user(username='w1', password='Pass@12345',
                                                    role='warehouse_supervisor')

    def test_toggle_active_is_admin_only(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'/api/users/toggle-active/{self.admin.id}/').status_code, 403)
        self.client.force_authenticate(self.admin)
        res = self.client.post(f'/api/users/toggle-active/{self.other.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_active'])
        self.assertEqual(self.client.post('/api/users/toggle-active/99999/').status_code, 404)

    def test_update_and_delete_are_admin_only(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/users/detail/{self.admin.id}/').status_code, 200)
        self.assertEqual(self.client.patch(f'/api/users/detail/{self.admin.id}/', {'email': 'x@y.z'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/users/detail/{self.admin.id}/').status_code, 403)
        self.client.force_authenticate(self.admin)
        res = self.client.patch(f'/api/users/detail/{self.other.id}/', {'role': 'sorting_supervisor'})
        self.assertEqual(res.status_code, 200)
        self.other.refresh_from_db()
        self.assertEqual(self.other.role, 'sorting_supervisor')

    def test_user_list_never_exposes_passwords(self):
        self.client.force_authenticate(self.other)
        res = self.client.get('/api/users/list/')
        self.assertEqual(len(res.data), 2)
        self.assertNotIn('password', res.data[0])


# ─────────────────────────────────────────────────────────────────────────────
# Phase 2: password changes, login monitoring, rate limit, token lifecycle
# ─────────────────────────────────────────────────────────────────────────────
from django.core.cache import cache
from django.test import override_settings

from apps.audit.models import AuditLog


class PasswordChangeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = CustomUser.objects.create_user(username='boss', password='Pass@12345', role='admin')
        self.user = CustomUser.objects.create_user(username='w1', password='Pass@12345',
                                                   role='warehouse_supervisor')
        self.client.force_authenticate(self.admin)

    def test_admin_can_change_a_password(self):
        res = self.client.put(f'/api/users/detail/{self.user.id}/', {
            'username': 'w1', 'role': 'warehouse_supervisor', 'password': 'Brand-New-Pass-42',
        })
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Brand-New-Pass-42'))
        log = AuditLog.objects.get(model_name='CustomUser', action='UPDATE')
        self.assertEqual(log.changes['password'], {'old': '***', 'new': '***'})

    def test_blank_password_keeps_the_current_one(self):
        self.client.put(f'/api/users/detail/{self.user.id}/', {'username': 'w1', 'password': ''})
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Pass@12345'))

    def test_weak_passwords_are_rejected(self):
        res = self.client.put(f'/api/users/detail/{self.user.id}/', {'password': '123'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('password', res.data)
        res = self.client.post('/api/users/register/', {
            'username': 'n', 'password': 'password', 'role': 'drying_supervisor'})
        self.assertEqual(res.status_code, 400)


class LoginMonitoringTests(APITestCase):
    def setUp(self):
        cache.clear()
        CustomUser.objects.create_user(username='w1', password='Pass@12345', role='warehouse_supervisor')

    def test_logins_are_recorded(self):
        self.client.post('/api/users/login/', {'username': 'w1', 'password': 'wrong'})
        self.client.post('/api/users/login/', {'username': 'ghost', 'password': 'x'})
        self.client.post('/api/users/login/', {'username': 'w1', 'password': 'Pass@12345'})
        failed = AuditLog.objects.filter(action='LOGIN_FAILED').order_by('timestamp')
        self.assertEqual([l.username for l in failed], ['w1', 'ghost'])
        self.assertIsNotNone(failed[0].user)       # account exists
        self.assertIsNone(failed[1].user)          # unknown account
        self.assertEqual(AuditLog.objects.filter(action='LOGIN').count(), 1)

    def test_login_is_rate_limited(self):
        codes = [self.client.post('/api/users/login/', {'username': 'w1', 'password': 'wrong'}).status_code
                 for _ in range(11)]
        self.assertEqual(codes[:10], [400] * 10)
        self.assertEqual(codes[10], 429)


class TokenLifecycleTests(APITestCase):
    def setUp(self):
        cache.clear()
        CustomUser.objects.create_user(username='w1', password='Pass@12345', role='warehouse_supervisor')
        self.tokens = self.client.post('/api/users/login/', {'username': 'w1', 'password': 'Pass@12345'}).data['token']

    def refresh(self, token):
        return self.client.post('/api/users/token/refresh/', {'refresh': token})

    def test_refresh_rotates_and_old_token_stops_working(self):
        res = self.refresh(self.tokens['refresh'])
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertNotEqual(res.data['refresh'], self.tokens['refresh'])
        self.assertEqual(self.refresh(self.tokens['refresh']).status_code, 401)   # blacklisted
        self.assertEqual(self.refresh(res.data['refresh']).status_code, 200)

    def test_logout_revokes_refresh_token(self):
        res = self.client.post('/api/users/logout/', {'refresh': self.tokens['refresh']})
        self.assertEqual(res.status_code, 205)
        self.assertEqual(self.refresh(self.tokens['refresh']).status_code, 401)
        # logging out twice, or with junk, is harmless
        self.assertEqual(self.client.post('/api/users/logout/', {'refresh': 'junk'}).status_code, 205)


class SelfLockoutTests(APITestCase):
    def test_admin_cannot_deactivate_or_delete_themselves(self):
        admin = CustomUser.objects.create_user(username='only_admin', password='Pass@12345', role='admin')
        self.client.force_authenticate(admin)
        res = self.client.post(f'/api/users/toggle-active/{admin.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.delete(f'/api/users/detail/{admin.id}/').status_code, 400)
        # nor through the edit endpoint
        self.assertEqual(self.client.patch(f'/api/users/detail/{admin.id}/', {'is_active': False}).status_code, 400)
        self.assertEqual(self.client.patch(f'/api/users/detail/{admin.id}/', {'role': 'drying_supervisor'}).status_code, 400)
        self.assertEqual(self.client.patch(f'/api/users/detail/{admin.id}/', {'email': 'me@example.com'}).status_code, 200)
        admin.refresh_from_db()
        self.assertTrue(admin.is_active)
        self.assertEqual(admin.role, 'admin')
