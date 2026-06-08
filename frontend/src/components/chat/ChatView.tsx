"use client";

// SC-WP-05 C5a — 사이드바 풀스크린 채팅 (thread REST 연동).
// 디자인 SoT: chat.jsx 의 Chat (.chat / .chat-threads / .chat-main) + onto.css 채팅 클래스.
//
// 이 commit(PLAN-105-T-004) 범위:
//   - 좌: 대화방 목록(새 대화 + thread 리스트 + 빈 상태). surface=chat 만(도크 personal 제외).
//   - 우: 선택 thread 이력(getThread) 메시지 스트림 + 컴포저.
//   - 새 대화: POST createThread → 목록 prepend + 선택. 기존 thread: 이력 로드(빈=안내).
//   - ★ 메시지 송신(WS)·인용/툴/draft·도크는 후속(C5b/C5c). 컴포저 send 는 스텁(seam).
//
// BE 미기동/미인증 graceful: 목록 실패 → 에러 안내, 단건 실패(404/401) → 동일 안내로 수렴.

import { useEffect, useRef, useState } from "react";
import { Plus, Search, MessageSquare, AlertTriangle, Loader2 } from "lucide-react";

import type { User } from "@/lib/auth";
import {
  listThreads,
  createThread,
  getThread,
  threadTitle,
  type ChatThreadMeta,
  type ChatThreadDetail,
} from "@/lib/chat";
import MessageBlock from "./MessageBlock";
import Composer from "./Composer";

type ListState = "loading" | "loaded" | "error";
type DetailState = "idle" | "loading" | "loaded" | "notfound";

/** thread 목록 메타 타임스탬프 → 오늘=HH:MM / 그 외=MM/DD (없거나 파싱 실패면 빈값). */
function formatThreadTs(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * updated_at 기준 날짜 그룹(디자인 chat.jsx: 오늘 / 이번 주 / 이전). 서버가 updated_at desc
 * 정렬을 보장하므로 그룹 분류는 순서를 보존(stable). ts 없으면 "이전"으로.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
function groupThreads(
  threads: ChatThreadMeta[],
): { group: string; items: ChatThreadMeta[] }[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const buckets: Record<string, ChatThreadMeta[]> = {
    오늘: [],
    "이번 주": [],
    이전: [],
  };
  for (const t of threads) {
    const ms = t.updated_at ? new Date(t.updated_at).getTime() : NaN;
    let key: string;
    if (Number.isNaN(ms)) key = "이전";
    else if (ms >= startOfToday) key = "오늘";
    else if (ms >= startOfToday - 6 * DAY_MS) key = "이번 주";
    else key = "이전";
    buckets[key].push(t);
  }
  return ["오늘", "이번 주", "이전"]
    .map((group) => ({ group, items: buckets[group] }))
    .filter((g) => g.items.length > 0);
}

export default function ChatView({ user }: { user: User }) {
  const [listState, setListState] = useState<ListState>("loading");
  const [threads, setThreads] = useState<ChatThreadMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detailState, setDetailState] = useState<DetailState>("idle");
  const [detail, setDetail] = useState<ChatThreadDetail | null>(null);

  // send 스텁 안내(컴포저 seam) — C5b 가 WS 송신으로 교체하면 제거.
  const [sendNotice, setSendNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamRef = useRef<HTMLDivElement>(null);

  // 최초 진입: 내 thread 목록(surface=chat) 로드.
  useEffect(() => {
    let alive = true;
    listThreads("chat")
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
        // DOC/thread NOT_FOUND(404)/UNAUTHENTICATED(401)/BE 미기동 → 동일 안내로 수렴.
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
    try {
      const created = await createThread("chat");
      setThreads((ts) => [created, ...ts]);
      setSelectedId(created.id);
    } catch {
      // 생성 실패(미인증 등) — 목록 상태로 안내(이미 error 면 유지).
      setListState((s) => (s === "loaded" ? "error" : s));
    }
  };

  // ★ send seam(C5a 스텁): 실제 송신 없이 안내만. C5b 가 WS 송신 + 낙관적 추가로 교체.
  const handleSend = (_text: string) => {
    setSendNotice(true);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setSendNotice(false), 3200);
  };

  const selectedMeta = threads.find((t) => t.id === selectedId) ?? null;

  function renderThreadList() {
    if (listState === "loading") {
      return (
        <div className="chat-threads-empty">
          <Loader2 className="lib-node-spin" size={20} aria-hidden />
          <span>대화를 불러오는 중…</span>
        </div>
      );
    }
    if (listState === "error") {
      return (
        <div className="chat-threads-empty">
          <AlertTriangle size={20} aria-hidden />
          <div>대화를 불러올 수 없습니다</div>
          <span>로그인 상태를 확인해주세요.</span>
        </div>
      );
    }
    if (threads.length === 0) {
      return (
        <div className="chat-threads-empty">
          <MessageSquare size={20} aria-hidden />
          <div>아직 대화가 없습니다</div>
          <span>새 대화로 시작하세요.</span>
        </div>
      );
    }
    return groupThreads(threads).map((g) => (
      <div key={g.group}>
        <div className="chat-threads-group">{g.group}</div>
        {g.items.map((t) => {
          const ts = formatThreadTs(t.updated_at);
          return (
            <button
              key={t.id}
              type="button"
              className={"chat-thread" + (t.id === selectedId ? " active" : "")}
              onClick={() => setSelectedId(t.id)}
              aria-current={t.id === selectedId ? "true" : undefined}
            >
              <div className="chat-thread-title">{threadTitle(t)}</div>
              {ts && <div className="chat-thread-meta">{ts}</div>}
            </button>
          );
        })}
      </div>
    ));
  }

  function renderConversation() {
    if (!selectedId) {
      return (
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <MessageSquare size={26} aria-hidden />
          </div>
          <h2>대화를 선택하세요</h2>
          <p>좌측에서 대화를 열거나 새 대화를 시작하세요.</p>
        </div>
      );
    }
    if (detailState === "loading") {
      return (
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <Loader2 className="lib-node-spin" size={26} aria-hidden />
          </div>
          <h2>불러오는 중</h2>
          <p>{selectedMeta ? threadTitle(selectedMeta) : ""}</p>
        </div>
      );
    }
    if (detailState === "notfound") {
      return (
        <div className="chat-empty">
          <div className="chat-empty-icon warn">
            <AlertTriangle size={26} aria-hidden />
          </div>
          <h2>대화를 찾을 수 없음</h2>
          <p>대화 이력을 불러올 수 없습니다.</p>
        </div>
      );
    }
    // loaded — 메시지 스트림 + 컴포저. 빈 thread 는 안내.
    const messages = detail?.messages ?? [];
    return (
      <>
        <div className="ch-stream full" ref={streamRef}>
          <div className="ch-stream-inner">
            {messages.length === 0 ? (
              <div className="chat-thread-blank">
                <p>아직 메시지가 없습니다.</p>
                <span>아래에 첫 메시지를 입력해 대화를 시작하세요.</span>
              </div>
            ) : (
              messages.map((m) => (
                <MessageBlock key={m.id} msg={m} user={user} />
              ))
            )}
          </div>
        </div>
        {sendNotice && (
          <div className="chat-send-notice">
            실시간 응답은 곧 연결됩니다 (WS · C5b).
          </div>
        )}
        <Composer onSend={handleSend} />
      </>
    );
  }

  return (
    <div className="chat">
      <aside className="chat-threads">
        <div className="chat-threads-head">
          <button
            type="button"
            className="btn btn-primary chat-new"
            onClick={onNew}
          >
            <Plus size={14} aria-hidden /> 새 대화
          </button>
        </div>
        {/* 검색 — v1 비활성(표시만), Shell 검색란과 동일 처리. */}
        <div className="chat-threads-search" aria-disabled>
          <Search size={13} aria-hidden />
          <input placeholder="대화 검색" disabled aria-label="대화 검색 (준비 중)" />
        </div>
        <div className="chat-threads-list">{renderThreadList()}</div>
      </aside>
      <section className="chat-main">{renderConversation()}</section>
    </div>
  );
}
