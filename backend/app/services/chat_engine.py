"""채팅 엔진 — open-kknaks producer 배선 (SC-WP-05 C3, SC-SPEC-04 §3 엔진/세션 모델).

C2 REST(thread 생성/목록/이력) 위에 **엔진 round-trip(submit → result → session 저장)**
만 얹는다. WS(`app/ws/`)·메시지 DB 저장·스트리밍 push 는 **C4** — 여기서 만들지 않는다.

큐·워커·Redis 는 open-kknaks 내장(AgentClient producer + RedisBroker + ClaudeWorker).
우리는 AgentClient 로 잡을 적재(submit)하고 결과를 회수(result)하며, 첫 턴에 Claude Code
CLI 가 발급한 `result_session_id` 를 thread 에 저장해 이후 resume 키로 쓴다.

## open-kknaks 옵션 채널 (원본 검증)
- `submit(prompt, *, context=, options=, provider_options=)`:
  - `prompt` = 유저 메시지(턴 본문).
  - `context` = 추가 컨텍스트 — surface=personal 일 때 **현재 문서 내용**을 주입.
  - `options` (executor 가 직접 읽음): `cwd`(→work_dir override), `timeout_sec`(**int 필수**),
    `resume={"mode":"session","session_id":..}`(→ `claude --resume <sid>`).
  - `provider_options` (worker `_merge_config` → `ClaudeConfig.merge_task_overrides`,
    **OVERRIDABLE_FIELDS 만**): `allowed_tools`/`disallowed_tools`/`permission_mode`/
    `append_system_prompt`/`system_prompt`/`model`/`max_turns` 등. work_dir 은 여기로 못
    바꾼다(보안 드롭) → cwd 는 `options` 로.
- `result(task_id, timeout=)` → `Task`(`.result` canonical 텍스트, `.result_session_id`,
  `.status`). None=미발견.

## surface 게이팅 (쓰기 경계는 **도구가 아니라 마운트**로 강제 — 워커는 사용자 데이터를 못 쓴다)
- 워커에 쓰기 마운트가 없다(medi-doc 는 `:ro`, 개인스페이스 미마운트). 도크의 "in-place
  반영"은 응답 텍스트를 FE 에디터에 반영하는 것이지 워커가 파일을 쓰는 게 아니다(spec-04 쓰기 경계).
- 양 surface 모두 `cwd`=도서관(:ro)을 탐색하므로 **동일 도구셋**(GROUNDING_TOOLS, Bash 포함).
  텍스트/PDF 는 네이티브 Read, **xlsx/docx(바이너리 오피스)는 Bash+python(openpyxl/python-docx)
  으로 추출**(읽기/추출 전용, `:ro` 라 변경 불가) — T-013 전까진 chat 만 Bash 였으나 personal 도
  도서관 바이너리를 못 읽는 버그라 통일.
- `chat`(사이드바): 문서 컨텍스트/쓰기 없음 — 도서관 탐색/Q&A 전용.
- `personal`(도크): 현재 열린 문서를 `context` 로 주입 + 도서관 grounding 병행. `edit_mode=="편집"`
  이면 "수정된 전체 마크다운 제시"를 프롬프트로 유도(FE 가 에디터 in-place 반영), 그 외(보기)는
  의견/답변만. 쓰기 경계는 Bash 제외가 아니라 마운트(:ro + 개인문서 미마운트)로 강제.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from open_kknaks import AgentClient, StreamEvent, TaskStatus

from app.exceptions import EngineError, EngineTimeoutError

if TYPE_CHECKING:  # 순환/런타임 import 회피 — 타입만
    from fastapi import Request

    from app.models.chat import ChatThread
    from app.repositories.chat import ChatThreadRepository

# 그라운딩 도구 화이트리스트(headless `claude -p` allowlist — 목록 밖 도구는 자동 차단).
# **chat·personal 양 surface 동일**(T-013): 둘 다 cwd=도서관(:ro)을 탐색하므로 도서관 바이너리
# 오피스(xlsx/docx)를 Bash+python(openpyxl/python-docx)으로 추출해야 한다 — Read 는 텍스트/PDF
# 만 파싱하므로. 쓰기 경계는 도구가 아니라 **마운트**로 강제: medi-doc 는 `:ro`, 워커에 개인문서
# 쓰기 마운트 없음 → Bash 는 읽기/추출 전용, 사용자 데이터 변경 불가(personal 에 Bash 줘도 안전).
GROUNDING_TOOLS = ["Read", "Glob", "Grep", "Bash"]


def _allowed_tools(surface: str) -> list[str]:
    """surface 별 도구 화이트리스트. 양 surface 동일 — 바이너리 추출용 Bash 포함(T-013).

    쓰기 경계는 Bash 제외가 아니라 `:ro` 마운트로 강제되므로 personal 도 Bash 안전.
    """
    return GROUNDING_TOOLS

# result() 가 PTY(timeout_sec)보다 먼저 끊겨 still-running task 를 false TIMEOUT 으로
# 오판하지 않도록, producer 대기는 PTY 상한 + 이 버퍼로 둔다.
_RESULT_TIMEOUT_BUFFER_SEC = 60

# 페르소나 + 그라운딩 지침(append_system_prompt) — 데모용 인라인 조립(DB 주입 아님,
# spec 발명 금지: 의도만 충족). 정확 문구는 구현 재량.
_PERSONA = (
    "당신은 오로라 메디뷰티 사내 문서 AI 어시스턴트입니다. "
    "도서관(medi-doc) 문서를 근거로 정확하고 간결하게 답하며, 근거가 된 문서의 출처를 밝힙니다. "
    "탐색은 medi-doc 의 index.md 에서 시작해 관련 문서로 좁혀 가십시오."
)
_GROUNDING_CHAT = (
    "이 대화는 도서관 탐색/Q&A 전용입니다. 도서관 문서를 직접 읽어 요약/인사이트/답변을 "
    "제공하되, 어떤 파일도 생성하거나 수정하지 마십시오. "
    "문서 포맷별 읽는 법: md/txt 등 텍스트와 pdf 는 직접 읽으십시오. "
    "xlsx 는 Bash 로 `python -c`(openpyxl), docx 는 python-docx 를 실행해 본문/수치를 추출하십시오 "
    "(바이너리라 직접 읽을 수 없습니다). 표·수치는 추측하지 말고 실제 파일에서 추출해 인용하며, "
    "index.md 요약으로 대체하지 마십시오."
)
# personal 도 도서관(medi-doc, :ro)을 cwd 로 탐색 가능하므로, 바이너리 추출 지침을 chat 과
# 동형으로 둔다(T-013): 현재 문서 컨텍스트 + 도서관 grounding 을 함께 활용한다.
_GROUNDING_PERSONAL_BINARY = (
    "도서관(medi-doc) 문서가 필요하면 직접 읽으십시오: md/txt 등 텍스트와 pdf 는 직접, "
    "xlsx 는 Bash 로 `python -c`(openpyxl), docx 는 python-docx 를 실행해 본문/수치를 추출하십시오 "
    "(바이너리라 직접 읽을 수 없습니다). 표·수치는 추측하지 말고 실제 파일에서 추출해 인용하십시오."
)
_GROUNDING_PERSONAL_EDIT = (
    "사용자가 현재 개인스페이스 문서를 편집 중입니다(아래 컨텍스트가 그 문서 내용). "
    "작성/수정 요청에는 **수정된 전체 마크다운 문서**를 코드블록 없이 본문으로 제시하십시오 "
    "(사용자 에디터가 이 내용을 그대로 반영합니다). 파일을 직접 쓰지는 마십시오. "
    + _GROUNDING_PERSONAL_BINARY
)
_GROUNDING_PERSONAL_VIEW = (
    "아래 컨텍스트는 사용자가 현재 보고 있는 문서입니다. 이를 근거로 의견/답변만 제공하고, "
    "문서를 다시 쓰거나 수정본을 제시하지 마십시오. "
    + _GROUNDING_PERSONAL_BINARY
)


def _system_prompt(surface: str, edit_mode: str | None) -> str:
    """surface/edit_mode 별 append_system_prompt 조립.

    NOTE(C4 계약): `edit_mode=="편집"` 은 **md 작성 활성** 신호다. 문서 포맷(md 여부)은
    `personal_docs.format` 에 있고 C4(WS)가 보유하므로, **C4 가 `편집` + md 일 때만**
    `edit_mode="편집"` 을 넘긴다(보기/비-md 는 `"보기"` 또는 None). 엔진은 md 판별을 하지
    않는다 — 넘어온 `편집`을 작성 게이트로 신뢰한다.
    """
    parts = [_PERSONA]
    if surface == "personal":
        if edit_mode == "편집":
            parts.append(_GROUNDING_PERSONAL_EDIT)
        else:
            parts.append(_GROUNDING_PERSONAL_VIEW)
    else:  # chat (사이드바)
        parts.append(_GROUNDING_CHAT)
    return "\n\n".join(parts)


class ChatEngine:
    """open-kknaks AgentClient 를 보유한 단일 공유 엔진(앱 lifespan 수명).

    `submit_turn` → task_id, `finalize` → canonical 응답 + session_id 저장,
    `stream_turn` → 스트림 래퍼(C4 WS 가 소비, C3 미사용).
    """

    def __init__(
        self,
        client: AgentClient,
        *,
        work_dir: str,
        timeout_sec: int,
    ) -> None:
        self.client = client
        self.work_dir = work_dir
        # PTY 실행 상한(int 보장 — executor 가 isinstance(int) 체크).
        self.timeout_sec = int(timeout_sec)
        # producer result() 대기 — PTY 상한 + 버퍼(false TIMEOUT 방지).
        self.result_timeout_sec = self.timeout_sec + _RESULT_TIMEOUT_BUFFER_SEC

    async def submit_turn(
        self,
        thread: ChatThread,
        content: str,
        *,
        doc_content: str | None = None,
        edit_mode: str | None = None,
    ) -> str:
        """턴 적재 → task_id. resume 분기 + surface 게이팅.

        - `thread.session_id` 있으면 resume(이어가기), 없으면 새 세션(첫 턴).
        - surface=chat: cwd=도서관(:ro) read-only 탐색.
        - surface=personal: 현재 문서를 `context` 로 주입, edit_mode 별 프롬프트 유도.
        """
        options: dict[str, Any] = {
            "cwd": self.work_dir,  # 도서관 docs(:ro) — read-only 그라운딩 (work_dir override)
            "timeout_sec": self.timeout_sec,  # int — executor 가 그대로 읽음
        }
        if thread.session_id:
            options["resume"] = {"mode": "session", "session_id": thread.session_id}

        provider_options: dict[str, Any] = {
            # 양 surface 동일 도구셋(Bash=바이너리 추출). 쓰기 경계는 :ro 마운트로 강제(T-013).
            "allowed_tools": _allowed_tools(thread.surface),
            "append_system_prompt": _system_prompt(thread.surface, edit_mode),
        }

        # 도크(personal)만 현재 문서 내용을 컨텍스트로 주입(보기/편집 무관). 사이드바(chat)는
        # 문서 컨텍스트 없음 — 도서관을 직접 탐색한다.
        context = doc_content if thread.surface == "personal" else None

        return await self.client.submit(
            content,
            context=context,
            options=options,
            provider_options=provider_options,
        )

    async def finalize(
        self,
        thread: ChatThread,
        task_id: str,
        thread_repo: ChatThreadRepository,
    ) -> str:
        """결과 회수 + session_id 저장 → canonical 응답 텍스트.

        - 첫 턴 완료 후 발급된 `result_session_id` 가 thread.session_id 와 다르면(첫턴
          None→저장) 저장하고 `thread_repo.update`(flush+refresh)로 영속.
        - result None / status failed·cancelled → EngineError, 미완(done 아님, 타임아웃)
          → EngineTimeoutError.

        > C3 범위: 메시지(user/assistant) DB 저장은 **하지 않는다**(C4 가 응답 완료 시).
        """
        result = await self.client.result(task_id, timeout=self.result_timeout_sec)
        if result is None:
            raise EngineError(f"엔진 결과 없음(task={task_id})")

        status = result.status
        if status == TaskStatus.DONE:
            pass  # 정상
        elif status in (TaskStatus.FAILED, TaskStatus.CANCELLED):
            raise EngineError(result.error or f"엔진 실패(status={status})")
        else:  # pending / running / retrying — result() 대기 후에도 미완 = 타임아웃
            raise EngineTimeoutError(f"엔진 타임아웃(status={status})")

        sid = result.result_session_id
        if sid and sid != thread.session_id:
            thread.session_id = sid
            await thread_repo.update(thread)

        return result.result or ""

    def stream_turn(
        self,
        task_id: str,
        *,
        timeout: float | None = None,
        event_types: set[str] | None = None,
    ) -> AsyncIterator[StreamEvent]:
        """`client.stream` 얇은 래퍼(async generator) — **C4 WS 가 소비, C3 미사용**.

        시그니처만 제공해 C4 리팩토를 막는다. timeout 미지정 시 result 대기와 동일 상한.
        """
        return self.client.stream(
            task_id,
            timeout=timeout if timeout is not None else self.result_timeout_sec,
            event_types=event_types,
        )


def get_chat_engine(request: Request) -> ChatEngine:
    """FastAPI 의존성 — lifespan 이 app.state 에 둔 단일 공유 ChatEngine 을 주입한다.

    C4 WS 핸들러가 `Depends(get_chat_engine)` 로 받아 submit/stream/finalize 한다.
    """
    return request.app.state.chat_engine
