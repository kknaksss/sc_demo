"""httpOnly 쿠키 세션 저장소 (SC-WP-02 C3, SC-OPEN-07 해소).

서버가 세션을 만들어 httpOnly 쿠키로 발급하고(로그인), 쿠키의 session id 로
유저를 복원하며(me), 로그아웃 시 서버측 세션을 무효화한다. 쿠키엔 **session id**
만 담고 user_id 는 서버측 저장소에 둔다 → 서버가 진짜로 무효화할 수 있다.

저장소는 코드 SoT(인메모리 vs redis). 운영은 redis(`RedisSessionStore`) — 여러
워커/재기동 간 세션 공유. 테스트는 redis 없이 `InMemorySessionStore` 로 DI override.
redis 연결은 lazy(db.py 와 동일) — import/생성 시점에 접속하지 않는다.
"""

import secrets
from typing import Protocol

from redis.asyncio import Redis

from app.config import settings

# 쿠키 이름/세션 속성 = 코드 SoT. 7일 만료, dev http 라 secure=False, 동일 site
# (localhost:33000↔33080 은 port 만 다른 same-site)라 SameSite=Lax 로 충분히 동반된다.
SESSION_COOKIE = "sc_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7일


class SessionStore(Protocol):
    """세션 저장소 표면 — router/service 가 의존하는 최소 계약."""

    async def create(self, user_id: str) -> str:
        """새 session id 발급 + user_id 매핑 저장(TTL). 발급된 sid 반환."""
        ...

    async def get(self, sid: str) -> str | None:
        """session id → user_id (없거나 만료면 None)."""
        ...

    async def delete(self, sid: str) -> None:
        """세션 무효화(로그아웃). 없는 sid 도 안전."""
        ...


def _new_sid() -> str:
    """추측 불가한 session id (URL-safe 토큰)."""
    return secrets.token_urlsafe(32)


class InMemorySessionStore:
    """프로세스 인메모리 저장소 — 테스트/단일 프로세스용(재기동 시 소실)."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def create(self, user_id: str) -> str:
        sid = _new_sid()
        self._store[sid] = user_id
        return sid

    async def get(self, sid: str) -> str | None:
        return self._store.get(sid)

    async def delete(self, sid: str) -> None:
        self._store.pop(sid, None)


class RedisSessionStore:
    """redis 백엔드 저장소 — 키 `sess:{sid}` = user_id, TTL 만료(세션 만료=UNAUTHENTICATED)."""

    _KEY = "sess:{sid}"

    def __init__(self, client: Redis) -> None:
        self._redis = client

    async def create(self, user_id: str) -> str:
        sid = _new_sid()
        await self._redis.set(self._KEY.format(sid=sid), user_id, ex=SESSION_TTL_SECONDS)
        return sid

    async def get(self, sid: str) -> str | None:
        value = await self._redis.get(self._KEY.format(sid=sid))
        if value is None:
            return None
        return value.decode("utf-8") if isinstance(value, bytes) else value

    async def delete(self, sid: str) -> None:
        await self._redis.delete(self._KEY.format(sid=sid))


# 운영 싱글톤 — lazy redis 클라이언트(생성만으론 미접속). FastAPI 의존성이 이걸 반환,
# 테스트는 get_session_store 를 override 해 InMemorySessionStore 로 갈아끼운다.
_redis_store: RedisSessionStore | None = None


def get_session_store() -> SessionStore:
    """FastAPI 의존성 — 운영 세션 저장소(redis) 싱글톤."""
    global _redis_store
    if _redis_store is None:
        _redis_store = RedisSessionStore(Redis.from_url(settings.redis_url))
    return _redis_store
