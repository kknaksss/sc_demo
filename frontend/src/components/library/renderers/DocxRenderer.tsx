"use client";

// SC-WP-03 C3 — docx 렌더러 (docx-preview).
// SoT: spec-01 §4 (docx = docx-preview, 클라이언트 raw bytes) + 디자인 .doc-docx(library.jsx).
// raw bytes(ArrayBuffer) → renderAsync(buf, container) 로 컨테이너에 DOM 주입.
// docx-preview 는 클라이언트 전용이라 effect 안에서 dynamic import (SSR 안전).
// 렌더 실패 시 graceful → 케이스 매트릭스와 동일 warn 으로 수렴(발명 금지).

import { useEffect, useRef, useState } from "react";

import { ViewerLoading, ViewerNotFound } from "../viewer-states";
import type { BytesState } from "./useFileBytes";

// C4b: fetch 를 호출부로 끌어올려 bytes 만 받는다(도서관 path / 개인스페이스 id 공용).
// render(buffer→DOM) 로직은 불변. name 은 loading/notfound 라벨용.
export default function DocxRenderer({
  bytes: state,
  name,
}: {
  bytes: BytesState;
  name: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (state.status !== "loaded") return;
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    host.innerHTML = "";
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        await renderAsync(state.buffer, host, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
        });
      } catch {
        if (alive) setRenderError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [state]);

  if (state.status === "loading") return <ViewerLoading name={name} />;
  if (state.status === "notfound" || state.status === "error" || renderError) {
    return <ViewerNotFound name={name} />;
  }

  return (
    <div className="viewer-scroll">
      <div className="doc-docx" ref={hostRef} />
    </div>
  );
}
