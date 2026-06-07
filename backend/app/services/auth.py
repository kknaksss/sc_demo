"""인증 서비스 (SC-WP-02 C3) — 검증·세션 생성/복원/해제.

Router(app/api/auth) → **Service(여기)** → Repository(app/repositories/user).
비밀번호 검증은 core/security.verify_password 재사용, 세션은 core/session 저장소.
에러는 AppError 계층을 raise(router 가 HTTP 변환). 자격 불일치는 이메일 존재
여부를 구분하지 않는 단일 INVALID_CREDENTIALS(열거 공격 방지).
"""

import uuid

from app.core.security import hash_password, verify_password
from app.core.session import SessionStore
from app.exceptions import InvalidCredentialsError, UnauthenticatedError
from app.models.user import User
from app.repositories.user import UserRepository

# 미존재 이메일에도 bcrypt 1회를 태워 타이밍을 평준화(존재 여부 누출 방지). 모듈 1회 계산.
_DUMMY_HASH = hash_password("dummy-password-for-timing-equalization")


class AuthService:
    def __init__(self, repo: UserRepository, store: SessionStore) -> None:
        self.repo = repo
        self.store = store

    async def login(self, email: str, password: str) -> tuple[User, str]:
        """자격 검증 → 세션 발급. (유저, session id) 반환. 불일치 시 InvalidCredentialsError."""
        user = await self.repo.by_email(email)
        if user is None:
            # 타이밍 평준화 — 존재하는 유저와 동일하게 1회 verify 후 동일 에러.
            verify_password(password, _DUMMY_HASH)
            raise InvalidCredentialsError()
        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()
        sid = await self.store.create(str(user.id))
        return user, sid

    async def current_user(self, sid: str | None) -> User:
        """쿠키 세션 → 현재 유저. 미인증/만료/유실 시 UnauthenticatedError."""
        if not sid:
            raise UnauthenticatedError()
        user_id = await self.store.get(sid)
        if user_id is None:
            raise UnauthenticatedError()
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError as exc:  # 변조된 세션값 — 미인증 취급
            raise UnauthenticatedError() from exc
        user = await self.repo.by_id(user_uuid)
        if user is None:
            raise UnauthenticatedError()
        return user

    async def logout(self, sid: str | None) -> None:
        """서버측 세션 무효화. sid 없으면 no-op(이미 미인증)."""
        if sid:
            await self.store.delete(sid)
