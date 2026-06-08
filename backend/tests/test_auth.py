"""인증 API 통합 테스트 (SC-WP-02 C3, SC-SPEC-03 §3·케이스 매트릭스).

DB/redis 없이 통과 — get_auth_service 의존성을 override 해 fake repo(해시된 시드 1행)
+ InMemorySessionStore 로 갈아끼운다. CORS preflight 는 미들웨어가 처리하므로 실제
OPTIONS 요청으로 검증한다(TestClient 직접 호출은 Origin 없이 가서 CORS 를 안 태움).

검증 대상: login 성공(쿠키 발급)·실패(INVALID_CREDENTIALS, 이메일 존재 비구분)·me
인증/미인증(UNAUTHENTICATED)·logout(204+쿠키 만료)·CORS preflight(명시 origin+credentials).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.api.auth import get_auth_service
from app.core.security import hash_password
from app.core.session import SESSION_COOKIE, InMemorySessionStore
from app.main import app
from app.models.user import User
from app.services.auth import AuthService

# 시드 1행(spec-03 §4 test1 계정) — 해시 저장(평문 금지).
_USER = User(
    id=uuid.uuid4(),
    email="test1@test.com",
    password_hash=hash_password("test1admin"),
    display_name="Test 1",
    org="test",
)


class FakeUserRepo:
    """by_email/by_id 만 흉내(AuthService 가 쓰는 표면)."""

    def __init__(self, user: User) -> None:
        self._by_email = {user.email: user}
        self._by_id = {user.id: user}

    async def by_email(self, email: str) -> User | None:
        return self._by_email.get(email)

    async def by_id(self, user_id: uuid.UUID) -> User | None:
        return self._by_id.get(user_id)


@pytest.fixture
def client():
    """공유 인메모리 세션 저장소 + fake repo 로 조립한 AuthService 를 주입한 클라이언트."""
    store = InMemorySessionStore()
    repo = FakeUserRepo(_USER)

    def _override() -> AuthService:
        return AuthService(repo, store)

    app.dependency_overrides[get_auth_service] = _override
    try:
        yield TestClient(app)
    finally:
        # 공유 app import 누수 방지(test_health 등 다른 테스트 보호).
        app.dependency_overrides.clear()


def _login(client: TestClient, password: str = "test1admin"):
    return client.post(
        "/api/auth/login",
        json={"email": "test1@test.com", "password": password},
    )


# ── login ──


def test_login_success_sets_cookie_and_returns_user(client: TestClient) -> None:
    resp = _login(client)
    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert user == {
        "id": str(_USER.id),
        "email": "test1@test.com",
        "display_name": "Test 1",
        "org": "test",
    }
    # role 누출 금지(v1 동등).
    assert "role" not in user
    # httpOnly 쿠키 세션 발급.
    set_cookie = resp.headers["set-cookie"]
    assert SESSION_COOKIE in set_cookie
    assert "httponly" in set_cookie.lower()
    assert client.cookies.get(SESSION_COOKIE)


def test_login_wrong_password_invalid_credentials(client: TestClient) -> None:
    resp = _login(client, password="wrong")
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_CREDENTIALS"
    assert resp.headers.get("set-cookie") is None


def test_login_unknown_email_invalid_credentials(client: TestClient) -> None:
    # 존재하지 않는 이메일도 동일 코드 — 이메일 존재 여부 비구분(열거 공격 방지).
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@test.com", "password": "whatever"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "INVALID_CREDENTIALS"


# ── me ──


def test_me_authenticated(client: TestClient) -> None:
    _login(client)  # TestClient 가 쿠키 보관 → 다음 요청에 자동 동반.
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["data"] == {
        "id": str(_USER.id),
        "email": "test1@test.com",
        "display_name": "Test 1",
        "org": "test",
    }


def test_me_unauthenticated(client: TestClient) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"


def test_me_with_bogus_cookie_unauthenticated(client: TestClient) -> None:
    client.cookies.set(SESSION_COOKIE, "not-a-real-session")
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"


# ── logout ──


def test_logout_invalidates_session(client: TestClient) -> None:
    _login(client)
    assert client.get("/api/auth/me").status_code == 200

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 204
    assert not resp.content  # 빈 body

    # 서버측 세션 무효화 → 만료 쿠키를 들고 다시 보내도 미인증.
    # (TestClient 가 만료 Set-Cookie 로 쿠키를 비우기도 하지만, 서버측 삭제가 본질.)
    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 401
    assert me_after.json()["code"] == "UNAUTHENTICATED"


# ── CORS (FE C4 플래그 — 브라우저 cross-origin 쿠키 인증) ──


def test_cors_preflight_allows_credentialed_post_from_fe_origin(client: TestClient) -> None:
    resp = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:33000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    # 명시적 origin(와일드카드 `*` 불가) + 자격 허용.
    assert resp.headers["access-control-allow-origin"] == "http://localhost:33000"
    assert resp.headers["access-control-allow-credentials"] == "true"


# ── 쿠키 secure 분기 (PLAN-106-T-001) ──
# Settings 레이어에서 검증한다 — _COOKIE_KWARGS·settings 는 import 타임 싱글톤이라
# import 후 monkeypatch 로 secure 를 못 뒤집는다. env → Settings() 분기만 단위검증.
def test_cookie_secure_defaults_false_for_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import Settings

    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    assert Settings().cookie_secure is False


def test_cookie_secure_true_when_env_set(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import Settings

    monkeypatch.setenv("COOKIE_SECURE", "true")
    assert Settings().cookie_secure is True
