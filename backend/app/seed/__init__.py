"""유저 시드 패키지 (SC-WP-02 C2).

`python -m app.seed` (→ `__main__.py`) 가 entrypoint 의 시드 단계에서 호출된다.
시드 로직 자체는 `users.seed_users(repo)` — repository 주입이라 DB 없이 단위 검증 가능.
"""

from app.seed.users import SEED_USERS, seed_users

__all__ = ["SEED_USERS", "seed_users"]
