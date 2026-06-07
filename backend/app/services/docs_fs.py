"""도서관 docs FS 서비스 (SC-WP-03 C1, SC-SPEC-01 §3·§4).

읽기전용 시드 루트(`medi-doc/`)를 트리/파일로 서빙한다. **DB/repo 없음** — 순수
파일시스템 읽기. Router(`app/api/docs.py`)가 이 서비스를 호출하고 응답 envelope/
raw bytes 분기를 담당한다.

보안: 모든 입력 path 는 루트 기준 상대경로로만 해석하며, 정규화(resolve) 후 루트
prefix 를 벗어나면(`..`/절대경로/심링크 escape) `InvalidPathError`. 숨김 항목
(`.` 시작 — 예 `.DS_Store`)은 트리 children·count·파일 서빙 모두에서 제외한다
(목록과 count 의 필터가 동일해야 FE 가 미리 받은 count 와 펼침 결과가 일치).

포맷 판별 = 확장자. md = 텍스트 JSON, docx/xlsx/pdf = raw bytes(서버 변환 없음,
SC-OPEN-01 해소), 그 외 = `UnsupportedFormatError`(415).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.exceptions import (
    DocNotFoundError,
    InvalidPathError,
    UnsupportedFormatError,
)

# 텍스트(JSON) 로 서빙하는 포맷. md 만 — 본문 content + meta 를 내린다.
_TEXT_EXTS = {"md", "markdown"}

# raw bytes 로 서빙하는 바이너리 4포맷 중 3종(+md=텍스트). Content-Type 매핑.
_BINARY_MEDIA = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@dataclass
class TextDoc:
    """md/텍스트 응답 — router 가 `{data:{path, content, meta}}` 로 감싼다."""

    path: str
    content: str
    meta: dict


@dataclass
class BinaryDoc:
    """바이너리 응답 — router 가 envelope 없이 raw `Response(content, media_type)`."""

    path: str
    content: bytes
    media_type: str


def _ext(name: str) -> str:
    """확장자(소문자, 점 제외). 없으면 빈 문자열."""
    return Path(name).suffix.lower().lstrip(".")


def _iso_mtime(stat) -> str:
    """수정 시각 → ISO8601(UTC). FE 뷰어 메타·트리 file 노드용."""
    return datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat()


class DocsFS:
    """주입된 루트 하위만 읽는 FS 서비스. 루트는 생성 시 resolve 해 고정한다."""

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root).resolve()

    def _resolve(self, rel: str) -> Path:
        """루트 기준 상대경로 → 절대경로. 루트 밖 탈출 시 InvalidPathError.

        절대경로(`/etc/passwd`)는 join 시 루트를 덮어쓰지만 resolve 후 prefix 검사에
        걸린다. `..`·심링크 escape 도 resolve 가 따라가 동일하게 차단된다.
        """
        target = (self._root / (rel or "")).resolve()
        if target != self._root and not target.is_relative_to(self._root):
            raise InvalidPathError(f"경로가 docs 루트를 벗어남: {rel!r}")
        return target

    def _rel_str(self, target: Path) -> str:
        """루트 기준 상대경로 문자열(posix). 루트 자신은 빈 문자열."""
        rel = target.relative_to(self._root)
        return "" if str(rel) == "." else rel.as_posix()

    @staticmethod
    def _visible(entries) -> list[Path]:
        """숨김(`.` 시작) 제외 + 정렬(폴더 먼저, 각 이름 오름차순)."""
        visible = [e for e in entries if not e.name.startswith(".")]
        return sorted(visible, key=lambda p: (p.is_file(), p.name.lower()))

    def _node(self, target: Path) -> dict:
        """단일 경로 → 트리 노드 dict (dir=count / file=size·updated_at)."""
        rel = self._rel_str(target)
        if target.is_dir():
            count = sum(1 for c in target.iterdir() if not c.name.startswith("."))
            return {"type": "dir", "name": target.name, "path": rel, "count": count}
        stat = target.stat()
        return {
            "type": "file",
            "name": target.name,
            "path": rel,
            "size": stat.st_size,
            "updated_at": _iso_mtime(stat),
        }

    def list_children(self, rel: str = "") -> list[dict]:
        """폴더의 직속 children 노드 목록. rel 빈값=루트.

        depth 는 router 가 받아도 한 레벨만 반환한다 — §3 응답은 flat children
        배열이고(중첩 children 필드 없음) FE 는 펼침마다 폴더별로 lazy 재요청한다.
        없는 경로/파일을 폴더처럼 조회하면 DOC_NOT_FOUND.
        """
        target = self._resolve(rel)
        if not target.exists():
            raise DocNotFoundError(f"폴더 없음: {rel!r}")
        if not target.is_dir():
            raise DocNotFoundError(f"폴더가 아님: {rel!r}")
        return [self._node(c) for c in self._visible(target.iterdir())]

    def read_file(self, rel: str) -> TextDoc | BinaryDoc:
        """파일 콘텐츠. md=TextDoc(JSON), docx/xlsx/pdf=BinaryDoc(raw bytes).

        없음=DOC_NOT_FOUND, 4포맷 외=UNSUPPORTED_FORMAT(415).
        """
        target = self._resolve(rel)
        if not target.exists() or not target.is_file():
            raise DocNotFoundError(f"문서 없음: {rel!r}")

        ext = _ext(target.name)
        path = self._rel_str(target)

        if ext in _TEXT_EXTS:
            stat = target.stat()
            # frontmatter 파싱은 미도입 — 시드 md 에 frontmatter 없음, FE 타입상 선택.
            meta = {"size": stat.st_size, "updated_at": _iso_mtime(stat), "author": None}
            return TextDoc(path=path, content=target.read_text(encoding="utf-8"), meta=meta)

        if ext in _BINARY_MEDIA:
            return BinaryDoc(path=path, content=target.read_bytes(), media_type=_BINARY_MEDIA[ext])

        raise UnsupportedFormatError(f"지원하지 않는 포맷: {target.name}")
