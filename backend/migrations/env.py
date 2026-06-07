"""Alembic async 환경 (SQLAlchemy 2.0 + asyncpg).

- DB URL 은 app.config.settings (env DATABASE_URL) 에서 주입 — alembic.ini 정적값 미사용.
- target_metadata = Base.metadata. C2 는 모델 없음 → 빈 baseline.
  후속 WP 에서 모델 추가 시 autogenerate 용으로 여기에 import 해야 한다.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.models.base import Base
from app.models import user  # noqa: F401 — autogenerate 가 users 테이블을 인식하도록 등록

config = context.config

# DB URL 을 env 경유로 주입 (정적 alembic.ini 값 override).
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# NOTE(후속 WP): 모델 추가 시 autogenerate 가 인식하도록 여기서 import.
#   예) from app.models import user  # noqa: F401
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
