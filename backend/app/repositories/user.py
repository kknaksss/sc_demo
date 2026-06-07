"""User repository — `users` 테이블 접근 격리 (SC-WP-02 C1).

C1 은 스키마 단계 — 인증/시드(C2~C3)가 쓸 기본 조회만 둔다.
DB 접근은 전부 이 레이어를 통과한다(Repository 패턴).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def by_email(self, email: str) -> User | None:
        """로그인 자격 검증용 — 이메일로 단건 조회 (없으면 None)."""
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def by_id(self, user_id: uuid.UUID) -> User | None:
        """현재 유저(me)/세션 복원용 — id 로 단건 조회 (없으면 None)."""
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def add(self, user: User) -> User:
        """시드(C2)/생성용 — flush 로 server_default(id/created_at) 확정."""
        self.session.add(user)
        await self.session.flush()
        return user
