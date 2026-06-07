---
id: SC-WP-01
type: work
title: 환경구성/스캐폴딩
status: proposed
owner: TBD
last_updated: 2026-06-07
covers:
  - SC-SPEC-05
---

# SC-WP-01 환경구성/스캐폴딩

feature WP 들이 올라갈 토대를 만든다 — docker-compose(backend/frontend/postgres/redis/worker) + FastAPI/Next.js skeleton + Alembic(entrypoint 적용) + 도서관/개인스페이스 마운트.

> 1 파일 = 1 WP = **빌드 계획**. SPEC 본문은 link 만([SC-SPEC-05](../spec/spec-05-environment.md)). 실제 schema/lock/이미지 tag 는 코드 SoT.
> Status Board / Spec Coverage 는 [work-map.md](../work-map.md).
> **진행 = commit 단위. 1 WP = 1 PR(종결 시), PR 분리 안 함.**

## 메타

- 의존 WP: 없음 (모든 WP 의 선행)
- 병렬 가능 WP: 없음 (이게 끝나야 02~05 착수)

## Code Surface

- Repo / module: 레포 루트 + `backend/` + `frontend/`
- 만질 파일 후보:
  - `docker-compose.yml` (5 서비스 + 33xxx 포트 + 마운트)
  - `backend/` — FastAPI 앱 (`app/main.py`, `app/db.py`, `alembic.ini`, `migrations/`), entrypoint 스크립트, `Dockerfile`
  - `backend/app/worker/` — open-kknaks ClaudeWorker 기동 진입점 (worker 서비스)
  - `frontend/` — Next.js App Router skeleton (`src/app/`, `package.json`, `Dockerfile`)
  - `backend/pyproject.toml` · `frontend/package.json` (스택 의존성)
- Domain / schema note:
  - 본 WP 는 테이블을 만들지 않음 — Alembic 초기화 + 빈 마이그레이션 베이스라인만. 실제 테이블은 WP-02~05.
  - entrypoint 순서: `alembic upgrade head` → idempotent seed → `exec uvicorn` (SPEC-05 §4).

## PR Plan

- **1 WP = 1 PR**, 내부는 아래 commit 단위. PR 분리 없음(스캐폴딩 한 흐름).
- 선행 PR: 없음.

## Dev Plan (commit 단위)

1. **C1** — `docker-compose.yml`: `backend`/`frontend`/`postgres`/`redis`/`worker` 5 서비스, 33xxx 포트(be 33080·fe 33000·pg 33432·redis 33379·worker 포트없음), 마운트(도서관 docs `:ro`→backend+worker, 개인스페이스 파일 rw→backend).
2. **C2** — backend skeleton: FastAPI 앱 + SQLAlchemy 2.0 async + asyncpg + Alembic 초기화 + entrypoint(`upgrade head`→seed→uvicorn). pytest+pytest-asyncio(`asyncio_mode=auto`) 설정.
3. **C3** — frontend skeleton: Next.js(App Router)+TS+React18 + Dockerfile. 빈 셸 페이지.
4. **C4** — worker 서비스: open-kknaks 의존 추가, ClaudeWorker 기동 진입점(config: work_dir=도서관 docs, disallowed_tools 등은 WP-05 에서 확정), redis 연결. **단일 워커**(`replicas: 1`).
5. **C5** — 마운트/인증 마감: 도서관 docs `:ro`(be+worker), 개인스페이스 파일 rw(be), worker 에 claude CLI 인증 전달 방식(인증 디렉토리 마운트/env) 구성. `~/.claude/projects` 세션 볼륨(선택).

## Progress Checklist

> commit push 시 ✅ + SHA 기입.

- [ ] C1 chore: docker-compose 5 서비스 + 33xxx 포트 + 마운트 — SHA: `-`
- [ ] C2 feat: backend FastAPI + SQLAlchemy async + Alembic + entrypoint — SHA: `-`
- [ ] C3 feat: frontend Next.js skeleton — SHA: `-`
- [ ] C4 feat: worker(open-kknaks ClaudeWorker, 단일) + redis 연결 — SHA: `-`
- [ ] C5 chore: 도서관/개인스페이스 마운트 + worker claude 인증 — SHA: `-`

## Test / QA Plan

- 통합: `docker compose up` → 5 서비스 기동, 포트 33xxx 응답.
- Backend: `alembic upgrade head` 가 entrypoint 에서 동작, pytest 1개 smoke 통과.
- 검증: 도서관 docs 가 backend·worker 양쪽에서 `:ro` 로 보임.

## Release Gate

- [ ] SC-SPEC-05 Acceptance Criteria 통과 (docker compose up, 포트, alembic, 마운트).
- [ ] backend pytest smoke 통과.
- [ ] work-map Status Board / Spec Coverage 갱신.

## Closure (WP 종결 시 작성)

> Release Gate 통과 시 작성.

## Open Issues

- FE 테스트 프레임워크 미결(SC-SPEC-05 SC-OPEN-14) — 본 WP 는 skeleton 만, 프레임워크 선택은 후속.
- 버전 핀/이미지 tag(SC-OPEN-15) — lock 파일 생성 시 확정.
