---
id: SC-WP-02
type: work
title: 유저/인증
status: proposed
owner: BE+FE
last_updated: 2026-06-07
covers:
  - SC-SPEC-03
---

# SC-WP-02 유저/인증

테스트 계정 5개 시드 + 이메일/비밀번호 로그인(httpOnly 쿠키 세션) + 인증 게이팅을 구현한다. 개인스페이스·채팅의 유저 스코프 근거.

> SPEC 본문은 link 만([SC-SPEC-03](../spec/spec-03-user.md)). Status Board 는 [work-map.md](../work-map.md).
> **진행 = commit 단위. 1 WP = 1 PR(종결 시), PR 분리 안 함.**

## 메타

- 의존 WP: SC-WP-01 (스캐폴딩)
- 병렬 가능 WP: SC-WP-03 (도서관 — 독립)

## Code Surface

- Repo / module: `backend/app` (auth) + `frontend/src` (로그인/게이팅)
- 만질 파일 후보:
  - `backend/migrations/versions/*_users.py` — users 테이블
  - `backend/app/models/user.py` · `app/repositories/user.py`
  - `backend/app/api/auth.py` — `/api/auth/login` · `/logout` · `/me`
  - `backend/app/core/session.py` — httpOnly 쿠키 세션
  - `backend/app/seed/users.py` — 5 계정 idempotent 시드
  - `frontend/src/app/login/` · `src/components/AuthGate`, `Sidebar 푸터`
- Domain / schema note:
  - `users`: id PK · email(unique) · password_hash · display_name · org · created_at (SC-SPEC-03 §4). role 컬럼 없음.
  - 세션 = httpOnly 쿠키(SC-OPEN-07 해소). 저장소(인메모리/redis)·만료·SameSite 는 코드 SoT.

## PR Plan

- **1 WP = 1 PR**, 내부 commit 단위. BE(C1~C3) → FE(C4) 순, BE/FE 워커 병렬 시 C4 는 C3 계약 확정 후.

## Dev Plan (commit 단위)

1. **C1** — `users` Alembic migration + SQLAlchemy model + repository.
2. **C2** — 시드 루틴: `test1@test.com`~`test5@test.com`(비번 해시, org `test`), idempotent. entrypoint seed 단계 연결.
3. **C3** — auth API: `POST /api/auth/login`(검증→Set-Cookie httpOnly, user+org 반환) · `POST /logout`(세션 무효화) · `GET /me`. `INVALID_CREDENTIALS`(이메일 존재 비구분) / `UNAUTHENTICATED`.
4. **C4** — FE: 로그인 화면(이메일/비번 직접 입력, quick-fill 없음) + 인증 게이팅(`app` — user 없으면 LoginScreen) + 사이드바 푸터(아바타·표시이름·`mediness/{org}`·로그아웃).

## Progress Checklist

- [x] C1 feat: users migration + model + repository — SHA: `a8cbbd3` (UUID PK, migration 19ebeed78f05, admin gate pytest8·ruff·alembic ✅)
- [x] C2 feat: 5 계정 idempotent 시드(bcrypt 해시) + core/security + entrypoint — SHA: `ed88aac` (pytest13·seed +5/+0·5행 확인)
- [x] C3 feat: auth API(login/logout/me, httpOnly 쿠키 세션, CORS) — SHA: `005ce13` (api→service→repo, pytest21·ruff, real pg+redis e2e)
- [x] C4 feat: FE 로그인 + 인증 게이팅 + 사이드바 셸(3탭)+푸터 — SHA: `b18aaf6` (디자인 CSS 토큰 차용, lint·build ✓. e2e 는 C3 후)

## Test / QA Plan

- 단위: 비번 해시/검증, 세션 발급/만료, 시드 idempotency.
- 통합: login→me→logout 사이클, 미인증 보호 리소스 차단(`UNAUTHENTICATED`).
- E2E: 5계정 로그인→셸 진입→로그아웃→게이트 복귀.
- 회귀: 없음(신규).

## Release Gate

- [x] SC-SPEC-03 Acceptance Criteria 통과(시드 5계정·로그인·me·로그아웃·INVALID_CREDENTIALS·해시저장·게이팅) — pytest + live e2e 검증.
- [x] 단위/통합/E2E 통과 — pytest 21(auth) / 전체 / **브라우저 로그인 e2e**(localhost:33000, test1~5) + curl live(pg+redis).
- [x] work-map 갱신 (ready_for_qa).

## Closure

### 종결 메타
- Status: **ready_for_qa** (코드 + 브라우저 로그인 e2e 검증 완료)
- 커밋: C1 `a8cbbd3` · C2 `ed88aac` · C3 `005ce13` · C4 `b18aaf6`
- Owner: api(BE) + web-fe(FE), admin 게이트/커밋

### 신규 자산
- `app/models/user.py`·`app/repositories/user.py`·`app/core/security.py`(bcrypt)·`app/core/session.py`(httpOnly 쿠키 세션, redis store, 서버측 무효화)·`app/services/auth.py`·`app/api/auth.py`·`app/schemas/auth.py`·`app/seed/` (5계정)
- migration `19ebeed78f05`(users). CORS(`config.cors_origins`).
- FE: `AppGate`·`LoginScreen`·`Shell`(사이드바 3탭)·`lib/auth.ts`. 디자인 CSS 토큰(`styles/tokens.css`·`onto.css`).
- **컨벤션**: 쿠키 세션(SC-OPEN-07), api→service→repo, `core/security.verify_password` 재사용(후속 WP).

### 검증 (브라우저 e2e ✓)
- localhost:33000 로그인 화면 → `test1@test.com`/`test1admin` → 셸 진입 → 로그아웃. 쿠키 발급·CORS·서버측 redis 세션 무효화 확인.

### 후속
- (없음 — WP-02 완결. role 분기는 SC-OPEN-08 후속, 필요 시.)

## Open Issues

- ~~세션 저장소(인메모리 vs redis)~~ → **redis 채택**(`RedisSessionStore`, 서버측 무효화).
