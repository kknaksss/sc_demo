// SC-WP-05 C5a — 채팅 thread REST 클라이언트.
// 계약: C2(PLAN-105-T-002, 라이브 검증). personal.ts 패턴 차용.
//   POST /api/chat/threads        body {surface:"chat"} → 201 {data:{id,title:null,surface,created_at}}
//   GET  /api/chat/threads?surface=chat                → 200 {data:{items:[...]}} (유저스코프, updated_at desc)
//   GET  /api/chat/threads/{id}                        → 200 {data:{id,surface,messages:[...]}}
//
// 인증=쿠키 세션(apiFetch credentials:"include"). 미인증 401 UNAUTHENTICATED.
// ★ 이 commit 은 thread REST 만 — 메시지 송수신(WS /ws/chat/{id})·도크(surface=personal)는 후속(C5b/C5c).

import { apiFetch } from "./api";

/** thread 의 표면(컨텍스트). 사이드바 풀스크린=chat / 개인스페이스 도크=personal(후속). */
export type ChatSurface = "chat" | "personal";

/** 메시지 역할 — 유저 입력 / 어시스턴트 응답. */
export type ChatRole = "user" | "assistant";

/** 목록 메타(GET ?surface 응답 items). title 은 null 가능(미명명 thread). */
export interface ChatThreadMeta {
  id: string;
  /** 서버가 아직 title 을 안 정했으면 null — 표시 측에서 fallback. */
  title: string | null;
  surface: ChatSurface;
  updated_at?: string;
  created_at?: string;
}

/** 단건 이력의 메시지(GET /{id} 의 messages). content=텍스트(assistant 는 마크다운 가능). */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  created_at?: string;
}

/**
 * 단건 thread 이력. ★ 계약상 title/timestamps 가 없다 — id/surface/messages 뿐.
 * 따라서 대화 헤더의 제목 등은 목록 메타(ChatThreadMeta)에서 가져온다(personal.ts selectedMeta 패턴).
 */
export interface ChatThreadDetail {
  id: string;
  surface: ChatSurface;
  messages: ChatMessage[];
}

interface ListResponse {
  data: { items: ChatThreadMeta[] };
}
/** POST(생성) 응답: id/title(null)/surface/created_at — ★ updated_at 미포함. */
interface CreateResponse {
  data: {
    id: string;
    title: string | null;
    surface: ChatSurface;
    updated_at?: string;
    created_at?: string;
  };
}
interface DetailResponse {
  data: ChatThreadDetail;
}

/** 내 thread 목록(유저 스코프, updated_at desc). 빈 items 는 빈 상태(오류 아님). */
export async function listThreads(
  surface: ChatSurface = "chat",
): Promise<ChatThreadMeta[]> {
  const res = await apiFetch<ListResponse>(
    `/api/chat/threads?surface=${encodeURIComponent(surface)}`,
  );
  return res.data?.items ?? [];
}

/**
 * 새 thread 생성. body {surface}.
 *
 * ★ 정규화: POST 응답엔 `updated_at` 이 없다. 목록은 `updated_at desc` 정렬이고
 *   새 thread 를 최상단에 prepend 하므로, created_at 으로 fallback 해두지 않으면
 *   정렬·표시가 어긋난다(personal.ts createDoc PLAN-104-T-005 와 동일한 버그 클래스).
 */
export async function createThread(
  surface: ChatSurface = "chat",
): Promise<ChatThreadMeta> {
  const res = await apiFetch<CreateResponse>("/api/chat/threads", {
    method: "POST",
    body: JSON.stringify({ surface }),
  });
  return {
    ...res.data,
    updated_at: res.data.updated_at ?? res.data.created_at,
  };
}

/** 단건 thread 이력. 빈 thread = messages:[]. 404/403/미기동은 ApiError 로 던진다. */
export async function getThread(id: string): Promise<ChatThreadDetail> {
  const res = await apiFetch<DetailResponse>(
    `/api/chat/threads/${encodeURIComponent(id)}`,
  );
  return res.data;
}

/** thread 표시 제목 — title 이 null/빈값이면 일관된 fallback("새 대화"). */
export function threadTitle(t: { title: string | null }): string {
  return t.title?.trim() || "새 대화";
}

/**
 * thread 목록 메타 타임스탬프 → 오늘=HH:MM / 그 외=MM/DD (없거나 파싱 실패면 빈값).
 * ★ ChatView(C5a)가 동일 포맷을 로컬에 두고 쓰지만 그건 off-limits 라 도크(C5c)는
 *   여기 공유 함수를 쓴다. 두 surface 가 같은 표기 규칙을 공유하도록 lib 로 끌어올림.
 */
export function formatThreadTs(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
