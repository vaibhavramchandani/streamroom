"""Everything LiveKit-specific on the server lives here, so the provider can change later."""

import json
from datetime import timedelta

from livekit import api as lk

from .config import Settings
from .models import Plan


def room_name(room_id: str) -> str:
    return f"room-{room_id}"


def mint_token(
    settings: Settings,
    *,
    room_id: str,
    user_id: str,
    display_name: str,
    can_stream: bool,
    plan: Plan,
) -> str:
    # Everyone can talk and watch. Only members with can_stream may share a screen.
    sources = ["microphone"]
    if can_stream:
        sources += ["screen_share", "screen_share_audio"]
    caps = {"max_height": plan.max_height, "max_fps": plan.max_fps, "plan": plan.id}
    return (
        lk.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(user_id)
        .with_name(display_name)
        .with_ttl(timedelta(seconds=settings.livekit_token_ttl_seconds))
        .with_metadata(json.dumps(caps))
        .with_attributes({k: str(v) for k, v in caps.items()})
        .with_grants(
            lk.VideoGrants(
                room_join=True,
                room=room_name(room_id),
                can_publish=True,
                can_publish_sources=sources,
                can_subscribe=True,
                can_publish_data=True,
                can_update_own_metadata=False,
            )
        )
        .to_jwt()
    )
