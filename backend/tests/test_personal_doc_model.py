"""PersonalDoc model smoke — `Base.metadata` 검사 (DB 없이 통과, SC-WP-04 C1).

live postgres 없이 스키마 계약(컬럼/제약/FK/인덱스)만 확인한다 — test_user_model
의 "DB 없이 통과" 원칙 유지(admin gate 가 postgres 없이 pytest 돌려도 green).
live `alembic upgrade head` 는 admin gate(postgres) 에서 검증.
"""

from app.models.base import Base
from app.models.personal_doc import FORMATS, PersonalDoc
from app.repositories.personal_doc import PersonalDocRepository


def test_personal_docs_table_registered() -> None:
    assert "personal_docs" in Base.metadata.tables
    assert PersonalDoc.__tablename__ == "personal_docs"


def test_personal_docs_columns_match_spec() -> None:
    cols = Base.metadata.tables["personal_docs"].columns
    assert set(cols.keys()) == {
        "id",
        "user_id",
        "title",
        "format",
        "editable",
        "file_path",
        "created_at",
        "updated_at",
    }
    # 보기/편집 모드는 런타임 UI 상태 — DB 컬럼 아님 (SC-SPEC-02 §4 판단)
    assert "edit_mode" not in cols
    assert "view_mode" not in cols


def test_personal_docs_constraints() -> None:
    table = Base.metadata.tables["personal_docs"]
    cols = table.columns
    assert cols["id"].primary_key
    # NOT NULL 전부
    for name in (
        "user_id",
        "title",
        "format",
        "editable",
        "file_path",
        "created_at",
        "updated_at",
    ):
        assert not cols[name].nullable, name
    # server_default (id=gen_random_uuid, created_at/updated_at=now())
    assert cols["id"].server_default is not None
    assert cols["created_at"].server_default is not None
    assert cols["updated_at"].server_default is not None


def test_personal_docs_fk_to_users() -> None:
    cols = Base.metadata.tables["personal_docs"].columns
    fks = list(cols["user_id"].foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "users"
    assert fks[0].column.name == "id"


def test_personal_docs_user_id_indexed() -> None:
    # 유저별 평면 목록 조회 인덱스 (SC-SPEC-02 §4)
    table = Base.metadata.tables["personal_docs"]
    indexed_cols = {tuple(c.name for c in idx.columns) for idx in table.indexes}
    assert ("user_id",) in indexed_cols


def test_formats_constant() -> None:
    # 인앱 생성/업로드 허용 4포맷 (SC-SPEC-02 §3)
    assert FORMATS == ("md", "docx", "xlsx", "pdf")


def test_repository_basic_api() -> None:
    # C2 의 CRUD/업로드가 사용할 기본 메서드 존재.
    for name in ("by_id", "by_user", "add", "update"):
        assert hasattr(PersonalDocRepository, name), name
