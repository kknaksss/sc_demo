"use client";

// SC-WP-05 C5a — 채팅 메시지 블록 (user/assistant).
// 디자인 SoT: chat.jsx 의 Message/.ch-msg (좌우 말풍선, user 왼쪽 / AI 오른쪽).
//   - user: plain 텍스트(말풍선, whitespace 보존).
//   - assistant: 마크다운(react-markdown + remark-gfm). ★ 도서관 .doc-md 가 아니라 .ch-content
//     컨테이너로 렌더한다 — .doc-md 는 문서 스케일 타이포라 말풍선엔 과하다(디자인 100% 매핑).
//   - 인용/툴/draft 블록은 WS 이벤트(C5b) 범위라 여기서 만들지 않는다.

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";

import { userInitial, type User } from "@/lib/auth";
import type { ChatMessage } from "@/lib/chat";

/** ISO 타임스탬프 → HH:MM (파싱 실패/없으면 빈 문자열). */
function formatTs(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MessageBlock({
  msg,
  user,
}: {
  msg: ChatMessage;
  user: User;
}) {
  const isUser = msg.role === "user";
  const ts = formatTs(msg.created_at);

  return (
    <div className={"ch-msg " + (isUser ? "from-user" : "from-ai")}>
      <div className={"ch-avatar " + (isUser ? "user" : "ai")}>
        {isUser ? userInitial(user) : <Sparkles size={14} aria-hidden />}
      </div>
      <div className="ch-msg-body">
        <div className="ch-msg-head">
          <span className="ch-name">{isUser ? user.display_name : "Claude"}</span>
          {ts && <span className="ch-ts">{ts}</span>}
        </div>
        <div className="ch-bubble">
          <div className="ch-content">
            {isUser ? (
              // plain 텍스트 — 마크다운 해석 없이 줄바꿈만 보존.
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
            ) : (
              <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
