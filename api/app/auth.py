"""Who is calling.

dev mode: POST /auth/dev returns an HS256 token for a display name. Local only.
supabase mode: verify the Supabase Auth access token against the project's JWKS.
Either way the routes get a `CurrentUser`.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status

from .config import Settings, get_settings
from .repo import Repo, get_repo


@dataclass
class CurrentUser:
    id: str
    display_name: str


def issue_dev_token(settings: Settings, display_name: str) -> tuple[str, str]:
    user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"dev:{display_name.strip().lower()}"))
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    token = jwt.encode(
        {"sub": user_id, "name": display_name, "exp": exp, "iss": "streamroom-dev"},
        settings.dev_jwt_secret,
        algorithm="HS256",
    )
    return user_id, token


@lru_cache
def _jwks(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json")


def _decode(settings: Settings, token: str) -> dict:
    if settings.auth_mode == "dev":
        return jwt.decode(token, settings.dev_jwt_secret, algorithms=["HS256"], issuer="streamroom-dev")
    key = _jwks(settings.supabase_url).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        key.key,
        algorithms=["RS256", "ES256"],
        audience="authenticated",
        issuer=f"{settings.supabase_url}/auth/v1",
    )


def current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    repo: Repo = Depends(get_repo),
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in first")
    try:
        claims = _decode(settings, authorization.split(" ", 1)[1])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session expired. Sign in again.")
    user_id = claims["sub"]
    profile = repo.get_profile(user_id)
    if profile is None:
        name = claims.get("name") or claims.get("user_metadata", {}).get("full_name") or "New user"
        profile = repo.upsert_profile(user_id, str(name)[:40])
    return CurrentUser(id=profile.id, display_name=profile.display_name)
