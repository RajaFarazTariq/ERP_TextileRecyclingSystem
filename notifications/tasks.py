# notifications/tasks.py
"""
Email alert system for Textile ERP.
─────────────────────────────────────────────────────────────
SETUP REQUIRED in settings.py:
─────────────────────────────────────────────────────────────
  EMAIL_BACKEND      = 'django.core.mail.backends.smtp.EmailBackend'
  EMAIL_HOST         = 'smtp.gmail.com'
  EMAIL_PORT         = 587
  EMAIL_USE_TLS      = True
  EMAIL_HOST_USER    = 'your-sending-address@gmail.com'
  EMAIL_HOST_PASSWORD = 'your-app-password'       # Gmail App Password
  DEFAULT_FROM_EMAIL = 'Textile ERP <your-sending-address@gmail.com>'

  # Management alert recipient
  MANAGEMENT_EMAIL   = 'thisismefaraz@gmail.com'

─────────────────────────────────────────────────────────────
ALERT TYPES:
  1. Order completed (auto-triggered on status change)
  2. Payment received (auto-triggered on Payment save)
  3. Low chemical stock (checked daily or on issuance)
  4. Low warehouse stock (checked when stock is consumed)
  5. Daily production summary (scheduled)
  6. Monthly sales summary (scheduled, 1st of month)

─────────────────────────────────────────────────────────────
SIGNALS (auto-wiring) — add to notifications/apps.py:
  class NotificationsConfig(AppConfig):
      def ready(self):
          import notifications.signals   # noqa
─────────────────────────────────────────────────────────────
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.db.models import Sum, Count, Q
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)

MANAGEMENT_EMAIL = getattr(settings, 'MANAGEMENT_EMAIL', 'thisismefaraz@gmail.com')
FROM_EMAIL       = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Textile ERP <noreply@textile-erp.com>')

# ── Stock alert thresholds ────────────────────────────────────────────────────
CHEMICAL_LOW_PCT  = 0.25    # Alert when remaining < 25% of total
WAREHOUSE_LOW_KG  = 1000    # Alert when unloading_weight stock entries fall below

# ─────────────────────────────────────────────────────────────────────────────
# Core email sender
# ─────────────────────────────────────────────────────────────────────────────

def _send_alert(subject, text_body, html_body=None, extra_recipients=None):
    """
    Send email to management address (+ optional extra recipients).
    Swallows exceptions so alerts never crash business logic.
    """
    recipients = [MANAGEMENT_EMAIL]
    if extra_recipients:
        recipients += [e for e in extra_recipients if e and e != MANAGEMENT_EMAIL]

    try:
        if html_body:
            msg = EmailMultiAlternatives(subject, text_body, FROM_EMAIL, recipients)
            msg.attach_alternative(html_body, "text/html")
            msg.send(fail_silently=False)
        else:
            send_mail(subject, text_body, FROM_EMAIL, recipients, fail_silently=False)
        logger.info(f"Alert sent: {subject} → {recipients}")
    except Exception as exc:
        logger.error(f"Failed to send alert '{subject}': {exc}")


def _html_wrap(title, body_rows, color="#1E40AF"):
    """Generate a clean HTML email body."""
    rows_html = "".join(
        f'<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">'
        f'{label}</td>'
        f'<td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;text-align:right;">'
        f'{value}</td></tr>'
        for label, value in body_rows
    )
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;background:#f8fafc;padding:24px;border-radius:12px;">
      <div style="background:{color};border-radius:8px 8px 0 0;padding:18px 24px;">
        <h2 style="color:white;margin:0;font-size:18px;">Textile ERP</h2>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">{title}</p>
      </div>
      <div style="background:white;border-radius:0 0 8px 8px;padding:0;">
        <table style="width:100%;border-collapse:collapse;">{rows_html}</table>
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:16px;">
        Automated alert from Textile ERP Recycling System · {date.today().strftime('%d %b %Y')}
      </p>
    </div>
    """


# ─────────────────────────────────────────────────────────────────────────────
# 1. ORDER ALERTS
# ─────────────────────────────────────────────────────────────────────────────

def alert_order_completed(order):
    """
    Called when a SalesOrder status changes to 'Completed'.
    Sends alert to management.
    """
    rows = [
        ("Order ID",        f"#{order.id}"),
        ("Buyer",           order.buyer_name),
        ("Fabric Quality",  order.fabric_quality or "—"),
        ("Weight Sold",     f"{order.weight_sold:,} kg"),
        ("Total Amount",    f"Rs. {int(order.total_price):,}"),
        ("Payment Status",  order.payment_status),
        ("Date Completed",  date.today().strftime('%d %b %Y')),
    ]
    html = _html_wrap("✅ Sales Order Completed", rows, color="#059669")
    text = (
        f"ORDER COMPLETED\n"
        f"Order #{order.id} — {order.buyer_name}\n"
        f"Amount: Rs. {int(order.total_price):,}\n"
        f"Payment: {order.payment_status}"
    )
    _send_alert(
        subject=f"[ERP] Order #{order.id} Completed — {order.buyer_name}",
        text_body=text,
        html_body=html,
    )


def alert_order_dispatched(order, dispatch):
    """Called when a dispatch record is created/updated to Dispatched."""
    rows = [
        ("Order ID",        f"#{order.id}"),
        ("Buyer",           order.buyer_name),
        ("Vehicle",         dispatch.vehicle_number),
        ("Driver",          dispatch.driver_name),
        ("Driver Contact",  dispatch.driver_contact or "—"),
        ("Weight Dispatched", f"{int(dispatch.dispatched_weight):,} kg"),
        ("Dispatch Date",   date.today().strftime('%d %b %Y')),
    ]
    html = _html_wrap("🚚 Order Dispatched", rows, color="#7C3AED")
    text = (
        f"ORDER DISPATCHED\n"
        f"Order #{order.id} — {order.buyer_name}\n"
        f"Vehicle: {dispatch.vehicle_number} | Driver: {dispatch.driver_name}"
    )
    _send_alert(
        subject=f"[ERP] Order #{order.id} Dispatched — {order.buyer_name}",
        text_body=text,
        html_body=html,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. PAYMENT ALERTS
# ─────────────────────────────────────────────────────────────────────────────

def alert_payment_received(payment):
    """Called when a Payment record is created."""
    order = payment.sales_order
    rows = [
        ("Payment ID",      f"#{payment.id}"),
        ("Order",           f"#{order.id} — {order.buyer_name}" if order else "—"),
        ("Amount Received", f"Rs. {int(payment.amount):,}"),
        ("Method",          payment.payment_method),
        ("Reference",       payment.reference_number or "—"),
        ("Received By",     payment.received_by.username if payment.received_by else "—"),
        ("Date",            date.today().strftime('%d %b %Y')),
    ]
    html = _html_wrap("💰 Payment Received", rows, color="#1E40AF")
    text = (
        f"PAYMENT RECEIVED\n"
        f"Order #{order.id} — {order.buyer_name}\n" if order else ""
        f"Amount: Rs. {int(payment.amount):,} via {payment.payment_method}"
    )
    _send_alert(
        subject=f"[ERP] Payment Received — Rs. {int(payment.amount):,} ({order.buyer_name if order else '—'})",
        text_body=text,
        html_body=html,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. LOW STOCK ALERTS
# ─────────────────────────────────────────────────────────────────────────────

def check_chemical_stock_alerts():
    """
    Check all chemicals. Send ONE bundled alert if any are critically low.
    Call this: after any chemical issuance, and daily via management command.
    """
    from decolorization.models import ChemicalStock

    critical = []
    for chem in ChemicalStock.objects.all():
        total   = float(chem.total_stock or 0)
        remain  = float(chem.remaining_stock or 0)
        if total > 0 and (remain / total) < CHEMICAL_LOW_PCT:
            critical.append(chem)

    if not critical:
        return

    rows = [("Chemical", f"Remaining / Total | %")]
    for c in critical:
        total  = float(c.total_stock or 0)
        remain = float(c.remaining_stock or 0)
        pct    = round(remain / total * 100, 1) if total else 0
        rows.append((
            c.chemical_name,
            f"{int(remain):,} / {int(total):,} {c.unit_of_measure} ({pct}%)"
        ))

    html = _html_wrap(
        f"⚠️ {len(critical)} Chemical(s) Critically Low — Restock Required",
        rows, color="#DC2626"
    )
    text = (
        f"CHEMICAL STOCK ALERT — {len(critical)} item(s) below 25%\n" +
        "\n".join(f"  • {c.chemical_name}: {int(c.remaining_stock):,} {c.unit_of_measure} remaining" for c in critical)
    )
    _send_alert(
        subject=f"[ERP] ⚠️ Low Chemical Stock Alert — {len(critical)} item(s)",
        text_body=text,
        html_body=html,
    )


def check_warehouse_stock_alerts():
    """
    Alert if total warehouse unloading weight drops below threshold.
    Call after stock is consumed / dispatched.
    """
    from warehouse.models import Stock
    from django.db.models import Sum

    total_kg = Stock.objects.filter(
        status='Approved', is_deleted=False
    ).aggregate(t=Sum('unloading_weight'))['t'] or 0

    if float(total_kg) < WAREHOUSE_LOW_KG:
        rows = [
            ("Current Approved Stock",  f"{int(total_kg):,} kg"),
            ("Alert Threshold",         f"{WAREHOUSE_LOW_KG:,} kg"),
            ("Status",                  "⚠️ RESTOCK REQUIRED"),
        ]
        html = _html_wrap("📦 Warehouse Stock Running Low", rows, color="#D97706")
        text = (
            f"WAREHOUSE STOCK ALERT\n"
            f"Approved stock: {int(total_kg):,} kg — below {WAREHOUSE_LOW_KG:,} kg threshold."
        )
        _send_alert(
            subject=f"[ERP] ⚠️ Warehouse Stock Low — {int(total_kg):,} kg remaining",
            text_body=text,
            html_body=html,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 4. AUTO STATUS UPDATES
# ─────────────────────────────────────────────────────────────────────────────

def auto_update_order_payment_status(order):
    """
    Recalculate payment_status based on total payments collected vs order total.
    Call after any Payment is saved/deleted for an order.
    """
    from sales.models import Payment

    total_price    = float(order.total_price or 0)
    total_paid     = float(
        Payment.objects.filter(
            sales_order=order, is_deleted=False
        ).aggregate(t=Sum('amount'))['t'] or 0
    )

    if total_price <= 0:
        return

    if total_paid >= total_price:
        new_status = 'Paid'
    elif total_paid > 0:
        new_status = 'Partial'
    else:
        new_status = 'Pending'

    if order.payment_status != new_status:
        order.payment_status = new_status
        order.save(update_fields=['payment_status'])
        logger.info(f"Order #{order.id} payment_status auto-updated to {new_status}")


def auto_update_fabric_status(fabric_stock_id):
    """
    Auto-set FabricStock.status based on sorting sessions:
    - All sessions Completed → 'Sorted'
    - Any session In Progress → 'In Sorting'
    - No sessions → 'In Warehouse'
    """
    from sorting.models import FabricStock, SortingSession

    try:
        fabric = FabricStock.objects.get(id=fabric_stock_id)
    except FabricStock.DoesNotExist:
        return

    sessions = SortingSession.objects.filter(fabric=fabric)
    if not sessions.exists():
        new_status = 'In Warehouse'
    elif sessions.filter(status='In Progress').exists():
        new_status = 'In Sorting'
    elif sessions.filter(status='Pending').exists():
        new_status = 'In Sorting'
    elif sessions.filter(status='Completed').count() == sessions.count():
        new_status = 'Sorted'
    else:
        new_status = 'In Sorting'

    if fabric.status != new_status:
        fabric.status = new_status
        fabric.save(update_fields=['status'])
        logger.info(f"FabricStock #{fabric.id} auto-status → {new_status}")


def auto_update_tank_status(tank_id):
    """
    Auto-set Tank.tank_status based on decolorization session:
    - Session Completed → 'Completed'
    - Session In Progress → 'Processing'
    - fabric_quantity > 0, no session → 'Filled'
    - No fabric → 'Empty'
    """
    from decolorization.models import Tank, DecolorizationSession

    try:
        tank = Tank.objects.get(id=tank_id)
    except Tank.DoesNotExist:
        return

    sessions = DecolorizationSession.objects.filter(tank=tank)
    fabric_qty = float(tank.fabric_quantity or 0)

    if sessions.filter(status='In Progress').exists():
        new_status = 'Processing'
    elif sessions.filter(status='Completed').exists() and not sessions.filter(status='In Progress').exists():
        new_status = 'Completed'
    elif fabric_qty > 0:
        new_status = 'Filled'
    else:
        new_status = 'Empty'

    if tank.tank_status != new_status:
        tank.tank_status = new_status
        tank.save(update_fields=['tank_status'])
        logger.info(f"Tank #{tank.id} auto-status → {new_status}")


# ─────────────────────────────────────────────────────────────────────────────
# 5. SCHEDULED REPORTS  (call from management command or cron)
# ─────────────────────────────────────────────────────────────────────────────

def send_daily_production_summary():
    """
    Send a daily production summary email to management.
    Intended to run at end of business day (e.g. 18:00 via cron).
    """
    from warehouse.models import Stock
    from sorting.models import SortingSession
    from decolorization.models import DecolorizationSession
    from django.db.models import Sum, Count

    today = date.today()
    start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    end   = start + timedelta(days=1)

    stock_count = Stock.objects.filter(created_at__gte=start, created_at__lt=end).count()
    stock_wt    = Stock.objects.filter(created_at__gte=start, created_at__lt=end).aggregate(t=Sum('unloading_weight'))['t'] or 0

    sort_agg = SortingSession.objects.filter(
        Q(created_at__gte=start, created_at__lt=end) | Q(end_date__gte=start, end_date__lt=end)
    ).aggregate(inp=Sum('quantity_taken'), out=Sum('quantity_sorted'), wst=Sum('waste_quantity'))

    dec_agg = DecolorizationSession.objects.filter(
        Q(created_at__gte=start, created_at__lt=end) | Q(end_date__gte=start, end_date__lt=end)
    ).aggregate(inp=Sum('input_quantity'), out=Sum('output_quantity'), wst=Sum('waste_quantity'))

    si  = int(sort_agg['inp']  or 0)
    so  = int(sort_agg['out']  or 0)
    sw  = int(sort_agg['wst']  or 0)
    di  = int(dec_agg['inp']   or 0)
    do_ = int(dec_agg['out']   or 0)
    dw  = int(dec_agg['wst']   or 0)

    rows = [
        ("Date",                          today.strftime('%A, %d %B %Y')),
        ("Warehouse Receipts",            f"{stock_count} entries ({int(stock_wt):,} kg)"),
        ("Sorting — Input",               f"{si:,} kg"),
        ("Sorting — Output",              f"{so:,} kg"),
        ("Sorting — Waste",               f"{sw:,} kg ({round(sw/si*100,1) if si else 0}%)"),
        ("Decolorization — Input",        f"{di:,} kg"),
        ("Decolorization — Output",       f"{do_:,} kg"),
        ("Decolorization — Waste",        f"{dw:,} kg ({round(dw/di*100,1) if di else 0}%)"),
    ]
    html = _html_wrap(f"📊 Daily Production Summary — {today.strftime('%d %b %Y')}", rows)
    text = "\n".join(f"{k}: {v}" for k, v in rows)

    _send_alert(
        subject=f"[ERP] Daily Production Summary — {today.strftime('%d %b %Y')}",
        text_body=text,
        html_body=html,
    )


def send_monthly_sales_summary():
    """
    Send monthly sales summary. Call on the 1st of each month.
    """
    from sales.models import SalesOrder, Payment
    from django.db.models import Sum, Count
    import calendar

    today  = date.today()
    # Last month
    first_of_this = today.replace(day=1)
    last_month_end = first_of_this - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)

    month_name = calendar.month_name[last_month_end.month]
    year       = last_month_end.year

    start = timezone.make_aware(timezone.datetime.combine(last_month_start, timezone.datetime.min.time()))
    end   = timezone.make_aware(timezone.datetime.combine(last_month_end,   timezone.datetime.max.time()))

    order_agg = SalesOrder.objects.filter(
        created_at__gte=start, created_at__lte=end, is_deleted=False
    ).aggregate(count=Count('id'), revenue=Sum('total_price'), weight=Sum('weight_sold'))

    pay_agg = Payment.objects.filter(
        created_at__gte=start, created_at__lte=end, is_deleted=False
    ).aggregate(total=Sum('amount'))

    rev = int(order_agg['revenue'] or 0)
    col = int(pay_agg['total']    or 0)

    rows = [
        ("Period",              f"{month_name} {year}"),
        ("Total Orders",        str(order_agg['count'] or 0)),
        ("Total Revenue",       f"Rs. {rev:,}"),
        ("Amount Collected",    f"Rs. {col:,}"),
        ("Pending Amount",      f"Rs. {max(0, rev - col):,}"),
        ("Total Weight Sold",   f"{int(order_agg['weight'] or 0):,} kg"),
    ]
    html = _html_wrap(f"📈 Monthly Sales Summary — {month_name} {year}", rows, color="#059669")
    text = "\n".join(f"{k}: {v}" for k, v in rows)

    _send_alert(
        subject=f"[ERP] Monthly Sales Summary — {month_name} {year}",
        text_body=text,
        html_body=html,
    )
