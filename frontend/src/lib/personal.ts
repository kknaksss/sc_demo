// SC-WP-04 C3 — 개인스페이스 personal docs API 클라이언트.
// 계약: SC-SPEC-02 §3.
//   GET  /api/personal/docs            → 내 문서 평면 목록(유저 스코프)
//   POST /api/personal/docs            → 새 md 문서 생성(빈 문서)
//   GET  /api/personal/docs/{id}       → 단건(md=content 텍스트 / 비-md=raw bytes + 메타)
//   PUT  /api/personal/docs/{id}       → md 저장(content [, title])
//   POST /api/personal/docs/upload     → 4포맷 업로드 반입 (C4 — 이 commit 미연동)
//
// 유저 식별 = SC-SPEC-03 로그인 세션 쿠키(apiFetch credentials:"include").
// 비-md 보기(docx/xlsx/pdf raw bytes 렌더)와 업로드 동작은 후속 C4 범위라
// 이 모듈은 md 목록/생성/조회/저장 경로만 제공한다.

import { apiFetch } from "./api";

/** 개인스페이스 문서 포맷 4종(도서관 DocFmt 중 unsupported 제외). */
export type PersonalFmt = "md" | "docx" | "xlsx" | "pdf";

/** 목록/단건 공통 메타(§3 응답). md=editable true / 비-md=false(보기 전용). */
export interface PersonalDocMeta {
  id: string;
  title: string;
  format: PersonalFmt;
  editable: boolean;
  updated_at?: string;
  created_at?: string;
}

/** 단건 조회 — md 는 content(마크다운 텍스트) 포함, 메타는 meta 안에 중첩(§3). */
export interface PersonalDocDetail {
  id: string;
  title: string;
  format: PersonalFmt;
  editable: boolean;
  /** md 일 때 마크다운 텍스트. 비-md 는 raw bytes 경로(C4)라 여기 없음. */
  content?: string;
  meta?: { updated_at?: string; created_at?: string };
}

interface ListResponse {
  data: { items: PersonalDocMeta[] };
}
/** POST(생성) 응답(§3): id/title/format/created_at 만 — editable·updated_at 은 미포함. */
interface CreateResponse {
  data: {
    id: string;
    title: string;
    format: PersonalFmt;
    editable?: boolean;
    updated_at?: string;
    created_at?: string;
  };
}
interface DetailResponse {
  data: PersonalDocDetail;
}
interface SaveResponse {
  data: { id: string; updated_at?: string };
}

/** 내 문서 평면 목록(유저 스코프). 빈 items 는 빈 공간(오류 아님). */
export async function listDocs(): Promise<PersonalDocMeta[]> {
  const res = await apiFetch<ListResponse>("/api/personal/docs");
  return res.data?.items ?? [];
}

/**
 * 새 md 문서 생성(빈 문서). body=title. v1 은 md 만(BE 가 md 외 UNSUPPORTED_FORMAT 방어).
 *
 * ★ 정규화: POST 응답엔 `editable`(·`updated_at`)가 없어 그대로 쓰면 `editable===undefined`
 *   → MySpaceView select effect 가 보기전용 분기로 떨어진다(PLAN-104-T-005 버그).
 *   v1 인앱 생성은 md 단일이고 md 는 항상 editable 이므로 `true` 로 보강한다.
 *   (BE 가 향후 editable 을 주면 그 값을 존중.) updated_at 누락 시 created_at fallback.
 */
export async function createDoc(title: string): Promise<PersonalDocMeta> {
  const res = await apiFetch<CreateResponse>("/api/personal/docs", {
    method: "POST",
    body: JSON.stringify({ title, format: "md" }),
  });
  return {
    ...res.data,
    editable: res.data.editable ?? true,
    updated_at: res.data.updated_at ?? res.data.created_at,
  };
}

/** 단건 조회. md 는 content 포함. 404(DOC_NOT_FOUND)/403(FORBIDDEN)은 ApiError 로 던진다. */
export async function getDoc(id: string): Promise<PersonalDocDetail> {
  const res = await apiFetch<DetailResponse>(
    `/api/personal/docs/${encodeURIComponent(id)}`,
  );
  return res.data;
}

/** md 저장(PUT). content [+ title]. md 문서에만 적용(비-md 는 보기 전용). */
export async function saveDoc(
  id: string,
  body: { content: string; title?: string },
): Promise<{ id: string; updated_at?: string }> {
  const res = await apiFetch<SaveResponse>(
    `/api/personal/docs/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  return res.data;
}
