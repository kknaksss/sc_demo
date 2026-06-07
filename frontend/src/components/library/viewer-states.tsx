"use client";

// SC-WP-03 C3 — 뷰어 상태화면 공용 컴포넌트.
// C2(Viewer.tsx)에서 인라인이던 ViewerState 를 분리(시각/문구 동일 — 렌더러도 재사용).
// 분리 이유: 바이너리 렌더러(docx/xlsx/pdf)가 로딩/에러 시 동일 상태화면을 써야 하는데
//   Viewer ↔ 렌더러 순환참조를 피하려고 제3 모듈로 둠. 출력 마크업은 C2 와 byte-identical.
// 문구 = spec-01 §2 UX Contract / 케이스 매트릭스 실측. 발명 금지.

import { Library, Folder, FileText, AlertTriangle, Loader2 } from "lucide-react";

export type StateIcon = "library" | "folder" | "doc" | "warn";

export function ViewerState({
  icon,
  title,
  desc,
  tone,
}: {
  icon: StateIcon;
  title: string;
  desc: string;
  tone?: "warn";
}) {
  const Icon =
    icon === "library"
      ? Library
      : icon === "folder"
        ? Folder
        : icon === "warn"
          ? AlertTriangle
          : FileText;
  return (
    <div className={"viewer-state" + (tone ? ` tone-${tone}` : "")}>
      <div className="viewer-state-icon">
        <Icon size={26} aria-hidden />
      </div>
      <h2>{title}</h2>
      <p>{desc}</p>
    </div>
  );
}

/** 로딩 상태화면 — C2 MdBody 의 "불러오는 중" 블록과 동일 마크업. */
export function ViewerLoading({ name }: { name: string }) {
  return (
    <div className="viewer-state">
      <div className="viewer-state-icon">
        <Loader2 className="lib-node-spin" size={26} aria-hidden />
      </div>
      <h2>불러오는 중</h2>
      <p>{name}</p>
    </div>
  );
}

/**
 * 콘텐츠 없음(404) / 렌더 실패 수렴 warn 상태.
 * 케이스 매트릭스 DOC_NOT_FOUND/INVALID_PATH 와 동일 문구로 수렴(발명 금지).
 */
export function ViewerNotFound({ name }: { name: string }) {
  return (
    <ViewerState
      icon="warn"
      tone="warn"
      title="문서를 찾을 수 없음"
      desc={`${name} 의 콘텐츠를 불러올 수 없습니다.`}
    />
  );
}
