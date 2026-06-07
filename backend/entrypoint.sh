#!/bin/sh
# backend 컨테이너 entrypoint (SC-SPEC-05 §4).
# 순서: 마이그레이션 적용 → 시드(후속 WP) → 앱 기동.
# 마이그레이션은 start 타임에 실행(빌드타임 RUN 금지) — backend 단일 owner.
set -e

echo "[entrypoint] alembic upgrade head"
alembic upgrade head

# NOTE(WP-02): users 테스트 계정 5개 idempotent 시드 — 후속 commit 에서 추가.
# echo "[entrypoint] seed"
# python -m app.seed

echo "[entrypoint] start uvicorn"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
