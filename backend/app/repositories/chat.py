"""Chat repository — `chat_threads` · `chat_messages` 접근 격리 (SC-WP-05 C1).

DB 접근은 전부 이 레이어를 통과한다(Repository 패턴). C1 은 스키마 단계 —
C2(REST)·C3(엔진)·C4(WS)가 쓸 기본 조회/추가/수정만 둔다. 유저 격리(FORBIDDEN)
판단은 service 가 `by_id` 결과의 `user_id` 와 세션 유저를 비교해 수행한다.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage, ChatThread


class ChatThreadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def by_id(self, thread_id: uuid.UUID) -> ChatThread | None:
        """단건 조회 (없으면 None). 유저 격리 검사는 service 에서 user_id 비교."""
        result = await self.session.execute(
            select(ChatThread).where(ChatThread.id == thread_id)
        )
        return result.scalar_one_or_none()

    async def by_user_and_surface(
        self, user_id: uuid.UUID, surface: str
    ) -> list[ChatThread]:
        """유저 스코프 + surface 목록 — 최근 활동 순. 사이드바(chat)/도크(personal)를
        가른다(서로 새지 않게, SC-SPEC-04 §3). 본인 thread 만 반환."""
        result = await self.session.execute(
            select(ChatThread)
            .where(ChatThread.user_id == user_id, ChatThread.surface == surface)
            .order_by(ChatThread.updated_at.desc())
        )
        return list(result.scalars().all())

    async def add(self, thread: ChatThread) -> ChatThread:
        """생성용 — flush 로 server_default(id/created_at/updated_at) 확정."""
        self.session.add(thread)
        await self.session.flush()
        return thread

    async def update(self, thread: ChatThread) -> ChatThread:
        """수정용 — flush 후 refresh.

        session_id 저장(turn 1 완료 후) 등으로 컬럼이 dirty 면 flush 가 UPDATE 발행
        → onupdate(server-side now())인 `updated_at` 이 expire 된다. refresh 로
        greenlet(async) 컨텍스트 안에서 만료 속성을 미리 reload 해야 라우터가 응답
        조립 시 동기 접근해도 lazy-load IO(MissingGreenlet)가 발생하지 않는다
        (WP-04 C2 의 PLAN-104-T-007 버그 재발 방지)."""
        self.session.add(thread)
        await self.session.flush()
        await self.session.refresh(thread)
        return thread


class ChatMessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def by_thread(self, thread_id: uuid.UUID) -> list[ChatMessage]:
        """thread 의 메시지 이력 — 생성 순(created_at asc). GET /threads/{id} 가 사용."""
        result = await self.session.execute(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    async def add(self, message: ChatMessage) -> ChatMessage:
        """저장용 — flush 로 server_default(id/created_at) 확정. 응답 완료 시
        user/assistant 메시지를 DB 에 영속(SC-SPEC-04 §3)."""
        self.session.add(message)
        await self.session.flush()
        return message
