"""도서관 docs API 통합 테스트 (SC-WP-03 C1, SC-SPEC-01 §3·케이스 매트릭스).

실제 `medi-doc/` 대신 tmp_path 로 결정적 트리를 깔고 `get_docs_fs` 의존성을 override
한다(auth 스위트의 dependency_overrides 패턴). 시드에는 미지원 포맷(.png)·숨김 파일이
없으므로 fixture 에서 직접 만들어 UNSUPPORTED_FORMAT·숨김 제외를 검증한다.

검증: 트리(루트/하위 lazy·dir count·file size/updated_at·정렬·숨김 제외·빈 폴더)·
파일(md JSON / 바이너리 raw bytes·Content-Type·envelope 비대칭)·케이스 매트릭스
(DOC_NOT_FOUND·UNSUPPORTED_FORMAT·INVALID_PATH traversal).
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.docs import get_docs_fs
from app.main import app
from app.services.docs_fs import DocsFS

# 바이너리 fixture 의 결정적 바이트(raw 서빙 동등성 검증용).
_DOCX_BYTES = b"PK\x03\x04 fake-docx-bytes"
_XLSX_BYTES = b"PK\x03\x04 fake-xlsx-bytes"
_PDF_BYTES = b"%PDF-1.7 fake-pdf-bytes"
_PNG_BYTES = b"\x89PNG\r\n fake-png-bytes"
_MD_BODY = "# 제목\n\n본문 한 줄.\n"


@pytest.fixture
def docs_root(tmp_path: Path) -> Path:
    """결정적 시드 트리.

    root/
      alpha/            (dir, count=2)
        note.md         (text)
        sheet.xlsx      (binary)
      empty/            (dir, count=0)
      .hidden_dir/      (숨김 — 제외)
      doc.docx          (binary)
      paper.pdf         (binary)
      image.png         (unsupported)
      readme.md         (text)
      .DS_Store         (숨김 — 제외)
    """
    alpha = tmp_path / "alpha"
    alpha.mkdir()
    (alpha / "note.md").write_text(_MD_BODY, encoding="utf-8")
    (alpha / "sheet.xlsx").write_bytes(_XLSX_BYTES)

    (tmp_path / "empty").mkdir()
    hidden_dir = tmp_path / ".hidden_dir"
    hidden_dir.mkdir()
    (hidden_dir / "secret.md").write_text("x", encoding="utf-8")

    (tmp_path / "doc.docx").write_bytes(_DOCX_BYTES)
    (tmp_path / "paper.pdf").write_bytes(_PDF_BYTES)
    (tmp_path / "image.png").write_bytes(_PNG_BYTES)
    (tmp_path / "readme.md").write_text(_MD_BODY, encoding="utf-8")
    (tmp_path / ".DS_Store").write_bytes(b"\x00\x01")
    return tmp_path


@pytest.fixture
def client(docs_root: Path):
    """tmp 트리를 가리키는 DocsFS 를 주입한 클라이언트."""

    def _override() -> DocsFS:
        return DocsFS(docs_root)

    app.dependency_overrides[get_docs_fs] = _override
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


# ── tree ──


def test_tree_root_lists_children_dirs_first(client: TestClient) -> None:
    resp = client.get("/api/docs/tree")
    assert resp.status_code == 200
    children = resp.json()["data"]["children"]
    names = [c["name"] for c in children]
    # 폴더 먼저(alpha, empty) → 파일(doc.docx, image.png, paper.pdf, readme.md), 각 알파벳.
    assert names == ["alpha", "empty", "doc.docx", "image.png", "paper.pdf", "readme.md"]
    # 숨김 제외.
    assert ".DS_Store" not in names
    assert ".hidden_dir" not in names


def test_tree_dir_has_count_excluding_hidden(client: TestClient) -> None:
    children = client.get("/api/docs/tree").json()["data"]["children"]
    by_name = {c["name"]: c for c in children}
    assert by_name["alpha"]["type"] == "dir"
    assert by_name["alpha"]["count"] == 2  # note.md + sheet.xlsx
    assert by_name["empty"]["count"] == 0


def test_tree_file_node_has_size_and_updated_at(client: TestClient) -> None:
    children = client.get("/api/docs/tree").json()["data"]["children"]
    readme = next(c for c in children if c["name"] == "readme.md")
    assert readme["type"] == "file"
    assert readme["size"] == len(_MD_BODY.encode("utf-8"))
    # ISO8601 (FE formatDate 가 앞 10자 사용).
    assert "T" in readme["updated_at"]
    assert readme["path"] == "readme.md"


def test_tree_subdir_lazy(client: TestClient) -> None:
    resp = client.get("/api/docs/tree", params={"path": "alpha", "depth": 1})
    assert resp.status_code == 200
    children = resp.json()["data"]["children"]
    names = [c["name"] for c in children]
    assert names == ["note.md", "sheet.xlsx"]
    # 하위 노드 path 는 루트 기준 상대경로.
    assert next(c for c in children if c["name"] == "note.md")["path"] == "alpha/note.md"


def test_tree_empty_folder_is_ok(client: TestClient) -> None:
    resp = client.get("/api/docs/tree", params={"path": "empty"})
    assert resp.status_code == 200
    assert resp.json()["data"]["children"] == []


def test_tree_not_found(client: TestClient) -> None:
    resp = client.get("/api/docs/tree", params={"path": "nope"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "DOC_NOT_FOUND"


def test_tree_on_file_path_not_found(client: TestClient) -> None:
    # 파일을 폴더처럼 트리 조회 → DOC_NOT_FOUND.
    resp = client.get("/api/docs/tree", params={"path": "readme.md"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "DOC_NOT_FOUND"


# ── file: md (text JSON) ──


def test_file_md_returns_json_envelope(client: TestClient) -> None:
    resp = client.get("/api/docs/file", params={"path": "readme.md"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    data = resp.json()["data"]
    assert data["path"] == "readme.md"
    assert data["content"] == _MD_BODY
    assert data["meta"]["size"] == len(_MD_BODY.encode("utf-8"))
    assert data["meta"]["author"] is None
    assert "T" in data["meta"]["updated_at"]


# ── file: binary (raw bytes, no envelope) ──


@pytest.mark.parametrize(
    ("path", "raw", "media"),
    [
        (
            "doc.docx",
            _DOCX_BYTES,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        (
            "alpha/sheet.xlsx",
            _XLSX_BYTES,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        ("paper.pdf", _PDF_BYTES, "application/pdf"),
    ],
)
def test_file_binary_serves_raw_bytes(
    client: TestClient, path: str, raw: bytes, media: str
) -> None:
    resp = client.get("/api/docs/file", params={"path": path})
    assert resp.status_code == 200
    # envelope 없이 원본 바이트 그대로(서버 변환 없음).
    assert resp.content == raw
    assert resp.headers["content-type"] == media


# ── file: 케이스 매트릭스 ──


def test_file_unsupported_format(client: TestClient) -> None:
    resp = client.get("/api/docs/file", params={"path": "image.png"})
    assert resp.status_code == 415
    assert resp.json()["code"] == "UNSUPPORTED_FORMAT"


def test_file_not_found(client: TestClient) -> None:
    resp = client.get("/api/docs/file", params={"path": "missing.md"})
    assert resp.status_code == 404
    assert resp.json()["code"] == "DOC_NOT_FOUND"


# ── path traversal 방어 (INVALID_PATH) ──


@pytest.mark.parametrize("evil", ["../secret.md", "../../etc/passwd", "/etc/passwd"])
def test_file_traversal_blocked(client: TestClient, evil: str) -> None:
    resp = client.get("/api/docs/file", params={"path": evil})
    assert resp.status_code == 404
    assert resp.json()["code"] == "INVALID_PATH"


@pytest.mark.parametrize("evil", ["..", "../..", "/etc"])
def test_tree_traversal_blocked(client: TestClient, evil: str) -> None:
    resp = client.get("/api/docs/tree", params={"path": evil})
    assert resp.status_code == 404
    assert resp.json()["code"] == "INVALID_PATH"
