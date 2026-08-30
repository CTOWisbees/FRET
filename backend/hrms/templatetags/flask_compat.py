import re
from django import template
from django.urls import reverse, NoReverseMatch
from django.utils.safestring import mark_safe
from django.utils.html import escape
from pdf_generator import ROLE_KEYS

register = template.Library()

@register.simple_tag(takes_context=True)
def url_for(context, viewname, **kwargs):
    """Flask url_for compatibility helper for Django templates."""
    # Filter out empty string or None kwargs
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    try:
        return reverse(viewname, kwargs=kwargs)
    except NoReverseMatch:
        try:
            return reverse(viewname, args=list(kwargs.values()))
        except NoReverseMatch:
            return f"#{viewname}"

@register.simple_tag(takes_context=True)
def get_flashed_messages(context, with_categories=False, category_filter=()):
    """Flask get_flashed_messages compatibility helper for Django templates."""
    messages = context.get('messages', [])
    result = []
    for msg in messages:
        # Django message tags: 'error', 'success', 'warning', 'info'
        category = getattr(msg, 'tags', 'info') or 'info'
        if category_filter and category not in category_filter:
            continue
        if with_categories:
            result.append((category, str(msg)))
        else:
            result.append(str(msg))
    return result

@register.filter
def nl2p(text):
    """Turns free-text textarea input into HTML paragraphs:
    a blank line starts a new paragraph, a single line break becomes <br>."""
    if not text:
        return ''
    paragraphs = re.split(r'\n\s*\n', str(text).strip())
    rendered = []
    for para in paragraphs:
        if not para.strip():
            continue
        safe = escape(para.strip()).replace('\n', '<br>\n')
        rendered.append(f'<p class="dossier-paragraph">{safe}</p>')
    return mark_safe('\n'.join(rendered))
