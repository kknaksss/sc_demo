"""User model smoke — `Base.metadata` 검사 (DB 없이 통과, SC-WP-02 C1).

live postgres 없이 스키마 계약(컬럼/제약)만 확인한다 — 기존 test_health 의
"DB 없이 통과" 원칙 유지(admin gate 가 postgres 없이 pytest 돌려도 green).
"""

from app.models.base import Base
from app.models.user import User
from app.repositories.user import UserRepository


def test_users_table_registered() -> None:
    assert "users" in Base.metadata.tables
    assert User.__tablename__ == "users"


def test_users_columns_match_spec() -> None:
    cols = Base.metadata.tables["users"].columns
    assert set(cols.keys()) == {
        "id",
        "email",
        "password_hash",
        "display_name",
        "org",
        "created_at",
    }
    # role 컬럼 없음 (v1 역할 동등, SC-OPEN-08)
    assert "role" not in cols


def test_users_constraints() -> None:
    cols = Base.metadata.tables["users"].columns
    assert cols["id"].primary_key
    assert cols["email"].unique
    # NOT NULL 전부
    for name in ("email", "password_hash", "display_name", "org", "created_at"):
        assert not cols[name].nullable, name
    # server_default 존재(id=gen_random_uuid, created_at=now())
    assert cols["id"].server_default is not None
    assert cols["created_at"].server_default is not None


def test_repository_basic_api() -> None:
    # 기본 조회 메서드가 존재(by_email/by_id) — C2~C3 가 사용.
    assert hasattr(UserRepository, "by_email")
    assert hasattr(UserRepository, "by_id")
