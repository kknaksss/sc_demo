"""인증 API 스키마 (SC-WP-02 C3, SC-SPEC-03 §3 계약).

Pydantic(스키마) ↔ SQLAlchemy(모델) 분리. 응답 envelope 는 router 가 dict 로
감싼다(login=`{data:{user}}`, me=`{data:{...}}` — 비대칭, FE 가 의존). 여기선
유저 표현(UserOut)과 로그인 입력(LoginRequest)만 정의한다.
"""

import uuid

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    """로그인 입력 — email+password.

    email 형식/길이는 코드 SoT(spec 미확정). 형식 강제(EmailStr)를 두지 않아
    빈 값/형식 불일치도 자격 검증으로 흘려 단일 `INVALID_CREDENTIALS` 로 수렴한다
    (이메일 존재 여부 비구분 — 열거 공격 방지).
    """

    email: str
    password: str


class UserOut(BaseModel):
    """외부 노출 유저 식별 정보 (SC-SPEC-03 §3). role 없음(v1 동등, SC-OPEN-08).

    id 는 uuid.UUID — pydantic v2 가 JSON 직렬화 시 문자열로 내보낸다.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    org: str
