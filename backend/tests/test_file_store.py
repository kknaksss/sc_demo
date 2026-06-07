"""PersonalFileStore 라운드트립 테스트 (SC-WP-04 C1).

tmp_path 를 루트로 주입해 md 텍스트/비-md 바이트 저장→읽기 라운드트립, 상대
file_path 생성 규약(`{user_id}/{doc_id}.{ext}`), 유저 디렉토리 격리, 루트 탈출
가드(InvalidPathError)를 검증한다. DB 불필요 — 순수 FS.
"""

import uuid
from pathlib import Path

import pytest

from app.exceptions import InvalidPathError
from app.services.file_store import PersonalFileStore

_MD_BODY = "# 주간 업무 메모\n\n- KCD 매핑 검수\n"
_PDF_BYTES = b"%PDF-1.7 fake-pdf-bytes"


def test_rel_path_layout() -> None:
    store = PersonalFileStore("/tmp/whatever")
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    assert store.rel_path(user_id, doc_id, "md") == f"{user_id}/{doc_id}.md"
    # 점 prefix 가 있어도 정규화
    assert store.rel_path(user_id, doc_id, ".pdf") == f"{user_id}/{doc_id}.pdf"


def test_save_text_roundtrip(tmp_path: Path) -> None:
    store = PersonalFileStore(tmp_path)
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    rel = store.save_text(user_id, doc_id, "md", _MD_BODY)

    assert rel == f"{user_id}/{doc_id}.md"
    # 실제 파일이 루트 하위에 생성됨
    assert (tmp_path / rel).read_text(encoding="utf-8") == _MD_BODY
    # store 경유 읽기도 동일
    assert store.read_text(rel) == _MD_BODY


def test_save_bytes_roundtrip(tmp_path: Path) -> None:
    store = PersonalFileStore(tmp_path)
    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    rel = store.save_bytes(user_id, doc_id, "pdf", _PDF_BYTES)

    assert rel == f"{user_id}/{doc_id}.pdf"
    assert store.read_bytes(rel) == _PDF_BYTES


def test_user_scoped_directories(tmp_path: Path) -> None:
    # 유저별 디렉토리로 분리 저장 — 다른 유저 문서가 섞이지 않음.
    store = PersonalFileStore(tmp_path)
    user_a, user_b = uuid.uuid4(), uuid.uuid4()
    doc_id = uuid.uuid4()

    rel_a = store.save_text(user_a, doc_id, "md", "A")
    rel_b = store.save_text(user_b, doc_id, "md", "B")

    assert rel_a.startswith(f"{user_a}/")
    assert rel_b.startswith(f"{user_b}/")
    assert store.read_text(rel_a) == "A"
    assert store.read_text(rel_b) == "B"


def test_traversal_guard_blocks_escape(tmp_path: Path) -> None:
    # 루트 밖 탈출(`..`/절대경로)은 InvalidPathError (docs_fs 동일 가드).
    store = PersonalFileStore(tmp_path)
    with pytest.raises(InvalidPathError):
        store.read_text("../../etc/passwd")
    with pytest.raises(InvalidPathError):
        store.read_bytes("/etc/passwd")
