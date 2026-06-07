"""Chat model smoke — `Base.metadata` 검사 (DB 없이 통과, SC-WP-05 C1).

live postgres 없이 스키마 계약(컬럼/제약/FK/인덱스)만 확인한다 —
test_personal_doc_model 의 "DB 없이 통과" 원칙 유지(admin gate 가 postgres 없이
pytest 돌려도 green). live `alembic upgrade head`/`check` 는 admin gate(postgres).
"""

from app.models.base import Base
from app.models.chat import ROLES, SURFACES, ChatMessage, ChatThread
from app.repositories.chat import ChatMessageRepository, ChatThreadRepository


def test_chat_tables_registered() -> None:
    assert "chat_threads" in Base.metadata.tables
    assert "chat_messages" in Base.metadata.tables
    assert ChatThread.__tablename__ == "chat_threads"
    assert ChatMessage.__tablename__ == "chat_messages"


def test_chat_threads_columns_match_spec() -> None:
    cols = Base.metadata.tables["chat_threads"].columns
    assert set(cols.keys()) == {
        "id",
        "user_id",
        "title",
        "session_id",
        "surface",
        "created_at",
        "updated_at",
    }
    # doc_id/edit_mode 는 WS 메시지 런타임 — thread 에 저장하지 않는다 (SC-SPEC-04 §4)
    assert "doc_id" not in cols
    assert "edit_mode" not in cols


def test_chat_messages_columns_match_spec() -> None:
    cols = Base.metadata.tables["chat_messages"].columns
    assert set(cols.keys()) == {
        "id",
        "thread_id",
        "role",
        "content",
        "created_at",
    }


def test_chat_threads_constraints() -> None:
    cols = Base.metadata.tables["chat_threads"].columns
    assert cols["id"].primary_key
    # NOT NULL (surface 포함)
    for name in ("user_id", "surface", "created_at", "updated_at"):
        assert not cols[name].nullable, name
    # NULL 허용 — title / session_id(turn 1 후 CLI 발급)
    assert cols["title"].nullable
    assert cols["session_id"].nullable
    # server_default
    assert cols["id"].server_default is not None
    assert cols["created_at"].server_default is not None
    assert cols["updated_at"].server_default is not None
    # updated_at 은 onupdate(now()) — session_id 저장 시 expire 됨
    assert cols["updated_at"].onupdate is not None


def test_chat_messages_constraints() -> None:
    cols = Base.metadata.tables["chat_messages"].columns
    assert cols["id"].primary_key
    for name in ("thread_id", "role", "content", "created_at"):
        assert not cols[name].nullable, name
    assert cols["id"].server_default is not None
    assert cols["created_at"].server_default is not None


def test_chat_threads_fk_to_users() -> None:
    cols = Base.metadata.tables["chat_threads"].columns
    fks = list(cols["user_id"].foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "users"
    assert fks[0].column.name == "id"


def test_chat_messages_fk_to_threads() -> None:
    cols = Base.metadata.tables["chat_messages"].columns
    fks = list(cols["thread_id"].foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "chat_threads"
    assert fks[0].column.name == "id"


def test_chat_indexes() -> None:
    # 유저별 thread 목록(user_id) · thread 별 이력(thread_id) 인덱스 (SC-SPEC-04 §4)
    threads = Base.metadata.tables["chat_threads"]
    messages = Base.metadata.tables["chat_messages"]
    thread_idx = {tuple(c.name for c in idx.columns) for idx in threads.indexes}
    msg_idx = {tuple(c.name for c in idx.columns) for idx in messages.indexes}
    assert ("user_id",) in thread_idx
    assert ("thread_id",) in msg_idx


def test_surface_and_role_constants() -> None:
    assert SURFACES == ("chat", "personal")
    assert ROLES == ("user", "assistant")


def test_repository_basic_api() -> None:
    # C2~C4 가 사용할 기본 메서드 존재.
    for name in ("by_id", "by_user_and_surface", "add", "update"):
        assert hasattr(ChatThreadRepository, name), name
    for name in ("by_thread", "add"):
        assert hasattr(ChatMessageRepository, name), name
