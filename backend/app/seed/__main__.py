"""`python -m app.seed` — entrypoint 시드 단계 (alembic upgrade head 이후 실행).

FastAPI 요청 라이프사이클 밖에서 도므로 세션을 직접 열고 **commit** 한다
(repo.add 는 flush 만 — commit 없으면 아무것도 영속되지 않음). idempotent 라 재기동 안전.
"""

import asyncio

from app.db import async_session
from app.repositories.user import UserRepository
from app.seed.users import seed_users


async def main() -> None:
    async with async_session() as session:
        repo = UserRepository(session)
        inserted = await seed_users(repo)
        await session.commit()
        print(f"[seed] users: +{inserted} inserted (idempotent)")


if __name__ == "__main__":
    asyncio.run(main())
