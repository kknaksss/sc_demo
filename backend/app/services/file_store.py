"""개인스페이스 FS file_store (SC-WP-04 C1, SC-SPEC-02 §4 DB).

문서 **콘텐츠 본체**를 서버 파일시스템에 저장/읽기한다 — md=텍스트, 비-md
(docx/xlsx/pdf)=바이너리 원본(서버 변환 없음, 도서관과 동일 altitude). DB
(`personal_docs`)는 메타만 보관하고 `file_path` 로 이 파일을 가리킨다.

레이아웃(코드 SoT): `{root}/{user_id}/{doc_id}.{ext}`. DB 의 `file_path` 에는
**루트 기준 상대경로**(`{user_id}/{doc_id}.{ext}`)를 저장한다 — 절대경로는
dev(`/Users/...`)/컨테이너(`/app/data/personal`) 마운트 간 이식성을 깨므로.
읽기 시 루트 하위로 resolve 하고, 루트 밖 탈출(`..`/절대경로/심링크)은
`InvalidPathError`(docs_fs 동일 가드).

저장 루트 = `settings.personal_data_root` (컨테이너 기본 `/app/data/personal`,
WP-01 `personal_data:rw` 마운트). 디렉토리는 저장 시 lazy 생성.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from app.exceptions import InvalidPathError


class PersonalFileStore:
    """주입된 루트 하위에서만 유저 스코프 문서 파일을 저장/읽는 FS 서비스."""

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root).resolve()

    def rel_path(self, user_id: uuid.UUID, doc_id: uuid.UUID, ext: str) -> str:
        """DB `file_path` 에 저장할 루트 기준 상대경로 = `{user_id}/{doc_id}.{ext}`."""
        return f"{user_id}/{doc_id}.{ext.lstrip('.')}"

    def _resolve(self, rel: str) -> Path:
        """루트 기준 상대경로 → 절대경로. 루트 밖 탈출 시 InvalidPathError.

        docs_fs._resolve 와 동일 가드 — 절대경로는 join 시 루트를 덮어쓰지만
        resolve 후 prefix 검사에 걸린다. `..`·심링크 escape 도 차단.
        """
        target = (self._root / (rel or "")).resolve()
        if target != self._root and not target.is_relative_to(self._root):
            raise InvalidPathError(f"경로가 개인스페이스 루트를 벗어남: {rel!r}")
        return target

    def save_text(self, user_id: uuid.UUID, doc_id: uuid.UUID, ext: str, content: str) -> str:
        """md 텍스트 저장 → 저장한 상대 file_path 반환."""
        rel = self.rel_path(user_id, doc_id, ext)
        target = self._resolve(rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return rel

    def save_bytes(self, user_id: uuid.UUID, doc_id: uuid.UUID, ext: str, content: bytes) -> str:
        """비-md(docx/xlsx/pdf) 원본 바이트 저장 → 저장한 상대 file_path 반환."""
        rel = self.rel_path(user_id, doc_id, ext)
        target = self._resolve(rel)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return rel

    def read_text(self, rel: str) -> str:
        """md 텍스트 읽기 (DB file_path 상대경로 기준)."""
        return self._resolve(rel).read_text(encoding="utf-8")

    def read_bytes(self, rel: str) -> bytes:
        """비-md 원본 바이트 읽기 (raw 서빙용, DB file_path 상대경로 기준)."""
        return self._resolve(rel).read_bytes()
