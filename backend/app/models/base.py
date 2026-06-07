"""SQLAlchemy Declarative Base — 모든 모델의 공통 베이스.

C2 는 베이스만 — 실제 테이블(users/personal_docs/chat_*)은 후속 WP-02~05.
Alembic autogenerate 가 Base.metadata 를 본다.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
