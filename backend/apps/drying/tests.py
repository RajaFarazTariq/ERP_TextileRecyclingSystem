from decimal import Decimal

from django.test import TestCase

from apps.core.testing import (
    make_user, client_for, make_fabric, make_dryer, make_drying_session, make_decolor_session,
)


class DryingTests(TestCase):
    def setUp(self):
        self.user = make_user('drying_supervisor')
        self.client = client_for(self.user)

    def test_session_lifecycle(self):
        fabric = make_fabric(status='Sent to Decolorization')
        dryer = make_dryer()
        session = make_drying_session(dryer=dryer, fabric=fabric, supervisor=self.user)
        self.assertEqual(session.status, 'Pending')

        res = self.client.post(f'/api/drying/sessions/{session.id}/start/')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db(); dryer.refresh_from_db()
        self.assertEqual(session.status, 'In Progress')
        self.assertEqual(dryer.status, 'Running')

        res = self.client.post(f'/api/drying/sessions/{session.id}/start/')
        self.assertEqual(res.status_code, 400)   # only Pending / On Hold can start

        res = self.client.post(f'/api/drying/sessions/{session.id}/complete/',
                               {'output_quantity': '88', 'waste_quantity': '2'}, format='json')
        self.assertEqual(res.status_code, 200)
        session.refresh_from_db(); dryer.refresh_from_db(); fabric.refresh_from_db()
        self.assertEqual(session.status, 'Completed')
        self.assertEqual(dryer.status, 'Cooling')
        self.assertEqual(fabric.status, 'Sorted')   # current "ready for sale" status

        res = self.client.post(f'/api/drying/sessions/{session.id}/complete/', {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_efficiency_fields(self):
        session = make_drying_session(input_quantity=Decimal('100'),
                                      output_quantity=Decimal('85'), waste_quantity=Decimal('5'))
        data = self.client.get(f'/api/drying/sessions/{session.id}/').data
        self.assertEqual(data['output_efficiency'], 85.0)
        self.assertEqual(data['moisture_loss_kg'], 10.0)

    def test_dryer_status_actions(self):
        dryer = make_dryer()
        self.client.post(f'/api/drying/dryers/{dryer.id}/set_maintenance/')
        dryer.refresh_from_db()
        self.assertEqual(dryer.status, 'Maintenance')
        self.client.post(f'/api/drying/dryers/{dryer.id}/set_available/')
        dryer.refresh_from_db()
        self.assertEqual(dryer.status, 'Available')

    def test_dropdown_endpoints(self):
        ready = make_fabric(status='Sent to Decolorization')
        make_fabric(status='Sorted')
        ids = {f['id'] for f in self.client.get('/api/drying/fabric-ready/').data}
        self.assertEqual(ids, {ready.id})

        done = make_decolor_session(fabric=ready, status='Completed')
        linked = make_decolor_session(fabric=ready, status='Completed')
        make_decolor_session(fabric=ready, status='In Progress')
        make_drying_session(fabric=ready, decolor_session=linked)
        ids = {s['id'] for s in self.client.get('/api/drying/decolor-sessions-done/').data}
        self.assertEqual(ids, {done.id})



class DryingCompletionValidationTests(TestCase):
    def test_output_plus_waste_cannot_exceed_input(self):
        client = client_for(make_user('drying_supervisor'))
        session = make_drying_session(input_quantity=Decimal('100'), status='In Progress')
        url = f'/api/drying/sessions/{session.id}/complete/'
        self.assertEqual(client.post(url, {'output_quantity': '95', 'waste_quantity': '10'},
                                     format='json').status_code, 400)
        self.assertEqual(client.post(url, {'output_quantity': 'x'}, format='json').status_code, 400)
        self.assertEqual(client.post(url, {'output_quantity': '90', 'waste_quantity': '10'},
                                     format='json').status_code, 200)
