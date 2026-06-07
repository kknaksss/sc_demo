"""채팅 워커 패키지 — open-kknaks ClaudeWorker 기동 (SC-WP-01 C4).

단일 워커가 Redis 에 붙어 큐를 소비한다. 진입점은 `python -m app.worker`
(→ `__main__.py`). 실제 채팅 잡 처리(submit/stream/resume·세션·WS 브리지)는 WP-05.
"""
