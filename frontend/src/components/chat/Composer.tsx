"use client";

// SC-WP-05 C5a — 채팅 컴포저 (풀스크린 variant).
// 디자인 SoT: chat.jsx 의 Composer (.ch-composer.full — 중앙 라운드 입력 카드).
//
// ★ send seam: 이 컴포넌트는 textarea 텍스트만 로컬로 관리하고, 제출 시 onSend(text) 를
//   호출한다. 실제 송신(WS /ws/chat/{id} + 낙관적 메시지 추가)은 C5b 가 onSend 핸들러를
//   교체해 연결한다. C5a 의 onSend 는 스텁(안내만) — 실제 응답 없음이 정상.
//   첨부/@멘션/MCP pill 은 동작 미연동(C5b) → Shell 검색란처럼 inert(표시만).

import { useState } from "react";
import { Paperclip, AtSign, Send } from "lucide-react";

export default function Composer({
  onSend,
  disabled = false,
  variant = "full",
}: {
  /** 제출 seam — C5b 가 WS 송신 + 낙관적 추가로 교체. C5a 는 스텁 핸들러. */
  onSend: (text: string) => void;
  disabled?: boolean;
  /** 레이아웃 변형 — 풀스크린(기본, C5a) / 개인스페이스 도크 콤팩트(C5c). */
  variant?: "full" | "dock";
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <div className={"ch-composer " + variant}>
      <div className="ch-composer-inner">
        <textarea
          className="ch-textarea"
          placeholder="무엇이든 물어보세요 · @ 로 도서관 문서 멘션"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="메시지 입력"
        />
        <div className="ch-composer-bar">
          {/* 첨부/멘션 — 동작 미연동(C5b). 표시만(inert). */}
          <button type="button" className="ch-cbtn" title="첨부 (준비 중)" disabled>
            <Paperclip size={14} aria-hidden />
          </button>
          <button type="button" className="ch-cbtn" title="멘션 (준비 중)" disabled>
            <AtSign size={14} aria-hidden />
          </button>
          <span className="ch-model">● open-kknaks</span>
          <span className="ch-mcp-pill">MCP · 도서관 read · md write</span>
          <span className="ch-spacer" />
          <button
            type="button"
            className="ch-send"
            onClick={submit}
            disabled={disabled || !text.trim()}
          >
            <Send size={12} aria-hidden /> 전송
          </button>
        </div>
      </div>
    </div>
  );
}
