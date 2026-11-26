from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import CurrentUser, current_user, issue_dev_token
from .config import Settings, get_settings
from .media import mint_token, room_name
from .models import (
    PLANS,
    DevSignIn,
    DevSignInOut,
    MemberOut,
    MemberPatch,
    MeOut,
    PlanOut,
    RoomCreate,
    RoomOut,
    TokenOut,
)
from .repo import Repo, get_repo

app = FastAPI(title="Streamroom API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().web_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _me(repo: Repo, user_id: str) -> MeOut:
    p = repo.get_profile(user_id)
    assert p is not None
    plan = PLANS[p.plan_id]
    return MeOut(id=p.id, display_name=p.display_name, plan=PlanOut(**plan.__dict__))


def _room_out(repo: Repo, room_id: str, user_id: str) -> RoomOut:
    room = repo.get_room(room_id)
    me = repo.get_member(room_id, user_id)
    assert room and me
    members = []
    for m in repo.members(room_id):
        prof = repo.get_profile(m.user_id)
        members.append(
            MemberOut(user_id=m.user_id, display_name=prof.display_name if prof else "?", role=m.role, can_stream=m.can_stream)
        )
    return RoomOut(id=room.id, name=room.name, invite_code=room.invite_code, my_role=me.role, members=members)


def _require_member(repo: Repo, room_id: str, user_id: str):
    # Same 404 for "no such room" and "not a member", so room ids can't be probed.
    m = repo.get_member(room_id, user_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")
    return m


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/auth/dev", response_model=DevSignInOut)
def dev_sign_in(body: DevSignIn, settings: Settings = Depends(get_settings), repo: Repo = Depends(get_repo)):
    if settings.auth_mode != "dev":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    name = body.display_name.strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a name")
    user_id, token = issue_dev_token(settings, name)
    repo.upsert_profile(user_id, name, body.plan_id)
    return DevSignInOut(token=token, me=_me(repo, user_id))


@app.get("/me", response_model=MeOut)
def get_me(user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    return _me(repo, user.id)


@app.get("/rooms", response_model=list[RoomOut])
def list_rooms(user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    return [_room_out(repo, r.id, user.id) for r in repo.rooms_for_user(user.id)]


@app.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(body: RoomCreate, user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Give the room a name")
    room = repo.create_room(user.id, name)
    return _room_out(repo, room.id, user.id)


@app.post("/rooms/join/{invite_code}", response_model=RoomOut)
def join_room(invite_code: str, user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    room = repo.get_room_by_invite(invite_code)
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That invite link doesn’t work any more")
    repo.add_member(room.id, user.id)
    return _room_out(repo, room.id, user.id)


@app.get("/rooms/{room_id}", response_model=RoomOut)
def get_room(room_id: str, user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    _require_member(repo, room_id, user.id)
    return _room_out(repo, room_id, user.id)


@app.patch("/rooms/{room_id}/members/{member_id}", response_model=RoomOut)
def patch_member(
    room_id: str,
    member_id: str,
    body: MemberPatch,
    user: CurrentUser = Depends(current_user),
    repo: Repo = Depends(get_repo),
):
    me = _require_member(repo, room_id, user.id)
    if me.role not in ("owner", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the room owner or an admin can change this")
    target = repo.get_member(room_id, member_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if target.role == "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The owner’s settings can’t be changed")
    if body.role is not None and me.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owner can change roles")
    repo.update_member(room_id, member_id, body.role, body.can_stream)
    return _room_out(repo, room_id, user.id)


@app.delete("/rooms/{room_id}/members/{member_id}", status_code=204)
def remove_member(room_id: str, member_id: str, user: CurrentUser = Depends(current_user), repo: Repo = Depends(get_repo)):
    me = _require_member(repo, room_id, user.id)
    target = repo.get_member(room_id, member_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if target.role == "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The owner can’t be removed")
    if member_id != user.id and me.role not in ("owner", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the room owner or an admin can remove people")
    repo.remove_member(room_id, member_id)
    # TODO(replica-backend): also call LiveKit RemoveParticipant so they drop out of the live call.
    return Response(status_code=204)


@app.post("/rooms/{room_id}/token", response_model=TokenOut)
def room_token(
    room_id: str,
    user: CurrentUser = Depends(current_user),
    repo: Repo = Depends(get_repo),
    settings: Settings = Depends(get_settings),
):
    member = _require_member(repo, room_id, user.id)
    profile = repo.get_profile(user.id)
    assert profile
    plan = PLANS[profile.plan_id]
    token = mint_token(
        settings,
        room_id=room_id,
        user_id=user.id,
        display_name=profile.display_name,
        can_stream=member.can_stream,
        plan=plan,
    )
    return TokenOut(
        url=settings.livekit_url,
        token=token,
        identity=user.id,
        room_name=room_name(room_id),
        can_stream=member.can_stream,
        max_height=plan.max_height,
        max_fps=plan.max_fps,
    )
