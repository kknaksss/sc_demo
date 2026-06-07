"""채팅 서비스 (SC-WP-05 C2, SC-SPEC-04 §3).

Router(app/api/chat) → **Service(여기)** → Repository(chat: thread/message C1).
C2 는 REST 만 — 빈 thread 생성·유저 스코프 목록(surface 격리)·메시지 이력 조회.
WS/엔진(open-kknaks)은 후속 C3·C4 라 여기서 다루지 않는다.

- 유저 격리: 단건 접근은 `_owned` 로 `thread.user_id == user_id` 검사 — 불일치
  `FORBIDDEN`(403), 부재 `THREAD_NOT_FOUND`(404). (personal `_owned` 패턴과 대칭.)
- `surface` 검증은 schema(POST Literal)·router(GET Query Literal) 단에서 거른다.
- `session_id` 는 내부 식별자라 어떤 응답에도 싣지 않는다(라우터 조립에서 제외).
"""

from __future__ import annotations

import uuid

from app.exceptions import ForbiddenError, ThreadNotFoundError
from app.models.chat import ChatMessage, ChatThread
from app.repositories.chat import ChatMessageRepository, ChatThreadRepository


class ChatService:
    def __init__(
        self, threads: ChatThreadRepository, messages: ChatMessageRepository
    ) -> None:
        self.threads = threads
        self.messages = messages

    async def create_thread(self, user_id: uuid.UUID, surface: str) -> ChatThread:
        """빈 대화방 생성 — surface NOT NULL 스탬프. session_id 미발급(C3 turn1 후),
        title null. add 는 flush 로 server_default(id/created_at/updated_at) 확정."""
        thread = ChatThread(user_id=user_id, surface=surface)
        return await self.threads.add(thread)

    async def list_threads(self, user_id: uuid.UUID, surface: str) -> list[ChatThread]:
        """유저 스코프 + surface 목록(최근 활동 순). 사이드바(chat)/도크(personal)를
        가른다 — 서로 새지 않게. C1 `by_user_and_surface` 사용."""
        return await self.threads.by_user_and_surface(user_id, surface)

    async def _owned(self, user_id: uuid.UUID, thread_id: uuid.UUID) -> ChatThread:
        """단건 + 소유 검사. 부재=THREAD_NOT_FOUND(404), 타유저=FORBIDDEN(403)."""
        thread = await self.threads.by_id(thread_id)
        if thread is None:
            raise ThreadNotFoundError(f"대화방 없음: {thread_id}")
        if thread.user_id != user_id:
            raise ForbiddenError("다른 유저의 대화방")
        return thread

    async def get_thread(
        self, user_id: uuid.UUID, thread_id: uuid.UUID
    ) -> tuple[ChatThread, list[ChatMessage]]:
        """본인 thread 단건 + 메시지 이력(created_at asc). 빈 thread 는 messages=[]."""
        thread = await self._owned(user_id, thread_id)
        messages = await self.messages.by_thread(thread_id)
        return thread, messages
