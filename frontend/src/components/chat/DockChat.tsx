"use client";

// SC-WP-05 C5b(도크) — 개인스페이스 AI 도크 채팅 (surface=personal, WS 라이브).
// 디자인 SoT: myspace.jsx 의 <DockChat> + chat.jsx 의 DockHistory + onto.css 의 .dock-* 클래스.
//
// 이 commit(PLAN-105-T-012) 범위 — C5c shell(9a2da80) 위에 WS 를 얹는다:
//   - 컴포저 send → WS /ws/chat/{id} 송신({content, doc_id, edit_mode}) + 낙관적 user/스트리밍.
//   - delta 누적 → done canonical 확정 → error 안내. (사이드바 ChatView C5b 패턴 그대로.)
//   - ★ 편집모드 in-place: 편집(edit_mode="편집") + md 문서일 때 done.message.content =
//     "수정된 전체 마크다운"(BE resolve_personal_turn). 이걸 onApplyToDoc 으로 에디터 draft 에
//     반영하고, 도크 말풍선엔 큰 본문 대신 간결한 확인만 표시한다(에디터가 채워지는 게 주효과).
//   - 보기/비-md 턴은 답변만 — 평소처럼 canonical 을 말풍선에 표시.
//
// ★ edit_mode 계약: BE 는 한글 "편집"/"보기" 를 기대한다(ws/chat.py:127, chat_engine.py:103
//   `if edit_mode == "편집"`). 에디터 mode("edit"/"view")를 그대로 보내면 BE 가 "보기"로
//   떨어져 편집 반영이 죽는다(빌드는 green) → 송신 시 한글로 매핑한다.
// ★ md 게이트(편집+md) 판별은 BE 가 하지만, FE 도 "이 턴을 in-place 반영으로 볼지"(간결
//   말풍선 + onApplyToDoc)를 같은 기준으로 판단해야 한다 — editMode/editable 둘 다 본다.
// ★ apply 판정은 송신 시점 값으로 고정한다(turnApplyRef). BE 결정은 송신된 payload 로 정해지므로
//   done 시점에 유저가 모드를 토글해도 송신 당시 기준으로 처리해야 일관된다.

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Clock,
  Plus,
  X,
  FileText,
  Pencil,
  Eye,
  MessageSquare,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import type { User } from "@/lib/auth";
import {
  listThreads,
  createThread,
  getThread,
  threadTitle,
  formatThreadTs,
  tmpId,
  turnErrorText,
  type ChatThreadMeta,
  type ChatThreadDetail,
  type ChatMessage,
} from "@/lib/chat";
import { useChatSocket } from "@/lib/chatSocket";
import MessageBlock from "./MessageBlock";
import Composer from "./Composer";

type ListState = "loading" | "loaded" | "error";
type DetailState = "idle" | "loading" | "loaded" | "notfound";

/** 편집+md 반영 턴의 말풍선 — 큰 마크다운 대신 보여줄 간결 확인. */
const APPLY_NOTICE = "문서에 반영했습니다. 에디터에서 확인 후 저장하세요.";

export default function DockChat({
  docId,
  docTitle,
  editMode,
  editable,
  user,
  onClose,
  onApplyToDoc,
}: {
  /** 현재 열린 개인스페이스 문서 id — WS 송신 payload 의 doc_id(없으면 null=답변만). */
  docId: string | null;
  /** 근거 문서 제목 — ground 바 표시용(display only). */
  docTitle: string | null;
  /** 에디터 보기/편집 모드 — 송신 시 한글 edit_mode 로 매핑. */
  editMode: "view" | "edit";
  /** 현재 문서가 md(편집 가능) 인지 — in-place 반영 게이트(편집 + md 일 때만). */
  editable: boolean;
  user: User;
  onClose: () => void;
  /**
   * 편집모드 + md 턴의 done.content(수정된 전체 md)를 에디터 draft 로 반영. 영속은 호출자(저장
   * 버튼) — 도크는 자동 저장하지 않는다(spec §2). 보기/비-md 턴에선 호출되지 않는다.
   */
  onApplyToDoc?: (content: string) => void;
}) {
  const [listState, setListState] = useState<ListState>("loading");
  const [threads, setThreads] = useState<ChatThreadMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailState, setDetailState] = useState<DetailState>("idle");
  const [detail, setDetail] = useState<ChatThreadDetail | null>(null);

  const [histOpen, setHistOpen] = useState(false);

  // WS 턴 상태(사이드바 ChatView 와 동형): 스트리밍 임시 말풍선 id · 송신 중(컴포저 잠금) · 에러 안내.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);

  // 진행 중 턴이 in-place 반영 턴인지(송신 시점 고정). done 에서 이 값으로 분기.
  const turnApplyRef = useRef(false);

  // type-and-go: thread 없을 때 첫 전송 — 생성 중 잠금(별도 상태라 selectedId 리셋 effect 의
  //   setSending(false) 에 안 풀림) + 연결·이력 준비되면 flush 할 보류 송신(턴 컨텍스트는
  //   클릭 시점에 고정해 저장).
  const [creating, setCreating] = useState(false);
  const pendingRef = useRef<{
    text: string;
    docId: string | null;
    editModeWire: string;
    willApply: boolean;
  } | null>(null);

  const streamRef = useRef<HTMLDivElement>(null);

  // 선택 thread 에 묶인 WS 연결(멀티턴은 같은 소켓 유지). 이벤트는 호출자 상태에 누적/확정/에러.
  const { status, send } = useChatSocket(selectedId, {
    onDelta: (text) => {
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) =>
                m.id === streamingId ? { ...m, content: m.content + text } : m,
              ),
            }
          : d,
      );
    },
    onDone: (message) => {
      const apply = turnApplyRef.current;
      // 편집+md 턴: 수정된 전체 md 를 에디터로 반영 + 말풍선은 간결 확인(큰 본문 안 쏟음).
      // 그 외(보기/비-md): canonical 을 그대로 말풍선에 표시. ★ 간결 말풍선도 canonical
      //   id/created_at 은 유지({...message, content}) — 멀티턴 키 안정.
      const shown: ChatMessage = apply
        ? { ...message, content: APPLY_NOTICE }
        : message;
      if (apply) onApplyToDoc?.(message.content);
      setDetail((d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) => (m.id === streamingId ? shown : m)),
            }
          : d,
      );
      if (selectedId) {
        setThreads((ts) => {
          const cur = ts.find((t) => t.id === selectedId);
          if (!cur) return ts;
          const bumped: ChatThreadMeta = {
            ...cur,
            updated_at: message.created_at ?? cur.updated_at,
          };
          return [bumped, ...ts.filter((t) => t.id !== selectedId)];
        });
      }
      setStreamingId(null);
      setSending(false);
    },
    onError: (code, message) => {
      // 에러 턴은 BE 미저장 — 스트리밍 임시 말풍선 제거(낙관적 user 메시지는 세션에 유지).
      setDetail((d) =>
        d ? { ...d, messages: d.messages.filter((m) => m.id !== streamingId) } : d,
      );
      setStreamingId(null);
      setSending(false);
      setTurnError(turnErrorText(code, message));
    },
  });

  // 실제 WS 송신 — 소켓 open + 이력 로드(detail!=null) 전제. 낙관적 user + 스트리밍 placeholder
  //   추가 → send({content, doc_id, edit_mode}). 턴 컨텍스트(docId/editModeWire/willApply)는
  //   호출자가 송신 시점 값으로 넘긴다(기존 thread=즉시 / 신규=flush). apply 판정은 turnApplyRef
  //   에 고정해 done 에서 분기.
  const dispatchSend = (
    text: string,
    docIdArg: string | null,
    editModeWire: string,
    willApply: boolean,
  ) => {
    const userMsg: ChatMessage = {
      id: tmpId(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    const aId = tmpId();
    const typingMsg: ChatMessage = {
      id: aId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setDetail((d) =>
      d ? { ...d, messages: [...d.messages, userMsg, typingMsg] } : d,
    );
    setStreamingId(aId);
    setSending(true);
    setTurnError(null);
    turnApplyRef.current = willApply;
    if (!send({ content: text, doc_id: docIdArg, edit_mode: editModeWire })) {
      // open 게이트를 통과했는데 송신 실패 — 드문 경합. placeholder 제거 + 안내.
      setDetail((d) =>
        d ? { ...d, messages: d.messages.filter((m) => m.id !== aId) } : d,
      );
      setStreamingId(null);
      setSending(false);
      setTurnError("메시지를 전송하지 못했습니다. 다시 시도해주세요.");
    }
  };

  // 연결이 예기치 않게 끊기면(핸드셰이크 거부/스트림 중 단절) 진행 중 턴을 실패 처리.
  useEffect(() => {
    if (status !== "error") return;
    setSending(false);
    if (pendingRef.current) {
      // 신규 thread 소켓이 열리기 전에 끊김 — 보류 송신 취소 + 안내(아래 flush effect 는
      //   pending 이 비어 short-circuit, 이중 처리 없음).
      pendingRef.current = null;
      setCreating(false);
      setTurnError("연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
    setStreamingId((sid) => {
      if (sid) {
        setDetail((d) =>
          d ? { ...d, messages: d.messages.filter((m) => m.id !== sid) } : d,
        );
        setTurnError("연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.");
      }
      return null;
    });
  }, [status]);

  // type-and-go flush: 보류 송신이 있고 신규 thread 의 소켓 open + 이력 로드 완료되면 송신.
  //   pending 을 먼저 비워 중복 송신 방지. creating→sending 전환은 같은 배치라 컴포저 잠금 유지.
  //   ★ 방금 만든 thread 의 이력 로드가 실패(notfound)하면 flush 가 영영 안 와 잠금이 풀리지
  //     않으므로 그 경우도 취소+안내한다. (status==="error" 는 위 effect 가 이미 처리.)
  useEffect(() => {
    const p = pendingRef.current;
    if (!p || !selectedId) return;
    if (detailState === "notfound") {
      pendingRef.current = null;
      setCreating(false);
      setTurnError("대화를 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (status !== "open" || detailState !== "loaded") return;
    pendingRef.current = null;
    setCreating(false);
    dispatchSend(p.text, p.docId, p.editModeWire, p.willApply);
    // dispatchSend/setter 는 안정적 — deps 는 전이를 트리거하는 status/detailState/selectedId 만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, detailState, selectedId]);

  // 최초 진입: 내 personal thread 목록(surface=personal) 로드. ★ chat 과 안 섞임.
  useEffect(() => {
    let alive = true;
    listThreads("personal")
      .then((items) => {
        if (!alive) return;
        setThreads(items);
        setListState("loaded");
      })
      .catch(() => {
        if (alive) setListState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  // 선택 변경 시 단건 이력 로드. ★ 헤더 제목은 목록 메타에서 — 단건엔 title 이 없다.
  useEffect(() => {
    // thread 전환 시 진행 중 턴 상태 초기화(이전 thread 스트리밍/에러가 새 thread 로 새지 않게).
    setStreamingId(null);
    setSending(false);
    setTurnError(null);
    if (!selectedId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailState("loading");
    getThread(selectedId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setDetailState("loaded");
      })
      .catch(() => {
        // thread NOT_FOUND(404)/UNAUTHENTICATED(401)/BE 미기동 → 동일 안내로 수렴.
        if (alive) setDetailState("notfound");
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // 메시지 갱신 시 스트림 하단으로 스크롤.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail]);

  const onNew = async () => {
    setHistOpen(false);
    try {
      const created = await createThread("personal");
      setThreads((ts) => [created, ...ts]);
      setSelectedId(created.id);
    } catch {
      // 생성 실패(미인증 등) — 목록 상태로 안내(이미 error 면 유지).
      setListState((s) => (s === "loaded" ? "error" : s));
    }
  };

  // 컴포저 제출. ★ type-and-go: 선택된 thread 가 없으면 첫 전송 시 personal thread 를 자동
  //   생성하고(열기만으론 생성 안 함 — 빈 thread 양산 방지), 연결·이력 준비되면 보류 송신을
  //   flush(위 effect)한다. 이미 thread 가 있으면 기존 동기 경로(소켓 open). edit_mode 는
  //   한글로 매핑, apply 판정용 editMode/editable·docId 는 클릭 시점 값으로 고정해 넘긴다.
  const handleSend = (text: string) => {
    if (sending || creating || pendingRef.current) return;
    const editModeWire = editMode === "edit" ? "편집" : "보기";
    const willApply = editModeWire === "편집" && editable;

    if (!selectedId) {
      // 첫 전송 — thread 생성 후 보류. 낙관적 메시지는 이력 로드 후 flush 에서 추가
      //   (createThread.then 에서 미리 넣으면 getThread 결과가 덮어써 사라진다).
      setCreating(true);
      setTurnError(null);
      pendingRef.current = { text, docId, editModeWire, willApply };
      createThread("personal")
        .then((created) => {
          setThreads((ts) => [created, ...ts]);
          setSelectedId(created.id); // → WS 연결 + 이력 로드 → flush effect 가 송신.
        })
        .catch(() => {
          // 생성 실패(미인증 등) — 보류 취소 + 안내.
          pendingRef.current = null;
          setCreating(false);
          setListState((s) => (s === "loaded" ? "error" : s));
          setTurnError("대화를 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
        });
      return;
    }

    if (status !== "open") {
      setTurnError(
        status === "error"
          ? "연결할 수 없습니다. 잠시 후 다시 시도해주세요."
          : "연결 중입니다. 잠시 후 다시 시도해주세요.",
      );
      return;
    }
    dispatchSend(text, docId, editModeWire, willApply);
  };

  const selectedMeta = threads.find((t) => t.id === selectedId) ?? null;
  const headTitle = selectedMeta ? threadTitle(selectedMeta) : "AI 어시스턴트";

  function renderHistory() {
    if (listState === "loading") {
      return (
        <div className="dock-hist-empty">
          <Loader2 className="lib-node-spin" size={18} aria-hidden />
          <span>불러오는 중…</span>
        </div>
      );
    }
    if (listState === "error") {
      return (
        <div className="dock-hist-empty">
          <AlertTriangle size={18} aria-hidden />
          <span>대화를 불러올 수 없습니다.</span>
        </div>
      );
    }
    if (threads.length === 0) {
      return (
        <div className="dock-hist-empty">
          <MessageSquare size={18} aria-hidden />
          <span>아직 대화가 없습니다.</span>
        </div>
      );
    }
    // ★ flat 목록 — preview/isNew 는 REST 에 없으니 생략(title + ts 만).
    return threads.map((t) => {
      const ts = formatThreadTs(t.updated_at);
      return (
        <button
          key={t.id}
          type="button"
          className={"dock-hist-item" + (t.id === selectedId ? " active" : "")}
          onClick={() => {
            setSelectedId(t.id);
            setHistOpen(false);
          }}
        >
          <Clock size={13} className="dock-hist-ic" aria-hidden />
          <span className="dock-hist-main">
            <span className="dock-hist-title">{threadTitle(t)}</span>
          </span>
          {ts && <span className="dock-hist-ts">{ts}</span>}
        </button>
      );
    });
  }

  function renderConversation() {
    if (!selectedId) {
      return (
        <div className="chat-thread-blank">
          <p>대화를 시작하세요</p>
          <span>아래에 메시지를 입력하면 바로 시작됩니다. 기록에서 이어볼 수도 있어요.</span>
        </div>
      );
    }
    if (detailState === "loading") {
      return (
        <div className="chat-thread-blank">
          <Loader2 className="lib-node-spin" size={20} aria-hidden />
          <p>불러오는 중</p>
        </div>
      );
    }
    if (detailState === "notfound") {
      return (
        <div className="chat-thread-blank">
          <AlertTriangle size={20} aria-hidden />
          <p>대화를 찾을 수 없음</p>
          <span>대화 이력을 불러올 수 없습니다.</span>
        </div>
      );
    }
    const messages = detail?.messages ?? [];
    if (messages.length === 0) {
      return (
        <div className="chat-thread-blank">
          <p>아직 메시지가 없습니다.</p>
          <span>아래에 첫 메시지를 입력해 대화를 시작하세요.</span>
        </div>
      );
    }
    return messages.map((m) => (
      <MessageBlock
        key={m.id}
        msg={m}
        user={user}
        typing={m.id === streamingId}
      />
    ));
  }

  return (
    <aside className="dock">
      <div className="dock-head">
        <Sparkles size={15} aria-hidden />
        <span className="dock-title">{headTitle}</span>
        <div className="dock-head-actions">
          <button
            type="button"
            className={"dock-iconbtn" + (histOpen ? " active" : "")}
            onClick={() => setHistOpen((v) => !v)}
            title="대화 기록"
            aria-expanded={histOpen}
          >
            <Clock size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="dock-iconbtn"
            onClick={onNew}
            title="새 대화"
          >
            <Plus size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="dock-iconbtn"
            onClick={onClose}
            title="닫기"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        {histOpen && (
          <>
            <div
              className="dock-hist-backdrop"
              onClick={() => setHistOpen(false)}
            />
            <div className="dock-hist">
              <div className="dock-hist-head">대화 기록</div>
              {renderHistory()}
            </div>
          </>
        )}
      </div>

      {/* 근거 문서 + 모드 — 송신 payload 의 doc_id/edit_mode 로 함께 나간다. */}
      <div className="dock-ground">
        <FileText size={12} aria-hidden />
        <span>근거: {docTitle || "선택된 문서 없음"}</span>
        {docId && (
          <span className="dock-ground-mode">
            {editMode === "edit" ? (
              <>
                <Pencil size={11} aria-hidden /> 편집
              </>
            ) : (
              <>
                <Eye size={11} aria-hidden /> 보기
              </>
            )}
          </span>
        )}
      </div>

      <div className="ch-stream dock" ref={streamRef}>
        <div className="ch-stream-inner">{renderConversation()}</div>
      </div>

      {turnError && (
        <div className="chat-turn-error" role="alert">
          <AlertTriangle size={14} aria-hidden />
          {turnError}
        </div>
      )}
      <Composer onSend={handleSend} disabled={sending || creating} variant="dock" />
    </aside>
  );
}
