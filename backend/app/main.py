"""FastAPI 진입점 (SC-WP-01 C2 skeleton).

- `GET /health` 인프라 health 체크 (DB 미접근 — 컨테이너 liveness 용).
- 도메인 라우터는 prefix `/api` 로 후속 WP 에서 마운트 (v1 prefix 없음).
- AppError 계층을 HTTP 응답으로 변환하는 핸들러.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.docs import router as docs_router
from app.config import settings
from app.exceptions import AppError

app = FastAPI(title="sc_demo backend")

# CORS — cross-origin 쿠키 인증(SC-WP-02 C3, FE C4 플래그). allow_credentials=True 면
# allow_origins 에 와일드카드(`*`) 불가 → 명시적 FE origin. allow_methods 기본은 GET 만
# 이라 login/logout(POST) preflight 가 깨진다 → "*" 로 전체 메서드 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


app.include_router(auth_router)
app.include_router(docs_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
