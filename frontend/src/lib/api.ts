// SC-WP-01 C3 / SC-WP-02 C4 — API 연동 베이스.
//
// 백엔드 base URL 은 NEXT_PUBLIC_API_BASE 로 주입(build-time inline). compose 의
// frontend 서비스엔 아직 env 가 없으므로 dev 기본값(host 33080)을 코드에 둔다.
//
// 주의: /health 는 백엔드 루트(prefix 없음), 도메인 API 는 /api prefix (SC-SPEC-05 §3).
// 그래서 base 에 /api 를 박지 않고, 도메인 호출에서만 prefix 를 붙인다.
//
// 인증은 httpOnly 쿠키 세션(SC-SPEC-03 SC-OPEN-07). cross-origin(base=33080) 에서도
// 쿠키가 저장·동반되도록 모든 호출에 credentials:"include" 를 강제한다.
// (BE 는 Access-Control-Allow-Credentials:true + 명시적 Origin 응답 필요 — `*` 불가.)

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:33080";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** 백엔드 에러 코드(SC-SPEC 케이스 매트릭스: INVALID_CREDENTIALS / UNAUTHENTICATED 등). */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 본문이 비어있을 수 있는 응답(204/빈 body)을 안전하게 파싱. 빈 응답이면 undefined. */
async function parseBody<T>(res: Response): Promise<T | undefined> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  return JSON.parse(text) as T;
}

/** 백엔드 루트 기준 fetch 래퍼. 도메인 API 는 path 에 `/api/...` 를 넘긴다. */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // 에러 코드는 body 에서 best-effort 로 추출(없으면 status 만으로 던진다).
    let code: string | undefined;
    try {
      const body = (await parseBody<{
        code?: string;
        error?: { code?: string };
      }>(res)) ?? {};
      code = body.code ?? body.error?.code;
    } catch {
      // body 가 JSON 이 아니면 코드 없이 진행
    }
    throw new ApiError(res.status, `request failed: ${res.status}`, code);
  }

  return (await parseBody<T>(res)) as T;
}

export interface HealthResponse {
  status: string;
}

/** 백엔드 liveness 핑 — `GET /health` (prefix 없음). */
export function health(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
