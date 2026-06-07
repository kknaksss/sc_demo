"use client";

// SC-WP-03 C2 — 좌측 트리 노드(폴더 caret/lazy 펼침 + 파일 포맷 배지).
// 디자인 SoT: claude-design/onto/library.jsx (TreeNode). 발명 금지.
// lazy: children 은 path 키로 LibraryView 가 보관, 폴더 펼침 시 부모가 fetch.

import { ChevronRight, Folder, Loader2 } from "lucide-react";

import { FMT_LABEL, type DocNode } from "@/lib/docs";

function FmtBadge({ fmt }: { fmt: DocNode["fmt"] }) {
  const f = fmt ?? "unsupported";
  return <span className={`fmt-badge fmt-${f}`}>{FMT_LABEL[f]}</span>;
}

export interface TreeProps {
  /** 같은 레벨에서 렌더할 노드들. */
  nodes: DocNode[];
  depth: number;
  /** path 기준 펼침/로딩/하위children/선택 상태(LibraryView 소유). */
  openPaths: Set<string>;
  loadingPaths: Set<string>;
  childrenByPath: Record<string, DocNode[]>;
  selectedPath: string | null;
  onToggle: (node: DocNode) => void;
  onSelect: (node: DocNode) => void;
}

export default function Tree({
  nodes,
  depth,
  openPaths,
  loadingPaths,
  childrenByPath,
  selectedPath,
  onToggle,
  onSelect,
}: TreeProps) {
  return (
    <>
      {nodes.map((node) => {
        const pad = 8 + depth * 14;
        const active = selectedPath === node.path;

        if (node.type === "dir") {
          const open = openPaths.has(node.path);
          const loading = loadingPaths.has(node.path);
          const loaded = childrenByPath[node.path];
          // 하위 개수: 서버 count 가 SoT (lazy 라 children.length 로 못 셈).
          const count = node.count ?? loaded?.length ?? 0;
          return (
            <div key={node.path}>
              <div
                className={"lib-node" + (active ? " active" : "")}
                style={{ paddingLeft: pad }}
                onClick={() => onToggle(node)}
              >
                <span className={"lib-caret" + (open ? " open" : "")}>
                  <ChevronRight size={11} aria-hidden />
                </span>
                <Folder className="lib-node-icon" size={15} aria-hidden />
                <span className="lib-node-label">{node.name}</span>
                {loading ? (
                  <Loader2 className="lib-node-spin" size={12} aria-hidden />
                ) : (
                  <span className="lib-node-count">{count}</span>
                )}
              </div>
              {open && loaded && loaded.length > 0 && (
                <Tree
                  nodes={loaded}
                  depth={depth + 1}
                  openPaths={openPaths}
                  loadingPaths={loadingPaths}
                  childrenByPath={childrenByPath}
                  selectedPath={selectedPath}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              )}
            </div>
          );
        }

        return (
          <div
            key={node.path}
            className={"lib-node lib-file" + (active ? " active" : "")}
            style={{ paddingLeft: pad + 18 }}
            onClick={() => onSelect(node)}
          >
            <span className="lib-node-label">{node.name}</span>
            <FmtBadge fmt={node.fmt} />
          </div>
        );
      })}
    </>
  );
}
