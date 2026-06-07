"""PersonalDoc repository — `personal_docs` 테이블 접근 격리 (SC-WP-04 C1).

DB 접근은 전부 이 레이어를 통과한다(Repository 패턴). C1 은 스키마 단계 —
C2 의 CRUD/업로드 API 가 쓸 기본 조회/추가/수정만 둔다. 유저 격리(FORBIDDEN)
판단은 service 가 `by_id` 결과의 `user_id` 와 세션 유저를 비교해 수행한다.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.personal_doc import PersonalDoc


class PersonalDocRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def by_id(self, doc_id: uuid.UUID) -> PersonalDoc | None:
        """단건 조회 (없으면 None). 유저 격리 검사는 service 에서 user_id 비교."""
        result = await self.session.execute(
            select(PersonalDoc).where(PersonalDoc.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def by_user(self, user_id: uuid.UUID) -> list[PersonalDoc]:
        """유저 스코프 평면 목록 — 최신 수정 순. 본인 문서만 반환."""
        result = await self.session.execute(
            select(PersonalDoc)
            .where(PersonalDoc.user_id == user_id)
            .order_by(PersonalDoc.updated_at.desc())
        )
        return list(result.scalars().all())

    async def add(self, doc: PersonalDoc) -> PersonalDoc:
        """생성/업로드용 — flush 로 server_default(id/created_at/updated_at) 확정."""
        self.session.add(doc)
        await self.session.flush()
        return doc

    async def update(self, doc: PersonalDoc) -> PersonalDoc:
        """저장(PUT)용 — 변경된 attribute flush. updated_at 은 onupdate 로 갱신."""
        self.session.add(doc)
        await self.session.flush()
        return doc
