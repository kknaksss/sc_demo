"""get_session unit-of-work 회귀 테스트 (SC-WP-04 C2 fix, PLAN-104-T-004).

버그: get_session 이 commit 하지 않아 personal 쓰기(repo.flush)가 요청 종료 시
롤백됨. fake-repo(메모리) 단위테스트로는 안 잡혀 admin live gate 에서 검출됨.

가드 2층:
1. **DB-free** — get_session 이 성공 시 commit / 예외 시 rollback 하는가(fake 세션).
   이번 버그의 직접 원인(commit 누락)을 DB 없이 항상 검증 = 회귀 잠금.
2. **live postgres** — create→별도 세션 재조회 라운드트립(영속 확인). DB 없으면 skip.
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.db import async_session, engine, get_session
from app.models.personal_doc import PersonalDoc
from app.models.user import User
from app.repositories.personal_doc import PersonalDocRepository
from app.services.file_store import PersonalFileStore
from app.services.personal import PersonalService

# ── 1. DB-free: get_session commit/rollback 계약 ──


class _FakeSession:
    def __init__(self) -> None:
        self.commit = AsyncMock()
        self.rollback = AsyncMock()


class _FakeSessionCM:
    """async_session() 대체 — async context manager 로 fake 세션 yield."""

    def __init__(self, session: _FakeSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeSession:
        return self._session

    async def __aexit__(self, *exc) -> bool:
        return False


async def test_get_session_commits_on_success(monkeypatch) -> None:
    fake = _FakeSession()
    monkeypatch.setattr("app.db.async_session", lambda: _FakeSessionCM(fake))

    gen = get_session()
    session = await gen.__anext__()
    assert session is fake
    # 제너레이터 정상 종료 → commit (이게 누락이 버그였다)
    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()

    fake.commit.assert_awaited_once()
    fake.rollback.assert_not_awaited()


async def test_get_session_rolls_back_on_exception(monkeypatch) -> None:
    fake = _FakeSession()
    monkeypatch.setattr("app.db.async_session", lambda: _FakeSessionCM(fake))

    gen = get_session()
    await gen.__anext__()
    # 요청 처리 중 예외 → rollback 후 재-raise (commit 안 함)
    with pytest.raises(ValueError):
        await gen.athrow(ValueError("boom"))

    fake.rollback.assert_awaited_once()
    fake.commit.assert_not_awaited()


# ── 2. live postgres: 교차 세션 영속 라운드트립 (DB 없으면 skip) ──


async def _pg_reachable() -> bool:
    try:
        async with engine.connect():
            return True
    except Exception:
        return False


async def test_create_persists_across_sessions() -> None:
    if not await _pg_reachable():
        pytest.skip("no postgres — live 영속 검증은 admin gate")

    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    # 선행: FK 대상 유저 1행 영속.
    async with async_session() as s:
        s.add(
            User(
                id=user_id,
                email=f"persist-{user_id}@test.com",
                password_hash="x",
                display_name="P",
                org="t",
            )
        )
        await s.commit()

    try:
        # get_session 의존성 경로로 personal_doc 영속 (repo.add=flush, get_session=commit).
        gen = get_session()
        session = await gen.__anext__()
        repo = PersonalDocRepository(session)
        await repo.add(
            PersonalDoc(
                id=doc_id,
                user_id=user_id,
                title="persist",
                format="md",
                editable=True,
                file_path=f"{user_id}/{doc_id}.md",
            )
        )
        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()  # 제너레이터 종료 → commit

        # 별도 세션에서 재조회 → 영속 확인 (commit 누락이면 None = 버그 재현).
        async with async_session() as s2:
            found = (
                await s2.execute(select(PersonalDoc).where(PersonalDoc.id == doc_id))
            ).scalar_one_or_none()
            assert found is not None
            assert found.title == "persist"
    finally:
        async with async_session() as s3:
            doc = await s3.get(PersonalDoc, doc_id)
            if doc is not None:
                await s3.delete(doc)
            user = await s3.get(User, user_id)
            if user is not None:
                await s3.delete(user)
            await s3.commit()


# ── 3. live postgres: PUT(title 변경) → updated_at 동기 접근 (MissingGreenlet 회귀) ──


async def test_save_md_with_title_updated_at_no_missing_greenlet(tmp_path) -> None:
    """PLAN-104-T-007 회귀: title 변경 PUT 후 응답 조립이 updated_at 을 만료 없이 읽는가.

    title 이 오면 DB 컬럼이 dirty → flush 가 UPDATE 발행 → onupdate(server-side now())
    인 updated_at 이 expire. repo.update 가 refresh 안 하면 라우터의 동기 `doc.updated_at`
    접근이 async 세션에서 lazy-load IO 를 시도해 MissingGreenlet(500). fake-repo 단위
    테스트로는 안 잡혀(expire 의미 없음) live DB 라운드트립으로 잠근다. DB 없으면 skip.
    """
    if not await _pg_reachable():
        pytest.skip("no postgres — MissingGreenlet 회귀 검증은 admin gate")

    user_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    store = PersonalFileStore(tmp_path)
    rel = store.save_text(user_id, doc_id, "md", "old body")

    # 선행: FK 유저 + 대상 md 문서 1행 영속.
    async with async_session() as s:
        s.add(
            User(
                id=user_id,
                email=f"greenlet-{user_id}@test.com",
                password_hash="x",
                display_name="G",
                org="t",
            )
        )
        s.add(
            PersonalDoc(
                id=doc_id,
                user_id=user_id,
                title="old title",
                format="md",
                editable=True,
                file_path=rel,
            )
        )
        await s.commit()

    try:
        # get_session(요청 스코프) 경로로 save_md(title 포함) — 라우터와 동일 흐름.
        gen = get_session()
        session = await gen.__anext__()
        service = PersonalService(PersonalDocRepository(session), store)
        doc = await service.save_md(user_id, doc_id, "new body", title="new title")

        # ★ 라우터가 응답 조립 시 하는 동기 접근. refresh 누락이면 여기서 MissingGreenlet.
        assert doc.updated_at is not None
        assert doc.title == "new title"

        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()  # 제너레이터 종료 → commit

        # 별도 세션 재조회 → title 영속 + updated_at 갱신(>created_at) 확인.
        async with async_session() as s2:
            found = await s2.get(PersonalDoc, doc_id)
            assert found is not None
            assert found.title == "new title"
            assert found.updated_at >= found.created_at
        # 본문(FS)도 반영.
        assert store.read_text(rel) == "new body"
    finally:
        async with async_session() as s3:
            doc = await s3.get(PersonalDoc, doc_id)
            if doc is not None:
                await s3.delete(doc)
            user = await s3.get(User, user_id)
            if user is not None:
                await s3.delete(user)
            await s3.commit()
