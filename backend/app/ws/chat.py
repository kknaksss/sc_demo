"""채팅 WebSocket 엔드포인트 — `WS /ws/chat/{thread_id}` (SC-WP-05 C4, SC-SPEC-04 §3).

채팅을 실제로 살리는 핵심: 송신 → C3 엔진(submit) → 실시간 스트림 push(delta) → 완료 시
canonical 확정 + 메시지 DB 저장(done). 인증 거부/엔진 실패는 close code / error 이벤트.

## 세션 전략 (2단계 — get_session HTTP 의존성 못 씀)
- **연결 스코프**(auth/authorize): 쿠키 → 유저, thread 단건 + 소유 검사. accept 전에 거부
  (close 4401 미인증 / 4403 타인 / 4404 부재). 짧은 1회 세션.
- **턴 스코프**(메시지당): `async with async_session()` 1개 — thread 재로드(attached),
  doc 로드(personal), 메시지 저장, commit. 턴마다 독립 unit-of-work.

## 엔진/의존성은 **in-body 수동 조립**(Depends 금지)
- WS scope 엔 `Request` 가 없어 C3 `get_chat_engine(request)` 재사용 불가 → `websocket.app
  .state.chat_engine` 로 직접 읽는다. Depends 는 body 전(인증 전)에 발화돼 거부 경로까지
  엔진/broker/lifespan 상태에 묶이므로 쓰지 않는다. auth·engine·세션 전부 body 안에서 조립.

## WS 프로토콜 (코드 SoT — C5b 가 소비)
- 접속: `WS /ws/chat/{thread_id}` (쿠키 `sc_session` 인증, 본인 소유 thread).
- 송신(client→server, surface 별):
  - `chat`:     `{ "content": "<텍스트>" }`
  - `personal`: `{ "content": "<텍스트>", "doc_id": "<uuid|null>", "edit_mode": "편집|보기" }`
- 수신(server→client) 3종:
  - `{ "type": "delta", "text": "<토큰>" }`  — 실시간 타이핑(엔진 text 이벤트). 누적 표시용.
  - `{ "type": "done", "message": { "id","role":"assistant","content":<canonical>,"created_at" } }`
  - `{ "type": "error", "code": "ENGINE_ERROR|ENGINE_TIMEOUT|INVALID_*|...", "message": "..." }`
  > delta=타이핑 누적, done.content=canonical 확정(중복 방지는 FE — spec §4). 에러 턴 미저장.

## 쓰기 경계
- personal in-place 반영은 FE 가 `done.content` 를 에디터에 넣고 유저가 기존
  `PUT /personal/docs/{id}`(WP-04)로 저장 — **WS 가 개인문서 파일을 직접 쓰지 않는다**.
"""

from __future__ import annotations

import logging
import uuid
from functools import partial
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

try:  # uvicorn[standard] 런타임에선 송신 후 끊김이 ConnectionClosed 로 표면화될 수 있음.
    from websockets.exceptions import ConnectionClosed as _ConnectionClosed
except ImportError:  # pragma: no cover — 폴백: WebSocketDisconnect 로 충분
    _ConnectionClosed = WebSocketDisconnect

from app.config import settings
from app.core.session import SESSION_COOKIE, get_session_store
from app.db import async_session
from app.exceptions import AppError, EngineError, EngineTimeoutError
from app.models.chat import ChatMessage
from app.repositories.chat import ChatMessageRepository, ChatThreadRepository
from app.repositories.personal_doc import PersonalDocRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService
from app.services.file_store import PersonalFileStore
from app.services.personal import PersonalService

if TYPE_CHECKING:
    from app.models.chat import ChatThread
    from app.models.personal_doc import PersonalDoc
    from app.models.user import User
    from app.services.chat_engine import ChatEngine

logger = logging.getLogger("app.ws.chat")

router = APIRouter(tags=["chat-ws"])

# WS close code (1000번대는 표준, 4000~4999 는 앱 정의). spec-04: 미인증=연결 거부.
WS_UNAUTHENTICATED = 4401
WS_FORBIDDEN = 4403
WS_NOT_FOUND = 4404

# 클라가 떠났을 때 send 가 던지는 예외들 — **송신 시점에만** 삼켜 턴을 끝까지 진행한다(고아
# 응답 방지). _try_send 가 send_json 만 감싸므로 엔진/DB 예외는 절대 여기로 흐르지 않는다.
# RuntimeError 는 starlette send-after-close("cannot call send once closed") 신호(직렬화
# 실패는 TypeError 라 그대로 전파됨).
_CLIENT_GONE: tuple[type[BaseException], ...] = (
    WebSocketDisconnect,
    RuntimeError,
    _ConnectionClosed,
)


# ─────────────────────────── 순수 헬퍼 (단위 테스트 대상) ───────────────────────────


def parse_payload(
    surface: str, data: dict[str, Any]
) -> tuple[str, uuid.UUID | None, str | None]:
    """surface 별 송신 payload 파싱/검증 → (content, doc_id, edit_mode).

    - 공통: `content` 는 비어있지 않은 텍스트(아니면 ValueError).
    - chat: doc_id/edit_mode 없음(None).
    - personal: `doc_id`(없으면 None=선택된 문서 없음, 답변만), `edit_mode`(편집|보기).
      잘못된 doc_id 형식은 ValueError.
    """
    content = data.get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("content 는 비어있지 않은 텍스트여야 합니다")
    if surface != "personal":
        return content, None, None

    raw_doc_id = data.get("doc_id")
    doc_id: uuid.UUID | None = None
    if raw_doc_id:
        try:
            doc_id = uuid.UUID(str(raw_doc_id))
        except ValueError as exc:
            raise ValueError(f"doc_id 형식 오류: {raw_doc_id!r}") from exc
    edit_mode = data.get("edit_mode")
    return content, doc_id, edit_mode


def resolve_personal_turn(
    doc: PersonalDoc, doc_text: str | None, payload_edit_mode: str | None
) -> tuple[str | None, str | None]:
    """도크(personal) 턴의 (doc_content, edit_mode) 결정 — **md 게이트**(C3 리포트 경고 준수).

    - md 문서: 본문(`doc_text`)을 컨텍스트로 주입. `payload_edit_mode=="편집"` 일 때만
      `edit_mode="편집"`(작성 활성), 그 외 `"보기"`(답변만).
    - 비-md 문서: 본문은 바이너리라 주입 불가 → **제목/포맷만** 컨텍스트로, `edit_mode="보기"`
      (작성 금지). 엔진은 `편집` 을 작성 게이트로 신뢰하므로 비-md 에 `편집` 을 넘기지 않는다.
    """
    if doc.format == "md":
        edit_mode = "편집" if payload_edit_mode == "편집" else "보기"
        return (doc_text or ""), edit_mode
    note = f"(문서 제목: {doc.title} · 형식: {doc.format} — 본문 미리보기 불가, 보기 전용)"
    return note, "보기"


# ─────────────────────────── seam (실 구현 — 테스트가 monkeypatch) ───────────────────────────


async def load_user(websocket: WebSocket) -> User | None:
    """쿠키 세션 → 유저(미인증 None). 연결 스코프 1회 세션으로 조회."""
    sid = websocket.cookies.get(SESSION_COOKIE)
    async with async_session() as s:
        auth = AuthService(UserRepository(s), get_session_store())
        try:
            return await auth.current_user(sid)
        except AppError:
            return None


async def load_thread(thread_id: uuid.UUID) -> ChatThread | None:
    """thread 단건(부재 None). 연결 스코프 인가 검사용(소유 비교는 호출부)."""
    async with async_session() as s:
        return await ChatThreadRepository(s).by_id(thread_id)


async def _load_personal_doc(
    session: AsyncSession, doc_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[PersonalDoc, str | None]:
    """개인문서(본인소유) 로드 → (doc, md텍스트|None). 부재 DOC_NOT_FOUND·타인 FORBIDDEN
    은 PersonalService 가 AppError 로 raise(run_turn 이 error 이벤트로 변환)."""
    svc = PersonalService(
        PersonalDocRepository(session), PersonalFileStore(settings.personal_data_root)
    )
    result = await svc.get_doc(user_id, doc_id)
    return result.doc, result.text


# ─────────────────────────── 송신 헬퍼 ───────────────────────────


async def _try_send(websocket: WebSocket, payload: dict[str, Any]) -> bool:
    """delta/done/error 송신을 best-effort 로 — 클라가 떠나 송신 실패면 False(턴은 계속).

    **send_json 만** 감싼다(엔진/DB 예외는 여기로 안 옴). 송신 성공 시 True, 클라 끊김
    예외(`_CLIENT_GONE`)면 False. 이 한 곳이 "WS 끊김 ≠ 턴 중단" 불변식의 경계다.
    """
    try:
        await websocket.send_json(payload)
        return True
    except _CLIENT_GONE:
        return False


async def _send_error(websocket: WebSocket, code: str, message: str) -> None:
    # best-effort — 에러 턴은 저장 안 하므로 클라가 떠났으면 조용히 생략(핸들러 크래시 방지).
    await _try_send(websocket, {"type": "error", "code": code, "message": message})


def _message_event(message: ChatMessage) -> dict[str, Any]:
    return {
        "type": "done",
        "message": {
            "id": str(message.id),
            "role": message.role,
            "content": message.content,
            "created_at": message.created_at.isoformat() if message.created_at else None,
        },
    }


# ─────────────────────────── 턴 실행 (주입형 — 단위 테스트 대상) ───────────────────────────


async def run_turn(
    websocket: WebSocket,
    engine: ChatEngine,
    thread: ChatThread,
    data: dict[str, Any],
    *,
    thread_repo: ChatThreadRepository,
    message_repo: ChatMessageRepository,
    load_doc,
    commit,
    user_id: uuid.UUID,
) -> None:
    """한 턴: payload 파싱 → (personal)doc 컨텍스트 → submit → delta 스트림 → finalize
    (canonical + session_id) → user/assistant 메시지 저장 + commit → done.

    **WS 끊김 내성(불변식)**: 스트리밍 중 클라가 떠나(다른 탭 등) delta 송신이 실패해도 턴을
    중단하지 않는다 — 송신만 best-effort 로 멈추고 finalize·메시지 저장·commit 은 그대로
    수행한다. 엔진이 canonical 을 만들면 연결 상태와 무관하게 DB 에 영속(DB 가 SoT) → 재진입
    시 GET /threads/{id} 로 복원. done 송신은 클라가 살아있을 때만.

    엔진 실패(EngineError/EngineTimeoutError)·검증 실패는 error 이벤트(best-effort)로 보내고
    **저장하지 않으며**(에러 턴 미저장) 연결은 유지한다(다음 턴 가능). 협력자(repo/engine/
    load_doc/commit)는 주입 — DB/redis/엔진 없이 fake 로 단위 테스트 가능.
    """
    # 1) payload 파싱
    try:
        content, doc_id, payload_edit_mode = parse_payload(thread.surface, data)
    except ValueError as exc:
        await _send_error(websocket, "INVALID_PAYLOAD", str(exc))
        return

    # 2) personal 컨텍스트(md 게이트). 잘못된/타인 문서는 error 이벤트.
    doc_content: str | None = None
    edit_mode: str | None = None
    if thread.surface == "personal" and doc_id is not None:
        try:
            doc, doc_text = await load_doc(doc_id, user_id)
        except AppError as exc:
            await _send_error(websocket, exc.code, exc.message)
            return
        doc_content, edit_mode = resolve_personal_turn(doc, doc_text, payload_edit_mode)

    # 3) submit → delta 스트림(best-effort 송신) → finalize.
    #    클라가 떠나도(WS 끊김) delta 송신 실패만 삼키고 스트림을 끝까지 돌며 finalize 한다.
    #    finalize 는 stream 과 독립(client.result(task_id) 직접 회수)이라 저장 불변식이 선다.
    client_alive = True
    try:
        task_id = await engine.submit_turn(
            thread, content, doc_content=doc_content, edit_mode=edit_mode
        )
        async for ev in engine.stream_turn(task_id):
            if ev.type == "text" and ev.text and client_alive:
                # 클라 끊기면 client_alive=False — 더는 송신 안 하되 루프/finalize 는 계속.
                client_alive = await _try_send(websocket, {"type": "delta", "text": ev.text})
        canonical = await engine.finalize(thread, task_id, thread_repo)
    except EngineTimeoutError as exc:
        await _send_error(websocket, exc.code, exc.message)
        return
    except EngineError as exc:
        await _send_error(websocket, exc.code, exc.message)
        return

    # 4) 메시지 DB 저장 — **client_alive 와 무관하게**(엔진 성공 시 항상). 핵심 불변식:
    #    엔진이 canonical 을 만들면 WS 연결 상태와 무관하게 user+assistant 가 DB 에 영속된다
    #    → 재진입 시 GET /threads/{id} 로 복원(DB 가 SoT). 에러 턴은 위에서 return — 미저장.
    await message_repo.add(ChatMessage(thread_id=thread.id, role="user", content=content))
    assistant = await message_repo.add(
        ChatMessage(thread_id=thread.id, role="assistant", content=canonical)
    )
    await commit()

    # 5) done — canonical 확정본. 클라가 떠났으면 송신 생략(저장은 이미 완료, 고아 응답 없음).
    if client_alive:
        await _try_send(websocket, _message_event(assistant))


# ─────────────────────────── 엔드포인트 ───────────────────────────


@router.websocket("/ws/chat/{thread_id}")
async def chat_ws(websocket: WebSocket, thread_id: uuid.UUID) -> None:
    """대화방 채널. 쿠키 인증 + 본인 소유 thread. surface 가 능력 정책을 가른다."""
    # ── 연결 스코프: 인증/인가 (accept 전 거부) ──
    user = await load_user(websocket)
    if user is None:
        await websocket.close(code=WS_UNAUTHENTICATED)
        return
    thread = await load_thread(thread_id)
    if thread is None:
        await websocket.close(code=WS_NOT_FOUND)
        return
    if thread.user_id != user.id:
        await websocket.close(code=WS_FORBIDDEN)
        return

    await websocket.accept()

    # 엔진은 in-body 로 app.state 에서(WS scope 엔 Request 없음 → C3 get_chat_engine 못 씀).
    engine: ChatEngine = websocket.app.state.chat_engine

    try:
        while True:
            data = await websocket.receive_json()

            # 턴 스코프: 메시지당 세션 1개(unit-of-work). thread 재로드 = attached(finalize
            # 의 session_id update 가 detached INSERT 로 오인되지 않게).
            async with async_session() as s:
                thread_repo = ChatThreadRepository(s)
                message_repo = ChatMessageRepository(s)
                turn_thread = await thread_repo.by_id(thread_id)
                if turn_thread is None:  # 대화 중 삭제 등 — 방어
                    await _send_error(websocket, "THREAD_NOT_FOUND", "대화방이 없습니다")
                    continue

                await run_turn(
                    websocket,
                    engine,
                    turn_thread,
                    data,
                    thread_repo=thread_repo,
                    message_repo=message_repo,
                    load_doc=partial(_load_personal_doc, s),
                    commit=s.commit,
                    user_id=user.id,
                )
    except WebSocketDisconnect:
        return
