"""애플리케이션 설정 — env 경유 (SC-SPEC-05 §3 스택).

DATABASE_URL / REDIS_URL 은 docker-compose 환경변수로 주입된다.
기본값은 컨테이너 DNS 기준(`postgres`/`redis`) — 로컬 실행 시 env 로 override.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://sc_demo:sc_demo@postgres:5432/sc_demo"
    redis_url: str = "redis://redis:6379/0"

    # CORS — FE(33000) ↔ BE(33080) cross-origin 쿠키 인증(SC-WP-02 C3). 자격(쿠키)
    # 동반 응답은 명시적 Origin 이 필수(와일드카드 `*` 불가) + allow_credentials.
    # env 로 override 가능(JSON 리스트). dev 기본 = FE 호스트 origin.
    cors_origins: list[str] = ["http://localhost:33000"]

    # ── 도서관 docs 루트 (SC-WP-03 C1 / SC-SPEC-01 §4 DB) ──
    # 읽기전용 시드(`medi-doc/`) FS 루트. 컨테이너 기본 = `/app/medi-doc :ro` 마운트
    # (SC-SPEC-05 §3 볼륨). dev 로컬 실행은 env `DOCS_ROOT` 로 레포 절대경로 override.
    # docs API(`/api/docs/*`)는 이 경로 하위 상대경로만 읽는다(밖 탈출 차단 = service).
    docs_root: str = "/app/medi-doc"

    # ── open-kknaks 워커 (SC-WP-01 C4 / SC-SPEC-04 §6 SC-OPEN-10) ──
    # 큐·워커·Redis 는 open-kknaks 내장 — 우리는 config 만 주입한다.
    # producer(AgentClient) 와 consumer(ClaudeWorker) 가 namespace/queue 를 공유해야
    # 하므로 WP-05 의 producer 도 아래 값을 참조한다(기본은 open-kknaks 디폴트와 일치).
    worker_work_dir: str = "/app/medi-doc"  # 도서관 docs 마운트(:ro) — 네이티브 파일 탐색 그라운딩
    worker_namespace: str = "open_kknaks"  # RedisBroker 네임스페이스 (open-kknaks 기본값)
    worker_queues: str = "default"  # 소비 큐(콤마 구분, AgentClient 기본 큐와 일치)
    worker_concurrency: int = 1  # 동시 처리 수 — placeholder, WP-05 에서 확정


settings = Settings()
