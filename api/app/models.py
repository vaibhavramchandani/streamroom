from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["owner", "admin", "member"]


def now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    max_height: int
    max_fps: int


PLANS: dict[str, Plan] = {
    "free": Plan("free", "Free", 720, 30),
    "hd": Plan("hd", "HD", 1080, 60),
}


@dataclass
class Profile:
    id: str
    display_name: str
    plan_id: str = "free"
    created_at: datetime = field(default_factory=now)


@dataclass
class Room:
    id: str
    owner_id: str
    name: str
    invite_code: str
    max_streams: int = 10
    created_at: datetime = field(default_factory=now)


@dataclass
class Member:
    room_id: str
    user_id: str
    role: Role = "member"
    can_stream: bool = True
    joined_at: datetime = field(default_factory=now)


# ---- API shapes


class PlanOut(BaseModel):
    id: str
    name: str
    max_height: int
    max_fps: int


class MeOut(BaseModel):
    id: str
    display_name: str
    plan: PlanOut


class DevSignIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)
    plan_id: Literal["free", "hd"] = "free"


class DevSignInOut(BaseModel):
    token: str
    me: MeOut


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class MemberOut(BaseModel):
    user_id: str
    display_name: str
    role: Role
    can_stream: bool


class RoomOut(BaseModel):
    id: str
    name: str
    invite_code: str
    my_role: Role
    members: list[MemberOut]


class MemberPatch(BaseModel):
    role: Literal["admin", "member"] | None = None
    can_stream: bool | None = None


class TokenOut(BaseModel):
    url: str
    token: str
    identity: str
    room_name: str
    can_stream: bool
    max_height: int
    max_fps: int
