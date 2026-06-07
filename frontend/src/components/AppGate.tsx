"use client";

// SC-WP-02 C4 — 인증 게이트(claude-design/onto/app.jsx 패턴).
// 마운트 시 GET /api/auth/me 로 현재 유저 확인 → 없으면 LoginScreen(전체화면),
// 있으면 Shell. 로그아웃/세션만료(UNAUTHENTICATED) → 게이트(로그인) 복귀.

import { useEffect, useState } from "react";

import { me, logout as apiLogout, type User } from "@/lib/auth";
import LoginScreen from "@/components/auth/LoginScreen";
import Shell from "@/components/shell/Shell";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; user: User }
  | { status: "anon" };

export default function AppGate() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // 최초 1회 현재 유저 조회. 미인증/세션만료/BE 미기동 → anon(로그인 게이트).
  useEffect(() => {
    let alive = true;
    me()
      .then((user) => {
        if (alive) setState({ status: "authed", user });
      })
      .catch(() => {
        if (alive) setState({ status: "anon" });
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // 서버 로그아웃 실패해도 클라이언트는 미인증으로 전환(게이트 복귀)
    }
    setState({ status: "anon" });
  };

  if (state.status === "loading") {
    // 인증 확인 중 — 깜빡임 방지용 빈 화면(페이지 배경만)
    return <div className="login" aria-busy />;
  }

  if (state.status === "anon") {
    return <LoginScreen onLogin={(user) => setState({ status: "authed", user })} />;
  }

  return <Shell user={state.user} onLogout={handleLogout} />;
}
