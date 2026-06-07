"""애플리케이션 에러 계층 (SC-SPEC-05 §3, @api role).

도메인 서비스는 AppError 하위를 raise 하고, main.py 의 핸들러가 HTTP 응답으로 변환.
C2 는 base 계층만 — 도메인별 구체 에러는 후속 WP.
"""


class AppError(Exception):
    """모든 애플리케이션 에러의 베이스."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.code
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class UnauthenticatedError(AppError):
    status_code = 401
    code = "UNAUTHENTICATED"


class InvalidCredentialsError(AppError):
    """로그인 자격 불일치 (이메일 없음/비번 틀림 비구분 — 열거 공격 방지, SC-SPEC-03)."""

    status_code = 401
    code = "INVALID_CREDENTIALS"
