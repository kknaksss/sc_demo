"""채팅 thread REST 통합 테스트 (SC-WP-05 C2, SC-SPEC-04 §3·케이스 매트릭스).

DB/redis 없이 통과 — get_current_user(고정 유저) + get_chat_service(인메모리 fake
repo 2종) 의존성 override. 미인증 케이스만 override 없이 실제 쿠키 의존성을 태운다
(쿠키 없음 → 401, DB/redis 미접근).

검증: 생성(surface 스탬프·title null·잘못된 surface 422)·목록(유저 스코프 + surface
격리 + updated_at desc)·이력(created_at asc, 빈 thread messages:[])·격리(FORBIDDEN/
THREAD_NOT_FOUND)·미인증(UNAUTHENTICATED)·session_id 전 응답 비노출.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.api.chat import get_chat_service, get_current_user
from app.main import app
from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from app.services.chat import ChatService

_SEED_TS = datetime(2026, 1, 1, tzinfo=UTC)


class FakeThreadRepo:
    """by_id/by_user_and_surface/add — ChatService 가 쓰는 표면(인메모리).

    add 는 server_default(id/created_at/updated_at)를 모사해 채운다(real DB 의
    INSERT…RETURNING eager_defaults 대응). by_user_and_surface 는 updated_at desc.
    """

    def __init__(self) -> None:
        self._by_id: dict[uuid.UUID, ChatThread] = {}

    async def by_id(self, thread_id: uuid.UUID) -> ChatThread | None:
        return self._by_id.get(thread_id)

    async def by_user_and_surface(
        self, user_id: uuid.UUID, surface: str
    ) -> list[ChatThread]:
        rows = [
            t
            for t in self._by_id.values()
            if t.user_id == user_id and t.surface == surface
        ]
        return sorted(rows, key=lambda t: t.updated_at, reverse=True)

    async def add(self, thread: ChatThread) -> ChatThread:
        now = datetime.now(UTC)
        if thread.id is None:
            thread.id = uuid.uuid4()
        if thread.created_at is None:
            thread.created_at = now
        if thread.updated_at is None:
            thread.updated_at = now
        self._by_id[thread.id] = thread
        return thread


class FakeMessageRepo:
    """by_thread/add — created_at asc 이력."""

    def __init__(self) -> None:
        self._rows: list[ChatMessage] = []

    async def by_thread(self, thread_id: uuid.UUID) -> list[ChatMessage]:
        rows = [m for m in self._rows if m.thread_id == thread_id]
        return sorted(rows, key=lambda m: m.created_at)

    async def add(self, message: ChatMessage) -> ChatMessage:
        if message.id is None:
            message.id = uuid.uuid4()
        if message.created_at is None:
            message.created_at = datetime.now(UTC)
        self._rows.append(message)
        return message


@pytest.fixture
def user() -> User:
    return User(
        id=uuid.uuid4(),
        email="a@test.com",
        password_hash="x",
        display_name="A",
        org="t",
    )


@pytest.fixture
def other_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def threads() -> FakeThreadRepo:
    return FakeThreadRepo()


@pytest.fixture
def messages() -> FakeMessageRepo:
    return FakeMessageRepo()


@pytest.fixture
def client(threads: FakeThreadRepo, messages: FakeMessageRepo, user: User):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_chat_service] = lambda: ChatService(threads, messages)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _seed_thread(
    threads: FakeThreadRepo,
    user_id: uuid.UUID,
    surface: str,
    *,
    title: str | None = None,
    session_id: str | None = "sess-internal",
    updated_at: datetime = _SEED_TS,
) -> ChatThread:
    """기존 thread 1행 직접 적재(생성 API 우회). session_id 를 일부러 채워
    응답 비노출을 검증한다."""
    thread = ChatThread(
        id=uuid.uuid4(),
        user_id=user_id,
        title=title,
        session_id=session_id,
        surface=surface,
        created_at=_SEED_TS,
        updated_at=updated_at,
    )
    threads._by_id[thread.id] = thread
    return thread


def _seed_message(
    messages: FakeMessageRepo,
    thread_id: uuid.UUID,
    role: str,
    content: str,
    created_at: datetime,
) -> ChatMessage:
    msg = ChatMessage(
        id=uuid.uuid4(),
        thread_id=thread_id,
        role=role,
        content=content,
        created_at=created_at,
    )
    messages._rows.append(msg)
    return msg


# ── 생성 (surface 스탬프) ──


def test_create_thread_chat(client) -> None:
    resp = client.post("/api/chat/threads", json={"surface": "chat"})
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert set(data.keys()) == {"id", "title", "surface", "created_at"}
    assert data["surface"] == "chat"
    assert data["title"] is None
    assert data["created_at"] is not None
    assert "session_id" not in data  # 내부 식별자 비노출


def test_create_thread_personal(client) -> None:
    resp = client.post("/api/chat/threads", json={"surface": "personal"})
    assert resp.status_code == 201
    assert resp.json()["data"]["surface"] == "personal"


def test_create_thread_invalid_surface_rejected(client) -> None:
    resp = client.post("/api/chat/threads", json={"surface": "bogus"})
    assert resp.status_code == 422  # schema Literal 거부


def test_create_thread_missing_surface_rejected(client) -> None:
    resp = client.post("/api/chat/threads", json={})
    assert resp.status_code == 422


# ── 목록 (유저 스코프 + surface 격리) ──


def test_list_surface_isolation(client, threads, user) -> None:
    _seed_thread(threads, user.id, "chat", title="사이드바 대화")
    _seed_thread(threads, user.id, "personal", title="도크 대화")

    chat_items = client.get("/api/chat/threads?surface=chat").json()["data"]["items"]
    personal_items = client.get("/api/chat/threads?surface=personal").json()["data"][
        "items"
    ]
    assert [i["title"] for i in chat_items] == ["사이드바 대화"]
    assert [i["title"] for i in personal_items] == ["도크 대화"]


def test_list_only_own_threads(client, threads, user, other_id) -> None:
    _seed_thread(threads, user.id, "chat", title="내 것")
    _seed_thread(threads, other_id, "chat", title="남의 것")  # 타유저 — 제외

    items = client.get("/api/chat/threads?surface=chat").json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["title"] == "내 것"
    assert set(items[0].keys()) == {"id", "title", "surface", "updated_at", "created_at"}
    assert "session_id" not in items[0]  # 비노출


def test_list_ordered_updated_desc(client, threads, user) -> None:
    _seed_thread(threads, user.id, "chat", title="old", updated_at=_SEED_TS)
    _seed_thread(
        threads, user.id, "chat", title="new", updated_at=_SEED_TS + timedelta(days=1)
    )
    items = client.get("/api/chat/threads?surface=chat").json()["data"]["items"]
    assert [i["title"] for i in items] == ["new", "old"]


def test_list_empty_is_not_error(client) -> None:
    resp = client.get("/api/chat/threads?surface=chat")
    assert resp.status_code == 200
    assert resp.json()["data"]["items"] == []


def test_list_invalid_surface_rejected(client) -> None:
    resp = client.get("/api/chat/threads?surface=bogus")
    assert resp.status_code == 422


# ── 단건 + 이력 ──


def test_get_thread_history_ordered(client, threads, messages, user) -> None:
    thread = _seed_thread(threads, user.id, "chat")
    _seed_message(messages, thread.id, "user", "두번째", _SEED_TS + timedelta(minutes=1))
    _seed_message(messages, thread.id, "user", "첫번째", _SEED_TS)
    _seed_message(
        messages, thread.id, "assistant", "응답", _SEED_TS + timedelta(minutes=2)
    )

    resp = client.get(f"/api/chat/threads/{thread.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"id", "surface", "messages"}
    assert [m["content"] for m in data["messages"]] == ["첫번째", "두번째", "응답"]
    assert set(data["messages"][0].keys()) == {"id", "role", "content", "created_at"}
    assert "session_id" not in data  # 비노출
    assert "doc_id" not in data["messages"][0]  # 메시지 런타임 — 이력에 없음


def test_get_thread_empty_messages(client, threads, user) -> None:
    thread = _seed_thread(threads, user.id, "personal")
    resp = client.get(f"/api/chat/threads/{thread.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["messages"] == []


# ── 유저 격리 / 케이스 매트릭스 ──


def test_get_thread_forbidden_other_user(client, threads, other_id) -> None:
    thread = _seed_thread(threads, other_id, "chat")  # 타유저 소유
    resp = client.get(f"/api/chat/threads/{thread.id}")
    assert resp.status_code == 403
    assert resp.json()["code"] == "FORBIDDEN"


def test_get_thread_not_found(client) -> None:
    resp = client.get(f"/api/chat/threads/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["code"] == "THREAD_NOT_FOUND"


# ── 미인증 (실제 쿠키 의존성, override 없음) ──


def test_unauthenticated_no_cookie() -> None:
    anon = TestClient(app)
    resp = anon.get("/api/chat/threads?surface=chat")
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"
