---
id: SC-WP-04
type: work
title: 개인스페이스
status: proposed
owner: BE+FE
last_updated: 2026-06-07
covers:
  - SC-SPEC-02
---

# SC-WP-04 개인스페이스

유저별 read-write 작업실 — md 인앱 생성/편집/저장 + 4포맷 업로드/보기(비-md 보기전용) + md 보기/편집 모드. 도서관 4포맷 렌더 재사용.

> SPEC 본문은 link 만([SC-SPEC-02](../spec/spec-02-personal-space.md)). Status Board 는 [work-map.md](../work-map.md).
> **진행 = commit 단위. 1 WP = 1 PR(종결 시), PR 분리 안 함.**

## 메타

- 의존 WP: SC-WP-02 (유저 스코프) + SC-WP-03 (4포맷 렌더 재사용)
- 병렬 가능 WP: 없음 (WP-05 가 본 WP 의존)

## Code Surface

- Repo / module: `backend/app` (personal docs) + `frontend/src` (목록/에디터)
- 만질 파일 후보:
  - `backend/migrations/versions/*_personal_docs.py`
  - `backend/app/models/personal_doc.py` · `app/repositories/personal_doc.py`
  - `backend/app/api/personal.py` — 목록/생성(md)/조회/PUT 저장/업로드(4포맷)
  - `backend/app/services/file_store.py` — 서버 FS 파일 저장(md 텍스트/바이너리 원본)
  - `frontend/src/app/personal/` · `MdEditor`(소스+react-markdown 프리뷰)·`DocList`·`Uploader`
- Domain / schema note:
  - `personal_docs`: id PK · user_id FK→users · title · format(md/docx/xlsx/pdf) · editable(md=true) · file_path · created_at · updated_at (SC-SPEC-02 §4). 콘텐츠 본체는 FS.
  - 보기/편집 모드 = 런타임 UI 상태(DB 컬럼 아님).

## PR Plan

- **1 WP = 1 PR**, 내부 commit 단위. BE(C1~C2) → FE(C3~C4).

## Dev Plan (commit 단위)

1. **C1** — `personal_docs` migration + model + repository + FS file_store.
2. **C2** — CRUD API: `GET /docs`(유저스코프 목록) · `POST /docs`(md 생성, 비-md=`UNSUPPORTED_FORMAT`) · `GET /docs/{id}`(md=text/비-md=raw bytes) · `PUT /docs/{id}`(md 저장) · `POST /docs/upload`(4포맷, 외=`UNSUPPORTED_UPLOAD_TYPE`). `FORBIDDEN`(타유저).
3. **C3** — FE 목록 + md 에디터(소스 textarea + react-markdown 프리뷰) + 보기/편집 모드 토글 + 저장(`수정됨`/`저장됨`).
4. **C4** — 업로드(4포맷) + 비-md 보기(도서관 렌더 재사용, editable=false) + 빈상태/notfound, e2e.

## Progress Checklist

- [ ] C1 feat: personal_docs migration + model + FS store — SHA: `-`
- [ ] C2 feat: CRUD + 업로드 API(유저스코프) — SHA: `-`
- [ ] C3 feat: FE 목록 + md 에디터 + 보기/편집 모드 — SHA: `-`
- [ ] C4 feat: 업로드 + 비-md 보기 + e2e — SHA: `-`

## Test / QA Plan

- 단위: 유저 격리(FORBIDDEN), format 가드(md only 생성), 업로드 형식 가드.
- 통합: 생성→편집→저장→재조회, 업로드(md 편집가능/비-md 보기전용), 빈 공간.
- E2E: md 생성·편집·저장 / docx·xlsx·pdf 업로드·보기.
- 회귀: 도서관 렌더(WP-03) 재사용 — 렌더 컴포넌트 공유 검증.

## Release Gate

- [ ] SC-SPEC-02 Acceptance Criteria 통과(md 생성/편집/저장·업로드 4포맷·비-md 보기전용·FORBIDDEN·빈상태).
- [ ] 단위/통합/E2E 통과.
- [ ] work-map 갱신.

## Closure (WP 종결 시 작성)

## Open Issues

- md 에디터 = 소스+프리뷰(경량) 확정. `@uiw/react-md-editor` 업그레이드는 후속 판단(SC-OPEN-06).
- 보기/편집 모드 토글 UX(명시 버튼 vs 자동) — 디자인 세부는 개발팀 + WP-05 도크 게이팅과 정합.
