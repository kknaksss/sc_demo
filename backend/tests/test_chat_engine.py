"""ChatEngine 단위 테스트 (SC-WP-05 C3, SC-SPEC-04 §3 엔진/세션 모델).

DB/redis 없이 통과 — AgentClient 를 인메모리 fake 로 대체하고 thread_repo.update 를
스파이로 검증한다. 라이브 엔진 왕복은 admin 게이트(worker 기동 필요).

검증:
- 새 세션(resume 없음) vs resume(thread.session_id 있을 때 options.resume) 분기
- surface 옵션: chat=cwd + read-only allowed_tools(+ context None) / personal=context 주입
- timeout_sec 가 int 로 전달(executor isinstance(int) 요구)
- session_id 첫턴 저장(None→sid, update 호출) · 이후 동일 sid → update 미호출
- 엔진 실패(status failed/None)→EngineError · 미완(running)→EngineTimeoutError
"""

import uuid

import pytest
from open_kknaks import Task, TaskStatus

from app.exceptions import EngineError, EngineTimeoutError
from app.models.chat import ChatThread
from app.services.chat_engine import CHAT_TOOLS, READ_ONLY_TOOLS, ChatEngine


class FakeAgentClient:
    """submit 인자를 캡처하고 미리 정해둔 Task 를 result 로 반환하는 fake."""

    def __init__(self, result: Task | None = None) -> None:
        self.submitted: list[dict] = []
        self._result = result
        self.result_calls: list[tuple[str, float]] = []

    async def submit(
        self, prompt, *, context=None, options=None, provider_options=None, **kw
    ) -> str:
        self.submitted.append(
            {
                "prompt": prompt,
                "context": context,
                "options": options or {},
                "provider_options": provider_options or {},
            }
        )
        return "task-1"

    async def result(self, task_id, *, timeout=600):
        self.result_calls.append((task_id, timeout))
        return self._result


class SpyThreadRepo:
    """update 호출만 기록 — finalize 의 session_id 저장 분기 검증용."""

    def __init__(self) -> None:
        self.updated: list[ChatThread] = []

    async def update(self, thread: ChatThread) -> ChatThread:
        self.updated.append(thread)
        return thread


def _thread(surface: str, *, session_id: str | None = None) -> ChatThread:
    return ChatThread(id=uuid.uuid4(), user_id=uuid.uuid4(), surface=surface, session_id=session_id)


def _engine(client: FakeAgentClient) -> ChatEngine:
    return ChatEngine(client, work_dir="/app/medi-doc", timeout_sec=600)


def _done(result="응답 본문", sid="sess-1") -> Task:
    return Task(prompt="x", status=TaskStatus.DONE, result=result, result_session_id=sid)


# ── submit_turn: resume 분기 ──


async def test_submit_first_turn_no_resume() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(_thread("chat"), "안녕")
    options = client.submitted[0]["options"]
    assert "resume" not in options  # 첫 턴 = 새 세션


async def test_submit_resume_when_session_id() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(_thread("chat", session_id="sess-9"), "이어서")
    options = client.submitted[0]["options"]
    assert options["resume"] == {"mode": "session", "session_id": "sess-9"}


# ── submit_turn: surface 게이팅 ──


async def test_submit_chat_grounding_tools_and_cwd_no_context() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(_thread("chat"), "도서관 질문", doc_content="무시됨")
    call = client.submitted[0]
    assert call["options"]["cwd"] == "/app/medi-doc"
    # chat 은 바이너리 오피스(xlsx/docx) 추출용 Bash 를 포함한 그라운딩 도구.
    assert call["provider_options"]["allowed_tools"] == CHAT_TOOLS
    assert call["context"] is None  # 사이드바는 문서 컨텍스트 없음
    assert "append_system_prompt" in call["provider_options"]


async def test_submit_chat_includes_bash_for_binary_grounding() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(_thread("chat"), "sales.xlsx 매출")
    tools = client.submitted[0]["provider_options"]["allowed_tools"]
    assert "Bash" in tools  # xlsx/docx 를 python 으로 추출하려면 Bash 필요


async def test_submit_personal_injects_doc_context() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(
        _thread("personal"), "이 문서 요약", doc_content="# 주간 메모\n내용", edit_mode="보기"
    )
    call = client.submitted[0]
    assert call["context"] == "# 주간 메모\n내용"  # 도크는 현재 문서 주입
    assert call["provider_options"]["allowed_tools"] == READ_ONLY_TOOLS  # 여전히 read-only


async def test_submit_personal_excludes_bash_security_boundary() -> None:
    """개인스페이스 surface 는 Bash 없음 — 워커에 개인문서 마운트 없고 md 컨텍스트만.

    쓰기 경계 회귀 가드: personal 에 Bash 가 새지 않는다(chat 한정 추출 도구).
    """
    client = FakeAgentClient()
    await _engine(client).submit_turn(
        _thread("personal"), "작성", doc_content="d", edit_mode="편집"
    )
    tools = client.submitted[0]["provider_options"]["allowed_tools"]
    assert "Bash" not in tools


async def test_submit_personal_edit_prompt_differs_from_view() -> None:
    client = FakeAgentClient()
    eng = _engine(client)
    await eng.submit_turn(_thread("personal"), "작성", doc_content="d", edit_mode="편집")
    await eng.submit_turn(_thread("personal"), "질문", doc_content="d", edit_mode="보기")
    edit_prompt = client.submitted[0]["provider_options"]["append_system_prompt"]
    view_prompt = client.submitted[1]["provider_options"]["append_system_prompt"]
    assert edit_prompt != view_prompt  # 편집 = 작성 유도, 보기 = 답변만


async def test_submit_timeout_sec_is_int() -> None:
    client = FakeAgentClient()
    await _engine(client).submit_turn(_thread("chat"), "q")
    ts = client.submitted[0]["options"]["timeout_sec"]
    assert isinstance(ts, int)  # executor 가 isinstance(int) 아니면 무시


# ── finalize: session_id 저장 + 결과 ──


async def test_finalize_saves_session_id_first_turn() -> None:
    client = FakeAgentClient(_done(result="답", sid="sess-new"))
    repo = SpyThreadRepo()
    thread = _thread("chat", session_id=None)
    out = await _engine(client).finalize(thread, "task-1", repo)
    assert out == "답"
    assert thread.session_id == "sess-new"
    assert repo.updated == [thread]  # 저장됨


async def test_finalize_no_update_when_session_unchanged() -> None:
    client = FakeAgentClient(_done(sid="sess-same"))
    repo = SpyThreadRepo()
    thread = _thread("chat", session_id="sess-same")
    await _engine(client).finalize(thread, "task-1", repo)
    assert repo.updated == []  # 동일 sid → update 미호출


async def test_finalize_result_timeout_exceeds_pty() -> None:
    client = FakeAgentClient(_done())
    await _engine(client).finalize(_thread("chat"), "task-1", SpyThreadRepo())
    _, timeout = client.result_calls[0]
    assert timeout > 600  # producer 대기 > PTY 상한(false TIMEOUT 방지)


# ── finalize: 실패/타임아웃 매핑 ──


async def test_finalize_none_raises_engine_error() -> None:
    client = FakeAgentClient(None)
    with pytest.raises(EngineError):
        await _engine(client).finalize(_thread("chat"), "task-1", SpyThreadRepo())


async def test_finalize_failed_raises_engine_error() -> None:
    client = FakeAgentClient(Task(prompt="x", status=TaskStatus.FAILED, error="boom"))
    with pytest.raises(EngineError):
        await _engine(client).finalize(_thread("chat"), "task-1", SpyThreadRepo())


async def test_finalize_still_running_raises_timeout() -> None:
    client = FakeAgentClient(Task(prompt="x", status=TaskStatus.RUNNING))
    with pytest.raises(EngineTimeoutError):
        await _engine(client).finalize(_thread("chat"), "task-1", SpyThreadRepo())
