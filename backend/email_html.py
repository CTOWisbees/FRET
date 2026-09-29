"""
Turn Ghost's *web* HTML into email-safe HTML.

The Content API renders posts for the browser. Ghost's own newsletter renderer
passes `target: 'email'` into the same card renderers, which strips srcset,
clamps image dimensions for Outlook, and swaps in a smaller source. The Content
API does none of that, so we redo it here.

Reference: TryGhost/Koenig, packages/kg-default-cards/src/cards/image.ts
"""
import html as html_lib
import os
import re
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# Width of the content column in newsletter.render_email() (580 card - 35px padding each side).
DISPLAY_WIDTH = int(os.environ.get("EMAIL_IMAGE_DISPLAY_WIDTH", "510"))

# Which resized copy to actually request. Ghost only serves widths declared in
# the active theme's package.json `config.image_sizes`. 600 exists in every stock
# theme (Casper and Source both declare it); 1000 is Casper-only, 1200 is
# Source-only. Check yours before raising this — an undeclared width won't resolve.
SRC_WIDTH = int(os.environ.get("GHOST_EMAIL_IMAGE_WIDTH", "600"))

IMG_STYLE = (
    "display:block;width:100%;max-width:{w}px;height:auto;"
    "margin:0 auto;border:0;border-radius:8px;"
)

_IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
_ATTR = re.compile(r'(\w[\w-]*)\s*=\s*"([^"]*)"', re.I)
_LOCAL_IMAGE = re.compile(r"^(?P<base>.*?/content/images)/(?!size/)(?P<path>.+)$")
_SIZED_IMAGE = re.compile(r"/content/images/size/w\d+/")


def _email_src(url):
    """Point a Ghost or Unsplash image URL at a sensibly sized copy."""
    if not url:
        return url

    if "images.unsplash.com" in url:
        # Ghost clamps these too — without it Outlook renders the full original.
        parts = urlparse(url)
        q = dict(parse_qsl(parts.query))
        q["w"] = str(SRC_WIDTH * 2)
        return urlunparse(parts._replace(query=urlencode(q)))

    if _SIZED_IMAGE.search(url):
        return url  # already a resized variant, leave it

    m = _LOCAL_IMAGE.match(url)
    if m:
        return f"{m.group('base')}/size/w{SRC_WIDTH}/{m.group('path')}"

    return url  # external host, nothing we can do


def _rewrite_img(match):
    # Attribute values arrive HTML-escaped (`&amp;` inside a query string).
    # Decode before touching the URL, re-encode on the way out.
    attrs = {k: html_lib.unescape(v) for k, v in _ATTR.findall(match.group(0))}

    # Email clients ignore these at best, mis-handle them at worst.
    for dead in ("srcset", "sizes", "loading", "class", "style"):
        attrs.pop(dead, None)

    attrs["src"] = _email_src(attrs.get("src", ""))

    # Outlook cannot scale an image without explicit width/height, so scale the
    # original dimensions down to the content column rather than dropping them.
    cap = DISPLAY_WIDTH
    try:
        w, h = int(attrs["width"]), int(attrs["height"])
        if w > DISPLAY_WIDTH:
            attrs["height"] = str(round(h * DISPLAY_WIDTH / w))
            attrs["width"] = str(DISPLAY_WIDTH)
        else:
            cap = w  # never upscale a small image to fill the column
    except (KeyError, ValueError, ZeroDivisionError):
        attrs.pop("width", None)
        attrs.pop("height", None)

    attrs.setdefault("alt", "")
    attrs["style"] = IMG_STYLE.format(w=cap)

    rendered = " ".join(
        f'{k}="{html_lib.escape(v, quote=True)}"' for k, v in attrs.items()
    )
    return f"<img {rendered}>"


# Ghost's kg-* classes do nothing without the theme stylesheet, so give the
# handful of block elements that appear inside a post real inline styles.
_BLOCK_STYLES = [
    (re.compile(r"<figure\b[^>]*>", re.I), '<figure style="margin:28px 0;">'),
    (re.compile(r"<figcaption\b[^>]*>", re.I),
     '<figcaption style="margin-top:10px;text-align:center;font-size:13px;color:#64748b;">'),
    (re.compile(r"<blockquote\b[^>]*>", re.I),
     '<blockquote style="margin:24px 0;padding-left:16px;border-left:3px solid #e2e8f0;color:#52525b;">'),
    (re.compile(r"<pre\b[^>]*>", re.I),
     '<pre style="background:#f4f6f8;padding:14px;border-radius:8px;overflow-x:auto;font-size:14px;">'),
    (re.compile(r"<h2\b[^>]*>", re.I),
     '<h2 style="font-size:22px;font-weight:800;color:#0f172a;line-height:1.3;margin:32px 0 14px;">'),
    (re.compile(r"<h3\b[^>]*>", re.I),
     '<h3 style="font-size:18px;font-weight:700;color:#0f172a;margin:28px 0 12px;">'),
    (re.compile(r"<p\b[^>]*>", re.I), '<p style="margin:0 0 20px;color:#334155;">'),
    (re.compile(r"<a\b(?![^>]*\bstyle=)([^>]*)>", re.I),
     r'<a\1 style="color:#4f46e5;text-decoration:none;font-weight:600;">'),
]


def prepare_for_email(html):
    """Rewrite a Ghost post's `html` field so it survives Outlook and Gmail."""
    if not html:
        return ""
    html = _IMG_TAG.sub(_rewrite_img, html)
    for pattern, replacement in _BLOCK_STYLES:
        html = pattern.sub(replacement, html)
    return html


def email_feature_image(url):
    """Sized URL for the hero image at the top of the newsletter."""
    return _email_src(url)
