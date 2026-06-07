// SC-WP-01 C3 — API 연동 베이스 (skeleton).
//
// 백엔드 base URL 은 NEXT_PUBLIC_API_BASE 로 주입(build-time inline). compose 의
// frontend 서비스엔 아직 env 가 없으므로 dev 기본값(host 33080)을 코드에 둔다.
// build-arg 와이어링은 후속 WP.
//
// 주의: /health 는 백엔드 루트(prefix 없음), 도메인 API 는 /api prefix (SC-SPEC-05 §3).
// 그래서 base 에 /api 를 박지 않고, 도메인 호출에서만 prefix 를 붙인다.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:33080";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 백엔드 루트 기준 fetch 래퍼 골격. 도메인 API 는 path 에 `/api/...` 를 넘긴다. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export interface HealthResponse {
  status: string;
}

/** 백엔드 liveness 핑 — `GET /health` (prefix 없음). */
export function health(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
