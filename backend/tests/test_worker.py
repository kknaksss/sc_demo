"""open-kknaks 워커 부팅 골격 검증 (SC-WP-01 C4).

C4 범위 = "워커가 뜨고 redis 에 붙는다"까지 → import 성공 + config/worker 구성이
크래시 없이 된다(실 redis 연결 없이도 객체 생성 가능). 실제 잡 처리는 WP-05.
"""

from app.config import settings


def test_open_kknaks_import():
    """open-kknaks 핵심 심볼 import 성공(의존성 vendoring 검증)."""
    from open_kknaks import ClaudeConfig, RedisBroker  # noqa: F401
    from open_kknaks.worker.worker import ClaudeWorker  # noqa: F401


def test_build_config_uses_library_workdir():
    """ClaudeConfig.work_dir 가 도서관 docs 마운트 경로로 설정된다."""
    from app.worker.__main__ import build_config

    cfg = build_config()
    assert cfg.work_dir == settings.worker_work_dir


def test_build_worker_constructs_without_redis():
    """RedisBroker/ClaudeWorker 구성이 실제 연결 없이도 크래시 없이 된다."""
    from open_kknaks import RedisBroker

    from app.worker.__main__ import build_worker

    broker = RedisBroker(url=settings.redis_url, namespace=settings.worker_namespace)
    worker = build_worker(broker)

    assert worker.queues == [
        q.strip() for q in settings.worker_queues.split(",") if q.strip()
    ]
    assert worker.concurrency == settings.worker_concurrency
    assert worker.config.work_dir == settings.worker_work_dir
