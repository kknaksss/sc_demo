"use client";

// SC-WP-03 C2 — 도서관 2-컬럼(좌 트리 / 우 뷰어) 오케스트레이터.
// 디자인 SoT: claude-design/onto/library.jsx. spec-01 §2 UX Contract.
//
// lazy 로드(spec §3): 진입 시 루트(path="", depth 1), 폴더 펼침 시 하위 요청.
// path 를 식별 키로 children/open/loading/selected 상태를 보관한다.
// BE 미기동이어도 graceful(로딩/빈 안내) — build/lint 통과 기준.

import { useEffect, useState } from "react";
import { Search, Database } from "lucide-react";

import { fetchTree, type DocNode } from "@/lib/docs";
import Tree from "./Tree";
import Viewer from "./Viewer";

type RootState = "loading" | "loaded" | "error";

export default function LibraryView() {
  const [rootState, setRootState] = useState<RootState>("loading");
  const [childrenByPath, setChildrenByPath] = useState<Record<string, DocNode[]>>({});
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<DocNode | null>(null);

  const setLoading = (path: string, on: boolean) =>
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (on) next.add(path);
      else next.delete(path);
      return next;
    });

  // 폴더 children lazy 로드 (이미 로드됐으면 skip). 루트는 path="".
  const loadDir = async (path: string) => {
    setLoading(path, true);
    try {
      const children = await fetchTree(path, 1);
      setChildrenByPath((prev) => ({ ...prev, [path]: children }));
      if (path === "") setRootState("loaded");
    } catch {
      if (path === "") setRootState("error");
      // 하위 폴더 실패는 graceful: 빈 상태로 둔다(재시도는 다시 펼치면 발생).
    } finally {
      setLoading(path, false);
    }
  };

  // 최초 진입: 루트 트리 로드.
  useEffect(() => {
    void loadDir("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폴더 클릭: 펼침/접힘 토글 + 선택(디자인 동작). 펼칠 때 미로드면 fetch.
  const handleToggle = (node: DocNode) => {
    setSelected(node);
    setOpenPaths((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (!childrenByPath[node.path]) void loadDir(node.path);
      }
      return next;
    });
  };

  // 파일 클릭: 우측 뷰어에 렌더.
  const handleSelect = (node: DocNode) => setSelected(node);

  const roots = childrenByPath[""] ?? [];

  return (
    <div className="lib">
      <aside className="lib-tree">
        {/* 검색 — v1 비활성(SC-OPEN-16 Out, 표시 전용). */}
        <div className="lib-search" aria-disabled>
          <Search size={14} aria-hidden />
          <input placeholder="문서 · 폴더 검색" disabled aria-label="검색 (준비 중)" />
        </div>

        <div className="lib-tree-scroll">
          {rootState === "loading" && (
            <div className="lib-tree-empty">불러오는 중…</div>
          )}
          {rootState === "error" && (
            <div className="lib-tree-empty">문서 트리를 불러올 수 없습니다.</div>
          )}
          {rootState === "loaded" && roots.length === 0 && (
            <div className="lib-tree-empty">표시할 문서가 없습니다.</div>
          )}
          {rootState === "loaded" && roots.length > 0 && (
            <Tree
              nodes={roots}
              depth={0}
              openPaths={openPaths}
              loadingPaths={loadingPaths}
              childrenByPath={childrenByPath}
              selectedPath={selected?.path ?? null}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          )}
        </div>

        <div className="lib-tree-foot">
          <Database size={12} aria-hidden />
          <span className="mono">seed · read-only</span>
        </div>
      </aside>

      <Viewer node={selected} />
    </div>
  );
}
