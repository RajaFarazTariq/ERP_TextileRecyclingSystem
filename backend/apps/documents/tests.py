import io
import os
import shutil
import tempfile
import zipfile
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.core.testing import client_for, make_user
from .models import Document, DocumentCategory, DocumentVersion

API = '/api/documents'
MEDIA = tempfile.mkdtemp(prefix='erp-documents-test-')

PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 24
JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 24
WEBP = b'RIFF\x24\x00\x00\x00WEBPVP8 ' + b'\x00' * 16
OLE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1' + b'\x00' * 24
EXE = b'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00'


def office_zip(folder):
    """The smallest thing that looks like a .docx (folder 'word') or .xlsx (folder 'xl')."""
    data = io.BytesIO()
    with zipfile.ZipFile(data, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        archive.writestr(f'{folder}/document.xml', '<x/>')
    return data.getvalue()


def upload(name='certificate.pdf', content=PDF):
    return SimpleUploadedFile(name, content)


@override_settings(MEDIA_ROOT=MEDIA, DOCUMENT_MAX_UPLOAD_MB=1)
class DocumentsTestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        shutil.rmtree(os.path.join(MEDIA, 'documents'), ignore_errors=True)
        self.admin = make_user('admin')
        self.keeper = make_user('warehouse_supervisor')
        self.sorter = make_user('sorting_supervisor')
        self.as_admin = client_for(self.admin)
        self.as_keeper = client_for(self.keeper)
        self.as_sorter = client_for(self.sorter)
        # The default categories come from the data migration
        self.certificates = DocumentCategory.objects.get(name='Quality certificates')
        self.supplier = DocumentCategory.objects.get(name='Supplier documents')
        self.employee = DocumentCategory.objects.get(name='Employee documents')

    def add(self, client=None, file=None, **data):
        data.setdefault('title', 'ISO 9001 certificate')
        data.setdefault('category', self.certificates.pk)
        data['file'] = file or upload()
        return (client or self.as_admin).post(f'{API}/documents/', data, format='multipart')

    def added(self, client=None, **data):
        res = self.add(client, **data)
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def fetch(self, client, url):
        """GET a download and close it, so the file isn't left open."""
        res = client.get(url)
        res.body = b''.join(res.streaming_content) if res.streaming else res.content
        res.close()
        return res

    def stored_files(self):
        folder = os.path.join(MEDIA, 'documents')
        return sorted(os.listdir(folder)) if os.path.isdir(folder) else []


class UploadTests(DocumentsTestCase):
    def test_upload_creates_a_document_with_version_1(self):
        doc = self.added(self.as_sorter, file=upload('Cert 2026.PDF'), note='First issue')
        self.assertTrue(doc['number'].startswith('DOC-'))
        self.assertEqual(doc['current_version'], 1)
        self.assertEqual(doc['created_by'], self.sorter.pk)
        self.assertEqual(doc['file_name'], 'Cert 2026.PDF')
        self.assertEqual(doc['extension'], 'pdf')
        self.assertEqual(doc['size_bytes'], len(PDF))
        version = DocumentVersion.objects.get(document_id=doc['id'])
        self.assertEqual((version.content_type, version.note, len(version.sha256)), ('application/pdf', 'First issue', 64))

    def test_file_is_stored_under_media_root_with_a_generated_name(self):
        before = self.stored_files()
        doc = self.added(file=upload('../../secret plan.pdf'))
        version = DocumentVersion.objects.get(document_id=doc['id'])
        self.assertRegex(version.file.name, r'^documents/[0-9a-f]{32}\.bin$')
        path = os.path.realpath(version.file.path)
        self.assertTrue(path.startswith(os.path.realpath(MEDIA) + os.sep))
        self.assertTrue(os.path.isfile(path))
        self.assertEqual(len(self.stored_files()), len(before) + 1)
        self.assertNotIn('secret', ' '.join(self.stored_files()))
        self.assertEqual(version.original_name, 'secret plan.pdf')

    def test_a_file_is_required(self):
        res = self.as_admin.post(f'{API}/documents/', {'title': 'x', 'category': self.certificates.pk}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('file', res.data)

    def test_a_file_over_the_size_limit_is_refused(self):
        res = self.add(file=upload('big.pdf', b'%PDF-1.4\n' + b'0' * (1024 * 1024)))
        self.assertEqual(res.status_code, 400)
        self.assertIn('too large', str(res.data['file']))
        self.assertEqual(Document.objects.count(), 0)

    def test_an_empty_file_is_refused(self):
        self.assertEqual(self.add(file=upload('empty.pdf', b'')).status_code, 400)

    def test_extensions_outside_the_list_are_refused(self):
        for name in ('tool.exe', 'page.html', 'script.js', 'picture.svg', 'archive.zip', 'noextension', 'double.pdf.exe'):
            res = self.add(file=upload(name, PDF))
            self.assertEqual(res.status_code, 400, name)
            self.assertIn('not allowed', str(res.data['file']), name)
        self.assertEqual(self.stored_files(), [])

    def test_content_must_match_the_extension(self):
        wrong = [
            ('renamed.pdf', EXE), ('page.pdf', b'<html><script>alert(1)</script></html>'),
            ('photo.png', JPEG), ('photo.jpg', PNG), ('photo.webp', PNG),
            ('letter.docx', PDF), ('letter.docx', office_zip('xl')), ('letter.docx', b'PK\x03\x04 not a zip'),
            ('sheet.xlsx', office_zip('word')), ('letter.doc', office_zip('word')), ('sheet.xls', PDF),
            ('data.csv', b'a,b\x00c'), ('notes.txt', EXE),
        ]
        for name, content in wrong:
            res = self.add(file=upload(name, content))
            self.assertEqual(res.status_code, 400, name)
            self.assertIn('not a real', str(res.data['file']), name)
        self.assertEqual(Document.objects.count(), 0)
        self.assertEqual(self.stored_files(), [])

    def test_every_allowed_type_is_accepted(self):
        good = [
            ('a.pdf', PDF), ('a.png', PNG), ('a.jpg', JPEG), ('a.jpeg', JPEG), ('a.webp', WEBP),
            ('a.doc', OLE), ('a.xls', OLE), ('a.docx', office_zip('word')), ('a.xlsx', office_zip('xl')),
            ('a.csv', b'lot,kg\n1,20\n'), ('a.txt', 'Café notes'.encode()),
        ]
        for name, content in good:
            self.assertEqual(self.add(file=upload(name, content)).status_code, 201, name)

    def test_dates_and_links_are_checked(self):
        res = self.add(issued_on='2026-05-01', expires_on='2026-04-01')
        self.assertIn('expires_on', res.data)
        res = self.add(linked_type='Supplier')
        self.assertIn('linked_label', res.data)
        doc = self.added(linked_type='Supplier', linked_id=7, linked_label='Karachi Cotton Traders')
        self.assertEqual((doc['linked_type'], doc['linked_id']), ('Supplier', 7))


class AccessTests(DocumentsTestCase):
    def setUp(self):
        super().setUp()
        self.public = self.added(title='Fabric certificate')
        self.purchase = self.added(title='Supplier agreement', category=self.supplier.pk)
        self.private = self.added(title='Employment contract', category=self.employee.pk)

    def titles(self, client, path='documents/'):
        return sorted(d['title'] for d in client.get(f'{API}/{path}').data)

    def test_default_categories(self):
        roles = {c.name: c.allowed_roles for c in DocumentCategory.objects.all()}
        self.assertEqual(len(roles), 9)
        for name in ('Employee documents', 'Customer documents', 'Invoices and delivery challans'):
            self.assertEqual(roles[name], [])
        for name in ('Supplier documents', 'Purchase documents'):
            self.assertEqual(roles[name], ['warehouse_supervisor'])
        for name in ('Quality certificates', 'Material test reports', 'Safety data sheets', 'Production batch documents'):
            self.assertEqual(len(roles[name]), 4)

    def test_lists_show_only_what_the_role_may_see(self):
        self.assertEqual(len(self.titles(self.as_admin)), 3)
        self.assertEqual(self.titles(self.as_keeper), ['Fabric certificate', 'Supplier agreement'])
        self.assertEqual(self.titles(self.as_sorter), ['Fabric certificate'])
        # Searching and filtering can't reach hidden documents either
        self.assertEqual(self.titles(self.as_sorter, 'documents/?search=contract'), [])
        self.assertEqual(self.titles(self.as_sorter, f'documents/?category={self.employee.pk}'), [])
        self.assertEqual(self.titles(self.as_sorter, 'expiring/?days=3650'), [])

    def test_categories_and_summary_follow_the_same_rule(self):
        names = [c['name'] for c in self.as_sorter.get(f'{API}/categories/').data]
        self.assertEqual(len(names), 4)
        self.assertNotIn('Employee documents', names)
        self.assertEqual(len(self.as_admin.get(f'{API}/categories/').data), 9)
        self.assertEqual(self.as_sorter.get(f'{API}/categories/{self.employee.pk}/').status_code, 404)
        self.assertEqual(self.as_admin.get(f'{API}/summary/').data['documents'], 3)
        summary = self.as_sorter.get(f'{API}/summary/').data
        self.assertEqual(summary['documents'], 1)
        self.assertEqual([c['name'] for c in summary['by_category']], ['Quality certificates'])

    def test_hidden_documents_answer_404_everywhere(self):
        hidden = self.private['id']
        for path in ('', 'download/', 'versions/', 'versions/1/download/'):
            self.assertEqual(self.fetch(self.as_keeper, f'{API}/documents/{hidden}/{path}').status_code, 404, path)
            self.assertEqual(self.fetch(self.as_admin, f'{API}/documents/{hidden}/{path}').status_code, 200, path)
        self.assertEqual(self.as_keeper.patch(f'{API}/documents/{hidden}/', {'title': 'x'}, format='json').status_code, 404)
        res = self.as_keeper.post(f'{API}/documents/{hidden}/versions/', {'file': upload()}, format='multipart')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(self.as_sorter.get(f'{API}/documents/{self.purchase["id"]}/download/').status_code, 404)
        self.assertEqual(self.fetch(self.as_keeper, f'{API}/documents/{self.purchase["id"]}/download/').status_code, 200)

    def test_logged_out_users_get_nothing(self):
        for path in ('documents/', f'documents/{self.public["id"]}/download/', 'summary/', 'expiring/', 'categories/'):
            self.assertEqual(self.client.get(f'{API}/{path}').status_code, 401, path)

    def test_uploads_only_into_categories_the_role_may_see(self):
        res = self.add(self.as_sorter, category=self.employee.pk)
        self.assertEqual(res.status_code, 400)
        self.assertIn('category', res.data)
        self.assertEqual(self.add(self.as_keeper, category=self.supplier.pk).status_code, 201)
        self.certificates.is_active = False
        self.certificates.save()
        self.assertIn('category', self.add().data)

    def test_only_the_uploader_or_an_admin_changes_a_document(self):
        mine = self.added(self.as_sorter, title='Sorting sheet')
        url = f'{API}/documents/{mine["id"]}/'
        self.assertEqual(self.as_keeper.patch(url, {'title': 'x'}, format='json').status_code, 403)
        res = self.as_keeper.post(f'{url}versions/', {'file': upload()}, format='multipart')
        self.assertEqual(res.status_code, 403)
        res = self.as_sorter.patch(url, {'title': 'Sorting sheet 2', 'expires_on': '2030-01-01'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['title'], 'Sorting sheet 2')
        self.assertTrue(res.data['can_change'])
        # Moving it to another category changes who sees it: admins only
        material = DocumentCategory.objects.get(name='Material test reports')
        self.assertEqual(self.as_sorter.patch(url, {'category': material.pk}, format='json').status_code, 403)
        self.assertEqual(self.as_admin.patch(url, {'category': material.pk}, format='json').status_code, 200)

    def test_only_admins_delete_and_the_files_go_too(self):
        doc_id = self.public['id']
        self.as_admin.post(f'{API}/documents/{doc_id}/versions/', {'file': upload('v2.pdf')}, format='multipart')
        files = self.stored_files()
        self.assertEqual(self.as_keeper.delete(f'{API}/documents/{doc_id}/').status_code, 403)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.as_admin.delete(f'{API}/documents/{doc_id}/').status_code, 204)
        self.assertEqual(len(self.stored_files()), len(files) - 2)
        self.assertFalse(DocumentVersion.objects.filter(document_id=doc_id).exists())

    def test_only_admins_manage_categories(self):
        body = {'name': 'Permits', 'allowed_roles': ['drying_supervisor', 'admin']}
        self.assertEqual(self.as_keeper.post(f'{API}/categories/', body, format='json').status_code, 403)
        res = self.as_admin.post(f'{API}/categories/', body, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['allowed_roles'], ['drying_supervisor'])
        res = self.as_admin.post(f'{API}/categories/', {'name': 'Bad', 'allowed_roles': ['director']}, format='json')
        self.assertEqual(res.status_code, 400)
        url = f'{API}/categories/{self.certificates.pk}/'
        self.assertEqual(self.as_keeper.patch(url, {'allowed_roles': []}, format='json').status_code, 403)
        # Closing a category hides its documents from the roles that lose it
        self.assertEqual(self.as_admin.patch(url, {'allowed_roles': ['sorting_supervisor']}, format='json').status_code, 200)
        self.assertEqual(self.titles(self.as_keeper), ['Supplier agreement'])
        self.assertEqual(self.as_keeper.get(f'{API}/documents/{self.public["id"]}/download/').status_code, 404)
        # A category that holds documents can't be deleted
        self.assertEqual(self.as_admin.delete(url).status_code, 409)


class DownloadTests(DocumentsTestCase):
    def test_download_is_an_attachment_with_safe_headers(self):
        doc = self.added(file=upload('report <b>.pdf'))
        # Even a name that got into the database some other way can't break the header
        DocumentVersion.objects.filter(document_id=doc['id']).update(original_name='rep"ort\r\n<b>/../x.html')
        res = self.fetch(self.as_sorter, f'{API}/documents/{doc["id"]}/download/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.body, PDF)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        self.assertEqual(res['X-Content-Type-Options'], 'nosniff')
        disposition = res['Content-Disposition']
        self.assertTrue(disposition.startswith('attachment; filename="'), disposition)
        for bad in ('<', '\r', '\n', 'ort"', '/', 'html'):
            self.assertNotIn(bad, disposition)
        self.assertTrue(disposition.endswith('.pdf"'), disposition)

    def test_text_files_are_never_sent_as_html(self):
        doc = self.added(file=upload('page.txt', b'<html><script>alert(1)</script></html>'))
        res = self.fetch(self.as_admin, f'{API}/documents/{doc["id"]}/download/')
        self.assertEqual(res['Content-Type'], 'text/plain; charset=utf-8')
        self.assertIn('attachment', res['Content-Disposition'])

    def test_downloads_are_written_to_the_audit_log(self):
        doc = self.added()
        self.fetch(self.as_keeper, f'{API}/documents/{doc["id"]}/download/')
        entry = AuditLog.objects.filter(action=AuditLog.ACTION_EXPORT, model_name='Document').first()
        self.assertEqual((entry.username, entry.object_id), (self.keeper.username, str(doc['id'])))
        self.assertIn('Version 1', entry.changes['downloaded']['new'])

    def test_a_missing_file_answers_404(self):
        doc = self.added()
        os.remove(DocumentVersion.objects.get(document_id=doc['id']).file.path)
        self.assertEqual(self.as_admin.get(f'{API}/documents/{doc["id"]}/download/').status_code, 404)


class VersionTests(DocumentsTestCase):
    def test_a_new_version_keeps_the_old_one(self):
        doc = self.added(self.as_sorter)
        url = f'{API}/documents/{doc["id"]}'
        newer = b'%PDF-1.7\nrevised\n'
        res = self.as_sorter.post(f'{url}/versions/', {'file': upload('revised.pdf', newer), 'note': 'Renewed'}, format='multipart')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['version'], res.data['note']), (2, 'Renewed'))

        current = self.as_sorter.get(f'{url}/').data
        self.assertEqual((current['current_version'], current['file_name']), (2, 'revised.pdf'))
        versions = self.as_keeper.get(f'{url}/versions/').data
        self.assertEqual([v['version'] for v in versions], [2, 1])
        self.assertNotEqual(versions[0]['sha256'], versions[1]['sha256'])
        self.assertNotIn('file', versions[0])

        self.assertEqual(self.fetch(self.as_keeper, f'{url}/download/').body, newer)
        self.assertEqual(self.fetch(self.as_keeper, f'{url}/versions/1/download/').body, PDF)
        self.assertEqual(self.as_keeper.get(f'{url}/versions/9/download/').status_code, 404)

    def test_a_new_version_is_checked_like_any_upload(self):
        doc = self.added()
        url = f'{API}/documents/{doc["id"]}/versions/'
        self.assertEqual(self.as_admin.post(url, {'file': upload('virus.pdf', EXE)}, format='multipart').status_code, 400)
        self.assertEqual(self.as_admin.post(url, {'note': 'no file'}, format='multipart').status_code, 400)
        self.assertEqual(Document.objects.get(pk=doc['id']).current_version, 1)

    def test_editing_details_never_replaces_the_file(self):
        doc = self.added()
        res = self.as_admin.patch(f'{API}/documents/{doc["id"]}/', {'title': 'New title', 'file': upload('x.pdf')}, format='multipart')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data['title'], res.data['current_version']), ('New title', 1))


class ExpiryTests(DocumentsTestCase):
    def setUp(self):
        super().setUp()
        today = date.today()
        self.ids = {
            'Expired': self.added(title='Old', expires_on=str(today - timedelta(days=1)))['id'],
            'Expiring soon': self.added(title='Soon', expires_on=str(today + timedelta(days=30)))['id'],
            'Valid': self.added(title='Fine', expires_on=str(today + timedelta(days=31)))['id'],
            'No expiry': self.added(title='Forever')['id'],
        }

    def test_status_follows_the_expiry_date(self):
        docs = {d['id']: d for d in self.as_admin.get(f'{API}/documents/').data}
        for status, doc_id in self.ids.items():
            self.assertEqual(docs[doc_id]['status'], status)
        self.assertEqual(docs[self.ids['Expired']]['days_left'], -1)
        self.assertEqual(docs[self.ids['Expiring soon']]['days_left'], 30)
        self.assertIsNone(docs[self.ids['No expiry']]['days_left'])
        today = self.added(title='Today', expires_on=str(date.today()))
        self.assertEqual(today['status'], 'Expiring soon')

    def test_list_filters(self):
        for status, doc_id in self.ids.items():
            res = self.as_admin.get(f'{API}/documents/', {'status': status})
            self.assertEqual([d['id'] for d in res.data], [doc_id], status)
        linked = self.added(title='Linked', linked_type='Supplier', linked_id=3, linked_label='Vendor 3',
                            reference_number='REF-778')
        res = self.as_admin.get(f'{API}/documents/', {'linked_type': 'Supplier', 'linked_id': 3})
        self.assertEqual([d['id'] for d in res.data], [linked['id']])
        self.assertEqual(len(self.as_admin.get(f'{API}/documents/', {'linked_type': 'Supplier', 'linked_id': 4}).data), 0)
        self.assertEqual([d['id'] for d in self.as_admin.get(f'{API}/documents/', {'search': 'ref-778'}).data], [linked['id']])
        self.assertEqual(len(self.as_admin.get(f'{API}/documents/', {'category': self.certificates.pk}).data), 5)
        self.assertEqual(len(self.as_admin.get(f'{API}/documents/', {'category': self.supplier.pk}).data), 0)

    def test_expiring_lists_expired_and_soon_soonest_first(self):
        res = self.as_sorter.get(f'{API}/expiring/')
        self.assertEqual([d['id'] for d in res.data], [self.ids['Expired'], self.ids['Expiring soon']])
        res = self.as_sorter.get(f'{API}/expiring/', {'days': 60})
        self.assertEqual(len(res.data), 3)

    def test_summary_numbers(self):
        self.added(title='Contract', category=self.employee.pk)
        old = Document.objects.get(pk=self.ids['Valid'])
        Document.objects.filter(pk=old.pk).update(created_at=old.created_at - timedelta(days=62))
        s = self.as_admin.get(f'{API}/summary/').data
        self.assertEqual((s['documents'], s['valid'], s['expiring_soon'], s['expired'], s['no_expiry']), (5, 1, 1, 1, 2))
        self.assertEqual(s['added_this_month'], 4)
        self.assertEqual(s['by_category'], [
            {'category': self.certificates.pk, 'name': 'Quality certificates', 'count': 4},
            {'category': self.employee.pk, 'name': 'Employee documents', 'count': 1},
        ])
        self.assertEqual(s['max_upload_mb'], 1)
        self.assertIn('pdf', s['allowed_extensions'])
        self.assertEqual(self.as_sorter.get(f'{API}/summary/').data['documents'], 4)


class DemoDataTests(DocumentsTestCase):
    def test_demo_data_can_be_added_and_wiped(self):
        from .demo import add_demo_documents, wipe_demo_documents
        add_demo_documents(self.admin)
        s = self.as_admin.get(f'{API}/summary/').data
        self.assertGreaterEqual(s['documents'], 20)
        self.assertTrue(s['expired'] and s['expiring_soon'] and s['valid'] and s['no_expiry'])
        self.assertEqual(len(self.stored_files()), DocumentVersion.objects.count())
        with self.captureOnCommitCallbacks(execute=True):
            wipe_demo_documents()
        self.assertEqual((Document.objects.count(), self.stored_files()), (0, []))
        self.assertEqual(DocumentCategory.objects.count(), 9)


class DemoDataTests(DocumentsTestCase):
    def test_demo_documents_are_valid_and_can_be_wiped(self):
        from .demo import add_demo_documents, wipe_demo_documents
        add_demo_documents(self.admin)
        self.assertGreaterEqual(Document.objects.count(), 20)
        self.assertEqual(len(self.stored_files()), DocumentVersion.objects.count())
        summary = self.as_admin.get(f'{API}/summary/').data
        self.assertTrue(summary['expired'] and summary['expiring_soon'] and summary['valid'])
        with self.captureOnCommitCallbacks(execute=True):
            wipe_demo_documents()
        self.assertEqual((Document.objects.count(), self.stored_files()), (0, []))
        self.assertEqual(DocumentCategory.objects.count(), 9)
