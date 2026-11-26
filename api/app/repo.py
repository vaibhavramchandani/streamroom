"""Data layer.

`Repo` is the interface the routes use. `InMemoryRepo` is the fake used until
replica-backend adds `PostgresRepo` (same methods, backed by replica/schema.sql).
Swapping it changes no route code.
"""

import secrets
import uuid
from typing import Protocol

from .models import Member, Profile, Room


class Repo(Protocol):
    def upsert_profile(self, user_id: str, display_name: str, plan_id: str | None = None) -> Profile: ...
    def get_profile(self, user_id: str) -> Profile | None: ...
    def create_room(self, owner_id: str, name: str) -> Room: ...
    def get_room(self, room_id: str) -> Room | None: ...
    def get_room_by_invite(self, code: str) -> Room | None: ...
    def rooms_for_user(self, user_id: str) -> list[Room]: ...
    def get_member(self, room_id: str, user_id: str) -> Member | None: ...
    def members(self, room_id: str) -> list[Member]: ...
    def add_member(self, room_id: str, user_id: str) -> Member: ...
    def update_member(self, room_id: str, user_id: str, role: str | None, can_stream: bool | None) -> Member: ...
    def remove_member(self, room_id: str, user_id: str) -> None: ...


class InMemoryRepo:
    def __init__(self) -> None:
        self.profiles: dict[str, Profile] = {}
        self.rooms: dict[str, Room] = {}
        self.memberships: dict[tuple[str, str], Member] = {}

    # profiles
    def upsert_profile(self, user_id: str, display_name: str, plan_id: str | None = None) -> Profile:
        p = self.profiles.get(user_id)
        if p is None:
            p = Profile(id=user_id, display_name=display_name, plan_id=plan_id or "free")
            self.profiles[user_id] = p
        else:
            p.display_name = display_name
            if plan_id:
                p.plan_id = plan_id
        return p

    def get_profile(self, user_id: str) -> Profile | None:
        return self.profiles.get(user_id)

    # rooms
    def create_room(self, owner_id: str, name: str) -> Room:
        room = Room(id=str(uuid.uuid4()), owner_id=owner_id, name=name, invite_code=secrets.token_hex(6))
        self.rooms[room.id] = room
        self.memberships[(room.id, owner_id)] = Member(room.id, owner_id, role="owner")
        return room

    def get_room(self, room_id: str) -> Room | None:
        return self.rooms.get(room_id)

    def get_room_by_invite(self, code: str) -> Room | None:
        return next((r for r in self.rooms.values() if r.invite_code == code), None)

    def rooms_for_user(self, user_id: str) -> list[Room]:
        ids = [rid for (rid, uid) in self.memberships if uid == user_id]
        return sorted((self.rooms[i] for i in ids), key=lambda r: r.created_at, reverse=True)

    # members
    def get_member(self, room_id: str, user_id: str) -> Member | None:
        return self.memberships.get((room_id, user_id))

    def members(self, room_id: str) -> list[Member]:
        return sorted((m for (rid, _), m in self.memberships.items() if rid == room_id), key=lambda m: m.joined_at)

    def add_member(self, room_id: str, user_id: str) -> Member:
        key = (room_id, user_id)
        if key not in self.memberships:  # joining twice is a no-op
            self.memberships[key] = Member(room_id, user_id)
        return self.memberships[key]

    def update_member(self, room_id: str, user_id: str, role: str | None, can_stream: bool | None) -> Member:
        m = self.memberships[(room_id, user_id)]
        if role is not None:
            m.role = role  # type: ignore[assignment]
        if can_stream is not None:
            m.can_stream = can_stream
        return m

    def remove_member(self, room_id: str, user_id: str) -> None:
        self.memberships.pop((room_id, user_id), None)


_repo = InMemoryRepo()


def get_repo() -> Repo:
    return _repo
