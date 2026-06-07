"""Chat SQLAlchemy 모델 — `chat_threads` · `chat_messages` (SC-SPEC-04 §4, SC-WP-05 C1).

채팅 대화방(thread)과 메시지를 DB 에 저장한다. 개인스페이스(personal_docs)와 달리
콘텐츠 본체(메시지 content)는 FS 가 아니라 **DB 컬럼**이다 — 채팅 메시지는 짧은 텍스트.

- `chat_threads.user_id` FK→users.id (유저 격리 근거, SC-SPEC-03). 유저별 목록 조회 index.
- `chat_threads.session_id` = Claude Code CLI 발급 세션 식별자. 생성 시점엔 비어있고(null),
  turn 1 완료 후 `result_session_id` 가 저장되며 이후 resume 키가 된다(SC-SPEC-04 §3).
- `chat_threads.surface` = `chat`(사이드바) / `personal`(도크). 생성 시 스탬프되어 능력
  정책(쓰기 허용/게이팅)을 가른다. enum vs varchar 는 코드 SoT — varchar 로 둔다
  (personal_docs.format idiom 일치, 검증은 service 레벨).
- `chat_messages.thread_id` FK→chat_threads.id, role(`user`/`assistant`), content(Text).
  이력 조회(created_at asc)를 위해 thread_id index.
- PK = UUID (users/personal_docs 와 동일 idiom).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# thread 생성 시 스탬프되는 surface — 능력 정책을 가른다 (SC-SPEC-04 §4).
SURFACES = ("chat", "personal")
# 메시지 작성 주체 (SC-SPEC-04 §4).
ROLES = ("user", "assistant")


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,  # 유저별 대화방 목록 조회 (SC-SPEC-04 §4 인덱스)
    )
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    # Claude Code CLI 가 turn 1 완료 후 발급 → 생성 시점엔 null, 이후 resume 키.
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    surface: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버그 표현
        return f"<ChatThread id={self.id} user_id={self.user_id} surface={self.surface!r}>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_threads.id"),
        nullable=False,
        index=True,  # thread 별 이력 조회 (SC-SPEC-04 §4 인덱스)
    )
    role: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버그 표현
        return f"<ChatMessage id={self.id} thread_id={self.thread_id} role={self.role!r}>"
