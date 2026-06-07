---
id: SC-WP-03
type: work
title: 도서관
status: proposed
owner: BE+FE
last_updated: 2026-06-07
covers:
  - SC-SPEC-01
---

# SC-WP-03 도서관

읽기전용 시드 문서를 폴더 트리로 탐색하고 브라우저에서 4포맷(md/docx/xlsx/pdf) 클라이언트 렌더하는 도서관을 구현한다.

> SPEC 본문은 link 만([SC-SPEC-01](../spec/spec-01-library.md)). Status Board 는 [work-map.md](../work-map.md).
> **진행 = commit 단위. 1 WP = 1 PR(종결 시), PR 분리 안 함.**

## 메타

- 의존 WP: SC-WP-01 (스캐폴딩 + 도서관 docs 마운트)
- 병렬 가능 WP: SC-WP-02 (유저 — 독립)

## Code Surface

- Repo / module: `backend/app` (docs API) + `frontend/src` (트리/뷰어)
- 만질 파일 후보:
  - `backend/app/api/docs.py` — `GET /api/docs/tree` · `GET /api/docs/file`
  - `backend/app/services/docs_fs.py` — 마운트된 `medi-doc/` FS 읽기(트리/raw bytes)
  - `frontend/src/app/library/` · `src/components/library/Tree`, `Viewer`
  - `frontend/package.json` — `react-markdown`+`remark-gfm` / `docx-preview` / `SheetJS(공식 CDN)` / `react-pdf`
- Domain / schema note:
  - **DB 테이블 없음** — 읽기전용 FS(`medi-doc/`). path = docs 루트 기준 상대경로.
  - 바이너리(docx/xlsx/pdf) = raw bytes 서빙, 렌더는 클라이언트(SC-OPEN-01 해소).

## PR Plan

- **1 WP = 1 PR**, 내부 commit 단위. BE(C1) → FE(C2~C4). BE/FE 병렬 시 FE 는 C1 계약 후.

## Dev Plan (commit 단위)

1. **C1** — docs API(BE): `GET /api/docs/tree`(path/depth, lazy children) · `GET /api/docs/file`(md=text JSON / 바이너리=raw bytes). `UNSUPPORTED_FORMAT`(415, 확장자 가드)·빈 폴더·not found.
2. **C2** — FE 셸 + 도서관 2-컬럼: 사이드바 3탭(도서관/개인스페이스/채팅) + 좌측 트리(폴더 caret/lazy, 포맷 배지) + 우측 뷰어 chrome.
3. **C3** — 4포맷 렌더러 wiring: md=react-markdown+remark-gfm / docx=docx-preview / xlsx=SheetJS / pdf=react-pdf. 뷰어 상태화면(미선택/폴더/렌더).
4. **C4** — 케이스/문구: 미지원(.png)·빈 폴더·콘텐츠없음 상태화면(디자인 실측 문구), e2e(4포맷 각각 렌더).

## Progress Checklist

- [ ] C1 feat: docs tree/file API(raw bytes 서빙) — SHA: `-`
- [ ] C2 feat: FE 셸 3탭 + 도서관 2-컬럼 트리 — SHA: `-`
- [ ] C3 feat: 4포맷 클라이언트 렌더러 — SHA: `-`
- [ ] C4 feat: 케이스 상태화면 + e2e — SHA: `-`

## Test / QA Plan

- 단위: 트리 빌드(lazy), 포맷 판별, raw bytes 응답.
- 통합: tree→file 흐름, 미지원/빈폴더/notfound.
- E2E: md/docx/xlsx/pdf 각 1개 브라우저 렌더 확인.
- 회귀: 없음(신규). FE 셸은 WP-02 와 공유(사이드바) — 통합 지점 주의.

## Release Gate

- [ ] SC-SPEC-01 Acceptance Criteria 통과(4포맷 렌더·트리 lazy·미지원·빈폴더·notfound).
- [ ] 단위/통합/E2E 통과.
- [ ] work-map 갱신.

## Closure (WP 종결 시 작성)

## Open Issues

- 사이드바 셸(3탭)을 WP-03 에서 만드는지 WP-01 에 둘지 — 개발팀 조율(여기선 WP-03 에 두되 WP-02 푸터와 통합).
- 검색 입력란 v1 비활성(SC-OPEN-16 Out) — UI 표시만, 동작 없음.
