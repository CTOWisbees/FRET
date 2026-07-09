"""
Ghost Content API client.

Read-only. The Content API key is safe to hold server-side and cannot write
anything. GHOST_ADMIN_API_KEY is only needed if your newsletter posts are
gated (visibility != 'public'), because the Content API truncates those.
"""
import os
from urllib.parse import urlencode

import requests

GHOST_URL = os.environ.get("GHOST_URL", "https://wisbees.com").rstrip("/")
CONTENT_KEY = os.environ.get("cd7e88cb2e1e4863b0dfdc51df")
ADMIN_KEY = os.environ.get("6a4fea1db64f1a00013b6066:b0ab3f261edc8b9dc9172290ae6f6eafc83fce683aef450565709fb52457fc0b")  # optional, "<id>:<hex secret>"
NEWSLETTER_TAG = os.environ.get("GHOST_NEWSLETTER_TAG", "newsletter")

_HEADERS = {"Accept-Version": "v5.0"}
LIST_FIELDS = "id,slug,title,excerpt,published_at,feature_image,visibility"


class GhostError(Exception):
    pass


def _content_get(path, **params):
    if not CONTENT_KEY:
        raise GhostError("GHOST_CONTENT_API_KEY is not set")
    params["key"] = CONTENT_KEY
    url = f"{GHOST_URL}/ghost/api/content/{path}/?{urlencode(params)}"
    r = requests.get(url, headers=_HEADERS, timeout=15)
    if r.status_code != 200:
        raise GhostError(f"Ghost Content API {r.status_code}: {r.text[:200]}")
    return r.json()


def _admin_token():
    """Ghost Admin API auth: HS256 JWT signed with the hex secret half of the key."""
    import jwt  # PyJWT
    from datetime import datetime, timedelta, timezone

    key_id, secret = ADMIN_KEY.split(":")
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"iat": now, "exp": now + timedelta(minutes=5), "aud": "/admin/"},
        bytes.fromhex(secret),
        algorithm="HS256",
        headers={"kid": key_id},
    )


def list_newsletter_posts(limit=20):
    """Recent posts carrying the newsletter tag, newest first."""
    data = _content_get(
        "posts",
        filter=f"tag:{NEWSLETTER_TAG}",
        limit=limit,
        order="published_at desc",
        fields=LIST_FIELDS,
    )
    return data.get("posts", [])


def get_newsletter_post(slug):
    """
    Full post by slug, with `html` populated — but ONLY if it carries the
    newsletter tag.

    This is the actual gate. The dropdown in work.html only lists tagged posts,
    but that's a UI convenience, not security — the browser sends whatever
    `post_slug` the form has, and a tampered request could name any public post
    on wisbees.com. This function is what /send-bulk-newsletter calls right
    before mailing, so it's where the check has to live.
    """
    data = _content_get(f"posts/slug/{slug}", include="tags,authors", formats="html")
    posts = data.get("posts") or []
    if not posts:
        raise GhostError(f"No post found with slug '{slug}'")
    post = posts[0]

    tags = {t["slug"] for t in post.get("tags", [])}
    if NEWSLETTER_TAG not in tags:
        raise GhostError(
            f"'{post['title']}' isn't tagged #{NEWSLETTER_TAG} — only newsletter "
            "posts can be sent through this tool."
        )

    if post.get("visibility") != "public":
        if not ADMIN_KEY:
            raise GhostError(
                f"Post '{slug}' is {post['visibility']}-only. The Content API only "
                "returns a preview of it. Set GHOST_ADMIN_API_KEY to send the full text."
            )
        post = _get_post_via_admin(post["id"])
        # Admin API doesn't echo `include=tags` the same way; re-verify here too
        # so a members-only post can't skip the check via the admin fallback path.
        admin_tags = {t["slug"] for t in post.get("tags", [])}
        if NEWSLETTER_TAG not in admin_tags:
            raise GhostError(
                f"'{post['title']}' isn't tagged #{NEWSLETTER_TAG} — only newsletter "
                "posts can be sent through this tool."
            )

    if not post.get("html"):
        raise GhostError(f"Post '{slug}' has no HTML body")
    return post


def _get_post_via_admin(post_id):
    url = f"{GHOST_URL}/ghost/api/admin/posts/{post_id}/?formats=html&include=tags"
    r = requests.get(
        url,
        headers={**_HEADERS, "Authorization": f"Ghost {_admin_token()}"},
        timeout=15,
    )
    if r.status_code != 200:
        raise GhostError(f"Ghost Admin API {r.status_code}: {r.text[:200]}")
    return r.json()["posts"][0]
