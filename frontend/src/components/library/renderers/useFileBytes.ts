"use client";

// SC-WP-03 C3 — 바이너리 raw bytes 로더 훅 (docx/xlsx/pdf 공용).
// fetchFileBytes(GET /api/docs/file, raw) 로 ArrayBuffer 를 받아 상태로 노출.
// 404(DOC_NOT_FOUND/INVALID_PATH) → "notfound", 그 외(BE 미기동 등) → "error".
// 두 상태 모두 뷰어에선 동일 warn(문서를 찾을 수 없음)으로 수렴(케이스 매트릭스).

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchFileBytes } from "@/lib/docs";

export type BytesState =
  | { status: "loading" }
  | { status: "loaded"; buffer: ArrayBuffer }
  | { status: "notfound" }
  | { status: "error" };

export function useFileBytes(path: string): BytesState {
  const [state, setState] = useState<BytesState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchFileBytes(path)
      .then((buffer) => {
        if (alive) setState({ status: "loaded", buffer });
      })
      .catch((err) => {
        if (!alive) return;
        const notfound = err instanceof ApiError && err.status === 404;
        setState({ status: notfound ? "notfound" : "error" });
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return state;
}
