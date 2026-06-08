"""채팅 WebSocket 핸들러 테스트 (SC-WP-05 C4, SC-SPEC-04 §3·케이스 매트릭스).

DB/redis/엔진 없이 통과:
- 순수 헬퍼(parse_payload / resolve_personal_turn) 직접 검증.
- `run_turn` 은 협력자(engine/repo/load_doc/commit/ws) 전부 fake 주입 — surface 분기,
  md 게이트(편집+md 만 작성 활성), delta 스트림→done, 엔진 실패→error 미저장.
- 연결 거부(미인증/타인/부재)는 TestClient.websocket_connect + seam monkeypatch.

WS+엔진 풀 통합(라이브 도서관 grounding·resume)은 admin 라이브 게이트.
"""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.exceptions import EngineError, EngineTimeoutError, ForbiddenError
from app.main import app
from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from app.ws import chat as ws_chat
from app.ws.chat import parse_payload, resolve_personal_turn, run_turn

# ─────────────────────────── fakes ───────────────────────────


class FakeWS:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)


class DisconnectWS:
    """클라가 스트리밍 도중 끊긴 WS — `raise_after` 회 성공 후 send_json 이
    WebSocketDisconnect 를 던진다(고아 응답 방지 회귀 테스트용)."""

    def __init__(self, *, raise_after: int = 0) -> None:
        self.sent: list[dict] = []  # 성공 송신만 기록
        self.raise_after = raise_after
        self._calls = 0

    async def send_json(self, payload: dict) -> None:
        self._calls += 1
        if self._calls > self.raise_after:
            raise WebSocketDisconnect(code=1001)
        self.sent.append(payload)


class FakeEngine:
    def __init__(
        self, *, deltas=(), canonical="응답", finalize_exc: Exception | None = None
    ) -> None:
        self.deltas = list(deltas)
        self.canonical = canonical
        self.finalize_exc = finalize_exc
        self.submit_calls: list[dict] = []

    async def submit_turn(self, thread, content, *, doc_content=None, edit_mode=None) -> str:
        self.submit_calls.append(
            {
                "content": content,
                "doc_content": doc_content,
                "edit_mode": edit_mode,
                "surface": thread.surface,
                "session_id": thread.session_id,
            }
        )
        return "task-x"

    def stream_turn(self, task_id):
        deltas = self.deltas

        async def _gen():
            for d in deltas:
                yield SimpleNamespace(type="text", text=d)

        return _gen()

    async def finalize(self, thread, task_id, thread_repo) -> str:
        if self.finalize_exc is not None:
            raise self.finalize_exc
        return self.canonical


class FakeMsgRepo:
    def __init__(self) -> None:
        self.added: list[ChatMessage] = []

    async def add(self, message: ChatMessage) -> ChatMessage:
        if message.id is None:
            message.id = uuid.uuid4()
        if message.created_at is None:
            message.created_at = datetime.now(UTC)
        self.added.append(message)
        return message


def _thread(surface: str, *, session_id: str | None = None) -> ChatThread:
    return ChatThread(
        id=uuid.uuid4(), user_id=uuid.uuid4(), surface=surface, session_id=session_id
    )


async def _run(thread, data, *, engine, load_doc=None, user_id=None, ws=None):
    """run_turn 구동 헬퍼 — ws/commit/repo 캡처를 묶어 반환. ws 미지정 시 FakeWS."""
    ws = ws if ws is not None else FakeWS()
    msg_repo = FakeMsgRepo()
    committed: list[bool] = []

    async def commit() -> None:
        committed.append(True)

    async def _default_load_doc(doc_id, uid):  # personal 미사용 경로 방어
        raise AssertionError("load_doc 호출되면 안 됨")

    await run_turn(
        ws,
        engine,
        thread,
        data,
        thread_repo=object(),
        message_repo=msg_repo,
        load_doc=load_doc or _default_load_doc,
        commit=commit,
        user_id=user_id or thread.user_id,
    )
    return ws, msg_repo, committed


# ─────────────────────────── parse_payload (순수) ───────────────────────────


def test_parse_payload_chat() -> None:
    assert parse_payload("chat", {"content": "안녕"}) == ("안녕", None, None)


def test_parse_payload_chat_ignores_doc_fields() -> None:
    # chat 은 doc_id/edit_mode 무시(None)
    assert parse_payload("chat", {"content": "q", "doc_id": "x", "edit_mode": "편집"}) == (
        "q",
        None,
        None,
    )


def test_parse_payload_personal_full() -> None:
    did = uuid.uuid4()
    content, doc_id, edit_mode = parse_payload(
        "personal", {"content": "써줘", "doc_id": str(did), "edit_mode": "편집"}
    )
    assert (content, doc_id, edit_mode) == ("써줘", did, "편집")


def test_parse_payload_personal_no_doc_id() -> None:
    # 선택된 문서 없음 — 답변만(doc_id None)
    assert parse_payload("personal", {"content": "q"}) == ("q", None, None)


def test_parse_payload_empty_content_raises() -> None:
    with pytest.raises(ValueError):
        parse_payload("chat", {"content": "   "})
    with pytest.raises(ValueError):
        parse_payload("chat", {})


def test_parse_payload_bad_doc_id_raises() -> None:
    with pytest.raises(ValueError):
        parse_payload("personal", {"content": "q", "doc_id": "not-a-uuid"})


# ─────────────────────────── resolve_personal_turn (md 게이트, 순수) ───────────────────────────


def test_resolve_md_edit_activates_authoring() -> None:
    doc = SimpleNamespace(format="md", title="메모")
    assert resolve_personal_turn(doc, "# 본문", "편집") == ("# 본문", "편집")


def test_resolve_md_view_is_answer_only() -> None:
    doc = SimpleNamespace(format="md", title="메모")
    assert resolve_personal_turn(doc, "# 본문", "보기") == ("# 본문", "보기")


def test_resolve_nonmd_never_authoring() -> None:
    doc = SimpleNamespace(format="pdf", title="보고서")
    content, edit_mode = resolve_personal_turn(doc, None, "편집")  # 편집 요청이라도
    assert edit_mode == "보기"  # 비-md 는 작성 금지
    assert content is not None and "보고서" in content  # 제목/포맷만


# ─────────────────────────── run_turn: 정상 흐름 ───────────────────────────


async def test_run_turn_chat_streams_and_saves() -> None:
    engine = FakeEngine(deltas=["안", "녕"], canonical="안녕하세요")
    thread = _thread("chat")
    ws, msg_repo, committed = await _run(thread, {"content": "하이"}, engine=engine)

    # submit: chat = 문서 컨텍스트/편집 없음
    assert engine.submit_calls[0]["content"] == "하이"
    assert engine.submit_calls[0]["doc_content"] is None
    assert engine.submit_calls[0]["edit_mode"] is None
    # 이벤트: delta 2 + done
    types = [e["type"] for e in ws.sent]
    assert types == ["delta", "delta", "done"]
    assert [e["text"] for e in ws.sent[:2]] == ["안", "녕"]
    done = ws.sent[-1]["message"]
    assert done["role"] == "assistant" and done["content"] == "안녕하세요"
    # 저장: user + assistant, commit
    assert [(m.role, m.content) for m in msg_repo.added] == [
        ("user", "하이"),
        ("assistant", "안녕하세요"),
    ]
    assert committed == [True]


async def test_run_turn_personal_md_edit_injects_and_authors() -> None:
    engine = FakeEngine(canonical="# 수정본")
    thread = _thread("personal")
    did = uuid.uuid4()

    async def load_doc(doc_id, uid):
        assert doc_id == did
        return SimpleNamespace(format="md", title="메모"), "# 원본"

    ws, _, committed = await _run(
        thread,
        {"content": "보고서 써줘", "doc_id": str(did), "edit_mode": "편집"},
        engine=engine,
        load_doc=load_doc,
    )
    call = engine.submit_calls[0]
    assert call["doc_content"] == "# 원본"  # 현재 문서 주입
    assert call["edit_mode"] == "편집"  # md + 편집 → 작성 활성
    assert committed == [True]


async def test_run_turn_personal_nonmd_blocks_authoring() -> None:
    engine = FakeEngine()
    thread = _thread("personal")
    did = uuid.uuid4()

    async def load_doc(doc_id, uid):
        return SimpleNamespace(format="pdf", title="보고서"), None

    await _run(
        thread,
        {"content": "이 숫자 맞아?", "doc_id": str(did), "edit_mode": "편집"},
        engine=engine,
        load_doc=load_doc,
    )
    assert engine.submit_calls[0]["edit_mode"] == "보기"  # 비-md → 작성 안 함


async def test_run_turn_personal_no_doc_answer_only() -> None:
    engine = FakeEngine()
    thread = _thread("personal")
    ws, _, _ = await _run(thread, {"content": "일반 질문"}, engine=engine)
    # doc_id 없음 → load_doc 미호출, 컨텍스트 없음
    assert engine.submit_calls[0]["doc_content"] is None
    assert engine.submit_calls[0]["edit_mode"] is None


# ─────────────────────────── run_turn: WS 끊김 내성 (T-009) ───────────────────────────


async def test_run_turn_saves_when_client_disconnects_midstream() -> None:
    """delta 송신 도중 클라가 끊겨도(WebSocketDisconnect) finalize+저장+commit 은 수행,
    done 송신은 생략 — 고아 응답 방지(DB SoT)."""
    engine = FakeEngine(deltas=["안", "녕"], canonical="안녕하세요")
    ws = DisconnectWS(raise_after=0)  # 첫 delta 부터 끊김
    _, msg_repo, committed = await _run(
        _thread("chat"), {"content": "하이"}, engine=engine, ws=ws
    )
    # 저장 불변식: 끊겨도 user+assistant 영속 + commit
    assert [(m.role, m.content) for m in msg_repo.added] == [
        ("user", "하이"),
        ("assistant", "안녕하세요"),
    ]
    assert committed == [True]
    # done 미송신(클라 떠남) — 성공 송신 없음
    assert ws.sent == [] and all(e.get("type") != "done" for e in ws.sent)
    # finalize 도달했음(엔진 canonical 사용) — 저장 내용이 그 증거
    assert msg_repo.added[-1].content == "안녕하세요"


async def test_run_turn_partial_stream_then_disconnect_still_saves() -> None:
    """첫 delta 는 도달, 이후 끊김 — 남은 delta 는 생략하되 저장/commit 은 수행."""
    engine = FakeEngine(deltas=["a", "b", "c"], canonical="abc")
    ws = DisconnectWS(raise_after=1)  # 첫 delta 성공 후 끊김
    _, msg_repo, committed = await _run(
        _thread("chat"), {"content": "q"}, engine=engine, ws=ws
    )
    assert ws.sent == [{"type": "delta", "text": "a"}]  # 첫 delta 만 도달
    assert [(m.role, m.content) for m in msg_repo.added] == [
        ("user", "q"),
        ("assistant", "abc"),
    ]
    assert committed == [True]


# ─────────────────────────── run_turn: 에러 (미저장) ───────────────────────────


async def test_run_turn_empty_content_errors_without_submit() -> None:
    engine = FakeEngine()
    ws, msg_repo, committed = await _run(_thread("chat"), {"content": " "}, engine=engine)
    assert ws.sent == [
        {"type": "error", "code": "INVALID_PAYLOAD", "message": ws.sent[0]["message"]}
    ]
    assert engine.submit_calls == []  # submit 도달 안 함
    assert msg_repo.added == [] and committed == []


async def test_run_turn_engine_error_event_no_save() -> None:
    engine = FakeEngine(finalize_exc=EngineError("실패"))
    ws, msg_repo, committed = await _run(_thread("chat"), {"content": "q"}, engine=engine)
    assert ws.sent[-1]["type"] == "error" and ws.sent[-1]["code"] == "ENGINE_ERROR"
    assert msg_repo.added == [] and committed == []  # 에러 턴 미저장


async def test_run_turn_engine_timeout_event() -> None:
    engine = FakeEngine(finalize_exc=EngineTimeoutError("지연"))
    ws, _, committed = await _run(_thread("chat"), {"content": "q"}, engine=engine)
    assert ws.sent[-1]["type"] == "error" and ws.sent[-1]["code"] == "ENGINE_TIMEOUT"
    assert committed == []


async def test_run_turn_forbidden_doc_errors_without_submit() -> None:
    engine = FakeEngine()
    thread = _thread("personal")

    async def load_doc(doc_id, uid):
        raise ForbiddenError("다른 유저의 문서")

    ws, _, committed = await _run(
        thread,
        {"content": "q", "doc_id": str(uuid.uuid4()), "edit_mode": "보기"},
        engine=engine,
        load_doc=load_doc,
    )
    assert ws.sent[-1]["type"] == "error" and ws.sent[-1]["code"] == "FORBIDDEN"
    assert engine.submit_calls == [] and committed == []


# ─────────────────────────── 연결 거부 (TestClient + seam monkeypatch) ───────────────────────────


def _user() -> User:
    return User(id=uuid.uuid4(), email="a@t.com", password_hash="x", display_name="A", org="t")


def test_ws_rejects_unauthenticated(monkeypatch) -> None:
    async def no_user(ws):
        return None

    monkeypatch.setattr(ws_chat, "load_user", no_user)
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/chat/{uuid.uuid4()}"):
            pass
    assert exc.value.code == ws_chat.WS_UNAUTHENTICATED


def test_ws_rejects_missing_thread(monkeypatch) -> None:
    user = _user()

    async def ret_user(ws):
        return user

    async def no_thread(tid):
        return None

    monkeypatch.setattr(ws_chat, "load_user", ret_user)
    monkeypatch.setattr(ws_chat, "load_thread", no_thread)
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/chat/{uuid.uuid4()}"):
            pass
    assert exc.value.code == ws_chat.WS_NOT_FOUND


def test_ws_rejects_other_users_thread(monkeypatch) -> None:
    user = _user()
    other_thread = ChatThread(id=uuid.uuid4(), user_id=uuid.uuid4(), surface="chat")

    async def ret_user(ws):
        return user

    async def ret_thread(tid):
        return other_thread

    monkeypatch.setattr(ws_chat, "load_user", ret_user)
    monkeypatch.setattr(ws_chat, "load_thread", ret_thread)
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/chat/{uuid.uuid4()}"):
            pass
    assert exc.value.code == ws_chat.WS_FORBIDDEN
