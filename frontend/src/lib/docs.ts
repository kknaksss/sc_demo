// SC-WP-03 C2/C3 — 도서관 docs API 클라이언트 + 포맷 판별.
// 계약: SC-SPEC-01 §3.
//   GET /api/docs/tree?path={path}&depth={n}  → 트리 children (depth 단위 lazy)
//   GET /api/docs/file?path={path}            → md=text JSON / 바이너리=raw bytes
//
// 트리 노드의 `fmt`(포맷 배지·미지원 판별)는 spec §케이스 매트릭스대로 FE 가
// 확장자로 1차 판별한다(서버는 fmt 를 안 내려줌). 4포맷 외는 unsupported →
// 렌더 요청 자체를 안 한다.

import { apiFetch } from "./api";

/** 렌더 지원 포맷 4종 + 그 외(unsupported). 디자인 FMT_LABEL 과 정합. */
export type DocFmt = "md" | "docx" | "xlsx" | "pdf" | "unsupported";

export const FMT_LABEL: Record<DocFmt, string> = {
  md: "MD",
  docx: "DOCX",
  xlsx: "XLSX",
  pdf: "PDF",
  unsupported: "FILE",
};

/** 트리 노드 — 서버 응답(§3) 형태. file 은 FE 에서 `fmt` 를 파생해 덧붙인다. */
export interface DocNode {
  type: "dir" | "file";
  name: string;
  /** 트리 루트(medi-doc) 기준 상대경로. */
  path: string;
  /** dir: 하위 항목 수(서버 제공 — lazy 라 children.length 로 못 셈). */
  count?: number;
  /** file: 메타. */
  size?: number;
  updated_at?: string;
  /** file: 확장자에서 파생한 포맷(FE 부가 필드). */
  fmt?: DocFmt;
}

interface TreeResponse {
  data: { children: DocNode[] };
}

/** md/텍스트 포맷 콘텐츠 응답(§3). 바이너리는 raw bytes 라 이 경로를 안 탄다. */
export interface DocFileText {
  path: string;
  content: string;
  meta?: {
    size?: number;
    updated_at?: string;
    frontmatter?: Record<string, unknown>;
    author?: string | null;
  };
}

interface FileResponse {
  data: DocFileText;
}

const SUPPORTED: Record<string, DocFmt> = {
  md: "md",
  markdown: "md",
  docx: "docx",
  xlsx: "xlsx",
  pdf: "pdf",
};

/** 파일명 확장자 → 포맷. 4포맷 외 전부 unsupported (spec UNSUPPORTED_FORMAT 1차 가드). */
export function fmtFromName(name: string): DocFmt {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "unsupported";
  const ext = name.slice(dot + 1).toLowerCase();
  return SUPPORTED[ext] ?? "unsupported";
}

/** md/docx/xlsx/pdf = 렌더 지원. unsupported 만 미지원 화면으로 분기. */
export function isSupported(fmt: DocFmt): boolean {
  return fmt !== "unsupported";
}

/** 바이트 수 → 사람이 읽는 크기(뷰어 메타). 없으면 빈 문자열. */
export function formatSize(size?: number): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** ISO8601 → YYYY-MM-DD(뷰어 메타). 파싱 실패 시 원문 앞 10자. */
export function formatDate(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/**
 * 폴더 children lazy 로드. path 빈값="" = 루트(depth 1).
 * file 노드엔 확장자 파생 fmt 를 채워 반환한다.
 */
export async function fetchTree(path = "", depth = 1): Promise<DocNode[]> {
  const qs = new URLSearchParams({ path, depth: String(depth) });
  const res = await apiFetch<TreeResponse>(`/api/docs/tree?${qs.toString()}`);
  const children = res.data?.children ?? [];
  return children.map((n) =>
    n.type === "file" ? { ...n, fmt: fmtFromName(n.name) } : n,
  );
}

/** md/텍스트 콘텐츠 조회. 바이너리(docx/xlsx/pdf)는 C3 에서 raw bytes 로 별도 처리. */
export async function fetchFileText(path: string): Promise<DocFileText> {
  const qs = new URLSearchParams({ path });
  const res = await apiFetch<FileResponse>(`/api/docs/file?${qs.toString()}`);
  return res.data;
}
