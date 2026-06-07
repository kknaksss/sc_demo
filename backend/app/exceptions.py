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


# ── 도서관 docs (SC-SPEC-01 케이스 매트릭스) ──
# DOC_NOT_FOUND / INVALID_PATH 둘 다 404 — FE 는 동일 "찾을 수 없음" 상태로 수렴 표시.
# code 로 둘을 구분(traversal 시도 vs 단순 부재)해 서버 로그/디버깅에서 분별 가능.


class DocNotFoundError(AppError):
    """없는 문서/폴더 경로 (루트 안에 존재하지 않음)."""

    status_code = 404
    code = "DOC_NOT_FOUND"


class InvalidPathError(AppError):
    """docs 루트 밖 탈출 시도(`..`/절대경로/심링크). 정규화 후 루트 prefix 미일치."""

    status_code = 404
    code = "INVALID_PATH"


class UnsupportedFormatError(AppError):
    """렌더 4포맷(md/docx/xlsx/pdf) 외 raw 요청 — 415."""

    status_code = 415
    code = "UNSUPPORTED_FORMAT"
