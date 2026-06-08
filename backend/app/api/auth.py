"""인증 라우터 (SC-WP-02 C3, SC-SPEC-03 §3) — `/api/auth/{login,logout,me}`.

Router → Service(app/services/auth) → Repository(app/repositories/user). 쿠키 set/
clear 와 응답 envelope 포장만 여기서 하고, 검증/세션 로직은 service 에 위임한다.

envelope 비대칭(FE 가 의존): login=`{data:{user}}`, me=`{data:{...}}`. logout 은 204.
응답에 role 없음(v1 동등). 에러(INVALID_CREDENTIALS/UNAUTHENTICATED)는 service 가
AppError 로 raise → main.py 핸들러가 401+code 로 변환.
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.session import (
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    SessionStore,
    get_session_store,
)
from app.db import get_session
from app.repositories.user import UserRepository
from app.schemas.auth import LoginRequest, UserOut
from app.services.auth import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 쿠키 속성 = 코드 SoT. httpOnly(JS 접근 차단), SameSite=Lax(same-site/same-origin 동반 충분).
# secure 는 env 분기(PLAN-106-T-001): dev http=False, prod https=True(COOKIE_SECURE=true).
# set/delete 가 동일 속성을 써야 브라우저가 로그아웃 시 쿠키를 지운다.
_COOKIE_KWARGS = {
    "httponly": True,
    "samesite": "lax",
    "secure": settings.cookie_secure,
    "path": "/",
}


def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    store: Annotated[SessionStore, Depends(get_session_store)],
) -> AuthService:
    """요청 스코프 AuthService — repo(DB 세션) + 세션 저장소 조립.

    테스트는 이 의존성을 override 해 fake repo + InMemorySessionStore 로 갈아끼운다
    (DB/redis 없이 통과).
    """
    return AuthService(UserRepository(session), store)


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict:
    """이메일+비밀번호 검증 → httpOnly 쿠키 세션 발급. 불일치 시 INVALID_CREDENTIALS(401)."""
    user, sid = await service.login(body.email, body.password)
    response.set_cookie(SESSION_COOKIE, sid, max_age=SESSION_TTL_SECONDS, **_COOKIE_KWARGS)
    return {"data": {"user": UserOut.model_validate(user).model_dump(mode="json")}}


@router.get("/me")
async def me(
    service: Annotated[AuthService, Depends(get_auth_service)],
    sc_session: Annotated[str | None, Cookie()] = None,
) -> dict:
    """현재 로그인 유저(who am I). 미인증/만료 시 UNAUTHENTICATED(401)."""
    user = await service.current_user(sc_session)
    return {"data": UserOut.model_validate(user).model_dump(mode="json")}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    service: Annotated[AuthService, Depends(get_auth_service)],
    sc_session: Annotated[str | None, Cookie()] = None,
) -> None:
    """서버측 세션 무효화 + 쿠키 만료. 204(빈 body).

    주입된 response 에 delete_cookie 만 걸고 None 반환 → 라우트 status 204 가 적용되고
    Set-Cookie(만료) 헤더만 병합된다.
    """
    await service.logout(sc_session)
    response.delete_cookie(SESSION_COOKIE, **_COOKIE_KWARGS)
