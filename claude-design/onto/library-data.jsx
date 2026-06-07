// onto/library-data.jsx — 시드 문서 트리 + 포맷별 콘텐츠 (읽기 전용 데모)

// ---------- 폴더/파일 트리 ----------
// type: dir | file, fmt: md|docx|xlsx|pdf|unsupported
const LIB_TREE = [
  {
    id: "회사", type: "dir", name: "회사소개", path: "회사소개", open: true,
    children: [
      { id: "d-intro",   type: "file", name: "mediness 소개.docx", path: "회사소개/mediness 소개.docx", fmt: "docx", size: "182 KB", updated: "2026-05-28", docId: "intro" },
      { id: "d-sec",     type: "file", name: "보안·컴플라이언스.pdf", path: "회사소개/보안·컴플라이언스.pdf", fmt: "pdf",  size: "1.1 MB", updated: "2026-05-12", docId: "security" },
    ],
  },
  {
    id: "제품", type: "dir", name: "제품", path: "제품", open: true,
    children: [
      {
        id: "온톨로지", type: "dir", name: "온톨로지", path: "제품/온톨로지", open: true,
        children: [
          { id: "d-onto-overview", type: "file", name: "온톨로지 개요.md", path: "제품/온톨로지/온톨로지 개요.md", fmt: "md", size: "8 KB",  updated: "2026-06-02", docId: "onto-overview" },
          { id: "d-onto-start",    type: "file", name: "시작하기.md",       path: "제품/온톨로지/시작하기.md", fmt: "md", size: "5 KB",  updated: "2026-06-01", docId: "onto-start" },
        ],
      },
      { id: "d-mapping", type: "file", name: "진단코드 매핑.xlsx", path: "제품/진단코드 매핑.xlsx", fmt: "xlsx", size: "46 KB", updated: "2026-05-30", docId: "mapping" },
      { id: "d-wp",      type: "file", name: "제품 백서.pdf",      path: "제품/제품 백서.pdf", fmt: "pdf",  size: "2.4 MB", updated: "2026-05-20", docId: "whitepaper" },
    ],
  },
  {
    id: "데이터", type: "dir", name: "데이터", path: "데이터", open: false,
    children: [
      { id: "d-arch", type: "file", name: "아키텍처.png", fmt: "unsupported", size: "320 KB", updated: "2026-04-18", docId: "arch" },
    ],
  },
  { id: "부록", type: "dir", name: "부록", path: "부록", open: false, children: [] },
];

const FMT_LABEL = { md: "MD", docx: "DOCX", xlsx: "XLSX", pdf: "PDF", unsupported: "FILE" };

// =========================================================
// 콘텐츠 렌더러 (포맷별)
// =========================================================

// ---------- MD: 온톨로지 개요 ----------
function DocOntoOverview() {
  return (
    <article className="doc-md">
      <h1>온톨로지 개요</h1>
      <p className="doc-md-lede">
        mediness 온톨로지는 임상 개념·코드·관계를 하나의 의미 그래프로 통합해, 흩어진 의료 데이터를
        기계가 읽고 추론할 수 있는 지식 자산으로 전환합니다.
      </p>

      <h2>왜 온톨로지인가</h2>
      <p>
        병원·검사실·청구 시스템은 각자 다른 코드 체계(ICD-10, SNOMED CT, LOINC, KCD)를 사용합니다.
        같은 "제2형 당뇨병"이 시스템마다 다른 코드로 기록되어 데이터 통합과 분석을 가로막습니다.
        온톨로지는 이 개념들을 <strong>표준 식별자</strong> 아래 묶고, 개념 사이의 관계를 명시합니다.
      </p>

      <h2>핵심 구성요소</h2>
      <ul>
        <li><strong>개념(Concept)</strong> — 질환·약물·검사·시술 등 임상 엔티티</li>
        <li><strong>관계(Relation)</strong> — <code>is-a</code>, <code>treats</code>, <code>causes</code> 등 개념 간 의미 연결</li>
        <li><strong>매핑(Mapping)</strong> — 외부 코드 체계 ↔ 표준 개념 식별자 연결</li>
        <li><strong>속성(Property)</strong> — 개념에 부여되는 메타데이터</li>
      </ul>

      <h2>개념 모델 예시</h2>
      <div className="doc-md-tablewrap">
        <table>
          <thead>
            <tr><th>개념</th><th>표준 ID</th><th>관계</th><th>대상</th></tr>
          </thead>
          <tbody>
            <tr><td>제2형 당뇨병</td><td className="mono">SCTID:44054006</td><td className="mono">is-a</td><td>당뇨병</td></tr>
            <tr><td>메트포르민</td><td className="mono">SCTID:372567009</td><td className="mono">treats</td><td>제2형 당뇨병</td></tr>
            <tr><td>당화혈색소 검사</td><td className="mono">LOINC:4548-4</td><td className="mono">measures</td><td>혈당 조절</td></tr>
          </tbody>
        </table>
      </div>

      <blockquote>
        매핑은 읽기 전용 시드로 사전탑재됩니다. 데모에서는 열람만 가능하며, 편집·업로드는 v1 범위 밖입니다.
      </blockquote>

      <h2>예시: 매핑 정의</h2>
      <pre className="doc-md-code"><code><span className="tk-c"># 진단코드 → 표준 개념 매핑</span>{"\n"}<span className="tk-k">mapping</span>:{"\n"}{"  "}- <span className="tk-k">source</span>: <span className="tk-s">"KCD:E11"</span>{"\n"}{"    "}<span className="tk-k">target</span>: <span className="tk-s">"SCTID:44054006"</span>{"\n"}{"    "}<span className="tk-k">confidence</span>: <span className="tk-n">0.98</span></code></pre>
    </article>
  );
}

// ---------- MD: 시작하기 ----------
function DocOntoStart() {
  return (
    <article className="doc-md">
      <h1>시작하기</h1>
      <p className="doc-md-lede">3단계로 온톨로지를 탐색하고 첫 매핑 결과를 확인합니다.</p>

      <h2>1. 도서관에서 개념 찾기</h2>
      <p>좌측 트리에서 <code>제품 / 온톨로지</code> 폴더를 열고 원하는 개념 문서를 선택합니다.</p>

      <h2>2. 매핑표 열람</h2>
      <p><code>진단코드 매핑.xlsx</code>에서 외부 코드와 표준 개념의 연결을 시트로 확인할 수 있습니다.</p>

      <h2>3. 백서로 맥락 이해</h2>
      <p><code>제품 백서.pdf</code>는 온톨로지 설계 원칙과 의료 데이터 통합 사례를 담고 있습니다.</p>

      <blockquote>모든 시드 문서는 별도 준비 없이 브라우저에서 바로 렌더됩니다.</blockquote>
    </article>
  );
}

// ---------- DOCX: 회사 소개 ----------
function DocIntro() {
  return (
    <article className="doc-docx">
      <h1>mediness</h1>
      <p className="doc-docx-subtitle">임상 지식을 연결하는 의료 AI 인프라</p>
      <hr />
      <h2>회사 개요</h2>
      <p>
        mediness는 병원과 연구기관이 흩어진 임상 데이터를 표준화된 의미 그래프로 통합하도록 돕는
        의료 AI 회사입니다. 온톨로지 기반의 지식 인프라 위에서 검색·추론·분석을 제공합니다.
      </p>
      <h2>핵심 역량</h2>
      <p>
        다년간 축적한 의료 용어 매핑 데이터와 임상 추론 모델을 결합해, 코드 체계가 다른 시스템 사이에서도
        일관된 의미 해석을 보장합니다. 모든 처리는 원내 또는 격리된 환경에서 수행되어 데이터가 외부로
        나가지 않습니다.
      </p>
      <h2>제품 라인업</h2>
      <p>
        도서관(문서 열람), 온톨로지 빌더(개념·관계 관리), 매핑 엔진(코드 변환)으로 구성됩니다. 본 데모는
        도서관 열람 경험을 중심으로 제공됩니다.
      </p>
      <p className="doc-docx-sign">문서 버전 1.2 · 2026-05-28 · 임상개발본부</p>
    </article>
  );
}

// ---------- XLSX: 진단코드 매핑 ----------
function DocMapping() {
  const cols = ["A", "B", "C", "D", "E"];
  const headers = ["원본 코드체계", "원본 코드", "표준 개념 ID", "표준 명칭", "신뢰도"];
  const rows = [
    ["KCD", "E11", "SCTID:44054006", "제2형 당뇨병", "0.98"],
    ["KCD", "I10", "SCTID:38341003", "본태성 고혈압", "0.97"],
    ["KCD", "J45", "SCTID:195967001", "천식", "0.95"],
    ["ICD-10", "E78.5", "SCTID:55822004", "고지혈증", "0.93"],
    ["LOINC", "4548-4", "LOINC:4548-4", "당화혈색소", "1.00"],
    ["LOINC", "2160-0", "LOINC:2160-0", "혈청 크레아티닌", "1.00"],
    ["KCD", "N18", "SCTID:709044004", "만성 콩팥병", "0.96"],
    ["ICD-10", "I21", "SCTID:22298006", "심근경색", "0.94"],
  ];
  return (
    <div className="doc-xlsx">
      <div className="doc-xlsx-grid">
        <table>
          <thead>
            <tr>
              <th className="xl-corner"></th>
              {cols.map((c) => <th key={c} className="xl-colhead">{c}</th>)}
            </tr>
            <tr>
              <th className="xl-rowhead">1</th>
              {headers.map((h, i) => <td key={i} className="xl-cell xl-header">{h}</td>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <th className="xl-rowhead">{ri + 2}</th>
                {r.map((cell, ci) => (
                  <td key={ci} className={"xl-cell" + (ci === 2 ? " mono" : "") + (ci === 4 ? " xl-num" : "")}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="doc-xlsx-tabs">
        <span className="xl-tab active">매핑</span>
        <span className="xl-tab">코드체계</span>
        <span className="xl-tab">변경이력</span>
      </div>
    </div>
  );
}

// ---------- PDF: 제품 백서 ----------
function DocWhitepaper() {
  return (
    <div className="doc-pdf">
      <div className="doc-pdf-toolbar">
        <span className="mono">1 / 12</span>
        <span className="doc-pdf-tool-sep" />
        <span className="mono">100%</span>
      </div>
      <div className="doc-pdf-page">
        <div className="doc-pdf-eyebrow">WHITEPAPER · 2026</div>
        <h1>의료 데이터를 위한<br/>온톨로지 인프라</h1>
        <p className="doc-pdf-byline">mediness 임상개발본부</p>
        <p>
          본 백서는 코드 체계가 분절된 의료 환경에서 온톨로지가 어떻게 데이터 통합과 임상 추론의
          공통 기반이 되는지를 설명한다.
        </p>
        <h2>1. 문제 정의</h2>
        <p>
          국내 의료기관은 KCD, 병원별 EMR 코드, 검사실 LOINC, 청구용 코드를 동시에 사용한다. 같은 임상
          개념이 시스템마다 다르게 기록되어, 기관 간 데이터 결합과 코호트 분석이 어렵다.
        </p>
        <h2>2. 접근</h2>
        <p>
          mediness는 모든 개념을 표준 식별자로 정규화하고, 개념 간 의미 관계를 그래프로 표현한다. 외부
          코드는 신뢰도와 함께 표준 개념에 매핑되어, 출처를 잃지 않으면서 통합 분석이 가능해진다.
        </p>
      </div>
      <div className="doc-pdf-page">
        <h2>3. 아키텍처</h2>
        <p>
          매핑 엔진은 읽기 전용 시드 매핑을 로드하고, 추론 계층은 관계 그래프를 순회해 파생 개념을
          도출한다. 모든 연산은 격리 환경에서 수행된다.
        </p>
        <p className="doc-pdf-pagenum">— 2 —</p>
      </div>
    </div>
  );
}

const DOC_RENDER = {
  "intro": DocIntro,
  "security": DocWhitepaper, // 데모용 재사용 (pdf)
  "onto-overview": DocOntoOverview,
  "onto-start": DocOntoStart,
  "mapping": DocMapping,
  "whitepaper": DocWhitepaper,
};

window.ONTO_LIB = { LIB_TREE, FMT_LABEL, DOC_RENDER };
