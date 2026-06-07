"""FastAPI 진입점 (SC-WP-01 C2 skeleton).

- `GET /health` 인프라 health 체크 (DB 미접근 — 컨테이너 liveness 용).
- 도메인 라우터는 prefix `/api` 로 후속 WP 에서 마운트 (v1 prefix 없음).
- AppError 계층을 HTTP 응답으로 변환하는 핸들러.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import AppError

app = FastAPI(title="sc_demo backend")


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
