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
