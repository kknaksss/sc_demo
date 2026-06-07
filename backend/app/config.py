"""애플리케이션 설정 — env 경유 (SC-SPEC-05 §3 스택).

DATABASE_URL / REDIS_URL 은 docker-compose 환경변수로 주입된다.
기본값은 컨테이너 DNS 기준(`postgres`/`redis`) — 로컬 실행 시 env 로 override.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://sc_demo:sc_demo@postgres:5432/sc_demo"
    redis_url: str = "redis://redis:6379/0"


settings = Settings()
