"""채팅 라우터 (SC-WP-05 C2, SC-SPEC-04 §3) — `/api/chat/threads`.

Router → Service(app/services/chat) → Repository(chat: thread/message C1).
C2 는 **REST 만** — thread 생성/목록/이력. WS(`/ws/chat/{id}`)·엔진(open-kknaks)은
후속 C3·C4. 유저 식별 = WP-02 쿠키 세션(`get_current_user` 재사용) — 미인증
`UNAUTHENTICATED`(401), 부재 `THREAD_NOT_FOUND`(404), 타유저 `FORBIDDEN`(403).

응답 envelope 는 **비대칭**(생성/목록/단건이 서로 다른 필드 셋, FE 가 각각 의존,
spec-04 §3) 이라 router 가 dict 로 직접 조립한다(WP-04 personal 방식). **`session_id`
는 내부 식별자라 어떤 응답에도 싣지 않는다**(spec-04 §3). 에러는 service 가 AppError 로
raise → main.py 핸들러가 `{code,message}` + status 로 변환.
"""

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.personal import get_current_user
from app.db import get_session
from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from app.repositories.chat import ChatMessageRepository, ChatThreadRepository
from app.schemas.chat import ThreadCreate
from app.services.chat import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


def get_chat_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ChatService:
    """요청 스코프 ChatService — C1 repo 2종(thread/message)을 DB 세션으로 조립.

    테스트는 이 의존성을 override 해 인메모리 fake repo 로 갈아끼운다(DB 없이 통과).
    """
    return ChatService(ChatThreadRepository(session), ChatMessageRepository(session))


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _thread_item(thread: ChatThread) -> dict:
    """목록 item — session_id 제외(내부 식별자), surface 노출(FE 페이로드 shape 근거)."""
    return {
        "id": str(thread.id),
        "title": thread.title,
        "surface": thread.surface,
        "updated_at": _iso(thread.updated_at),
        "created_at": _iso(thread.created_at),
    }


def _message(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "role": message.role,
        "content": message.content,
        "created_at": _iso(message.created_at),
    }


@router.post("/threads", status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ThreadCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
) -> dict:
    """빈 대화방 생성 — surface 스탬프. title null, session_id 미발급(C3). 잘못된
    surface 는 schema Literal 이 422 거부."""
    thread = await service.create_thread(user.id, body.surface)
    return {
        "data": {
            "id": str(thread.id),
            "title": thread.title,
            "surface": thread.surface,
            "created_at": _iso(thread.created_at),
        }
    }


@router.get("/threads")
async def list_threads(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
    surface: Annotated[Literal["chat", "personal"], Query()],
) -> dict:
    """내 대화방 목록 — 유저 스코프 + surface 격리(`?surface=`), updated_at desc.
    사이드바(chat)/도크(personal)가 서로 새지 않는다. session_id 노출 금지."""
    threads = await service.list_threads(user.id, surface)
    return {"data": {"items": [_thread_item(t) for t in threads]}}


@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ChatService, Depends(get_chat_service)],
) -> dict:
    """대화방 단건 + 메시지 이력(created_at asc). 본인 thread 만 — 부재
    THREAD_NOT_FOUND(404)/타유저 FORBIDDEN(403). 빈 thread 는 messages:[].
    session_id·doc_id·edit_mode 반환 안 함(spec-04 §3)."""
    thread, messages = await service.get_thread(user.id, thread_id)
    return {
        "data": {
            "id": str(thread.id),
            "surface": thread.surface,
            "messages": [_message(m) for m in messages],
        }
    }
