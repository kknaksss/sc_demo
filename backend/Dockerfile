# backend — FastAPI (SC-SPEC-05 §3, SC-WP-01 C2).
# 버전 핀/이미지 tag 는 코드 SoT — python:3.12-slim 기준.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# uv (의존성 관리) — astral 공식 이미지에서 바이너리만 복사.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 의존성 레이어 (소스 변경과 분리해 캐시).
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# 앱 소스.
COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

# 마이그레이션은 start 타임 entrypoint 에서 (Dockerfile RUN 금지).
ENTRYPOINT ["./entrypoint.sh"]
