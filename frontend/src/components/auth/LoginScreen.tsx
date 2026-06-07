"use client";

// SC-WP-02 C4 — 로그인 화면(전체 화면 인증 게이트).
// 디자인 SoT: claude-design/onto/auth.jsx + SC-SPEC-03 §2 UX Contract(실측 문구/배치).
// v1 제외: 시드 quick-fill 목록·공통 비밀번호 노출(SC-SPEC-03 §2 PO 결정).

import { useState } from "react";
import { Mail, Lock } from "lucide-react";

import { ApiError } from "@/lib/api";
import { login, type User } from "@/lib/auth";

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const em = email.trim().toLowerCase();
    // 입력 누락 — FE 즉시 피드백(SC-SPEC-03 §2 실측 문구)
    if (!em || !password) {
      setError("이메일과 비밀번호를 입력하세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const user = await login(em, password);
      onLogin(user);
    } catch (err) {
      // 자격 불일치(INVALID_CREDENTIALS) / 그 외 실패 — 이메일 존재 여부 비구분, 단일 문구
      if (err instanceof ApiError && err.status >= 500) {
        setError("로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="nav-logo">M</div>
          <div>
            <div className="login-brand-name">mediness</div>
            <div className="login-brand-sub">온톨로지 워크스페이스</div>
          </div>
        </div>

        <h1 className="login-title">로그인</h1>
        <p className="login-desc">가입 절차 없이 로그인하세요.</p>

        <label className="login-field">
          <span className="login-label">이메일</span>
          <span className="login-input">
            <Mail size={15} aria-hidden />
            <input
              type="email"
              value={email}
              placeholder="name@test.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </span>
        </label>

        <label className="login-field">
          <span className="login-label">비밀번호</span>
          <span className="login-input">
            <Lock size={15} aria-hidden />
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
          </span>
        </label>

        {error && <div className="login-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary login-submit"
          disabled={submitting}
        >
          {submitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
      <div className="login-foot">데모 · 5 테스트 계정 · 역할 동등</div>
    </div>
  );
}
