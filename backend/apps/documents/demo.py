"""Demo data for the Documents module: a varied set of documents with small real files."""
from datetime import timedelta

from django.apps import apps
from django.core.exceptions import FieldError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.users.models import CustomUser
from . import services
from .models import Document, DocumentCategory


def _pdf(title, lines):
    """A small one-page PDF with a heading and a few lines of text."""
    def safe(text):
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    text = [f'BT /F1 16 Tf 60 770 Td ({safe(title)}) Tj ET']
    text += [f'BT /F1 11 Tf 60 {735 - 18 * i} Td ({safe(line)}) Tj ET' for i, line in enumerate(lines)]
    stream = '\n'.join(text).encode('latin-1', 'replace')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R '
        b'/Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out, offsets = b'%PDF-1.4\n', []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b'%d 0 obj\n' % number + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
    out += b''.join(b'%010d 00000 n \n' % offset for offset in offsets)
    out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    return out


def _csv(rows):
    return '\n'.join(','.join(row) for row in rows).encode() + b'\n'


def _names(app_label, model_name, field, fallback):
    """A few real names from another module, or made-up ones if it has none."""
    try:
        names = list(apps.get_model(app_label, model_name).objects.order_by('pk').values_list(field, flat=True)[:3])
    except (LookupError, FieldError):
        names = []
    return [str(n) for n in names] + fallback[len(names):]


def add_demo_documents(admin):
    """Create the demo documents. Call once on a database that has the main demo data."""
    services.ensure_default_categories()
    categories = {c.name: c for c in DocumentCategory.objects.all()}
    users = {u.username: u for u in CustomUser.objects.filter(
        username__in=['warehouse_user', 'sorting_user', 'decolor_user', 'drying_user'])}
    today = timezone.localdate()
    suppliers = _names('warehouse', 'Vendor', 'name', ['Karachi Cotton Traders', 'Faisalabad Textile Waste', 'Lahore Rags Co.'])
    customers = _names('sales', 'Customer', 'name', ['Sapphire Mills', 'Nishat Yarns', 'Gul Ahmed'])

    def add(title, category, name, content, by=None, issued=None, expires=None, reference='', description='',
            link=('', ''), age=0, revisions=()):
        user = users.get(by, admin)
        document = Document.objects.create(
            title=title, category=categories[category], description=description, reference_number=reference,
            issued_on=today + timedelta(days=issued) if issued is not None else None,
            expires_on=today + timedelta(days=expires) if expires is not None else None,
            linked_type=link[0], linked_label=link[1], created_by=user)
        services.add_version(document, SimpleUploadedFile(name, content), user, 'First upload')
        for note, new_name, new_content in revisions:
            services.add_version(document, SimpleUploadedFile(new_name, new_content), user, note)
        if age:
            Document.objects.filter(pk=document.pk).update(created_at=timezone.now() - timedelta(days=age))
        return document

    add('GRS scope certificate', 'Quality certificates', 'grs-scope-certificate.pdf',
        _pdf('Global Recycled Standard', ['Scope certificate', 'Recycled cotton fibre, mechanical process']),
        issued=-340, expires=25, reference='GRS-2025-04417', age=120,
        description='Recycled content certificate for the factory. Renewal audit is booked.')
    add('ISO 9001 certificate', 'Quality certificates', 'iso-9001.pdf',
        _pdf('ISO 9001:2015', ['Quality management system', 'Textile recycling and fibre recovery']),
        issued=-400, expires=330, reference='QMS-88213', age=200,
        revisions=[('Renewed for another year', 'iso-9001-renewed.pdf',
                    _pdf('ISO 9001:2015', ['Quality management system', 'Renewed certificate']))])
    add('OEKO-TEX Standard 100', 'Quality certificates', 'oeko-tex-100.pdf',
        _pdf('OEKO-TEX Standard 100', ['Product class II', 'Recycled cotton fibre']),
        issued=-380, expires=-12, reference='OTX-23-55120', age=90,
        description='Expired. The new test samples were sent to the institute.')
    add('Fibre length and strength test', 'Material test reports', 'fibre-test-report.pdf',
        _pdf('Fibre test report', ['Mean fibre length: 14.2 mm', 'Strength: 24.1 cN/tex', 'Moisture: 7.8 %']),
        by='drying_user', issued=-6, reference='LAB-0926', link=('Fabric lot', 'Lot 1 - Cotton'), age=5)
    add('Colour fastness results', 'Material test reports', 'colour-fastness.csv',
        _csv([['test', 'grade'], ['Washing', '4'], ['Rubbing (dry)', '4-5'], ['Light', '3-4']]),
        by='decolor_user', issued=-15, link=('Fabric lot', 'Lot 2 - Polyester blend'), age=14)
    add('Moisture readings, incoming bales', 'Material test reports', 'moisture-readings.txt',
        b'Bale 1: 8.1 %\nBale 2: 9.4 %\nBale 3: 7.7 %\n', by='warehouse_user', issued=-2, age=2,
        link=('Supplier', suppliers[0]))
    add('Hydrogen peroxide 50% safety data sheet', 'Safety data sheets', 'sds-hydrogen-peroxide.pdf',
        _pdf('Safety data sheet', ['Hydrogen peroxide 50 %', 'Oxidiser. Wear gloves and eye protection.']),
        by='decolor_user', issued=-700, expires=18, reference='SDS-H2O2-07', link=('Chemical', 'Hydrogen Peroxide'),
        age=150, revisions=[('New edition from the supplier', 'sds-hydrogen-peroxide-rev8.pdf',
                             _pdf('Safety data sheet', ['Hydrogen peroxide 50 %', 'Edition 8']))])
    add('Caustic soda safety data sheet', 'Safety data sheets', 'sds-caustic-soda.pdf',
        _pdf('Safety data sheet', ['Sodium hydroxide', 'Corrosive. Keep away from acids.']),
        by='decolor_user', issued=-200, expires=530, reference='SDS-NAOH-03', link=('Chemical', 'Caustic Soda'), age=60)
    add('Sodium hypochlorite safety data sheet', 'Safety data sheets', 'sds-sodium-hypochlorite.pdf',
        _pdf('Safety data sheet', ['Sodium hypochlorite 12 %', 'Never mix with acids.']),
        issued=-800, expires=-70, reference='SDS-NAOCL-02', link=('Chemical', 'Sodium Hypochlorite'), age=180)
    add('Batch record, decolorization', 'Production batch documents', 'batch-record.csv',
        _csv([['step', 'start', 'end', 'kg'], ['Fill', '08:10', '08:40', '450'], ['Process', '08:40', '11:30', '450'],
              ['Drain', '11:30', '11:50', '438']]),
        by='decolor_user', issued=-3, link=('Production order', 'MO-00001'), age=3)
    add('Sorting sheet', 'Production batch documents', 'sorting-sheet.txt',
        b'Lot sorted by colour.\nWhite: 210 kg\nColoured: 164 kg\nWaste: 22 kg\n',
        by='sorting_user', issued=-1, link=('Fabric lot', 'Lot 3 - Mixed'), age=1)
    add('Supplier registration', 'Supplier documents', 'supplier-registration.pdf',
        _pdf('Supplier registration', [suppliers[0], 'National tax number and sales tax registration']),
        by='warehouse_user', issued=-300, expires=65, link=('Supplier', suppliers[0]), age=45)
    add('Supply agreement', 'Supplier documents', 'supply-agreement.pdf',
        _pdf('Supply agreement', [suppliers[1], 'Post-consumer cotton waste, 12 months']),
        issued=-350, expires=9, reference='AGR-2025-11', link=('Supplier', suppliers[1]), age=100,
        description='Ends soon. Talks about the new prices have started.')
    add('Weighbridge slip', 'Purchase documents', 'weighbridge-slip.pdf',
        _pdf('Weighbridge slip', ['Gross: 14,820 kg', 'Tare: 6,240 kg', 'Net: 8,580 kg']),
        by='warehouse_user', issued=-4, link=('Purchase order', 'PO-00001'), age=4)
    add('Supplier quotation', 'Purchase documents', 'quotation.pdf',
        _pdf('Quotation', [suppliers[2], 'Cotton clips, Rs. 92 per kg, valid 30 days']),
        by='warehouse_user', issued=-10, expires=20, link=('Supplier', suppliers[2]), age=10)
    add('Customer supply contract', 'Customer documents', 'supply-contract.pdf',
        _pdf('Supply contract', [customers[0], 'Recycled cotton fibre, quarterly call-off']),
        issued=-150, expires=215, reference='CON-2026-03', link=('Customer', customers[0]), age=30)
    add('Customer quality requirements', 'Customer documents', 'quality-requirements.pdf',
        _pdf('Quality requirements', [customers[1], 'Fibre length min 12 mm, moisture max 9 %']),
        issued=-90, link=('Customer', customers[1]), age=20)
    add('Sales invoice', 'Invoices and delivery challans', 'sales-invoice.pdf',
        _pdf('Sales invoice', [customers[0], '2,400 kg recycled fibre']), issued=-8, link=('Invoice', 'INV-00001'), age=8)
    add('Delivery challan', 'Invoices and delivery challans', 'delivery-challan.pdf',
        _pdf('Delivery challan', [customers[0], 'Vehicle LES-4471, 48 bales']),
        issued=-8, link=('Sales order', 'Order 1'), age=8)
    add('Employment contract', 'Employee documents', 'employment-contract.pdf',
        _pdf('Employment contract', ['Machine operator, drying section']),
        issued=-420, link=('Employee', 'Bilal Ahmed'), age=160)
    add('Forklift licence', 'Employee documents', 'forklift-licence.pdf',
        _pdf('Forklift operator licence', ['Valid for two years']),
        issued=-715, expires=15, reference='FL-20931', link=('Employee', 'Usman Tariq'), age=75)
    add('Boiler inspection certificate', 'Quality certificates', 'boiler-inspection.pdf',
        _pdf('Boiler inspection certificate', ['Inspected and passed', 'Next inspection in 12 months']),
        by='drying_user', issued=-30, expires=335, reference='BLR-7741', link=('Machine', 'Boiler 1'), age=0)


def wipe_demo_documents():
    """Delete every document with its files, then the categories, and put the default categories back."""
    Document.objects.all().delete()   # versions go with them, and their files are removed from disk
    DocumentCategory.objects.all().delete()
    services.ensure_default_categories()
