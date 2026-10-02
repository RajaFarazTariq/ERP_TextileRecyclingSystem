from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from apps.core.testing import (
    client_for, make_chemical, make_decolor_session, make_drying_session, make_fabric, make_sorting_session,
    make_stock, make_tank, make_user,
)
from apps.decolorization.models import ChemicalIssuance
from .demo import add_demo_sustainability, wipe_demo_sustainability
from .models import SustainabilityTarget, UtilityReading, WasteCategory, WasteRecord

API = '/api/sustainability'


class SustainabilityTestCase(TestCase):
    def setUp(self):
        self.admin = make_user('admin')
        self.sorter = make_user('sorting_supervisor')
        self.dryer_user = make_user('drying_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_sorter = client_for(self.sorter)
        self.as_dryer = client_for(self.dryer_user)
        self.today = timezone.localdate()
        self.dust = WasteCategory.objects.get(name='Fibre dust')              # Recyclable
        self.sludge = WasteCategory.objects.get(name='Chemical sludge')       # Hazardous
        self.dirty = WasteCategory.objects.get(name='Contaminated fabric')    # General

    def waste(self, client=None, **data):
        data.setdefault('date', str(self.today))
        data.setdefault('category', self.dust.pk)
        data.setdefault('stage', 'Sorting')
        data.setdefault('quantity_kg', '40')
        data.setdefault('disposal_method', 'Sent to recycler')
        return (client or self.as_sorter).post(f'{API}/waste-records/', data, format='json')

    def reading(self, client=None, **data):
        data.setdefault('date', str(self.today))
        data.setdefault('utility', 'Water')
        data.setdefault('quantity', '10')
        return (client or self.as_sorter).post(f'{API}/utility-readings/', data, format='json')


class SetupTests(SustainabilityTestCase):
    def test_default_categories_exist(self):
        names = set(WasteCategory.objects.values_list('name', flat=True))
        self.assertLessEqual({'Fibre dust', 'Offcuts', 'Contaminated fabric', 'Chemical sludge', 'Packaging',
                              'Wastewater sludge'}, names)

    def test_only_admins_manage_categories(self):
        body = {'name': 'Metal scrap', 'classification': 'Recyclable'}
        self.assertEqual(self.as_sorter.post(f'{API}/waste-categories/', body, format='json').status_code, 403)
        res = self.as_admin.post(f'{API}/waste-categories/', body, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['records'], 0)
        self.assertEqual(self.as_admin.post(f'{API}/waste-categories/', body, format='json').status_code, 400)
        self.assertEqual(self.as_sorter.get(f'{API}/waste-categories/').status_code, 200)
        url = f'{API}/waste-categories/{res.data["id"]}/'
        self.assertEqual(self.as_sorter.patch(url, {'is_active': False}, format='json').status_code, 403)
        self.assertEqual(self.as_sorter.delete(url).status_code, 403)
        self.assertEqual(self.as_admin.delete(url).status_code, 204)

    def test_only_admins_manage_targets_and_one_is_active_per_figure(self):
        body = {'metric': 'recovery_rate', 'target_value': '75', 'direction': 'At least', 'period': '2026'}
        self.assertEqual(self.as_sorter.post(f'{API}/targets/', body, format='json').status_code, 403)
        res = self.as_admin.post(f'{API}/targets/', body, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['metric_label'], 'Recovery rate %')
        again = self.as_admin.post(f'{API}/targets/', body, format='json')
        self.assertEqual(again.status_code, 400)
        self.assertIn('metric', again.data)
        url = f'{API}/targets/{res.data["id"]}/'
        self.assertEqual(self.as_admin.patch(url, {'target_value': '80'}, format='json').status_code, 200)
        self.assertEqual(self.as_admin.patch(url, {'is_active': False}, format='json').status_code, 200)
        self.assertEqual(self.as_admin.post(f'{API}/targets/', body, format='json').status_code, 201)
        self.assertEqual(self.as_admin.patch(url, {'target_value': '-1'}, format='json').status_code, 400)

    def test_login_is_needed(self):
        from rest_framework.test import APIClient
        self.assertIn(APIClient().get(f'{API}/summary/').status_code, (401, 403))


class WasteRecordTests(SustainabilityTestCase):
    def test_recorder_is_set_by_the_server(self):
        fabric = make_fabric()
        res = self.waste(recorded_by=self.admin.pk, fabric=fabric.pk, revenue='500')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['recorded_by'], self.sorter.pk)
        self.assertEqual(res.data['recorded_by_name'], self.sorter.username)
        self.assertEqual(res.data['classification'], 'Recyclable')
        self.assertEqual(res.data['fabric_material'], 'Cotton')

    def test_values_are_checked(self):
        self.assertIn('quantity_kg', self.waste(quantity_kg='0').data)
        self.assertIn('disposal_cost', self.waste(disposal_cost='-1').data)
        self.assertIn('revenue', self.waste(revenue='-1').data)
        self.assertIn('date', self.waste(date=str(self.today + timedelta(days=1))).data)
        self.assertIn('disposal_method', self.waste(disposal_method='Burned').data)
        self.dust.is_active = False
        self.dust.save()
        self.assertIn('category', self.waste().data)

    def test_supervisors_change_only_their_own_records_and_admins_delete(self):
        record = self.waste().data
        url = f'{API}/waste-records/{record["id"]}/'
        self.assertEqual(self.as_dryer.patch(url, {'quantity_kg': '1'}, format='json').status_code, 403)
        res = self.as_sorter.patch(url, {'quantity_kg': '55'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['quantity_kg'], '55.00')
        self.assertEqual(self.as_admin.patch(url, {'notes': 'Checked'}, format='json').status_code, 200)
        self.assertEqual(WasteRecord.objects.get(pk=record['id']).recorded_by, self.sorter)
        self.assertEqual(self.as_sorter.delete(url).status_code, 403)
        self.assertEqual(self.as_admin.delete(url).status_code, 204)

    def test_a_used_category_cannot_be_deleted(self):
        self.waste()
        res = self.as_admin.delete(f'{API}/waste-categories/{self.dust.pk}/')
        self.assertEqual(res.status_code, 409)

    def test_list_filters(self):
        self.waste()
        self.waste(category=self.sludge.pk, stage='Decolorization', disposal_method='Treated')
        self.waste(date=str(self.today - timedelta(days=400)))

        def count(**params):
            return len(self.as_dryer.get(f'{API}/waste-records/', params).data)

        self.assertEqual(count(), 3)
        self.assertEqual(count(classification='Hazardous'), 1)
        self.assertEqual(count(stage='Sorting'), 2)
        self.assertEqual(count(date_filter='this_year', stage='Sorting'), 1)


class UtilityReadingTests(SustainabilityTestCase):
    def test_unit_follows_the_utility(self):
        res = self.reading(unit='gallons')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['unit'], 'm3')
        self.assertEqual(res.data['recorded_by'], self.sorter.pk)
        url = f'{API}/utility-readings/{res.data["id"]}/'
        self.assertEqual(self.as_sorter.patch(url, {'utility': 'Electricity'}, format='json').data['unit'], 'kWh')
        self.assertEqual(self.reading(utility='Diesel').data['unit'], 'litres')
        self.assertEqual(self.reading(utility='Steam').data['unit'], 'kg')

    def test_values_are_checked(self):
        self.assertIn('quantity', self.reading(quantity='0').data)
        self.assertIn('cost', self.reading(cost='-5').data)
        self.assertIn('utility', self.reading(utility='Coal').data)
        self.assertIn('date', self.reading(date=str(self.today + timedelta(days=2))).data)

    def test_supervisors_change_only_their_own_readings_and_admins_delete(self):
        reading = self.reading().data
        url = f'{API}/utility-readings/{reading["id"]}/'
        self.assertEqual(self.as_dryer.patch(url, {'quantity': '1'}, format='json').status_code, 403)
        self.assertEqual(self.as_sorter.patch(url, {'quantity': '12'}, format='json').status_code, 200)
        self.assertEqual(self.as_sorter.delete(url).status_code, 403)
        self.assertEqual(self.as_admin.delete(url).status_code, 204)
        self.assertEqual(len(self.as_dryer.get(f'{API}/utility-readings/', {'utility': 'Water'}).data), 0)


class FigureTests(SustainabilityTestCase):
    """The numbers of the summary and the report, from a small known set of records."""

    def setUp(self):
        super().setUp()
        now = timezone.now()
        done = {'status': 'Completed', 'end_date': now}
        fabric = make_fabric(stock=make_stock(our_weight=Decimal('1200')))
        make_stock(our_weight=Decimal('300'), status='Rejected')                         # left out
        make_sorting_session(fabric=fabric, quantity_taken=Decimal('1000'), quantity_sorted=Decimal('900'),
                             waste_quantity=Decimal('60'), **done)
        make_sorting_session(fabric=fabric, quantity_taken=Decimal('500'))               # still running: left out
        tank = make_tank()
        session = make_decolor_session(tank=tank, fabric=fabric, input_quantity=Decimal('900'),
                                       output_quantity=Decimal('855'), waste_quantity=Decimal('20'),
                                       water_liters=Decimal('2500'), **done)
        make_drying_session(fabric=fabric, input_quantity=Decimal('855'), output_quantity=Decimal('750'),
                            waste_quantity=Decimal('5'), **done)
        chemical = make_chemical(chemical_name='Peroxide', unit_of_measure='Liters')
        for quantity in ('10', '5.5'):
            issuance = ChemicalIssuance.objects.create(chemical=chemical, tank=tank, issued_by=self.admin,
                                                       quantity=Decimal(quantity), session=session)
            ChemicalIssuance.objects.filter(pk=issuance.pk).update(unit_cost=Decimal('120'))

        self.waste(quantity_kg='60', disposal_cost='0', revenue='900')                                  # recyclable
        self.waste(category=self.sludge.pk, stage='Decolorization', quantity_kg='15', disposal_method='Treated',
                   disposal_cost='450')
        self.waste(category=self.dirty.pk, quantity_kg='25', disposal_method='Landfill', disposal_cost='100')
        self.reading(quantity='30', cost='3000')                                         # 30 m3 of water
        self.reading(utility='Electricity', quantity='1500', cost='60000')
        self.reading(utility='Electricity', quantity='375.5', cost='15000', stage='Drying')
        self.reading(utility='Gas', quantity='200', cost='20000')

    def summary(self, **params):
        res = self.as_dryer.get(f'{API}/summary/', params)
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def test_material_balance_per_stage(self):
        data = self.summary()
        self.assertEqual(data['material_in'], {'deliveries': 1, 'kg': '1200.00'})
        sorting, decolor, drying = data['stages']
        self.assertEqual(sorting, {
            'stage': 'Sorting', 'sessions': 1, 'input_kg': '1000.00', 'output_kg': '900.00', 'loss_kg': '100.00',
            'loss_pct': '10.00', 'waste_kg': '60.00', 'other_loss_kg': '40.00', 'yield_pct': '90.00'})
        self.assertEqual((decolor['loss_kg'], decolor['loss_pct'], decolor['waste_kg']), ('45.00', '5.00', '20.00'))
        self.assertEqual((drying['input_kg'], drying['output_kg'], drying['loss_kg']), ('855.00', '750.00', '105.00'))
        self.assertEqual(drying['loss_pct'], '12.28')
        self.assertEqual(drying['other_loss_kg'], '100.00')

    def test_recovery_rate_is_dried_output_over_material_taken_into_sorting(self):
        recovery = self.summary()['recovery']
        self.assertEqual(recovery, {'input_kg': '1000.00', 'output_kg': '750.00', 'rate_pct': '75.00',
                                    'loss_kg': '250.00', 'stage_yield_pct': '75.00'})

    def test_waste_by_classification_and_method(self):
        waste = self.summary()['waste']
        self.assertEqual((waste['records'], waste['total_kg'], waste['landfill_kg']), (3, '100.00', '25.00'))
        self.assertEqual((waste['diverted_pct'], waste['landfill_pct']), ('75.00', '25.00'))
        self.assertEqual((waste['hazardous_kg'], waste['disposal_cost'], waste['revenue']),
                         ('15.00', '550.00', '900.00'))
        self.assertEqual(waste['by_classification'], [
            {'name': 'Recyclable', 'kg': '60.00', 'share_pct': '60.00'},
            {'name': 'Hazardous', 'kg': '15.00', 'share_pct': '15.00'},
            {'name': 'General', 'kg': '25.00', 'share_pct': '25.00'}])
        self.assertEqual([m['name'] for m in waste['by_method']], ['Sent to recycler', 'Landfill', 'Treated'])
        self.assertEqual([(s['name'], s['kg']) for s in waste['by_stage']],
                         [('Sorting', '85.00'), ('Decolorization', '15.00')])

    def test_water_energy_and_chemicals_per_kg_of_output(self):
        data = self.summary()
        utilities, chemicals = data['utilities'], data['chemicals']
        self.assertEqual((utilities['water_m3'], utilities['water_l_per_kg']), ('30.00', '40.00'))
        self.assertEqual(utilities['session_water_liters'], '2500.00')
        self.assertEqual((utilities['energy_kwh'], utilities['energy_kwh_per_kg']), ('1875.50', '2.50'))
        self.assertEqual(utilities['total_cost'], '98000.00')
        self.assertEqual([(u['utility'], u['unit'], u['quantity'], u['readings']) for u in utilities['by_utility']],
                         [('Water', 'm3', '30.00', 1), ('Electricity', 'kWh', '1875.50', 2), ('Gas', 'm3', '200.00', 1)])
        self.assertEqual((chemicals['issuances'], chemicals['total_cost'], chemicals['cost_per_kg']),
                         (2, '1860.00', '2.48'))
        self.assertEqual(chemicals['items'][0]['chemical_name'], 'Peroxide')
        self.assertEqual((chemicals['items'][0]['quantity'], chemicals['items'][0]['cost']), ('15.50', '1860.00'))

    def test_targets_show_whether_they_are_met(self):
        for metric, direction, value in [('recovery_rate', 'At least', '80'), ('landfill_share', 'At most', '25'),
                                         ('water_per_kg', 'At most', '50')]:
            SustainabilityTarget.objects.create(metric=metric, direction=direction, target_value=Decimal(value))
        SustainabilityTarget.objects.create(metric='energy_per_kg', direction='At most', target_value=1,
                                            is_active=False)
        targets = {t['metric']: t for t in self.summary()['targets']}
        self.assertEqual(set(targets), {'recovery_rate', 'landfill_share', 'water_per_kg'})
        self.assertEqual((targets['recovery_rate']['actual'], targets['recovery_rate']['met']), ('75.00', False))
        self.assertEqual((targets['landfill_share']['actual'], targets['landfill_share']['met']), ('25.00', True))
        self.assertTrue(targets['water_per_kg']['met'])

    def test_trend_has_one_row_per_month(self):
        self.waste(date=str(self.today - timedelta(days=800)))                           # too old for the trend
        trend = self.summary()['trend']
        self.assertEqual(len(trend), 12)
        self.assertEqual(len(self.summary(months='6')['trend']), 6)
        self.assertEqual(trend[-1], {
            'month': self.today.strftime('%Y-%m'), 'input_kg': '1000.00', 'output_kg': '750.00',
            'recovery_pct': '75.00', 'waste_kg': '100.00', 'water_m3': '30.00', 'energy_kwh': '1875.50'})
        self.assertEqual((trend[0]['input_kg'], trend[0]['recovery_pct']), ('0.00', None))

    def test_summary_defaults_to_this_month_and_the_report_to_all_time(self):
        self.waste(date=str(self.today - timedelta(days=800)), quantity_kg='11')
        self.assertEqual(self.summary()['waste']['total_kg'], '100.00')
        self.assertEqual(self.summary(date_filter='all')['waste']['total_kg'], '111.00')
        report = self.as_sorter.get(f'{API}/report/').data
        self.assertEqual(report['waste']['total_kg'], '111.00')
        self.assertNotIn('trend', report)
        old = self.as_sorter.get(f'{API}/report/', {'year': self.today.year - 5}).data
        self.assertEqual(old['waste']['total_kg'], '0.00')

    def test_nothing_recorded_gives_nulls_not_errors(self):
        data = self.as_admin.get(f'{API}/report/', {'year': self.today.year - 5}).data
        self.assertIsNone(data['recovery']['rate_pct'])
        self.assertIsNone(data['recovery']['stage_yield_pct'])
        self.assertIsNone(data['stages'][0]['loss_pct'])
        self.assertIsNone(data['waste']['diverted_pct'])
        self.assertIsNone(data['utilities']['water_l_per_kg'])
        self.assertIsNone(data['chemicals']['cost_per_kg'])
        self.assertEqual(data['material_in'], {'deliveries': 0, 'kg': '0.00'})

    def test_definitions_explain_the_figures(self):
        names = [d['name'] for d in self.summary()['definitions']]
        self.assertIn('Recovery rate', names)
        self.assertIn('Diverted from landfill', names)


class DemoDataTests(SustainabilityTestCase):
    def test_demo_data_can_be_added_and_wiped(self):
        add_demo_sustainability(self.admin)
        self.assertGreater(WasteRecord.objects.count(), 40)
        self.assertEqual(UtilityReading.objects.values('utility').distinct().count(), 5)
        self.assertEqual(SustainabilityTarget.objects.filter(is_active=True).count(), 5)
        self.assertFalse(WasteRecord.objects.filter(date__gt=self.today).exists())
        self.assertFalse(UtilityReading.objects.filter(date__gt=self.today).exists())
        data = self.as_admin.get(f'{API}/summary/').data
        self.assertTrue(all(float(m['waste_kg']) > 0 for m in data['trend'][-6:]))
        wipe_demo_sustainability()
        self.assertEqual(WasteCategory.objects.count() + WasteRecord.objects.count(), 0)
        add_demo_sustainability(self.admin)
        self.assertEqual(WasteCategory.objects.count(), 6)
