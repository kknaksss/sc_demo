# sc_demo Spec

최종 수정: 2026-06-07

sc_demo(온톨로지 시스템 — Next.js FE + FastAPI BE + Worker(open-kknaks) + Redis/Postgres)의 기능, UX, 정책, acceptance criteria 가 모이는 map 입니다. 상세 계약은 `spec/` 아래 1 파일 = 1 SPEC 으로 둡니다.

본문은 contract 만 다룹니다. 구현 진척·WP 매핑은 [work-map.md](work-map.md) 참조.

## Scope

### In Scope - v1

- TBD

### Out Of Scope - v1

- TBD

## 용어

| 용어 | 의미 |
|---|---|
|  |  |

## SPEC List

| ID | 제목 | 영역 | Status | 파일 |
|---|---|---|---|---|
| SC-SPEC-01 | 도서관 | Library | draft | [spec/spec-01-library.md](spec/spec-01-library.md) |
| SC-SPEC-02 | 개인스페이스 | Personal Space | draft | [spec/spec-02-personal-space.md](spec/spec-02-personal-space.md) |
| SC-SPEC-03 | 유저 | User | draft | [spec/spec-03-user.md](spec/spec-03-user.md) |
| SC-SPEC-04 | 채팅 | Chat | draft | [spec/spec-04-chat.md](spec/spec-04-chat.md) |
| SC-SPEC-05 | 환경구성 | Foundation | draft | [spec/spec-05-environment.md](spec/spec-05-environment.md) |

## 영역별 읽는 순서

| 영역 | SPEC |
|---|---|
| Foundation (토대) | SC-SPEC-05 환경구성 |
| Library | SC-SPEC-01 도서관 |
| Personal Space | SC-SPEC-02 개인스페이스 |
| User | SC-SPEC-03 유저 |
| Chat | SC-SPEC-04 채팅 |
