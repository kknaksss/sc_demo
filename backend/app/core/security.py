"""비밀번호 해시 유틸 (SC-WP-02 C2, SC-SPEC-03 §4).

bcrypt 로 해시/검증. **평문 저장 금지** — 시드(C2)와 로그인(C3)이 공유한다.
bcrypt 는 bytes 경계라 입력은 encode, 저장값은 decode 해 str 로 다룬다.
"""

import bcrypt


def hash_password(plain: str) -> str:
    """평문 비밀번호를 bcrypt 해시(str)로 변환 — DB `password_hash` 저장용."""
    digest = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())
    return digest.decode("utf-8")


def verify_password(plain: str, password_hash: str) -> bool:
    """평문이 저장된 해시와 일치하는지 검증 (로그인 자격 대조)."""
    return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("utf-8"))
