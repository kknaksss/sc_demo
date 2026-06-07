// onto/chat.jsx — AI 채팅 (멀티턴): 풀 화면(사이드바) + 도크(개인공간 우측)
// 능력: 도서관 읽기(그라운딩) / 개인공간 md 대신작성. 쓰기 경계 = md 한정.

const { useState: useChatState, useRef: useChatRef, useEffect: useChatEffect } = React;

// ---------- 공통: 메시지 블록 렌더 ----------
function ToolCard({ tool, status, time, rows }) {
  return (
    <div className="ch-tool">
      <div className="ch-tool-head">
        <span className="ch-mcp">MCP</span>
        <span className="ch-tool-name">{tool}</span>
        <span className="ch-tool-status">{status} · {time}</span>
      </div>
      <div className="ch-tool-body">
        {rows.map((r, i) => (
          <div key={i}><span className="k">{r[0]}</span><span className="v">{r[1]}</span></div>
        ))}
      </div>
    </div>
  );
}

function Citations({ items }) {
  return (
    <div className="ch-cites">
      {items.map((c, i) => (
        <div key={i} className="ch-cite">
          <span className="ch-cite-num">{i + 1}</span>
          <span className="ch-cite-title">{c.title}</span>
          <span className="ch-cite-loc">{c.loc}</span>
        </div>
      ))}
    </div>
  );
}

function DraftCard({ block, onSave }) {
  const OI = window.OI;
  return (
    <div className="ch-draft">
      <div className="ch-draft-head">
        <span className="fmt-badge fmt-md">MD</span>
        <span className="ch-draft-title">{block.title}</span>
        <span className="ch-draft-tag">대신작성 초안</span>
      </div>
      <div className="ch-draft-body">{block.body}</div>
      <div className="ch-draft-foot">
        {block.saved ? (
          <span className="ch-draft-saved"><OI.Check size={13} /> 개인공간에 저장됨</span>
        ) : (
          <button className="btn btn-primary ch-draft-save" onClick={onSave}>
            <OI.FilePlus size={13} /> 개인공간에 저장
          </button>
        )}
        <span className="ch-draft-note">에이전트는 md 만 작성합니다</span>
      </div>
    </div>
  );
}

function Blocks({ blocks, onSaveDraft }) {
  const OI = window.OI;
  return blocks.map((b, i) => {
    if (b.type === "text") return <p key={i} dangerouslySetInnerHTML={{ __html: b.value }} />;
    if (b.type === "list") return <ul key={i}>{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    if (b.type === "tool") return <ToolCard key={i} {...b} />;
    if (b.type === "cites") return <Citations key={i} items={b.items} />;
    if (b.type === "draft") return <DraftCard key={i} block={b} onSave={() => onSaveDraft(i)} />;
    return null;
  });
}

function Message({ msg, onSaveDraft, user }) {
  const OI = window.OI;
  const isUser = msg.role === "user";
  const u = user || { initial: "민", display_name: "김민준" };
  return (
    <div className={"ch-msg " + (isUser ? "from-user" : "from-ai")}>
      <div className={"ch-avatar " + (isUser ? "user" : "ai")}>
        {isUser ? u.initial : <OI.Sparkles size={14} />}
      </div>
      <div className="ch-msg-body">
        <div className="ch-msg-head">
          <span className="ch-name">{isUser ? u.display_name : "Claude"}</span>
          <span className="ch-ts">{msg.ts}{!isUser && " · open-kknaks"}</span>
          {msg.typing && <span className="ch-caret" />}
        </div>
        <div className="ch-bubble">
          <div className="ch-content">
            <Blocks blocks={msg.blocks} onSaveDraft={(bi) => onSaveDraft(msg.id, bi)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 시뮬레이션된 에이전트 ----------
let _mid = 1000;
const nextId = () => "msg" + (++_mid);
const nowTs = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };

function assistantReply(text, ctx) {
  const wantsWrite = /작성|초안|만들어|md|문서로|정리해/.test(text);
  if (wantsWrite) {
    return {
      id: nextId(), role: "assistant", ts: nowTs(),
      blocks: [
        { type: "text", value: ctx?.docTitle
            ? `<b>${ctx.docTitle}</b> 내용을 바탕으로 md 초안을 작성했습니다. 저장하면 개인공간에 새 문서로 추가됩니다.`
            : "요청하신 내용을 md 초안으로 정리했습니다. 저장하면 개인공간에 새 문서로 추가됩니다." },
        { type: "tool", tool: "personal.create_md", status: "준비", time: "0.2s",
          rows: [["format", "md (쓰기 경계)"], ["title", "AI 초안 — 매핑 요약"], ["persist", "유저 확인 후 저장"]] },
        { type: "draft", title: "AI 초안 — 매핑 요약.md",
          body: "## 요약\n- 당뇨·고혈압 매핑 신뢰도 0.97↑\n- 검사코드 LOINC 매핑 검수 필요\n\n## 다음 단계\n- 희귀질환 코드 공백 보완",
          saved: false },
      ],
    };
  }
  return {
    id: nextId(), role: "assistant", ts: nowTs(),
    blocks: [
      { type: "text", value: "도서관 시드 문서를 읽어 확인했습니다." },
      { type: "tool", tool: "library.read_doc", status: "완료", time: "0.4s",
        rows: [["path", `"${ctx?.docTitle || "제품/온톨로지/온톨로지 개요.md"}"`], ["→", "1.8 KB · 읽기전용 시드"]] },
      { type: "text", value: "표준 개념 매핑은 KCD·ICD-10·LOINC 를 SNOMED CT 식별자로 정규화하며, 평균 신뢰도는 <b>0.94</b> 수준입니다. 희귀질환 코드 일부는 표준 매핑 공백이 남아 있습니다." },
      { type: "cites", items: [
        { title: "제품/온톨로지/온톨로지 개요.md", loc: "개념 모델 · L24" },
        { title: "제품/진단코드 매핑.xlsx", loc: "매핑 시트 · 8행" },
      ] },
    ],
  };
}

// ---------- 컴포저 ----------
function Composer({ variant, onSend, mentions }) {
  const OI = window.OI;
  const [text, setText] = useChatState("");
  const submit = () => { const t = text.trim(); if (!t) return; onSend(t); setText(""); };
  return (
    <div className={"ch-composer " + variant}>
      <div className="ch-composer-inner">
        {variant === "full" && mentions && (
          <div className="ch-mentions">
            {mentions.map((m, i) => (
              <span key={i} className="ch-mention"><OI.Doc size={11} /> {m} <span className="ch-mention-x">×</span></span>
            ))}
          </div>
        )}
        <textarea
          className="ch-textarea"
          placeholder={variant === "dock" ? "현재 문서를 근거로 질문…" : "무엇이든 물어보세요 · @ 로 도서관 문서 멘션"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        />
        <div className="ch-composer-bar">
          {variant === "full" && <>
            <button className="ch-cbtn" title="첨부"><OI.Paperclip size={14} /></button>
            <button className="ch-cbtn" title="멘션"><OI.AtSign size={14} /></button>
          </>}
          <span className="ch-model">● open-kknaks</span>
          {variant === "full" && <span className="ch-mcp-pill">MCP · 도서관 read · md write</span>}
          <span className="ch-spacer" />
          <button className="ch-send" onClick={submit}><OI.Send size={12} /> 전송</button>
        </div>
      </div>
    </div>
  );
}

// ---------- 대화 스트림 (공통) ----------
function Conversation({ messages, setMessages, variant, ctx, onCreateMd, user }) {
  const scrollRef = useChatRef(null);
  useChatEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);

  const saveDraft = (msgId, bi) => {
    setMessages((ms) => ms.map((m) => {
      if (m.id !== msgId) return m;
      const blocks = m.blocks.map((b, i) => (i === bi ? { ...b, saved: true } : b));
      return { ...m, blocks };
    }));
    const draft = messages.find((m) => m.id === msgId)?.blocks[bi];
    if (draft && onCreateMd) onCreateMd(draft.title, draft.body);
  };

  const send = (text) => {
    const userMsg = { id: nextId(), role: "user", ts: nowTs(), blocks: [{ type: "text", value: text }] };
    setMessages((ms) => [...ms, userMsg]);
    const typingId = nextId();
    setMessages((ms) => [...ms, { id: typingId, role: "assistant", ts: nowTs(), typing: true, blocks: [{ type: "text", value: "생각 중…" }] }]);
    setTimeout(() => {
      const reply = assistantReply(text, ctx);
      setMessages((ms) => ms.map((m) => (m.id === typingId ? reply : m)));
    }, 850);
  };

  return (
    <>
      <div className={"ch-stream " + variant} ref={scrollRef}>
        <div className="ch-stream-inner">
          {messages.map((m) => <Message key={m.id} msg={m} onSaveDraft={saveDraft} user={user} />)}
        </div>
      </div>
      <Composer variant={variant} onSend={send} mentions={variant === "full" ? ["제품/온톨로지/온톨로지 개요.md", "제품/진단코드 매핑.xlsx"] : null} />
    </>
  );
}

// ---------- 시드 thread ----------
const CHAT_THREADS = [
  { group: "오늘", items: [
    { id: "t1", title: "당뇨 매핑 신뢰도 질문", snippet: "표준 개념 매핑 신뢰도가…", ts: "14:18", msgs: 4 },
    { id: "t2", title: "백서 2장 요약 요청", snippet: "아키텍처 섹션 핵심만…", ts: "11:02", msgs: 2 },
  ]},
  { group: "이번 주", items: [
    { id: "t3", title: "고혈압 개념 관계 정리", snippet: "is-a / treats 관계를…", ts: "월", msgs: 6 },
    { id: "t4", title: "검사코드 LOINC 매핑 초안", snippet: "md 초안으로 정리해줘…", ts: "월", msgs: 3 },
  ]},
];

const SEED_CONV = [
  { id: "msg1", role: "user", ts: "14:18", blocks: [
    { type: "text", value: '<span class="ch-inline-doc">제품/온톨로지/온톨로지 개요.md</span> 표준 개념 매핑 신뢰도는 어느 정도야? 공백은 없어?' },
  ]},
  { id: "msg2", role: "assistant", ts: "14:18", blocks: [
    { type: "text", value: "도서관 시드 문서를 읽어 확인했습니다." },
    { type: "tool", tool: "library.read_doc", status: "완료", time: "0.4s",
      rows: [["path", '"제품/온톨로지/온톨로지 개요.md"'], ["range", "개념 모델 §"], ["→", "1.8 KB · 읽기전용"]] },
    { type: "tool", tool: "library.read_doc", status: "완료", time: "0.3s",
      rows: [["path", '"제품/진단코드 매핑.xlsx"'], ["→", "매핑 시트 8행"]] },
    { type: "text", value: "<b>매핑 신뢰도 요약</b>" },
    { type: "list", items: [
      "주요 만성질환(당뇨·고혈압·천식)은 신뢰도 <b>0.95↑</b> 로 안정적",
      "검사코드(LOINC)는 1:1 매핑이라 <b>1.00</b>",
      "<b>공백</b>: 희귀질환 코드 일부가 표준 개념에 미매핑 — 다음 분기 과제",
    ]},
    { type: "cites", items: [
      { title: "제품/온톨로지/온톨로지 개요.md", loc: "개념 모델 · L24" },
      { title: "제품/진단코드 매핑.xlsx", loc: "매핑 시트 · E열" },
    ]},
  ]},
];

// =========================================================
// 풀 화면 채팅 (사이드바)
// =========================================================
function Chat({ user }) {
  const OI = window.OI;
  const [activeThread, setActiveThread] = useChatState("t1");
  const [messages, setMessages] = useChatState(SEED_CONV);

  return (
    <div className="chat">
      <aside className="chat-threads">
        <div className="chat-threads-head">
          <button className="btn btn-primary chat-new"><OI.Plus size={14} /> 새 대화</button>
        </div>
        <div className="chat-threads-search">
          <OI.Search size={13} />
          <input placeholder="대화 검색" />
        </div>
        <div className="chat-threads-list">
          {CHAT_THREADS.map((g) => (
            <div key={g.group}>
              <div className="chat-threads-group">{g.group}</div>
              {g.items.map((t) => (
                <button key={t.id} className={"chat-thread" + (t.id === activeThread ? " active" : "")} onClick={() => setActiveThread(t.id)}>
                  <div className="chat-thread-title">{t.title}</div>
                  <div className="chat-thread-snippet">{t.snippet}</div>
                  <div className="chat-thread-meta">{t.ts} · {t.msgs}개</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="chat-main">
        <Conversation messages={messages} setMessages={setMessages} variant="full" ctx={null} onCreateMd={null} user={user} />
      </section>
    </div>
  );
}

// =========================================================
// 도크 채팅 (개인공간 우측, IDE식)
// =========================================================
const DOCK_GREETING = [
  { id: "d1", role: "assistant", ts: nowTs(), blocks: [
    { type: "text", value: "현재 문서를 근거로 도와드릴게요. 요약·질의응답은 물론, <b>md 초안</b>도 대신 작성해 개인공간에 저장할 수 있어요." },
  ]},
];

// 시드 대화 기록 (유저 스코프 thread — GET /api/chat/threads)
const DOCK_THREADS = [
  {
    id: "dt-new", title: "새 대화", isNew: true,
    messages: DOCK_GREETING,
  },
  {
    id: "dt1", title: "분기 메모 핵심 정리", ts: "오늘 14:02", preview: "주간 업무 메모에서 핵심 3가지를…",
    messages: [
      { id: "m1", role: "user", ts: "14:01", blocks: [{ type: "text", value: "이 문서 핵심만 3줄로 정리해줘" }] },
      { id: "m2", role: "assistant", ts: "14:02", blocks: [
        { type: "text", value: "주간 업무 메모 핵심 3가지입니다:" },
        { type: "list", items: ["매핑 신뢰도 0.95 미만 항목 재검토 필요", "LOINC 동기화 일정 6/12로 확정", "온톨로지 개요 문서 리뷰 요청 대기"] },
      ]},
    ],
  },
  {
    id: "dt2", title: "md 초안 작성 요청", ts: "어제 17:40", preview: "회의 결론을 md 초안으로…",
    messages: [
      { id: "m1", role: "user", ts: "17:38", blocks: [{ type: "text", value: "회의 결론을 md 초안으로 만들어줘" }] },
      { id: "m2", role: "assistant", ts: "17:40", blocks: [
        { type: "text", value: "회의 결론 초안을 작성했습니다. 개인공간에 저장할 수 있어요." },
        { type: "draft", title: "회의 결론 초안.md", body: "# 회의 결론\n\n- 매핑 신뢰도 기준 0.95 확정\n- LOINC 동기화 6/12\n- 리뷰어 지정: 이서연" },
      ]},
    ],
  },
];

function DockHistory({ threads, activeId, onPick, onClose }) {
  const OI = window.OI;
  return (
    <>
      <div className="dock-hist-backdrop" onClick={onClose} />
      <div className="dock-hist">
        <div className="dock-hist-head">대화 기록</div>
        {threads.map((t) => (
          <button
            key={t.id}
            className={"dock-hist-item" + (t.id === activeId ? " active" : "") + (t.isNew ? " is-new" : "")}
            onClick={() => { onPick(t); onClose(); }}
          >
            {t.isNew
              ? <OI.Plus size={14} className="dock-hist-ic" />
              : <OI.Clock size={13} className="dock-hist-ic" />}
            <span className="dock-hist-main">
              <span className="dock-hist-title">{t.title}</span>
              {!t.isNew && <span className="dock-hist-preview">{t.preview}</span>}
            </span>
            {!t.isNew && <span className="dock-hist-ts">{t.ts}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function DockChat({ doc, onClose, onCreateMd, user }) {
  const OI = window.OI;
  const [threads] = useChatState(DOCK_THREADS);
  const [activeId, setActiveId] = useChatState("dt-new");
  const [messages, setMessages] = useChatState(DOCK_GREETING);
  const [histOpen, setHistOpen] = useChatState(false);

  const active = threads.find((t) => t.id === activeId) || threads[0];

  const pickThread = (t) => {
    setActiveId(t.id);
    setMessages(t.isNew ? DOCK_GREETING : t.messages);
  };

  return (
    <aside className="dock">
      <div className="dock-head">
        <OI.Sparkles size={15} />
        <span className="dock-title">{active.isNew ? "AI 어시스턴트" : active.title}</span>
        <div className="dock-head-actions">
          <button
            className={"dock-iconbtn" + (histOpen ? " active" : "")}
            onClick={() => setHistOpen((v) => !v)}
            title="대화 기록"
          >
            <OI.Clock size={15} />
          </button>
          <button className="dock-iconbtn" onClick={() => pickThread(threads[0])} title="새 대화"><OI.Plus size={15} /></button>
          <button className="dock-iconbtn" onClick={onClose} title="닫기"><OI.X size={15} /></button>
        </div>
        {histOpen && (
          <DockHistory threads={threads} activeId={activeId} onPick={pickThread} onClose={() => setHistOpen(false)} />
        )}
      </div>
      <div className="dock-ground">
        <OI.Doc size={12} />
        <span>근거: {doc ? doc.title : "선택된 문서 없음"}</span>
      </div>
      <Conversation
        key={activeId}
        messages={messages}
        setMessages={setMessages}
        variant="dock"
        ctx={{ docTitle: doc ? doc.title : null }}
        onCreateMd={onCreateMd}
        user={user}
      />
    </aside>
  );
}

window.Chat = Chat;
window.DockChat = DockChat;
