"""채팅 API 스키마 (SC-WP-05 C2, SC-SPEC-04 §3 계약).

Pydantic(스키마) ↔ SQLAlchemy(모델) 분리. **응답 envelope 는 비대칭**(생성/목록/
단건이 서로 다른 필드 셋, FE 가 각각 의존, spec-04 §3) 이라 단일 응답 스키마를 두지
않고 router 가 dict 로 직접 조립한다(WP-04 personal 방식). 여기선 입력(생성)만 정의.
"""

from typing import Literal

from pydantic import BaseModel


class ThreadCreate(BaseModel):
    """새 대화방(thread) 생성 입력. `surface` 필수 — `chat`(사이드바)/`personal`(도크)
    만 허용(NOT NULL 스탬프, 능력 정책을 가름). Literal 로 그 외 값은 422 거부."""

    surface: Literal["chat", "personal"]
