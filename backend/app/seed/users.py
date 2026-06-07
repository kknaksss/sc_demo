"""테스트 계정 5개 idempotent 시드 (SC-WP-02 C2, SC-SPEC-03 §4 시드 표 = SoT).

구체값(이메일/비번/표시이름/org)은 spec-03 §4 시드 표 그대로 — 임의 변경 금지.
비밀번호는 시드 시 bcrypt 해시로 저장(평문 금지). email 존재 시 skip → 재실행 안전.
"""

from app.core.security import hash_password
from app.models.user import User
from app.repositories.user import UserRepository

# spec-03 §4 시드 표 (SoT) — (email, 평문 비밀번호, 표시이름, org).
# 평문은 데모 로그인용 명시값이며 DB 엔 해시만 저장한다.
SEED_USERS: list[tuple[str, str, str, str]] = [
    ("test1@test.com", "test1admin", "Test 1", "test"),
    ("test2@test.com", "test2admin", "Test 2", "test"),
    ("test3@test.com", "test3admin", "Test 3", "test"),
    ("test4@test.com", "test4admin", "Test 4", "test"),
    ("test5@test.com", "test5admin", "Test 5", "test"),
]


async def seed_users(repo: UserRepository) -> int:
    """5 테스트 계정을 idempotent 하게 적재 — 신규 삽입 행 수를 반환.

    email 이 이미 있으면 skip(재기동/재실행 안전). 비밀번호는 해시 저장.
    """
    inserted = 0
    for email, plain, display_name, org in SEED_USERS:
        if await repo.by_email(email) is not None:
            continue
        await repo.add(
            User(
                email=email,
                password_hash=hash_password(plain),
                display_name=display_name,
                org=org,
            )
        )
        inserted += 1
    return inserted
