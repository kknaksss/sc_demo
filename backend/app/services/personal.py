"""개인스페이스 서비스 (SC-WP-04 C2, SC-SPEC-02 §3·§4).

Router(app/api/personal) → **Service(여기)** → Repository(personal_doc) + file_store(C1).
유저 격리·포맷 가드·DB 메타↔FS 콘텐츠 조립을 담당한다. 에러는 AppError 계층을
raise(main.py 핸들러가 HTTP 변환).

- 유저 격리: 모든 단건 접근은 `doc.user_id == user.id` 검사 — 불일치 `FORBIDDEN`(403),
  부재 `DOC_NOT_FOUND`(404). (둘을 구분 = spec-02 케이스 매트릭스. id 존재 노출은 spec 수용.)
- 생성 = md 전용(`UNSUPPORTED_FORMAT` 400 방어). 업로드 = 4포맷(`UNSUPPORTED_UPLOAD_TYPE` 400).
- md=editable true(인앱 편집) / 비-md=false(보기 전용). 비-md 저장(PUT) 거부 — 생성 가드와
  대칭으로 `UNSUPPORTED_FORMAT`(400) (spec 케이스 매트릭스 미코드화 분기, 코드 SoT).
- 콘텐츠 본체는 FS(blocking I/O) — `run_in_threadpool` 로 이벤트 루프 밖에서 실행.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi.concurrency import run_in_threadpool

from app.exceptions import (
    DocNotFoundError,
    ForbiddenError,
    UnsupportedCreateFormatError,
    UnsupportedUploadTypeError,
)
from app.models.personal_doc import FORMATS, PersonalDoc
from app.repositories.personal_doc import PersonalDocRepository
from app.services.file_store import PersonalFileStore

# 비-md(docx/xlsx/pdf) raw 서빙 Content-Type (도서관 docs_fs 와 동일 매핑).
_BINARY_MEDIA = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def _ext(name: str) -> str:
    """확장자(소문자, 점 제외). 없으면 빈 문자열."""
    return Path(name).suffix.lower().lstrip(".")


@dataclass
class DocContent:
    """단건 조회 결과 — md=text(JSON envelope) / 비-md=binary(raw bytes Response)."""

    doc: PersonalDoc
    text: str | None = None
    binary: bytes | None = None
    media_type: str | None = None


class PersonalService:
    def __init__(self, repo: PersonalDocRepository, file_store: PersonalFileStore) -> None:
        self.repo = repo
        self.file_store = file_store

    async def list_docs(self, user_id: uuid.UUID) -> list[PersonalDoc]:
        """유저 스코프 평면 목록(최신 수정 순)."""
        return await self.repo.by_user(user_id)

    async def _owned(self, user_id: uuid.UUID, doc_id: uuid.UUID) -> PersonalDoc:
        """단건 + 소유 검사. 부재=DOC_NOT_FOUND(404), 타유저=FORBIDDEN(403)."""
        doc = await self.repo.by_id(doc_id)
        if doc is None:
            raise DocNotFoundError(f"문서 없음: {doc_id}")
        if doc.user_id != user_id:
            raise ForbiddenError("다른 유저의 문서")
        return doc

    async def create_md(self, user_id: uuid.UUID, title: str, fmt: str = "md") -> PersonalDoc:
        """빈 md 문서 생성. md 외 format 은 UNSUPPORTED_FORMAT(400) 방어."""
        if fmt != "md":
            raise UnsupportedCreateFormatError(f"생성은 md 전용: {fmt!r}")
        doc_id = uuid.uuid4()  # file_path 를 insert 전에 확정하려 Python 에서 발급
        rel = await run_in_threadpool(self.file_store.save_text, user_id, doc_id, "md", "")
        doc = PersonalDoc(
            id=doc_id,
            user_id=user_id,
            title=title,
            format="md",
            editable=True,
            file_path=rel,
        )
        return await self.repo.add(doc)

    async def get_doc(self, user_id: uuid.UUID, doc_id: uuid.UUID) -> DocContent:
        """단건 콘텐츠. md=text / 비-md=raw bytes(+media_type)."""
        doc = await self._owned(user_id, doc_id)
        if doc.format == "md":
            text = await run_in_threadpool(self.file_store.read_text, doc.file_path)
            return DocContent(doc=doc, text=text)
        binary = await run_in_threadpool(self.file_store.read_bytes, doc.file_path)
        return DocContent(doc=doc, binary=binary, media_type=_BINARY_MEDIA.get(doc.format))

    async def save_md(
        self, user_id: uuid.UUID, doc_id: uuid.UUID, content: str, title: str | None = None
    ) -> PersonalDoc:
        """md 저장(PUT). 비-md(editable=false)는 UNSUPPORTED_FORMAT(400) — 보기 전용."""
        doc = await self._owned(user_id, doc_id)
        if doc.format != "md" or not doc.editable:
            raise UnsupportedCreateFormatError("비-md 문서는 보기 전용(저장 불가)")
        await run_in_threadpool(self.file_store.save_text, user_id, doc_id, "md", content)
        if title is not None:
            doc.title = title
        return await self.repo.update(doc)

    async def upload(self, user_id: uuid.UUID, filename: str, content: bytes) -> PersonalDoc:
        """4포맷 업로드 반입. 외 형식 UNSUPPORTED_UPLOAD_TYPE(400). md=editable/비-md=보기전용."""
        ext = _ext(filename)
        if ext not in FORMATS:
            raise UnsupportedUploadTypeError(f"업로드 불가 형식: .{ext}")
        doc_id = uuid.uuid4()
        rel = await run_in_threadpool(self.file_store.save_bytes, user_id, doc_id, ext, content)
        title = Path(filename).stem or filename
        doc = PersonalDoc(
            id=doc_id,
            user_id=user_id,
            title=title,
            format=ext,
            editable=(ext == "md"),
            file_path=rel,
        )
        return await self.repo.add(doc)
