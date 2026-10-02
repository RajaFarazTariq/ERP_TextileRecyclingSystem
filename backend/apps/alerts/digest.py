"""The e-mail digest: one message listing the open items of every rule marked "send e-mail"."""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone
from django.utils.html import escape

from . import rules

logger = logging.getLogger(__name__)

COLOURS = {'danger': '#DC2626', 'warning': '#D97706', 'info': '#2563EB'}


def _text(sections):
    lines = []
    for rule, items in sections:
        lines += ['', f'{rule.title} ({len(items)})']
        lines += [f'  - {"[ESCALATED] " if i["escalated"] else ""}{i["title"]} {i["message"]}' for i in items]
    return '\n'.join(lines).strip()


def _html(sections, day):
    blocks = []
    for rule, items in sections:
        rows = ''.join(
            f'<li style="margin:4px 0;color:{COLOURS[i["severity"]]};"><span style="color:#111827;">'
            f'{"<b>Escalated:</b> " if i["escalated"] else ""}<b>{escape(i["title"])}</b> {escape(i["message"])}'
            f'</span></li>' for i in items)
        blocks.append(f'<h3 style="margin:18px 0 6px;font-size:15px;">{escape(rule.title)} ({len(items)})</h3>'
                      f'<ul style="margin:0;padding-left:18px;font-size:14px;">{rows}</ul>')
    return (f'<div style="font-family:Arial,sans-serif;max-width:640px;">'
            f'<h2 style="margin:0 0 4px;">Textile ERP: needs attention</h2>'
            f'<p style="margin:0;color:#6B7280;font-size:13px;">{day:%d %b %Y}</p>{"".join(blocks)}</div>')


def send_digest():
    """
    Send the digest to MANAGEMENT_EMAIL. Returns the number of items sent,
    0 when there was nothing to report, or None when no recipient is set.
    """
    recipient = getattr(settings, 'MANAGEMENT_EMAIL', '')
    if not recipient:
        logger.warning('MANAGEMENT_EMAIL not set; skipping the alert digest')
        return None
    sections = rules.digest()
    count = sum(len(items) for _, items in sections)
    if not count:
        return 0
    message = EmailMultiAlternatives(
        f'[ERP] {count} item(s) need attention', _text(sections),
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'Textile ERP <noreply@localhost>'), [recipient])
    message.attach_alternative(_html(sections, timezone.localdate()), 'text/html')
    message.send(fail_silently=False)
    logger.info('Alert digest sent with %s item(s)', count)
    return count
