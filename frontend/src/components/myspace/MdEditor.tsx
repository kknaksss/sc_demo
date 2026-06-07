"use client";

// SC-WP-04 C3 — md 에디터 본문 (보기 모드 ↔ 편집 모드).
// SoT: SC-SPEC-02 §2 UX Contract + §4 (SC-OPEN-06 해소).
//   ★ 디자인 myspace.jsx 의 RichEditor(contentEditable)를 차용하지 않고, spec §4 가
//     확정한 "마크다운 소스 textarea + react-markdown 라이브 프리뷰"(경량)로 구현한다.
//   - 보기 모드: 저장된 마크다운을 react-markdown 으로 렌더만(편집 동작 전).
//   - 편집 모드: 좌 소스 textarea + 우 라이브 프리뷰. 입력 시 dirty(`수정됨`).
//   md 렌더는 도서관(WP-03 Viewer)과 동일하게 react-markdown + remark-gfm + .doc-md 재사용.

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MdEditorProps {
  mode: "view" | "edit";
  /** 보기 모드에서 렌더할 저장된 콘텐츠. */
  content: string;
  /** 편집 모드 소스 버퍼(dirty 로컬 상태). */
  draft: string;
  onDraftChange: (next: string) => void;
}

/** 마크다운 렌더 블록 — 도서관 MdBody 와 동일 마크업(.doc-md). */
function MdRender({ source }: { source: string }) {
  return (
    <article className="doc-md">
      <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
    </article>
  );
}

export default function MdEditor({
  mode,
  content,
  draft,
  onDraftChange,
}: MdEditorProps) {
  if (mode === "view") {
    return (
      <div className="ed">
        <div className="ed-scroll">
          <div className="viewer-scroll">
            <MdRender source={content} />
          </div>
        </div>
      </div>
    );
  }

  // 편집 모드 — 소스 textarea + 라이브 프리뷰 2분할.
  return (
    <div className="ed ms-edit">
      <div className="ms-edit-split">
        <textarea
          className="ms-source"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="마크다운을 입력하세요…"
          spellCheck={false}
          aria-label="마크다운 소스"
        />
        <div className="ms-preview">
          <div className="viewer-scroll">
            <MdRender source={draft} />
          </div>
        </div>
      </div>
    </div>
  );
}
