"use client";

// SC-WP-05 C5c(shell) — 개인스페이스 AI 도크 (surface=personal thread REST 연동).
// 디자인 SoT: myspace.jsx 의 <DockChat> + chat.jsx 의 DockHistory + onto.css 의 .dock-* 클래스.
//
// 이 commit(PLAN-105-T-006) 범위:
//   - 헤더: 제목 + 대화기록 토글(드롭다운) · 새 대화 · 닫기(X).
//   - ground: 근거 문서(docTitle) + 편집/보기 모드 표시(전달만, 동작 X).
//   - 본문: 선택 thread 이력(getThread) 메시지 스트림(MessageBlock 재사용) + 빈/로딩/오류.
//   - 하단: Composer(variant="dock") 재사용 — send 는 스텁(seam). 실제 송신 X.
//   - surface=personal 만 조회 — 사이드바 chat(C5a)과 안 섞인다.
//
// ★ C5b 가 연결할 seam:
//   (a) handleSend — 지금은 안내만. WS /ws/chat/{id} 송신 + 낙관적 추가로 교체.
//   (b) docId / editMode — WS 송신 payload 의 doc_id / edit_mode 로 쓸 자리(지금은 표시·전달만).
// ★ 디자인 mock(chat.jsx)은 preview/isNew 같은 필드를 갖지만 REST 계약(ChatThreadMeta)엔
//   없다 — 없는 필드는 만들지 말고(degrade) 생략한다. "새 대화"는 isNew 가짜 row 가 아니라
//   헤더 + 버튼 → createThread("personal")(C5a onNew 와 동일 패턴).

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
  type ChatThreadMeta,
  type ChatThreadDetail,
} from "@/lib/chat";
import MessageBlock from "./MessageBlock";
import Composer from "./Composer";

type ListState = "loading" | "loaded" | "error";
type DetailState = "idle" | "loading" | "loaded" | "notfound";

export default function DockChat({
  docId,
  docTitle,
  editMode,
  user,
  onClose,
}: {
  /** 현재 열린 개인스페이스 문서 id — C5b WS 송신 payload 의 doc_id seam(지금은 전달만). */
  docId: string | null;
  /** 근거 문서 제목 — ground 바 표시용(display only). */
  docTitle: string | null;
  /** 에디터 보기/편집 모드 — C5b edit_mode seam(지금은 표시만, 동작 X). */
  editMode: "view" | "edit";
  user: User;
  onClose: () => void;
}) {
  const [listState, setListState] = useState<ListState>("loading");
  const [threads, setThreads] = useState<ChatThreadMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailState, setDetailState] = useState<DetailState>("idle");
  const [detail, setDetail] = useState<ChatThreadDetail | null>(null);

  const [histOpen, setHistOpen] = useState(false);

  // send 스텁 안내(컴포저 seam) — C5b 가 WS 송신으로 교체하면 제거.
  const [sendNotice, setSendNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamRef = useRef<HTMLDivElement>(null);

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

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

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

  // ★ send seam(C5c 스텁): 실제 송신 없이 안내만. C5b 가 WS 송신 + 낙관적 추가로 교체.
  //   교체 시 docId/editMode 를 payload 의 doc_id/edit_mode 로 함께 보낸다.
  const handleSend = (_text: string) => {
    setSendNotice(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setSendNotice(false), 3200);
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
          <span>새 대화 버튼으로 시작하거나 기록에서 이어가세요.</span>
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
    return messages.map((m) => <MessageBlock key={m.id} msg={m} user={user} />);
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

      {/* 근거 문서 + 모드 — 표시·전달만(C5b 가 doc_id/edit_mode 로 송신). */}
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

      {sendNotice && (
        <div className="chat-send-notice">
          실시간 응답은 곧 연결됩니다 (WS · C5b).
        </div>
      )}
      <Composer onSend={handleSend} variant="dock" />
    </aside>
  );
}
