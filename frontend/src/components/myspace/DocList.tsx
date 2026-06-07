"use client";

// SC-WP-04 C3 — 좌측 내 문서 목록 패널.
// 디자인 SoT: myspace.jsx (.ms-list / .ms-doc) + SC-SPEC-02 §2.
//   상단 `내 문서`(+개수) · `새 문서`(md) · `업로드` 버튼.
//   ★ 새 문서 = v1 md 단일(spec §2). 디자인의 md/docx/xlsx 드롭다운 중 md 만 →
//     별도 메뉴 없이 직접 md 생성 버튼으로 둔다(레이아웃 단순화, 기능 동일).
//   ★ 업로드(C4a) = 숨김 file input(.md/.docx/.xlsx/.pdf) 트리거 → 첫 파일을 onUpload 로 올림.
//   평면 목록(폴더/트리 없음). 항목 = 포맷 배지 + 제목 + 수정시각(보기전용은 `· 보기 전용`).

import { useRef } from "react";
import { Plus, Upload, FilePlus } from "lucide-react";

import { FMT_LABEL, formatDate } from "@/lib/docs";
import type { PersonalDocMeta } from "@/lib/personal";

interface DocListProps {
  docs: PersonalDocMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** 4포맷 업로드(C4a). 선택된 첫 파일을 올린다. */
  onUpload: (file: File) => void;
  /** BE 미기동 등으로 목록을 못 불러온 경우(빈 공간과 구분). */
  loadError?: boolean;
}

export default function DocList({
  docs,
  selectedId,
  onSelect,
  onNew,
  onUpload,
  loadError,
}: DocListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="ms-list">
      <div className="ms-list-head">
        <span className="ms-list-title">내 문서</span>
        <span className="ms-list-count">{docs.length}</span>
      </div>

      <div className="ms-actions">
        <button
          type="button"
          className="btn btn-primary ms-new-btn"
          onClick={onNew}
        >
          <Plus size={14} aria-hidden /> 새 문서
        </button>
        {/* 업로드(C4a) — 숨김 input 트리거 → 첫 파일을 onUpload(POST /api/personal/docs/upload). */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.docx,.xlsx,.pdf"
          hidden
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            // 같은 파일 재선택해도 onChange 가 다시 발화하도록 value 리셋.
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn ms-upload-btn"
          title="업로드 (md · docx · xlsx · pdf)"
          aria-label="업로드"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} aria-hidden />
        </button>
      </div>

      <div className="ms-docs">
        {docs.length === 0 ? (
          <div className="ms-empty">
            <FilePlus size={22} aria-hidden />
            <div>{loadError ? "문서를 불러올 수 없습니다" : "아직 문서가 없습니다"}</div>
            <span>{loadError ? "잠시 후 다시 시도하세요" : "새 문서를 만들어 시작하세요"}</span>
          </div>
        ) : (
          docs.map((d) => (
            <button
              key={d.id}
              type="button"
              className={"ms-doc" + (d.id === selectedId ? " active" : "")}
              onClick={() => onSelect(d.id)}
            >
              <span className={`fmt-badge fmt-${d.format}`}>
                {FMT_LABEL[d.format]}
              </span>
              <span className="ms-doc-main">
                <span className="ms-doc-title">{d.title}</span>
                <span className="ms-doc-meta">
                  {formatDate(d.updated_at)}
                  {!d.editable ? " · 보기 전용" : ""}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
