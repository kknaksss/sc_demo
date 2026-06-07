// SC-WP-02 C4 — 인증 API 클라이언트 (SC-SPEC-03 §3 계약).
//
// 계약: POST /api/auth/login · POST /api/auth/logout · GET /api/auth/me.
// 인증 자격 = httpOnly 쿠키 세션 → JS 가 토큰을 보관하지 않고, apiFetch 의
// credentials:"include" 로 쿠키가 자동 동반된다.
//
// 응답 envelope 가 호출마다 다르다(주의):
//   - login: { data: { user: {...} } }
//   - me:    { data: {...} }          (필드가 data 바로 아래)

import { apiFetch } from "./api";

/** 로그인한 유저(외부 노출 식별 정보). 역할/권한 없음 — v1 동등(SC-OPEN-08). */
export interface User {
  id: string;
  email: string;
  display_name: string;
  org: string;
}

interface LoginResponse {
  data: { user: User };
}

interface MeResponse {
  data: User;
}

/** 이메일+비밀번호 검증 → 세션 발급(Set-Cookie). 실패 시 ApiError(code=INVALID_CREDENTIALS). */
export async function login(email: string, password: string): Promise<User> {
  const res = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.data.user;
}

/** 현재 로그인 유저(who am I). 미인증이면 ApiError(401, code=UNAUTHENTICATED). */
export async function me(): Promise<User> {
  const res = await apiFetch<MeResponse>("/api/auth/me");
  return res.data;
}

/** 세션 무효화 + 쿠키 만료. 응답 body 없음(204/200) — 반환값 없음. */
export async function logout(): Promise<void> {
  await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

/** 아바타 이니셜 — 표시이름 첫 글자(FE 표시 파생, schema 필드 아님). */
export function userInitial(user: User): string {
  return user.display_name.trim().charAt(0).toUpperCase() || "?";
}
