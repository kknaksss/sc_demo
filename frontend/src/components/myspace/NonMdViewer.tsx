"use client";

// SC-WP-04 C4b — 개인스페이스 비-md(docx/xlsx/pdf) 보기.
// 도서관(WP-03) 렌더러를 재사용한다(중복 구현 금지) — fetch 소스만 personal(id) 로 갈린다.
//   bytes 입력: GET /api/personal/docs/{id} raw → usePersonalBytes(useBytes 공유 코어).
//   render: dynamic(ssr:false) 공유 Docx/Xlsx/PdfRenderer 에 bytes 전달(도서관과 동일 DOM).
// md 편집 경로는 MySpaceView 가 직접 처리 — 여기는 보기 전용 비-md 3포맷만.

import {
  DocxRenderer,
  PdfRenderer,
  XlsxRenderer,
} from "@/components/library/renderers/dynamic";
import { useBytes } from "@/components/library/renderers/useFileBytes";
import { fetchPersonalBytes, type PersonalFmt } from "@/lib/personal";

/** 개인스페이스 raw bytes 훅 — 도서관 useFileBytes 와 동일 패턴(useBytes 공유), fetch 만 personal. */
function usePersonalBytes(id: string) {
  return useBytes(`personal:${id}`, () => fetchPersonalBytes(id));
}

export default function NonMdViewer({
  id,
  format,
  name,
}: {
  id: string;
  format: PersonalFmt;
  name: string;
}) {
  const bytes = usePersonalBytes(id);
  // .ms-nonmd = 도서관 .lib-viewer 와 동일한 flex-column 컨텍스트(.ms-body row 안에서 너비/높이
  // 채움). 렌더러의 .viewer-scroll/.doc-xlsx 가 도서관과 동일하게 렌더되도록 보장.
  let body = null;
  switch (format) {
    case "docx":
      body = <DocxRenderer bytes={bytes} name={name} />;
      break;
    case "xlsx":
      body = <XlsxRenderer bytes={bytes} name={name} />;
      break;
    case "pdf":
      body = <PdfRenderer bytes={bytes} name={name} />;
      break;
    default:
      // md 는 이 컴포넌트로 라우팅되지 않는다(MySpaceView 가 editable 분기에서 거름).
      return null;
  }
  return <div className="ms-nonmd">{body}</div>;
}
