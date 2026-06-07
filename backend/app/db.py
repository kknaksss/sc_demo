"""비동기 DB 엔진/세션 (SQLAlchemy 2.0 async + asyncpg).

엔진 생성은 lazy — import 시점에 연결하지 않으므로 DB 없이도 앱 import 가능
(health smoke 테스트가 postgres 없이 통과).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, future=True, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI 의존성 — 요청 스코프 세션 = unit-of-work.

    repository 는 flush 만 한다(server_default 확정). 영속(commit)은 여기서 요청
    경계에서 일괄 처리 — 성공 시 commit, 예외 시 rollback. 이래야 personal
    create/save/upload 쓰기가 영속된다(없으면 요청 종료 시 롤백 — WP-04 C2 버그).
    읽기전용(docs)·redis 세션(auth)은 pending 변경이 없어 commit/rollback 무해하고,
    향후 chat(WP-05) 쓰기도 동일 패턴으로 자동 커버된다.
    """
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
