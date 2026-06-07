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

- [x] C1 chore: docker-compose 5 서비스 + 33xxx 포트 + 마운트 — SHA: `4dd5196` (+ baseline `5c96058`)
- [x] C2 feat: backend FastAPI + SQLAlchemy async + Alembic + entrypoint — SHA: `6c756b4` (admin gate: pytest·ruff·alembic ✅)
- [x] C3 feat: frontend Next.js skeleton — SHA: `dbcc541` (next 14.2.35/TS strict/Tailwind, build·lint ✅)
- [x] C4 feat: worker(open-kknaks ClaudeWorker, 단일) + redis 연결 — SHA: `2ee5389` (의존성=vendored wheel, boot smoke·pytest 4·ruff ✅)
- [x] C5 chore: worker 컨테이너(Dockerfile.worker node+open-kknaks, claude 미설치) + host claude 바인드마운트 + 인증/세션 — SHA: `f159384` (T-005 폐기→T-006 재정합. compose config·build·마운트 ✅, provider.check 는 deploy 검증)

## Test / QA Plan

- 통합: `docker compose up` → 5 서비스 기동, 포트 33xxx 응답.
- Backend: `alembic upgrade head` 가 entrypoint 에서 동작, pytest 1개 smoke 통과.
- 검증: 도서관 docs 가 backend·worker 양쪽에서 `:ro` 로 보임.

## Release Gate

- [x] SC-SPEC-05 토대 코드 정합 (compose 5서비스/33xxx 포트/alembic entrypoint/마운트 — config·build 검증).
- [x] backend pytest smoke 통과 (admin gate: pytest 4 · ruff clean).
- [x] work-map Status Board / Spec Coverage 갱신.
- [x] **worker claude 로컬 검증(Mac)**: `.claude-tools` 마운트로 worker 컨테이너 `provider.check claude=ok`(claude 2.1.85, `/claude-tools/node_modules/.bin/claude`) + redis 연결 + worker.started/stopped. **deploy 안 가도 로컬 동작** (host 바이너리 마운트 폐기 → setup.sh `.claude-tools` 패턴, `48b0fb8`).

## Closure

### 종결 메타

- Status: **ready_for_qa** (코드 정합 + worker claude 로컬 검증 완료)
- 커밋 범위: `4dd5196`..`48b0fb8` (C1~C5 + claude-tools fix, + baseline `5c96058`)
- Owner: api(BE) + web-fe(FE) 워커, admin 게이트/커밋
- 일자: 2026-06-07

### 신규 자산 (다음 WP 참조)

**신규**
- `docker-compose.yml` — 5서비스(be/fe/pg/redis/worker 단일) + 33xxx + 마운트
- `backend/` — FastAPI(`/health`) + SQLAlchemy async + Alembic(빈 베이스라인 `07283d7bf643`) + entrypoint(upgrade→seed placeholder→uvicorn) + pytest(asyncio_mode=auto) + ruff. 레이어 골격(api/schemas/services/repositories/models/exceptions AppError).
- `backend/app/worker/` — open-kknaks ClaudeWorker 기동 골격. `backend/vendor/` open-kknaks wheel.
- `backend/Dockerfile.worker` — python+open-kknaks(claude 미설치). node+claude 는 `.claude-tools` 마운트에서.
- `setup.sh` — Linux node + Claude Code(JS) 를 `.claude-tools/` 스테이징(open-kknaks 패턴, Mac/Linux 양쪽 동작). `.claude-tools` gitignore.
- `docker-compose.prod.yml` — prod 오버라이드(.env.prod, restart always). dev=`compose up` / prod=`-f ... prod.yml --env-file .env.prod`.
- `frontend/` — Next.js(App Router)+TS strict+Tailwind+lucide-react+standalone Dockerfile + `src/lib/api.ts`.
- `.env.example` — `CLAUDE_BIN_DIR`/`CLAUDE_CODE_OAUTH_TOKEN`/postgres. (`.env` gitignore)
- **컨벤션**: route prefix `/api`(v1 없음), 단일 워커, 커밋=admin(워커는 리포트만).

### 후속 태스크

- **deploy(admin)**: home-server 에서 `bash setup.sh`(.claude-tools 스테이징) + `cp .env.example .env.prod` 토큰 채움 → `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build`. (worker claude 는 로컬에서 이미 검증됨 — 동일 패턴.)
- **전체 `compose up` 5서비스 동시 기동**: worker+redis 는 검증, backend+frontend 빌드 검증 — 5개 한번에 up 은 QA 라운드에서.
- **SC-OPEN-14 FE 테스트 프레임워크**: skeleton 만 — Jest/Vitest/Playwright 선택은 후속.
- **알려진 부채**: open-kknaks = vendored wheel(`backend/vendor/`) — 갱신 시 재-vendoring(work-05 참조). next 14 transitive audit 5건(React18 고정 정책).

## Open Issues

- FE 테스트 프레임워크 미결(SC-SPEC-05 SC-OPEN-14) — 본 WP 는 skeleton 만, 프레임워크 선택은 후속.
- 버전 핀/이미지 tag(SC-OPEN-15) — lock 파일 생성 시 확정.
