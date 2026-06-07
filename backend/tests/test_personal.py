"""개인스페이스 API 통합 테스트 (SC-WP-04 C2, SC-SPEC-02 §3·케이스 매트릭스).

DB/redis 없이 통과 — get_current_user(고정 유저) + get_personal_service(fake repo +
tmp file_store) 의존성 override. 미인증 케이스만 override 없이 실제 쿠키 의존성을
태운다(쿠키 없음 → 401, DB/redis 미접근 = current_user 가 sid 없음에서 즉시 raise).

검증: 목록(유저스코프)·md생성(+비-md 거부 UNSUPPORTED_FORMAT)·단건(md text/비-md raw
bytes)·저장(+비-md 거부)·업로드(md editable/pdf 보기전용/외 형식 UNSUPPORTED_UPLOAD_TYPE)·
FORBIDDEN(타유저)·DOC_NOT_FOUND·UNAUTHENTICATED.
"""

import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.api.personal import get_current_user, get_personal_service
from app.main import app
from app.models.personal_doc import PersonalDoc
from app.models.user import User
from app.services.file_store import PersonalFileStore
from app.services.personal import PersonalService

_SEED_TS = datetime(2026, 1, 1, tzinfo=UTC)


class FakePersonalRepo:
    """by_id/by_user/add/update — PersonalService 가 쓰는 표면(인메모리)."""

    def __init__(self) -> None:
        self._by_id: dict[uuid.UUID, PersonalDoc] = {}

    async def by_id(self, doc_id: uuid.UUID) -> PersonalDoc | None:
        return self._by_id.get(doc_id)

    async def by_user(self, user_id: uuid.UUID) -> list[PersonalDoc]:
        docs = [d for d in self._by_id.values() if d.user_id == user_id]
        return sorted(docs, key=lambda d: d.updated_at, reverse=True)

    async def add(self, doc: PersonalDoc) -> PersonalDoc:
        now = datetime.now(UTC)
        if doc.created_at is None:
            doc.created_at = now
        doc.updated_at = now
        self._by_id[doc.id] = doc
        return doc

    async def update(self, doc: PersonalDoc) -> PersonalDoc:
        doc.updated_at = datetime.now(UTC)
        self._by_id[doc.id] = doc
        return doc


@pytest.fixture
def user() -> User:
    return User(
        id=uuid.uuid4(),
        email="a@test.com",
        password_hash="x",
        display_name="A",
        org="t",
    )


@pytest.fixture
def other_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def store(tmp_path) -> PersonalFileStore:
    return PersonalFileStore(tmp_path)


@pytest.fixture
def repo() -> FakePersonalRepo:
    return FakePersonalRepo()


@pytest.fixture
def client(repo: FakePersonalRepo, store: PersonalFileStore, user: User):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_personal_service] = lambda: PersonalService(repo, store)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _seed(
    repo: FakePersonalRepo,
    store: PersonalFileStore,
    user_id: uuid.UUID,
    fmt: str,
    content: bytes | str,
) -> PersonalDoc:
    """기존 문서 1행 + FS 파일 직접 적재(생성 API 우회)."""
    doc_id = uuid.uuid4()
    if fmt == "md":
        rel = store.save_text(user_id, doc_id, "md", content)  # type: ignore[arg-type]
    else:
        rel = store.save_bytes(user_id, doc_id, fmt, content)  # type: ignore[arg-type]
    doc = PersonalDoc(
        id=doc_id,
        user_id=user_id,
        title=f"seed-{fmt}",
        format=fmt,
        editable=(fmt == "md"),
        file_path=rel,
        created_at=_SEED_TS,
        updated_at=_SEED_TS,
    )
    repo._by_id[doc_id] = doc
    return doc


# ── 목록 (유저 스코프) ──


def test_list_only_own_docs(client, repo, store, user, other_id) -> None:
    _seed(repo, store, user.id, "md", "# 내문서1")
    _seed(repo, store, user.id, "pdf", b"%PDF-1.7 mine")
    _seed(repo, store, other_id, "md", "# 남의문서")  # 다른 유저 — 목록에서 제외

    resp = client.get("/api/personal/docs")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 2
    assert set(items[0].keys()) == {"id", "title", "format", "editable", "updated_at", "created_at"}


def test_list_empty_is_not_error(client) -> None:
    resp = client.get("/api/personal/docs")
    assert resp.status_code == 200
    assert resp.json()["data"]["items"] == []


# ── 생성 (md 전용) ──


def test_create_md_success(client, repo, store, user) -> None:
    resp = client.post("/api/personal/docs", json={"title": "주간 메모"})
    assert resp.status_code == 201
    data = resp.json()["data"]
    # 생성 envelope = {id,title,format,created_at} (editable/updated_at 없음)
    assert set(data.keys()) == {"id", "title", "format", "created_at"}
    assert data["title"] == "주간 메모"
    assert data["format"] == "md"
    # 빈 md 파일이 FS 에 생성됨
    doc = repo._by_id[uuid.UUID(data["id"])]
    assert store.read_text(doc.file_path) == ""
    assert doc.editable is True


def test_create_non_md_rejected(client) -> None:
    resp = client.post("/api/personal/docs", json={"title": "x", "format": "docx"})
    assert resp.status_code == 400
    assert resp.json()["code"] == "UNSUPPORTED_FORMAT"


# ── 단건 조회 (md text / 비-md raw bytes) ──


def test_get_md_returns_content(client, repo, store, user) -> None:
    doc = _seed(repo, store, user.id, "md", "# 제목\n본문")
    resp = client.get(f"/api/personal/docs/{doc.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["content"] == "# 제목\n본문"
    assert data["editable"] is True
    assert set(data["meta"].keys()) == {"updated_at", "created_at"}


def test_get_binary_returns_raw_bytes(client, repo, store, user) -> None:
    doc = _seed(repo, store, user.id, "pdf", b"%PDF-1.7 fake")
    resp = client.get(f"/api/personal/docs/{doc.id}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content == b"%PDF-1.7 fake"


# ── 저장 (PUT, md 전용) ──


def test_save_md_updates_file(client, repo, store, user) -> None:
    doc = _seed(repo, store, user.id, "md", "old")
    resp = client.put(f"/api/personal/docs/{doc.id}", json={"content": "new body"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert set(data.keys()) == {"id", "updated_at"}
    assert store.read_text(doc.file_path) == "new body"


def test_save_non_md_rejected(client, repo, store, user) -> None:
    doc = _seed(repo, store, user.id, "pdf", b"%PDF-1.7")
    resp = client.put(f"/api/personal/docs/{doc.id}", json={"content": "nope"})
    assert resp.status_code == 400
    assert resp.json()["code"] == "UNSUPPORTED_FORMAT"


# ── 업로드 (4포맷) ──


def test_upload_md_editable(client) -> None:
    resp = client.post(
        "/api/personal/docs/upload",
        files={"file": ("note.md", b"# uploaded", "text/markdown")},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["format"] == "md"
    assert data["editable"] is True
    assert set(data.keys()) == {"id", "title", "format", "editable", "created_at"}


def test_upload_pdf_view_only(client) -> None:
    resp = client.post(
        "/api/personal/docs/upload",
        files={"file": ("paper.pdf", b"%PDF-1.7 up", "application/pdf")},
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["format"] == "pdf"
    assert data["editable"] is False


def test_upload_unsupported_rejected(client) -> None:
    resp = client.post(
        "/api/personal/docs/upload",
        files={"file": ("image.png", b"\x89PNG fake", "image/png")},
    )
    assert resp.status_code == 400
    assert resp.json()["code"] == "UNSUPPORTED_UPLOAD_TYPE"


# ── 유저 격리 / 케이스 매트릭스 ──


def test_forbidden_other_user_doc(client, repo, store, other_id) -> None:
    doc = _seed(repo, store, other_id, "md", "# 남의것")  # 다른 유저 소유
    resp = client.get(f"/api/personal/docs/{doc.id}")
    assert resp.status_code == 403
    assert resp.json()["code"] == "FORBIDDEN"


def test_doc_not_found(client) -> None:
    resp = client.get(f"/api/personal/docs/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["code"] == "DOC_NOT_FOUND"


# ── 미인증 (실제 쿠키 의존성, override 없음) ──


def test_unauthenticated_no_cookie() -> None:
    # override 미설정 → 실제 get_current_user 가 쿠키 없음에서 UNAUTHENTICATED(401).
    anon = TestClient(app)
    resp = anon.get("/api/personal/docs")
    assert resp.status_code == 401
    assert resp.json()["code"] == "UNAUTHENTICATED"
