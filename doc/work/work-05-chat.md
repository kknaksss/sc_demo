---
id: SC-WP-05
type: work
title: 채팅
status: proposed
owner: BE+FE
last_updated: 2026-06-07
covers:
  - SC-SPEC-04
---

# SC-WP-05 채팅

open-kknaks(서버 Claude Code) + Redis + WebSocket 기반 멀티턴 AI 채팅. 두 surface(사이드바 탐색/Q&A · 개인스페이스 도크 작성 어시스턴스) + 도크 편집모드 in-place 반영.

> SPEC 본문은 link 만([SC-SPEC-04](../spec/spec-04-chat.md)). Status Board 는 [work-map.md](../work-map.md).
> **진행 = commit 단위. 1 WP = 1 PR(종결 시), PR 분리 안 함.**

## 메타

- 의존 WP: SC-WP-02(유저)·SC-WP-03(도서관 그라운딩)·SC-WP-04(개인스페이스 md write 타겟)
- 병렬 가능 WP: 없음 (마지막)

## Code Surface

- Repo / module: `backend/app`(thread REST + WS) + `backend/app/worker`(open-kknaks) + `frontend/src`(채팅 UI/도크)
- 만질 파일 후보:
  - `backend/migrations/versions/*_chat.py` — `chat_threads` · `chat_messages`
  - `backend/app/models/chat.py` · `app/repositories/chat.py`
  - `backend/app/api/chat.py` — `POST /threads` · `GET /threads` · `GET /threads/{id}`
  - `backend/app/ws/chat.py` — `WS /ws/chat/{thread_id}` (송·수신, Redis Streams 브리지)
  - `backend/app/worker/chat_worker.py` — open-kknaks AgentClient.submit/stream, session_id 저장, resume
  - `frontend/src/components/chat/` — 사이드바 풀스크린 + `DockChat`(대화기록/새대화) + 메시지 블록 렌더
- Domain / schema note:
  - `chat_threads`: id PK · user_id FK · title(null) · **session_id**(null, Claude Code CLI 발급, turn1 후) · **surface**(chat/personal NOT NULL) · created/updated_at
  - `chat_messages`: id PK · thread_id FK · role(user/assistant) · content · created_at
  - 엔진: open-kknaks 내장 RedisBroker/ClaudeWorker(우리가 큐/워커 안 짬), Redis Streams 전송, **단일 워커**(resume 이식성). canonical 본문=`result().result`(text delta 중복 주의).

## PR Plan

- **1 WP = 1 PR**, 내부 commit 단위. BE(C1~C4) → FE(C5) → 케이스(C6). C3(엔진)·C4(WS) 가 핵심 리스크.

## Dev Plan (commit 단위)

1. **C1** — `chat_threads`(surface·session_id)/`chat_messages` migration + model + repository.
2. **C2** — thread REST: `POST /threads`(surface body, 빈 방) · `GET /threads`(surface 필터: 사이드바=chat/도크=personal) · `GET /threads/{id}`(이력).
3. **C3** — open-kknaks 워커 연동: `submit`(첫=새세션/resume=저장 session_id) → turn1 `result_session_id` 저장, `stream` 소비. work_dir=도서관 docs(`:ro`), 도크는 doc 내용 컨텍스트 주입. (사이드바=read-only 탐색, 도크=edit_mode 게이팅.)
4. **C4** — `WS /ws/chat/{thread_id}`: 쿠키 인증 + 본인 thread, 송신(사이드바 `{content}` / 도크 `{content,doc_id,edit_mode}`) → Redis 작업 적재, Worker 응답 스트림(Redis Streams)을 WS 로 push, 완료 시 DB 저장. `ENGINE_ERROR`/`ENGINE_TIMEOUT`.
5. **C5** — FE: 사이드바 풀스크린(thread 목록+스트림+컴포저, 첨부/멘션 없음) + 도크(헤더 대화기록/새대화/닫기, 현재문서 근거) + 메시지 블록(텍스트/인용) + **도크 편집모드+md → 에디터 in-place 반영**(WP-04 에디터 + 기존 `저장` PUT 재사용) + 보기/비-md=답변만.
6. **C6** — 케이스: `WRITE_FAILED`(도크 저장은 WP-04 PUT 재사용), 미인증, 엔진 실패/타임아웃, e2e(사이드바 Q&A / 도크 in-place / 멀티턴 resume).

## Progress Checklist

- [ ] C1 feat: chat_threads(surface,session_id)+chat_messages migration+model — SHA: `-`
- [ ] C2 feat: thread REST(생성 surface/목록 필터/이력) — SHA: `-`
- [ ] C3 feat: open-kknaks 워커 연동(submit/stream/resume, session_id 저장) — SHA: `-`
- [ ] C4 feat: WS 엔드포인트(Redis Streams 브리지, surface 분기) — SHA: `-`
- [ ] C5 feat: FE 사이드바 채팅 + 도크(기록/게이팅 in-place) — SHA: `-`
- [ ] C6 feat: 케이스(ENGINE/WRITE_FAILED/미인증) + e2e — SHA: `-`

## Test / QA Plan

- 단위: surface 분기, session_id 저장/resume, 도크 게이팅(편집+md 만 쓰기), 유저 격리.
- 통합: 새대화→첫메시지(새세션)→후속(resume), 사이드바 도서관 탐색, 도크 in-place 반영→WP-04 저장.
- E2E: ① 사이드바 도서관 질의(인용) ② 도크 편집모드 "작성해줘"→현재문서 반영→저장 ③ 도크 보기모드 "맞아?"→답변만 ④ 멀티턴 맥락 유지.
- 회귀: WP-04 개인스페이스 PUT 저장(in-place 반영이 재사용).

## Release Gate

- [ ] SC-SPEC-04 Acceptance Criteria 통과(새대화·새세션·resume·WS 스트리밍·도서관 탐색·도크 in-place·md 한정·유저격리·미인증·엔진실패).
- [ ] 단위/통합/E2E 통과.
- [ ] work-map 갱신.

## Closure (WP 종결 시 작성)

## Open Issues

- 워커 토폴로지 = 단일 워커 확정. 스케일아웃(sticky/공유볼륨)은 후속 WP.
- open-kknaks claude CLI 인증을 worker 컨테이너에 주입하는 구체 방식(WP-01 C5 와 연계).
- text delta 중복 처리(canonical=`result().result`) — WS 블록 계약 구현 시 확정.
