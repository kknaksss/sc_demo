import type { Metadata } from "next";

import "./globals.css";

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
