import type { Metadata } from "next";

// 순서 중요: globals(@tailwind) → 디자인 토큰 → 셸/로그인 CSS.
// Tailwind preflight 뒤에 디자인 CSS 를 두어 시각을 디자인(claude-design/onto) 기준으로 고정한다.
import "./globals.css";
import "../styles/tokens.css";
import "../styles/onto.css";

export const metadata: Metadata = {
  title: "sc_demo",
  description: "mediness sc_demo — 도서관 · 개인스페이스 · 채팅",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
