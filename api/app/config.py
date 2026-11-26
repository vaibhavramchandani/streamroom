from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All config comes from env vars (or api/.env). See api/.env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # dev: sign in with just a name (local testing only).
    # supabase: verify Supabase Auth JWTs (production).
    auth_mode: Literal["dev", "supabase"] = "dev"
    dev_jwt_secret: str = "dev-only-change-me-dev-only-change-me"
    supabase_url: str = ""  # https://<project>.supabase.co

    # LiveKit. `livekit-server --dev` uses devkey / secret on ws://localhost:7880.
    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"
    livekit_token_ttl_seconds: int = 600

    web_origin: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
