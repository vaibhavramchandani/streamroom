import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.repo import InMemoryRepo, get_repo


@pytest.fixture
def client():
    repo = InMemoryRepo()
    app.dependency_overrides[get_repo] = lambda: repo
    yield TestClient(app)
    app.dependency_overrides.clear()


def sign_in(client, name, plan="free"):
    r = client.post("/auth/dev", json={"display_name": name, "plan_id": plan})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_requires_sign_in(client):
    assert client.get("/rooms").status_code == 401
    assert client.get("/rooms", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_create_join_and_list(client):
    host = sign_in(client, "Host")
    guest = sign_in(client, "Guest")
    room = client.post("/rooms", json={"name": "Friday games"}, headers=host).json()
    assert room["my_role"] == "owner"

    # guest can't see it until they use the invite
    assert client.get(f"/rooms/{room['id']}", headers=guest).status_code == 404
    joined = client.post(f"/rooms/join/{room['invite_code']}", headers=guest).json()
    assert joined["my_role"] == "member"
    assert {m["display_name"] for m in joined["members"]} == {"Host", "Guest"}
    # joining twice is harmless
    assert client.post(f"/rooms/join/{room['invite_code']}", headers=guest).status_code == 200
    assert len(client.get("/rooms", headers=guest).json()) == 1


def test_bad_invite(client):
    assert client.post("/rooms/join/nope", headers=sign_in(client, "X")).status_code == 404


def test_blank_names_rejected(client):
    assert client.post("/auth/dev", json={"display_name": "   "}).status_code == 422
    h = sign_in(client, "A")
    assert client.post("/rooms", json={"name": "  "}, headers=h).status_code == 422
    assert client.post("/rooms", json={"name": "x" * 61}, headers=h).status_code == 422


def _claims(token_out):
    s = get_settings()
    return jwt.decode(token_out["token"], s.livekit_api_secret, algorithms=["HS256"], options={"verify_aud": False})


def test_token_carries_plan_caps_and_room(client):
    hd = sign_in(client, "HD user", plan="hd")
    room = client.post("/rooms", json={"name": "r"}, headers=hd).json()
    out = client.post(f"/rooms/{room['id']}/token", headers=hd).json()
    assert (out["max_height"], out["max_fps"]) == (1080, 60)
    c = _claims(out)
    assert c["video"]["room"] == f"room-{room['id']}"
    assert c["video"]["roomJoin"] is True
    assert "screen_share" in c["video"]["canPublishSources"]
    assert c["attributes"]["max_fps"] == "60"


def test_free_plan_capped(client):
    free = sign_in(client, "Free user")
    room = client.post("/rooms", json={"name": "r"}, headers=free).json()
    out = client.post(f"/rooms/{room['id']}/token", headers=free).json()
    assert (out["max_height"], out["max_fps"]) == (720, 30)


def test_non_member_gets_no_token(client):
    host = sign_in(client, "Host")
    stranger = sign_in(client, "Stranger")
    room = client.post("/rooms", json={"name": "r"}, headers=host).json()
    assert client.post(f"/rooms/{room['id']}/token", headers=stranger).status_code == 404


def test_owner_can_block_streaming(client):
    host = sign_in(client, "Host")
    guest = sign_in(client, "Guest")
    room = client.post("/rooms", json={"name": "r"}, headers=host).json()
    joined = client.post(f"/rooms/join/{room['invite_code']}", headers=guest).json()
    guest_id = next(m["user_id"] for m in joined["members"] if m["display_name"] == "Guest")

    # a member can't change permissions
    host_id = next(m["user_id"] for m in joined["members"] if m["display_name"] == "Host")
    assert client.patch(f"/rooms/{room['id']}/members/{host_id}", json={"can_stream": False}, headers=guest).status_code == 403

    assert client.patch(f"/rooms/{room['id']}/members/{guest_id}", json={"can_stream": False}, headers=host).status_code == 200
    out = client.post(f"/rooms/{room['id']}/token", headers=guest).json()
    assert out["can_stream"] is False
    assert _claims(out)["video"]["canPublishSources"] == ["microphone"]


def test_remove_member(client):
    host = sign_in(client, "Host")
    guest = sign_in(client, "Guest")
    room = client.post("/rooms", json={"name": "r"}, headers=host).json()
    joined = client.post(f"/rooms/join/{room['invite_code']}", headers=guest).json()
    host_id = next(m["user_id"] for m in joined["members"] if m["display_name"] == "Host")
    guest_id = next(m["user_id"] for m in joined["members"] if m["display_name"] == "Guest")
    assert client.delete(f"/rooms/{room['id']}/members/{host_id}", headers=guest).status_code == 403
    assert client.delete(f"/rooms/{room['id']}/members/{guest_id}", headers=guest).status_code == 204  # leave
    assert client.get(f"/rooms/{room['id']}", headers=guest).status_code == 404
