"""ChatMessageRepository.by_thread 이력 순서 회귀 (SC-WP-05, SC-SPEC-04 §4).

버그: 한 턴의 user/assistant 는 같은 트랜잭션에서 INSERT → PG `now()`=
transaction_timestamp() 라 `created_at` 이 **동일** → created_at 단독 정렬은 동률이라
순서 비결정적(heap 반환 순서에 의존, vacuum/update 후 뒤집힐 수 있음). fake-repo(메모리)
단위테스트는 add 마다 distinct wall-clock 을 찍어 못 잡는다 → live PG 라운드트립으로 잠근다.

role 타이브레이커(user→assistant)가 같은 created_at 에서도 user 를 앞에 고정하는지 검증.
DB 없으면 skip(= admin live gate).
"""

import uuid

import pytest

from app.db import async_session, engine
from app.models.chat import ChatMessage, ChatThread
from app.models.user import User
from app.repositories.chat import ChatMessageRepository


async def _pg_reachable() -> bool:
    try:
        async with engine.connect():
            return True
    except Exception:
        return False


async def test_by_thread_orders_user_before_assistant_same_txn() -> None:
    if not await _pg_reachable():
        pytest.skip("no postgres — 이력 순서 회귀는 admin gate")

    user_id = uuid.uuid4()
    thread_id = uuid.uuid4()

    # 선행: FK 유저 + thread.
    async with async_session() as s:
        s.add(
            User(
                id=user_id,
                email=f"hist-{user_id}@test.com",
                password_hash="x",
                display_name="H",
                org="t",
            )
        )
        s.add(ChatThread(id=thread_id, user_id=user_id, surface="chat"))
        await s.commit()

    try:
        # 한 턴 = 같은 트랜잭션에서 user→assistant 삽입(run_turn 과 동일). created_at server
        # default(now()) → 둘이 동일해진다(타이 유발).
        async with async_session() as s:
            repo = ChatMessageRepository(s)
            u = await repo.add(ChatMessage(thread_id=thread_id, role="user", content="질문"))
            a = await repo.add(
                ChatMessage(thread_id=thread_id, role="assistant", content="응답")
            )
            await s.commit()
            # 타이 전제 확인 — 같은 트랜잭션이라 created_at 동일.
            assert u.created_at == a.created_at

        # 재조회: 타이브레이커로 user 가 assistant 앞.
        async with async_session() as s:
            rows = await ChatMessageRepository(s).by_thread(thread_id)
            assert [(m.role, m.content) for m in rows] == [
                ("user", "질문"),
                ("assistant", "응답"),
            ]
    finally:
        async with async_session() as s:
            for m in await ChatMessageRepository(s).by_thread(thread_id):
                await s.delete(m)
            thread = await s.get(ChatThread, thread_id)
            if thread is not None:
                await s.delete(thread)
            user = await s.get(User, user_id)
            if user is not None:
                await s.delete(user)
            await s.commit()
