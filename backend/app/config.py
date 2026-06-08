"""애플리케이션 설정 — env 경유 (SC-SPEC-05 §3 스택).

DATABASE_URL / REDIS_URL 은 docker-compose 환경변수로 주입된다.
기본값은 컨테이너 DNS 기준(`postgres`/`redis`) — 로컬 실행 시 env 로 override.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://sc_demo:sc_demo@postgres:5432/sc_demo"
    redis_url: str = "redis://redis:6379/0"

    # ── 쿠키 secure 분기 (PLAN-106-T-001) ──
    # 세션 쿠키의 Secure 속성. dev(http)=False(브라우저가 http 로도 쿠키 전송),
    # prod(https, NPM same-origin)=True. compose 가 env `COOKIE_SECURE=true` 로 override.
    cookie_secure: bool = False

    # CORS — FE(33000) ↔ BE(33080) cross-origin 쿠키 인증(SC-WP-02 C3). 자격(쿠키)
    # 동반 응답은 명시적 Origin 이 필수(와일드카드 `*` 불가) + allow_credentials.
    # env 로 override 가능(JSON 리스트). dev 기본 = FE 호스트 origin.
    cors_origins: list[str] = ["http://localhost:33000"]

    # ── 도서관 docs 루트 (SC-WP-03 C1 / SC-SPEC-01 §4 DB) ──
    # 읽기전용 시드(`medi-doc/`) FS 루트. 컨테이너 기본 = `/app/medi-doc :ro` 마운트
    # (SC-SPEC-05 §3 볼륨). dev 로컬 실행은 env `DOCS_ROOT` 로 레포 절대경로 override.
    # docs API(`/api/docs/*`)는 이 경로 하위 상대경로만 읽는다(밖 탈출 차단 = service).
    docs_root: str = "/app/medi-doc"

    # ── 개인스페이스 file_store 루트 (SC-WP-04 C1 / SC-SPEC-02 §4 DB) ──
    # 유저 문서 콘텐츠 본체(md 텍스트/비-md 원본 바이트)를 저장하는 read-write FS 루트.
    # 컨테이너 기본 = `/app/data/personal` (WP-01 `personal_data:rw` 마운트). dev 로컬
    # 실행은 env `PERSONAL_DATA_ROOT` 로 override. DB `personal_docs.file_path` 는 이
    # 루트 기준 상대경로를 저장(이식성) — file_store 가 루트 하위로 resolve(탈출 차단).
    personal_data_root: str = "/app/data/personal"

    # ── open-kknaks 워커 (SC-WP-01 C4 / SC-SPEC-04 §6 SC-OPEN-10) ──
    # 큐·워커·Redis 는 open-kknaks 내장 — 우리는 config 만 주입한다.
    # producer(AgentClient) 와 consumer(ClaudeWorker) 가 namespace/queue 를 공유해야
    # 하므로 WP-05 의 producer 도 아래 값을 참조한다(기본은 open-kknaks 디폴트와 일치).
    worker_work_dir: str = "/app/medi-doc"  # 도서관 docs 마운트(:ro) — 네이티브 파일 탐색 그라운딩
    worker_namespace: str = "open_kknaks"  # RedisBroker 네임스페이스 (open-kknaks 기본값)
    worker_queues: str = "default"  # 소비 큐(콤마 구분, AgentClient 기본 큐와 일치)
    worker_concurrency: int = 1  # 동시 처리 수 — placeholder, WP-05 에서 확정

    # ── 채팅 엔진(producer) 타임아웃 (SC-WP-05 C3 / SC-SPEC-04 케이스 매트릭스) ──
    # `engine_timeout_sec` = 워커 PTY 실행 상한(task `options.timeout_sec`, **int 필수** —
    # executor 가 isinstance(int) 아니면 DEFAULT_TIMEOUT 으로 떨어뜨린다). producer 의
    # `result()` 대기는 이 값 + 버퍼(엔진 내부)라야 PTY 가 아직 도는데 false ENGINE_TIMEOUT
    # 으로 끊지 않는다(C3 finalize). 임계/재시도 튜닝은 admin 라이브 게이트.
    engine_timeout_sec: int = 600


settings = Settings()
