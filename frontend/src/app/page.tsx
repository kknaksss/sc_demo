// SC-WP-02 C4 — 진입점: 인증 게이트.
// 미인증이면 로그인 화면, 인증되면 사이드바 셸(3탭). 게이팅은 클라이언트에서.
import AppGate from "@/components/AppGate";

export default function Home() {
  return <AppGate />;
}
