"""open-kknaks ClaudeWorker 기동 진입점 — `python -m app.worker`.

SC-WP-01 C4 (SC-SPEC-04 §6 SC-OPEN-10). **단일 워커**가 Redis 에 붙어 큐를 소비할
수 있는 골격까지가 본 commit 의 범위다. 실제 채팅 잡 처리(submit/stream/resume·
세션 발급/저장·WS 브리지·surface 게이팅)는 WP-05 에서 구현한다.

큐·워커·Redis 는 open-kknaks 내장(RedisBroker + ClaudeWorker) — 우리가 큐/워커를
짜지 않고 우리 config(`app.config.settings`)로 기동한다. resume 보장을 위해 워커는
하나뿐이다(compose `replicas: 1`).
"""

import asyncio
import logging

from open_kknaks import ClaudeConfig, RedisBroker
from open_kknaks.middleware.logging import LoggingMiddleware
from open_kknaks.middleware.retries import RetriesMiddleware
from open_kknaks.worker.worker import ClaudeWorker

from app.config import settings

logger = logging.getLogger("app.worker")


def build_config() -> ClaudeConfig:
    """ClaudeConfig 구성.

    `work_dir` = 도서관 docs 마운트(:ro) — Claude Code 네이티브 파일 도구로 직접
    탐색해 그라운딩한다(MCP 없음). disallowed_tools/permission_mode/max_turns/model
    등 **능력 정책(surface 게이팅)은 WP-05 에서 확정** — C4 는 기동 골격 + placeholder.
    """
    return ClaudeConfig(
        work_dir=settings.worker_work_dir,
        # NOTE(WP-05): surface 게이팅 — 사이드바(chat)=read-only 탐색,
        #   도크(personal)=edit_mode+md 일 때만 쓰기. disallowed_tools /
        #   permission_mode / max_turns / model 은 WP-05 에서 주입한다.
    )


def build_worker(broker: RedisBroker) -> ClaudeWorker:
    """우리 config 로 open-kknaks ClaudeWorker 를 구성(연결은 호출자 책임)."""
    return ClaudeWorker(
        broker=broker,
        config=build_config(),
        middleware=[LoggingMiddleware(), RetriesMiddleware()],
        queues=[q.strip() for q in settings.worker_queues.split(",") if q.strip()],
        concurrency=settings.worker_concurrency,
    )


async def wait_for_redis(
    broker: RedisBroker, *, attempts: int = 30, delay: float = 2.0
) -> bool:
    """redis 가 응답할 때까지 ping 재시도 — 없으면 크래시하지 않고 대기.

    끝까지 실패해도 예외를 올리지 않는다(ClaudeWorker 의 dequeue 루프가 자체적으로
    재시도하므로 워커는 idle 대기 상태로 부팅을 이어간다). 부팅 가시성을 위한 게이트.
    """
    for attempt in range(1, attempts + 1):
        try:
            await broker.redis.ping()
            logger.info("redis ready (attempt %d)", attempt)
            return True
        except Exception as exc:  # noqa: BLE001 — 연결 가능 여부만 확인, 모두 재시도
            logger.warning("redis unavailable (attempt %d/%d): %s", attempt, attempts, exc)
            await asyncio.sleep(delay)
    logger.error("redis unreachable after %d attempts — idle 대기로 진행", attempts)
    return False


async def run() -> None:
    """워커 부팅: RedisBroker 연결 → ClaudeWorker 기동(빈 큐면 idle 대기)."""
    broker = RedisBroker(url=settings.redis_url, namespace=settings.worker_namespace)
    await broker.connect()
    await wait_for_redis(broker)

    worker = build_worker(broker)
    logger.info(
        "starting ClaudeWorker (redis=%s, namespace=%s, queues=%s, work_dir=%s, concurrency=%d)",
        settings.redis_url,
        settings.worker_namespace,
        worker.queues,
        settings.worker_work_dir,
        worker.concurrency,
    )
    try:
        # run() 은 SIGTERM/SIGINT graceful stop 핸들러를 설치하고 인터럽트까지 대기한다.
        await worker.run()
    finally:
        await broker.close()
        logger.info("worker stopped, broker closed")


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    asyncio.run(run())


if __name__ == "__main__":
    main()
