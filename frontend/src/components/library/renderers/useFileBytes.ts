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

/**
 * raw bytes 로더 일반화(C4b) — 도서관(path)·개인스페이스(id)가 fetch 소스만 다르고
 * loading/loaded/notfound/error 상태 매핑은 동일하므로 공유한다.
 * `key` 변경 시 재로드(소스 식별자). loader 는 매 렌더 새 클로저라 dep 에 넣지 않고 key 로만 트리거.
 * 404(DOC_NOT_FOUND/INVALID_PATH)→notfound, 그 외(BE 미기동 등)→error 로 수렴(케이스 매트릭스).
 */
export function useBytes(
  key: string,
  loader: () => Promise<ArrayBuffer>,
): BytesState {
  const [state, setState] = useState<BytesState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    loader()
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
    // key(소스 식별자)만 의존 — loader 클로저는 매 렌더 새로 생성되므로 dep 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** 도서관 raw bytes 로더 훅 — GET /api/docs/file?path=. (시그니처 불변, 도서관 경로 그대로.) */
export function useFileBytes(path: string): BytesState {
  return useBytes(path, () => fetchFileBytes(path));
}
