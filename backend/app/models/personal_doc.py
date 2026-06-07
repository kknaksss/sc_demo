"""PersonalDoc SQLAlchemy model — `personal_docs` 테이블 (SC-SPEC-02 §4, SC-WP-04 C1).

개인스페이스의 유저 스코프 문서 **메타데이터**. 콘텐츠 본체(md 텍스트 / docx·xlsx·pdf
원본 바이트)는 DB 가 아니라 서버 FS 에 저장되고(`app/services/file_store.py`),
`file_path` 가 그 파일을 가리킨다.

- `user_id` FK→users.id (유저 격리 근거, SC-SPEC-03). 유저별 평면 목록 조회를 위해 index.
- `format` = `md`/`docx`/`xlsx`/`pdf`. enum vs varchar 는 코드 SoT — varchar 로 둔다
  (users 테이블 idiom 일치, 생성 가드는 service 레벨).
- `editable` = md `true`(인앱 편집) / 비-md `false`(보기 전용). 능력(capability)을 나타내며,
  보기↔편집 모드는 런타임 UI 상태라 DB 컬럼이 아니다(SC-SPEC-02 §4 판단).
- PK = UUID (users.id 와 동일 idiom).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# 인앱 생성/업로드 허용 포맷. md 만 editable(인앱 편집), 나머지는 보기 전용.
FORMATS = ("md", "docx", "xlsx", "pdf")


class PersonalDoc(Base):
    __tablename__ = "personal_docs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,  # 유저별 평면 목록 조회 (SC-SPEC-02 §4 인덱스)
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    format: Mapped[str] = mapped_column(String, nullable=False)
    editable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버그 표현
        return f"<PersonalDoc id={self.id} user_id={self.user_id} format={self.format!r}>"
