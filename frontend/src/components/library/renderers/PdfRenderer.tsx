"use client";

// SC-WP-03 C3 — pdf 렌더러 (react-pdf / pdf.js).
// SoT: spec-01 §4 (pdf = react-pdf, 클라이언트 raw bytes) + 디자인 .doc-pdf(library.jsx).
//
// ★ Next 14 worker 핀: react-pdf 가 번들한 pdfjs 버전(pdfjs.version)에 맞춰 worker 를
//   고정한다 — 별도 pdfjs-dist 설치 없이 버전 불일치("API/Worker version mismatch")를 회피.
//   이 컴포넌트는 Viewer 에서 next/dynamic(ssr:false) 로만 로드되므로 모듈 최상단의
//   GlobalWorkerOptions 설정은 클라이언트에서만 실행된다.
//
// raw bytes 는 useFileBytes 로 받고, Document file={{ data }} 로 전달.
//   ★ Uint8Array 사본을 넘긴다 — react-pdf 가 버퍼를 detach 할 수 있어 원본 재사용 시 깨짐.

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import type { DocNode } from "@/lib/docs";
import { ViewerLoading, ViewerNotFound } from "../viewer-states";
import { useFileBytes } from "./useFileBytes";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PAGE_WIDTH = 640; // 디자인 .doc-pdf-page width:640px

// ★ medi-doc PDF 는 폰트 미임베드(/FontFile 0) — base fonts = Helvetica(표준14) +
//   HYSMyeongJo-Medium·HYGothic-Medium(Adobe-Korea1 한글 CIDFont). pdf.js 가 cMapUrl
//   (CID→글리프 매핑) + standardFontDataUrl(표준폰트) 없이는 글리프를 못 그려 텍스트 blank.
//   worker 와 동일 pdfjs 버전(pdfjs.version) unpkg CDN 으로 핀(버전 mismatch 회피).
const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

export default function PdfRenderer({ node }: { node: DocNode }) {
  const state = useFileBytes(node.path);
  const [numPages, setNumPages] = useState(0);
  const [renderError, setRenderError] = useState(false);

  // file prop 은 안정 참조여야 재로딩 루프가 안 생긴다. 버퍼 사본을 memo.
  const file = useMemo(
    () =>
      state.status === "loaded"
        ? { data: new Uint8Array(state.buffer.slice(0)) }
        : null,
    [state],
  );

  if (state.status === "loading") return <ViewerLoading name={node.name} />;
  if (state.status === "notfound" || state.status === "error" || renderError) {
    return <ViewerNotFound name={node.name} />;
  }

  return (
    <div className="viewer-scroll">
      <div className="doc-pdf">
        <Document
          file={file}
          options={PDF_OPTIONS}
          onLoadError={() => setRenderError(true)}
          onSourceError={() => setRenderError(true)}
          loading={<ViewerLoading name={node.name} />}
          error={<ViewerNotFound name={node.name} />}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={PAGE_WIDTH}
              renderAnnotationLayer={false}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
