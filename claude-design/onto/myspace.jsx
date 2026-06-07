// onto/myspace.jsx — 개인공간: 내 문서 목록(평면) + 생성/편집/저장 + 업로드 (read-write)

const { useState, useRef, useEffect } = React;

const FMT_LABEL_MS = { md: "MD", docx: "DOCX", xlsx: "XLSX", pdf: "PDF" };

// ---------- 시드: 내 문서 ----------
const SEED_DOCS = [
  {
    id: "m1", title: "주간 업무 메모", format: "md",
    updatedAt: "2026-06-04 17:20", createdAt: "2026-06-01",
    html: `<h1>주간 업무 메모</h1><p>이번 주 온톨로지 매핑 검수 진행 상황을 정리한다.</p><h2>완료</h2><ul><li>KCD → SNOMED 매핑 1차 검수 (당뇨·고혈압)</li><li>신뢰도 0.9 미만 항목 플래그</li></ul><h2>다음 주</h2><ul><li>검사코드 LOINC 매핑 리뷰</li><li>백서 2장 초안</li></ul>`,
  },
  {
    id: "m2", title: "분기 보고서", format: "docx",
    updatedAt: "2026-06-03 11:05", createdAt: "2026-05-20",
    html: `<h1>2026 2분기 임상개발 보고</h1><p>본 보고서는 온톨로지 매핑 커버리지와 품질 지표를 요약한다.</p><h2>핵심 지표</h2><p>표준 개념 매핑 커버리지는 전 분기 대비 12%p 상승했으며, 평균 신뢰도는 0.94를 유지하고 있다.</p><h2>리스크</h2><p>희귀질환 코드의 표준 매핑 공백이 남아 있어 다음 분기 우선 과제로 둔다.</p>`,
  },
  {
    id: "m3", title: "실험 데이터", format: "xlsx",
    updatedAt: "2026-06-02 09:48", createdAt: "2026-05-28",
    grid: [
      ["개념", "샘플 수", "정확도", "신뢰도"],
      ["당뇨", "1240", "0.97", "0.98"],
      ["고혈압", "980", "0.95", "0.97"],
      ["천식", "610", "0.92", "0.95"],
      ["고지혈증", "540", "0.91", "0.93"],
    ],
  },
  {
    id: "m4", title: "참고 백서.pdf", format: "pdf", viewOnly: true,
    updatedAt: "2026-05-31 14:00", createdAt: "2026-05-31",
  },
];

// ---------- 빈 문서 템플릿 ----------
function blankDoc(format) {
  const base = {
    id: "n" + Math.random().toString(36).slice(2, 8),
    title: "제목 없는 문서",
    format,
    createdAt: "방금",
    updatedAt: "방금",
  };
  if (format === "xlsx") {
    return { ...base, grid: Array.from({ length: 14 }, () => Array.from({ length: 6 }, () => "")) };
  }
  return { ...base, html: "" };
}

// =========================================================
// 리치 에디터 (md / docx) — uncontrolled contentEditable
// =========================================================
function RichEditor({ docId, variant, initialHTML, bufferRef, onDirty }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) bufferRef.current = { type: "html", value: ref.current.innerHTML }; }, [docId]);

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val);
    if (ref.current) { bufferRef.current = { type: "html", value: ref.current.innerHTML }; onDirty(); }
    ref.current && ref.current.focus();
  };
  const btn = (label, cmd, val) => (
    <button className="ed-tool" onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd, val)}>{label}</button>
  );

  return (
    <div className={"ed ed-" + variant}>
      <div className="ed-toolbar">
        {variant === "docx" && <>
          {btn("H1", "formatBlock", "<h1>")}
          {btn("H2", "formatBlock", "<h2>")}
          {btn("본문", "formatBlock", "<p>")}
          <span className="ed-tool-sep" />
        </>}
        {variant === "md" && <>
          {btn("제목", "formatBlock", "<h2>")}
          <span className="ed-tool-sep" />
        </>}
        <button className="ed-tool ed-tool-b" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>B</button>
        <button className="ed-tool ed-tool-i" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>I</button>
        <span className="ed-tool-sep" />
        {btn("• 목록", "insertUnorderedList")}
        {btn("1. 목록", "insertOrderedList")}
      </div>
      <div className="ed-scroll">
        <div
          ref={ref}
          className={"ed-surface ed-surface-" + variant}
          contentEditable
          suppressContentEditableWarning
          data-empty={!initialHTML}
          dangerouslySetInnerHTML={{ __html: initialHTML || "" }}
          onInput={(e) => { bufferRef.current = { type: "html", value: e.currentTarget.innerHTML }; onDirty(); }}
        />
      </div>
    </div>
  );
}

// =========================================================
// 스프레드시트 에디터 (xlsx) — 편집 가능 그리드
// =========================================================
function SheetEditor({ docId, initialGrid, bufferRef, onDirty }) {
  const gridRef = useRef(initialGrid.map((r) => [...r]));
  useEffect(() => { gridRef.current = initialGrid.map((r) => [...r]); bufferRef.current = { type: "grid", value: gridRef.current }; }, [docId]);
  const cols = ["A", "B", "C", "D", "E", "F"].slice(0, initialGrid[0].length);

  return (
    <div className="ed ed-xlsx">
      <div className="ed-toolbar ed-toolbar-xlsx">
        <span className="ed-xlsx-hint">셀을 클릭해 값을 입력하세요</span>
      </div>
      <div className="doc-xlsx-grid ed-grid">
        <table>
          <thead>
            <tr>
              <th className="xl-corner"></th>
              {cols.map((c) => <th key={c} className="xl-colhead">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {initialGrid.map((row, ri) => (
              <tr key={ri}>
                <th className="xl-rowhead">{ri + 1}</th>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={"xl-cell xl-edit" + (ri === 0 ? " xl-header" : "")}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => { gridRef.current[ri][ci] = e.currentTarget.textContent; bufferRef.current = { type: "grid", value: gridRef.current }; onDirty(); }}
                  >{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 상태 화면 ----------
function MsState({ icon, title, desc, tone, cta }) {
  const Icon = window.OI[icon];
  return (
    <div className={"viewer-state" + (tone ? " tone-" + tone : "")}>
      <div className="viewer-state-icon"><Icon size={26} /></div>
      <h2>{title}</h2>
      <p>{desc}</p>
      {cta}
    </div>
  );
}

// =========================================================
// 개인공간
// =========================================================
function MySpace({ user }) {
  const OI = window.OI;
  const [docs, setDocs] = useState(SEED_DOCS);
  const [selectedId, setSelectedId] = useState("m1");
  const [dirty, setDirty] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const bufferRef = useRef(null);
  const fileRef = useRef(null);
  const [dockOpen, setDockOpen] = useState(true);

  const selected = docs.find((d) => d.id === selectedId) || null;
  const editable = selected && !selected.viewOnly;

  const showToast = (msg, tone) => { setToast({ msg, tone }); setTimeout(() => setToast(null), 3200); };

  const select = (id) => { setSelectedId(id); setDirty(false); };

  const createDoc = (format) => {
    const d = blankDoc(format);
    setDocs((ds) => [d, ...ds]);
    setSelectedId(d.id);
    setDirty(false);
    setNewOpen(false);
  };

  const save = () => {
    if (!selected || !bufferRef.current) { setDirty(false); return; }
    const buf = bufferRef.current;
    const now = "방금";
    setDocs((ds) => ds.map((d) => {
      if (d.id !== selected.id) return d;
      if (buf.type === "html") return { ...d, html: buf.value, updatedAt: now };
      if (buf.type === "grid") return { ...d, grid: buf.value.map((r) => [...r]), updatedAt: now };
      return d;
    }));
    setDirty(false);
    showToast("저장되었습니다", "ok");
  };

  const onUploadClick = () => fileRef.current && fileRef.current.click();
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!["md", "docx", "xlsx", "pdf"].includes(ext)) {
      showToast(`업로드할 수 없는 형식입니다 (.${ext}) — md · docx · xlsx · pdf 만 가능`, "warn");
      return;
    }
    const d = {
      id: "u" + Math.random().toString(36).slice(2, 8),
      title: f.name,
      format: ext,
      viewOnly: ext === "pdf",
      createdAt: "방금", updatedAt: "방금",
      html: ext === "pdf" ? null : "<p></p>",
      grid: ext === "xlsx" ? Array.from({ length: 14 }, () => Array.from({ length: 6 }, () => "")) : undefined,
    };
    setDocs((ds) => [d, ...ds]);
    setSelectedId(d.id);
    showToast(`${f.name} 업로드됨${ext === "pdf" ? " · 보기 전용" : ""}`, "ok");
  };

  // 채팅 대신작성 → 개인공간 md 생성
  const createMdFromChat = (title, body) => {
    const html = body.split("\n").map((ln) => {
      if (ln.startsWith("## ")) return "<h2>" + ln.slice(3) + "</h2>";
      if (ln.startsWith("- ")) return "<li>" + ln.slice(2) + "</li>";
      return ln.trim() ? "<p>" + ln + "</p>" : "";
    }).join("");
    const d = { id: "c" + Math.random().toString(36).slice(2, 8), title: (title || "AI \ucd08\uc548").replace(/\.md$/, ""), format: "md", createdAt: "\ubc29\uae08", updatedAt: "\ubc29\uae08", html };
    setDocs((ds) => [d, ...ds]);
    showToast("AI \ucd08\uc548\uc774 \uac1c\uc778\uacf5\uac04\uc5d0 \uc800\uc7a5\ub428", "ok");
  };

  // ---------- 에디터/뷰어 본문 ----------
  function Body() {
    if (!selected) {
      return <MsState icon="Edit" title="문서를 선택하세요" desc="좌측에서 문서를 열거나 새 문서를 만들어 작성을 시작하세요." />;
    }
    if (selected.format === "pdf") {
      const Pdf = window.ONTO_LIB.DOC_RENDER["whitepaper"];
      return <div className="viewer-scroll" key={selected.id}><Pdf /></div>;
    }
    if (!["md", "docx", "xlsx"].includes(selected.format)) {
      return <MsState icon="Doc" tone="warn" title="지원하지 않는 포맷" desc="인앱 편집은 md · docx · xlsx 만 지원합니다." />;
    }
    if (selected.format === "xlsx") {
      return <SheetEditor docId={selected.id} initialGrid={selected.grid} bufferRef={bufferRef} onDirty={() => setDirty(true)} />;
    }
    return (
      <RichEditor
        docId={selected.id}
        variant={selected.format}
        initialHTML={selected.html}
        bufferRef={bufferRef}
        onDirty={() => setDirty(true)}
      />
    );
  }

  return (
    <div className="ms">
      {/* 좌측: 내 문서 목록 */}
      <aside className="ms-list">
        <div className="ms-list-head">
          <span className="ms-list-title">내 문서</span>
          <span className="ms-list-count">{docs.length}</span>
        </div>
        <div className="ms-actions">
          <div className="ms-new-wrap">
            <button className="btn btn-primary ms-new-btn" onClick={() => setNewOpen((o) => !o)}>
              <OI.Plus size={14} /> 새 문서
            </button>
            {newOpen && (
              <>
                <div className="ms-menu-backdrop" onClick={() => setNewOpen(false)} />
                <div className="ms-menu">
                  {[["md", "마크다운"], ["docx", "워드 문서"], ["xlsx", "스프레드시트"]].map(([f, label]) => (
                    <button key={f} className="ms-menu-item" onClick={() => createDoc(f)}>
                      <span className={"fmt-badge fmt-" + f}>{FMT_LABEL_MS[f]}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button className="btn ms-upload-btn" onClick={onUploadClick} title="업로드 (md · docx · xlsx · pdf)">
            <OI.Upload size={14} />
          </button>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onFile} />
        </div>

        <div className="ms-docs">
          {docs.length === 0 ? (
            <div className="ms-empty">
              <OI.FilePlus size={22} />
              <div>아직 문서가 없습니다</div>
              <span>새 문서를 만들어 시작하세요</span>
            </div>
          ) : docs.map((d) => (
            <button
              key={d.id}
              className={"ms-doc" + (d.id === selectedId ? " active" : "")}
              onClick={() => select(d.id)}
            >
              <span className={"fmt-badge fmt-" + d.format}>{FMT_LABEL_MS[d.format]}</span>
              <span className="ms-doc-main">
                <span className="ms-doc-title">{d.title}</span>
                <span className="ms-doc-meta">{d.updatedAt}{d.viewOnly ? " · 보기 전용" : ""}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* 우측: 에디터/뷰어 + 도크 채팅 */}
      <section className="ms-main">
        <div className="ms-editor-col">
          {selected && (
            <div className="ms-chrome">
              <input
                className="ms-title-input"
                defaultValue={selected.title}
                key={selected.id}
                readOnly={!editable}
                onChange={() => setDirty(true)}
              />
              <span className={"fmt-badge fmt-" + selected.format}>{FMT_LABEL_MS[selected.format]}</span>
              <div className="ms-chrome-right">
                {selected.viewOnly ? (
                  <span className="ms-viewonly"><OI.Lock size={12} /> 보기 전용</span>
                ) : (
                  <>
                    <span className={"ms-save-state" + (dirty ? " dirty" : "")}>
                      {dirty ? "수정됨" : "저장됨"}
                    </span>
                    <button className="btn btn-primary ms-save" onClick={save} disabled={!dirty}>
                      <OI.Check size={13} /> 저장
                    </button>
                  </>
                )}
                <span className="ms-chrome-sep" />
                <button
                  className={"btn ms-ai-btn" + (dockOpen ? " active" : "")}
                  onClick={() => setDockOpen((o) => !o)}
                  title="AI 어시스턴트"
                >
                  <OI.Sparkles size={14} /> AI
                </button>
              </div>
            </div>
          )}
          <div className="ms-body"><Body /></div>
        </div>
        {dockOpen && (
          <window.DockChat doc={selected} onClose={() => setDockOpen(false)} onCreateMd={createMdFromChat} user={user} />
        )}
      </section>

      {toast && (
        <div className={"ms-toast" + (toast.tone === "warn" ? " warn" : "")}>
          {toast.tone === "warn" ? <OI.Doc size={14} /> : <OI.Check size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

window.MySpace = MySpace;
