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
