"""개인스페이스 라우터 (SC-WP-04 C2, SC-SPEC-02 §3) — `/api/personal/docs`.

Router → Service(app/services/personal) → Repository(personal_doc) + file_store.
유저 식별 = WP-02 쿠키 세션(`AuthService.current_user`) — 미인증 `UNAUTHENTICATED`(401),
타유저 문서 `FORBIDDEN`(403).

응답 envelope 는 **비대칭**(목록/생성/단건/저장/업로드가 서로 다른 필드 셋, FE 가 각각
의존, spec-02 §3) 이라 router 가 dict 로 직접 조립한다. 비-md 단건은 envelope 없이
raw `Response(bytes, media_type)`(도서관 패턴 재사용). 에러는 service 가 AppError 로
raise → main.py 핸들러가 `{code,message}` + status 로 변환.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, File, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_auth_service
from app.config import settings
from app.db import get_session
from app.models.personal_doc import PersonalDoc
from app.models.user import User
from app.repositories.personal_doc import PersonalDocRepository
from app.schemas.personal import PersonalDocCreate, PersonalDocUpdate
from app.services.auth import AuthService
from app.services.file_store import PersonalFileStore
from app.services.personal import PersonalService

router = APIRouter(prefix="/api/personal", tags=["personal"])


async def get_current_user(
    service: Annotated[AuthService, Depends(get_auth_service)],
    sc_session: Annotated[str | None, Cookie()] = None,
) -> User:
    """쿠키 세션 → 현재 유저(유저 스코프). 미인증/만료 시 UNAUTHENTICATED(401).

    테스트는 이 의존성을 override 해 고정 유저를 주입한다(인증 경로 우회). 미인증
    케이스는 override 없이 실제 의존성을 쿠키 없이 태워 401 을 검증.
    """
    return await service.current_user(sc_session)


def get_personal_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PersonalService:
    """요청 스코프 PersonalService — repo(DB 세션) + file_store(설정 루트) 조립.

    테스트는 이 의존성을 override 해 fake repo + tmp file_store 로 갈아끼운다.
    """
    repo = PersonalDocRepository(session)
    store = PersonalFileStore(settings.personal_data_root)
    return PersonalService(repo, store)


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _list_item(doc: PersonalDoc) -> dict:
    return {
        "id": str(doc.id),
        "title": doc.title,
        "format": doc.format,
        "editable": doc.editable,
        "updated_at": _iso(doc.updated_at),
        "created_at": _iso(doc.created_at),
    }


@router.get("/docs")
async def list_docs(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[PersonalService, Depends(get_personal_service)],
) -> dict:
    """내 문서 목록(평면, 유저 스코프). 빈 공간은 빈 items(오류 아님)."""
    docs = await service.list_docs(user.id)
    return {"data": {"items": [_list_item(d) for d in docs]}}


@router.post("/docs", status_code=status.HTTP_201_CREATED)
async def create_doc(
    body: PersonalDocCreate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[PersonalService, Depends(get_personal_service)],
) -> dict:
    """새 md 문서 생성(빈 문서). 비-md format → UNSUPPORTED_FORMAT(400)."""
    doc = await service.create_md(user.id, body.title, body.format)
    return {
        "data": {
            "id": str(doc.id),
            "title": doc.title,
            "format": doc.format,
            "created_at": _iso(doc.created_at),
        }
    }


@router.get("/docs/{doc_id}", response_model=None)
async def get_doc(
    doc_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[PersonalService, Depends(get_personal_service)],
) -> Response | dict:
    """단건 — md=텍스트 JSON / 비-md=raw bytes. 부재 DOC_NOT_FOUND·타유저 FORBIDDEN."""
    result = await service.get_doc(user.id, doc_id)
    if result.binary is not None:
        return Response(content=result.binary, media_type=result.media_type)
    doc = result.doc
    return {
        "data": {
            "id": str(doc.id),
            "title": doc.title,
            "format": doc.format,
            "editable": doc.editable,
            "content": result.text,
            "meta": {"updated_at": _iso(doc.updated_at), "created_at": _iso(doc.created_at)},
        }
    }


@router.put("/docs/{doc_id}")
async def save_doc(
    doc_id: uuid.UUID,
    body: PersonalDocUpdate,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[PersonalService, Depends(get_personal_service)],
) -> dict:
    """md 저장. 비-md(보기 전용) 저장 → UNSUPPORTED_FORMAT(400)."""
    doc = await service.save_md(user.id, doc_id, body.content, body.title)
    return {"data": {"id": str(doc.id), "updated_at": _iso(doc.updated_at)}}


@router.post("/docs/upload", status_code=status.HTTP_201_CREATED)
async def upload_doc(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[PersonalService, Depends(get_personal_service)],
    file: Annotated[UploadFile, File()],
) -> dict:
    """4포맷(md/docx/xlsx/pdf) 업로드 반입. 외 형식 → UNSUPPORTED_UPLOAD_TYPE(400)."""
    content = await file.read()
    doc = await service.upload(user.id, file.filename or "", content)
    return {
        "data": {
            "id": str(doc.id),
            "title": doc.title,
            "format": doc.format,
            "editable": doc.editable,
            "created_at": _iso(doc.created_at),
        }
    }
