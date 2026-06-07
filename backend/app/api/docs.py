"""도서관 docs 라우터 (SC-WP-03 C1, SC-SPEC-01 §3) — `/api/docs/{tree,file}`.

Router → Service(`app/services/docs_fs`). DB/repo 없음(읽기전용 FS). 권한 분기 없음
— 데모는 어드민 전제로 전부 노출(spec §4 Functional Rule).

envelope: tree = `{data:{children}}`, md/텍스트 file = `{data:{path,content,meta}}`.
바이너리(docx/xlsx/pdf) file 은 envelope 없이 raw `Response(bytes, media_type)` —
클라이언트가 포맷별 라이브러리로 렌더(SC-OPEN-01). 에러는 service 가 AppError 로
raise → main.py 핸들러가 `{code,message}` + status 로 변환.

FS 읽기는 blocking I/O 라 `run_in_threadpool` 로 이벤트 루프 밖에서 실행한다.
"""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from app.config import settings
from app.services.docs_fs import BinaryDoc, DocsFS

router = APIRouter(prefix="/api/docs", tags=["docs"])


def get_docs_fs() -> DocsFS:
    """설정된 docs 루트로 조립한 FS 서비스. 테스트는 이 의존성을 override 해 tmp 트리로 교체."""
    return DocsFS(Path(settings.docs_root))


@router.get("/tree")
async def tree(
    fs: Annotated[DocsFS, Depends(get_docs_fs)],
    path: str = "",
    depth: int = Query(1, ge=1),
) -> dict:
    """문서 트리 조회 — path 빈값=루트. depth 단위 lazy(현재 한 레벨씩 children).

    depth 는 계약 호환을 위해 받되 service 가 한 레벨만 반환한다(§3 flat children,
    FE 는 폴더 펼침마다 재요청). dir 노드 count·file 노드 size/updated_at 동봉.
    """
    children = await run_in_threadpool(fs.list_children, path)
    return {"data": {"children": children}}


@router.get("/file", response_model=None)
async def file(
    fs: Annotated[DocsFS, Depends(get_docs_fs)],
    path: str = Query(...),
) -> Response | dict:
    """문서 콘텐츠 — md=텍스트 JSON, docx/xlsx/pdf=raw bytes(서버 변환 없음).

    없음=DOC_NOT_FOUND(404)·루트 밖=INVALID_PATH(404)·4포맷 외=UNSUPPORTED_FORMAT(415).
    """
    doc = await run_in_threadpool(fs.read_file, path)
    if isinstance(doc, BinaryDoc):
        return Response(content=doc.content, media_type=doc.media_type)
    return {"data": {"path": doc.path, "content": doc.content, "meta": doc.meta}}
