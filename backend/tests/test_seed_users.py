"""유저 시드 + 해시 단위 테스트 (DB 없이 통과, SC-WP-02 C2).

idempotency 는 fake repo(dict 백업)로 로직만, 해시는 순수 함수로 검증한다.
실제 postgres 5행 적재/재실행 무중복은 리포트의 수동 검증(real-DB 더블런)이 SoT.
"""

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.seed.users import SEED_USERS, seed_users


class FakeUserRepo:
    """email 키 dict 백업 — by_email/add 만 흉내(seed_users 가 쓰는 표면)."""

    def __init__(self) -> None:
        self.by_email_store: dict[str, User] = {}

    async def by_email(self, email: str) -> User | None:
        return self.by_email_store.get(email)

    async def add(self, user: User) -> User:
        self.by_email_store[user.email] = user
        return user


# ── 해시 (순수 함수) ──


def test_hash_is_not_plaintext() -> None:
    h = hash_password("test1admin")
    assert h != "test1admin"
    assert h.startswith("$2")  # bcrypt 포맷


def test_verify_roundtrip() -> None:
    h = hash_password("test1admin")
    assert verify_password("test1admin", h) is True
    assert verify_password("wrong", h) is False


# ── 시드 ──


def test_seed_values_match_spec() -> None:
    assert len(SEED_USERS) == 5
    emails = [u[0] for u in SEED_USERS]
    assert emails == [f"test{i}@test.com" for i in range(1, 6)]
    for i, (email, plain, name, org) in enumerate(SEED_USERS, start=1):
        assert email == f"test{i}@test.com"
        assert plain == f"test{i}admin"
        assert name == f"Test {i}"
        assert org == "test"


async def test_seed_inserts_five_and_hashes() -> None:
    repo = FakeUserRepo()
    inserted = await seed_users(repo)
    assert inserted == 5
    assert len(repo.by_email_store) == 5
    # 평문 저장 금지 — 저장값은 해시이고 평문으로 검증 가능
    u1 = repo.by_email_store["test1@test.com"]
    assert u1.password_hash != "test1admin"
    assert verify_password("test1admin", u1.password_hash) is True
    assert u1.display_name == "Test 1"
    assert u1.org == "test"


async def test_seed_is_idempotent() -> None:
    repo = FakeUserRepo()
    first = await seed_users(repo)
    second = await seed_users(repo)
    assert first == 5
    assert second == 0  # 재실행 시 중복 삽입 없음
    assert len(repo.by_email_store) == 5
