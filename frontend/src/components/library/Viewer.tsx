"use client";

// SC-WP-03 C2/C3 — 우측 뷰어: 상태화면 5종 + chrome + md 렌더.
// 디자인 SoT: claude-design/onto/library.jsx (Viewer/ViewerChrome/ViewerState).
// 문구 = spec-01 §2 UX Contract 실측. 발명 금지.
//
// 상태화면 5종:
//   (1) 미선택 (2) 폴더(항목/빈) (3) 파일 정상(chrome+본문) (4) 미지원 포맷 (5) 콘텐츠 없음
// 렌더러 범위: 본 task = md(react-markdown+remark-gfm). docx/xlsx/pdf 바이너리
//   렌더는 후속(C3) — 정상 chrome 은 유지하고 본문만 "준비 중" 안내.

import { useEffect, useState, type ReactNode } from "react";
import { Library, Folder, FileText, AlertTriangle, Loader2 } from "lucide-react";
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

type StateIcon = "library" | "folder" | "doc" | "warn";

function ViewerState({
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

  if (state.status === "loading") {
    return (
      <div className="viewer-state">
        <div className="viewer-state-icon">
          <Loader2 className="lib-node-spin" size={26} aria-hidden />
        </div>
        <h2>불러오는 중</h2>
        <p>{node.name}</p>
      </div>
    );
  }
  if (state.status === "notfound" || state.status === "error") {
    // 케이스 매트릭스: DOC_NOT_FOUND / INVALID_PATH → 동일 상태로 수렴.
    return (
      <ViewerState
        icon="warn"
        tone="warn"
        title="문서를 찾을 수 없음"
        desc={`${node.name} 의 콘텐츠를 불러올 수 없습니다.`}
      />
    );
  }
  return (
    <div className="viewer-scroll">
      <article className="doc-md">
        <Markdown remarkPlugins={[remarkGfm]}>{state.content}</Markdown>
      </article>
    </div>
  );
}

/** docx/xlsx/pdf: 렌더러는 후속(C3). chrome 은 정상 유지, 본문만 준비중 안내. */
function BinaryPending({ node }: { node: DocNode }) {
  const label = FMT_LABEL[node.fmt ?? "unsupported"];
  return (
    <div className="viewer-state">
      <div className="viewer-state-icon">
        <FileText size={26} aria-hidden />
      </div>
      <h2>{label} 렌더 준비 중</h2>
      <p>{node.name} — 브라우저 렌더러는 후속 작업(C3)에서 연결됩니다.</p>
    </div>
  );
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
    body = node.fmt === "md" ? <MdBody node={node} /> : <BinaryPending node={node} />;
  }

  return (
    <section className="lib-viewer">
      {chrome}
      {body}
    </section>
  );
}
