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

- [ ] C1 feat: users migration + model + repository — SHA: `-`
- [ ] C2 feat: 5 계정 idempotent 시드(해시) — SHA: `-`
- [ ] C3 feat: auth API(login/logout/me, httpOnly 쿠키) — SHA: `-`
- [ ] C4 feat: FE 로그인 + 인증 게이팅 + 사이드바 푸터 — SHA: `-`

## Test / QA Plan

- 단위: 비번 해시/검증, 세션 발급/만료, 시드 idempotency.
- 통합: login→me→logout 사이클, 미인증 보호 리소스 차단(`UNAUTHENTICATED`).
- E2E: 5계정 로그인→셸 진입→로그아웃→게이트 복귀.
- 회귀: 없음(신규).

## Release Gate

- [ ] SC-SPEC-03 Acceptance Criteria 통과(시드 5계정·로그인·me·로그아웃·INVALID_CREDENTIALS·해시저장·게이팅).
- [ ] 단위/통합/E2E 통과.
- [ ] work-map 갱신.

## Closure (WP 종결 시 작성)

## Open Issues

- 세션 저장소(인메모리 vs redis) 선택 — 개발팀 결정(redis 이미 있음).
