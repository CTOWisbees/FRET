import re
from jinja2 import Environment, pass_context
from django.urls import reverse, NoReverseMatch
from django.contrib import messages
from django.templatetags.static import static
from django.utils.safestring import mark_safe
from django.utils.html import escape
from pdf_generator import ROLE_KEYS

@pass_context
def jinja_url_for(context, endpoint, **kwargs):
    if endpoint == 'static':
        filename = kwargs.get('filename') or kwargs.get('path') or ''
        return static(filename)
    
    kwargs = {k: v for k, v in kwargs.items() if v is not None}
    try:
        return reverse(endpoint, kwargs=kwargs)
    except NoReverseMatch:
        try:
            return reverse(endpoint, args=list(kwargs.values()))
        except NoReverseMatch:
            return f"#{endpoint}"

@pass_context
def jinja_get_flashed_messages(context, with_categories=False, category_filter=()):
    request = context.get('request')
    if not request:
        return []
    storage = messages.get_messages(request)
    result = []
    for msg in storage:
        category = getattr(msg, 'tags', 'info') or 'info'
        if category_filter and category not in category_filter:
            continue
        if with_categories:
            result.append((category, str(msg)))
        else:
            result.append(str(msg))
    return result

def nl2p(text):
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

def environment(**options):
    env = Environment(**options)
    env.globals['url_for'] = jinja_url_for
    env.globals['get_flashed_messages'] = jinja_get_flashed_messages
    env.globals['ALL_ROLE_KEYS'] = ROLE_KEYS
    env.filters['nl2p'] = nl2p
    return env
