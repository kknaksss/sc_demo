"use client";

// SC-WP-05 C5b — 채팅 WebSocket 훅 (surface-agnostic).
// 계약: C4 WS(PLAN-105-T-005, 라이브 검증) — `WS /ws/chat/{thread_id}`.
//
//   접속 : ${WS_BASE}/ws/chat/{thread_id}. 쿠키 sc_session 은 same-site 라 핸드셰이크에
//          자동 동반(추가 헤더 불필요). 거부(미인증/타인/부재) → 서버가 close → status "error".
//   송신 : send(payload) — 객체를 JSON 송신. payload shape 은 호출자가 결정:
//          사이드바 {content} / 도크 {content, doc_id, edit_mode}. ★ 그래서 payload-agnostic.
//   수신 : {type:"delta", text}(누적) · {type:"done", message{...}}(canonical 확정) ·
//          {type:"error", code, message}.
//
// ★ 재사용: 사이드바 ChatView(C5b)와 도크 DockChat(C5b-dock)이 같은 훅을 쓴다. 훅은 메시지
//   상태를 소유하지 않고 이벤트만 콜백으로 흘려보낸다 — surface 별 상태/낙관적 추가는 호출자.

import { useEffect, useRef, useState } from "react";

import { API_BASE } from "./api";
import type { ChatMessage } from "./chat";

/** API_BASE(http/https) → WS_BASE(ws/wss). ★ scheme 만 치환(호스트에 "http" 가 있어도 안전). */
export function wsBase(): string {
  if (API_BASE.startsWith("https://")) return "wss://" + API_BASE.slice(8);
  if (API_BASE.startsWith("http://")) return "ws://" + API_BASE.slice(7);
  // 상대/스킴리스 — 현재 origin 기준(브라우저에서만 호출됨).
  return API_BASE;
}

/** 연결 상태. error = 핸드셰이크 거부 또는 예기치 않은 종료(다음 턴 불가, 안내 필요). */
export type ChatSocketStatus = "idle" | "connecting" | "open" | "error";

/** 수신 done 이벤트의 canonical 메시지(C4 _message_event). */
interface DonePayload {
  id: string;
  role: "assistant";
  content: string;
  created_at?: string | null;
}

/** 호출자가 surface 별로 구현하는 이벤트 핸들러(누적/확정/에러는 호출자 상태에서). */
export interface ChatSocketHandlers {
  /** delta 토큰 — "타이핑 중" 말풍선에 누적. */
  onDelta?: (text: string) => void;
  /** done — 누적분을 canonical 로 교체(중복 제거). */
  onDone?: (message: ChatMessage) => void;
  /** error 이벤트(code 별 안내) — 에러 턴은 미저장. */
  onError?: (code: string, message: string) => void;
}

/**
 * threadId 에 묶인 WS 연결. threadId 가 바뀌면 기존 소켓 close + 새 연결(턴마다 재연결 X —
 * 멀티턴은 같은 소켓 유지, BE 가 session_id resume). 언마운트 시 close.
 *
 * @returns status(연결 상태) + send(payload→JSON 송신, open 아니면 false).
 */
export function useChatSocket(
  threadId: string | null,
  handlers: ChatSocketHandlers,
): {
  status: ChatSocketStatus;
  send: (payload: Record<string, unknown>) => boolean;
} {
  const [status, setStatus] = useState<ChatSocketStatus>("idle");
  const socketRef = useRef<WebSocket | null>(null);

  // 핸들러는 ref 로 최신화 — 콜백이 매 렌더 새 클로저라도 소켓 재연결 없이 최신 상태를 본다.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!threadId) {
      setStatus("idle");
      socketRef.current = null;
      return;
    }

    setStatus("connecting");
    const ws = new WebSocket(`${wsBase()}/ws/chat/${encodeURIComponent(threadId)}`);
    socketRef.current = ws;

    ws.onopen = () => setStatus("open");

    ws.onmessage = (ev) => {
      let data: unknown;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return; // 비-JSON 프레임 무시.
      }
      const h = handlersRef.current;
      const msg = data as { type?: string; text?: string; message?: DonePayload; code?: string; message_?: string };
      if (msg.type === "delta" && typeof msg.text === "string") {
        h.onDelta?.(msg.text);
      } else if (msg.type === "done" && msg.message) {
        h.onDone?.({
          id: msg.message.id,
          role: "assistant",
          content: msg.message.content,
          created_at: msg.message.created_at ?? undefined,
        });
      } else if (msg.type === "error") {
        const e = data as { code?: string; message?: string };
        h.onError?.(e.code ?? "UNKNOWN", e.message ?? "");
      }
    };

    // 서버측 종료(핸드셰이크 거부/스트림 중 단절) → 에러 상태. 의도적 close 는 아래 cleanup 이
    // 핸들러를 떼어내므로 여기로 오지 않는다.
    ws.onclose = () => setStatus("error");
    ws.onerror = () => setStatus("error");

    return () => {
      // ★ 핸들러를 먼저 떼어내고 close — 의도적 종료(thread 전환/언마운트/StrictMode 재마운트)는
      //   onclose/onmessage 를 발화시키지 않는다(뒤늦은 delta 가 새 thread 상태를 오염시키지 않음).
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      if (socketRef.current === ws) socketRef.current = null;
    };
  }, [threadId]);

  const send = (payload: Record<string, unknown>): boolean => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  };

  return { status, send };
}
