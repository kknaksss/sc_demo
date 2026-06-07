// SC-WP-04 C4b — 바이너리 렌더러(docx/xlsx/pdf)의 dynamic(ssr:false) 로더 공유 모듈.
//
// ★ ssr:false 필수 — react-pdf 는 SSR 비활성 필수이고, PdfRenderer 모듈 최상단의
//   pdfjs.GlobalWorkerOptions 설정은 클라이언트에서만 실행돼야 한다. "use client" 만으로는
//   App Router 가 첫 요청에 client 컴포넌트를 prerender 하므로 부족 → 반드시 dynamic(ssr:false).
//   도서관 Viewer 와 개인스페이스 NonMdViewer 가 동일 인스턴스를 공유해 회귀 위험 단일화.

import dynamic from "next/dynamic";

export const DocxRenderer = dynamic(() => import("./DocxRenderer"), {
  ssr: false,
});
export const XlsxRenderer = dynamic(() => import("./XlsxRenderer"), {
  ssr: false,
});
export const PdfRenderer = dynamic(() => import("./PdfRenderer"), {
  ssr: false,
});
