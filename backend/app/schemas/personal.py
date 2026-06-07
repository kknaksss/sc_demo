"""개인스페이스 API 스키마 (SC-WP-04 C2, SC-SPEC-02 §3 계약).

Pydantic(스키마) ↔ SQLAlchemy(모델) 분리. **응답 envelope 는 비대칭**(목록/생성/
단건/저장/업로드가 서로 다른 필드 셋, FE 가 각각 의존) 이라 단일 응답 스키마를 두지
않고 router 가 dict 로 직접 조립한다(spec-02 §3). 여기선 입력(생성/저장)만 정의.
"""

from pydantic import BaseModel


class PersonalDocCreate(BaseModel):
    """새 문서 생성 입력. v1 은 md 전용 — format 은 받되 md 외는 service 가
    `UNSUPPORTED_FORMAT`(400) 로 방어(UI 는 md 만 제공). default md."""

    title: str
    format: str = "md"


class PersonalDocUpdate(BaseModel):
    """md 저장(PUT) 입력 — 마크다운 content + 선택 title. md 문서에만 적용."""

    content: str
    title: str | None = None
