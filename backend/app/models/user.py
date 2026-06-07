"""User SQLAlchemy model — `users` 테이블 (SC-SPEC-03 §4, SC-WP-02 C1).

테스트 계정 5개가 시드로 저장되는 유저 테이블. 개인스페이스/채팅의
유저 격리(FK→users.id) 근거. role 컬럼 없음(v1 역할 동등, SC-OPEN-08).

PK = UUID (spec-02/spec-04 의 user_id FK 대상). 비밀번호는 평문 금지 —
`password_hash` 에만 저장(해시 알고리즘은 C2 시드/C3 인증의 코드 SoT).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    org: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버그 표현
        return f"<User id={self.id} email={self.email!r}>"
