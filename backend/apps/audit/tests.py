from django.test import TestCase

from apps.core.testing import make_user, client_for
from apps.warehouse.models import Vendor
from .models import AuditLog


class AuditLogTests(TestCase):
    def setUp(self):
        self.user = make_user('warehouse_supervisor')
        self.client = client_for(self.user)

    def test_create_update_delete_are_logged(self):
        res = self.client.post('/api/warehouse/vendors/', {'name': 'V1'}, format='json')
        vid = res.data['id']
        self.client.patch(f'/api/warehouse/vendors/{vid}/', {'contact': '0300'}, format='json')
        self.client.delete(f'/api/warehouse/vendors/{vid}/')

        logs = AuditLog.objects.filter(model_name='Vendor', object_id=str(vid)).order_by('timestamp')
        self.assertEqual([l.action for l in logs], ['CREATE', 'UPDATE', 'DELETE'])
        self.assertTrue(all(l.username == self.user.username for l in logs))
        self.assertEqual(logs[1].changes, {'contact': {'old': None, 'new': '0300'}})
        self.assertFalse(Vendor.objects.filter(pk=vid).exists())

    def test_non_admin_sees_only_own_logs(self):
        other = make_user('sorting_supervisor')
        client_for(other).post('/api/sorting/fabric-stock/', {}, format='json')   # 400, nothing logged
        self.client.post('/api/warehouse/vendors/', {'name': 'Mine'}, format='json')
        client_for(make_user('admin')).post('/api/warehouse/vendors/', {'name': 'Admins'}, format='json')

        mine = self.client.get('/api/audit/logs/').data
        self.assertEqual(mine['count'], 1)
        self.assertEqual(mine['results'][0]['object_repr'], 'Mine')

        all_logs = client_for(make_user('admin')).get('/api/audit/logs/').data
        self.assertEqual(all_logs['count'], 2)

    def test_export(self):
        res = self.client.get('/api/audit/logs/export/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.content.startswith(b'PK'))
