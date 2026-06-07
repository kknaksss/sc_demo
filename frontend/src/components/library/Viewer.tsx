"use client";

// SC-WP-03 C2/C3 — 우측 뷰어: 상태화면 5종 + chrome + 4포맷 렌더.
// 디자인 SoT: claude-design/onto/library.jsx (Viewer/ViewerChrome/ViewerState).
// 문구 = spec-01 §2 UX Contract 실측. 발명 금지.
//
// 상태화면 5종:
//   (1) 미선택 (2) 폴더(항목/빈) (3) 파일 정상(chrome+본문) (4) 미지원 포맷 (5) 콘텐츠 없음
// 렌더러: md=react-markdown / docx=docx-preview / xlsx=SheetJS / pdf=react-pdf.
//   바이너리 3종(docx/xlsx/pdf)은 클라이언트 전용 + 코드 스플릿이라 next/dynamic(ssr:false).
//   상태화면(로딩/콘텐츠없음)은 viewer-states 공용 모듈 재사용(렌더러와 동일 마크업).

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { FileText } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ApiError } from "@/lib/api";
import {
  FMT_LABEL,
  fetchFileText,
  formatDate,
  formatSize,
  type DocFmt,
  type DocNode,
} from "@/lib/docs";
import { ViewerLoading, ViewerNotFound, ViewerState } from "./viewer-states";

// 바이너리 렌더러는 클라이언트 전용(react-pdf 는 SSR 비활성 필수) + 코드 스플릿.
const DocxRenderer = dynamic(() => import("./renderers/DocxRenderer"), {
  ssr: false,
});
const XlsxRenderer = dynamic(() => import("./renderers/XlsxRenderer"), {
  ssr: false,
});
const PdfRenderer = dynamic(() => import("./renderers/PdfRenderer"), {
  ssr: false,
});

function FmtBadge({ fmt }: { fmt: DocFmt }) {
  return <span className={`fmt-badge fmt-${fmt}`}>{FMT_LABEL[fmt]}</span>;
}

function ViewerChrome({ node }: { node: DocNode }) {
  const segs = (node.path || node.name).split("/");
  const size = formatSize(node.size);
  const updated = formatDate(node.updated_at);
  return (
    <div className="viewer-chrome">
      <div className="viewer-path">
        {segs.map((s, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="viewer-path-sep">/</span>}
            <span className={i === segs.length - 1 ? "viewer-path-cur" : undefined}>
              {s}
            </span>
          </span>
        ))}
        <FmtBadge fmt={node.fmt ?? "unsupported"} />
      </div>
      <div className="viewer-meta">
        {size && <span className="mono">{size}</span>}
        {size && updated && <span className="viewer-meta-dot" />}
        {updated && <span className="mono">{updated}</span>}
        <span className="viewer-readonly">읽기 전용</span>
      </div>
    </div>
  );
}

type MdState =
  | { status: "loading" }
  | { status: "loaded"; content: string }
  | { status: "notfound" }
  | { status: "error" };

/** md 본문: /api/docs/file 조회 → react-markdown 렌더. 404 → 콘텐츠 없음(warn). */
function MdBody({ node }: { node: DocNode }) {
  const [state, setState] = useState<MdState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchFileText(node.path)
      .then((file) => {
        if (alive) setState({ status: "loaded", content: file.content ?? "" });
      })
      .catch((err) => {
        if (!alive) return;
        // DOC_NOT_FOUND / INVALID_PATH(404) → 콘텐츠 없음. 그 외(BE 미기동 등)도 동일 수렴.
        const notfound = err instanceof ApiError && err.status === 404;
        setState({ status: notfound ? "notfound" : "error" });
      });
    return () => {
      alive = false;
    };
  }, [node.path]);

  if (state.status === "loading") return <ViewerLoading name={node.name} />;
  if (state.status === "notfound" || state.status === "error") {
    // 케이스 매트릭스: DOC_NOT_FOUND / INVALID_PATH → 동일 상태로 수렴.
    return <ViewerNotFound name={node.name} />;
  }
  return (
    <div className="viewer-scroll">
      <article className="doc-md">
        <Markdown remarkPlugins={[remarkGfm]}>{state.content}</Markdown>
      </article>
    </div>
  );
}

/** 지원 파일(md/docx/xlsx/pdf) 포맷별 본문 렌더 분기. */
function FileBody({ node }: { node: DocNode }) {
  switch (node.fmt) {
    case "md":
      return <MdBody node={node} />;
    case "docx":
      return <DocxRenderer node={node} />;
    case "xlsx":
      return <XlsxRenderer node={node} />;
    case "pdf":
      return <PdfRenderer node={node} />;
    default:
      // supported 분기에서만 도달 — 방어적 fallback(미지원으로 수렴 안 함).
      return (
        <div className="viewer-state">
          <div className="viewer-state-icon">
            <FileText size={26} aria-hidden />
          </div>
          <h2>{node.name}</h2>
          <p>표시할 수 없는 문서입니다.</p>
        </div>
      );
  }
}

export default function Viewer({ node }: { node: DocNode | null }) {
  let body: ReactNode;
  let chrome: ReactNode = null;

  if (!node) {
    body = (
      <ViewerState
        icon="library"
        title="문서를 선택하세요"
        desc="좌측 트리에서 문서를 열면 이 영역에 브라우저 렌더 결과가 표시됩니다."
      />
    );
  } else if (node.type === "dir") {
    const count = node.count ?? 0;
    body =
      count === 0 ? (
        <ViewerState
          icon="folder"
          title="빈 폴더"
          desc="이 폴더에는 표시할 문서가 없습니다."
        />
      ) : (
        <ViewerState
          icon="folder"
          title={node.name}
          desc={`${count}개 항목 · 좌측 트리에서 문서를 선택하세요.`}
        />
      );
  } else if (node.fmt === "unsupported") {
    body = (
      <ViewerState
        icon="warn"
        tone="warn"
        title="지원하지 않는 포맷"
        desc={`${node.name} — md · docx · xlsx · pdf 만 렌더할 수 있습니다.`}
      />
    );
  } else {
    // 지원 파일(md/docx/xlsx/pdf): 정상 chrome + 본문.
    chrome = <ViewerChrome node={node} />;
    body = <FileBody node={node} />;
  }

  return (
    <section className="lib-viewer">
      {chrome}
      {body}
    </section>
  );
}
