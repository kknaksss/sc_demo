"""FastAPI 진입점 (SC-WP-01 C2 skeleton).

- `GET /health` 인프라 health 체크 (DB 미접근 — 컨테이너 liveness 용).
- 도메인 라우터는 prefix `/api` 로 후속 WP 에서 마운트 (v1 prefix 없음).
- AppError 계층을 HTTP 응답으로 변환하는 핸들러.
- lifespan: open-kknaks RedisBroker 연결 + 단일 공유 ChatEngine 생성(SC-WP-05 C3).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from open_kknaks import AgentClient, RedisBroker

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.docs import router as docs_router
from app.api.personal import router as personal_router
from app.config import settings
from app.exceptions import AppError
from app.services.chat_engine import ChatEngine

logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """open-kknaks producer 생명주기 — startup 연결, shutdown 정리.

    broker 는 워커와 **동일 url/namespace** 라야 잡이 소비된다(불일치 = 영영 미소비).
    연결은 best-effort: redis 가 아직 없어도 API 부팅을 막지 않는다(docs/personal/auth
    라우트는 redis 무관). 그 경우 submit 이 실패해 spec-04 `ENGINE_ERROR` 로 수렴한다.
    """
    broker = RedisBroker(url=settings.redis_url, namespace=settings.worker_namespace)
    try:
        await broker.connect()
        logger.info("chat broker connected (namespace=%s)", settings.worker_namespace)
    except Exception as exc:  # noqa: BLE001 — redis 부재로 API 부팅을 막지 않는다
        logger.warning("chat broker connect failed (계속 진행): %s", exc)

    app.state.chat_broker = broker
    app.state.chat_engine = ChatEngine(
        AgentClient(broker),
        work_dir=settings.worker_work_dir,
        timeout_sec=settings.engine_timeout_sec,
    )
    try:
        yield
    finally:
        try:
            await broker.close()
            logger.info("chat broker closed")
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat broker close failed: %s", exc)


app = FastAPI(title="sc_demo backend", lifespan=lifespan)

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
app.include_router(personal_router)
app.include_router(chat_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
