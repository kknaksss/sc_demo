"use client";

// SC-WP-03 C3 — xlsx 렌더러 (SheetJS).
// SoT: spec-01 §4/§6 — xlsx = SheetJS(공식 CDN tarball, npm `xlsx` 아님), sheet_to_html 표 렌더.
//   디자인 .doc-xlsx / .doc-xlsx-grid / .doc-xlsx-tabs (library.jsx) 차용.
// raw bytes(ArrayBuffer) → XLSX.read(Uint8Array, {type:"array"}) → 시트별 sheet_to_html.
//   ★ type:"array" 는 Uint8Array 입력. SheetJS 는 effect 안 dynamic import(클라이언트 전용·SSR 안전).
// sheet_to_html 는 신뢰된 시드 문서의 HTML 문자열이라 dangerouslySetInnerHTML 로 주입.
// 다중 시트는 하단 탭으로 전환(디자인 .doc-xlsx-tabs).

import { useEffect, useState } from "react";

import { ViewerLoading, ViewerNotFound } from "../viewer-states";
import type { BytesState } from "./useFileBytes";

interface Workbook {
  names: string[];
  htmlByName: Record<string, string>;
}

// C4b: bytes 입력형(fetch 는 호출부). render(workbook→html) 로직 불변.
export default function XlsxRenderer({
  bytes: state,
  name,
}: {
  bytes: BytesState;
  name: string;
}) {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [active, setActive] = useState(0);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (state.status !== "loaded") return;
    let alive = true;
    (async () => {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(new Uint8Array(state.buffer), {
          type: "array",
        });
        const htmlByName: Record<string, string> = {};
        for (const name of workbook.SheetNames) {
          htmlByName[name] = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
        }
        if (alive) {
          setWb({ names: workbook.SheetNames, htmlByName });
          setActive(0);
        }
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
  if (!wb) return <ViewerLoading name={name} />;

  const activeName = wb.names[active] ?? wb.names[0];

  return (
    <div className="doc-xlsx">
      <div
        className="doc-xlsx-grid"
        dangerouslySetInnerHTML={{ __html: wb.htmlByName[activeName] ?? "" }}
      />
      {wb.names.length > 1 && (
        <div className="doc-xlsx-tabs">
          {wb.names.map((name, i) => (
            <button
              key={name}
              type="button"
              className={"xl-tab" + (i === active ? " active" : "")}
              onClick={() => setActive(i)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
