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
    """FastAPI 의존성 — 요청 스코프 세션."""
    async with async_session() as session:
        yield session
