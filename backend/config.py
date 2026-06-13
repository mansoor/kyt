from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str
    SECRET_KEY: str
    ENCRYPTION_KEY: str = ""

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    INITIAL_ADMIN_EMAIL: str = "admin@teslamate.local"
    INITIAL_ADMIN_PASSWORD: str = "changeme"

    TESLA_CLIENT_ID: str = ""
    TESLA_CLIENT_SECRET: str = ""

    MQTT_HOST: str = "mosquitto"
    MQTT_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""

    GEOCODER_URL: str = "https://photon.komoot.io"

    CORS_ORIGINS: str = ""
    LOG_LEVEL: str = "INFO"
    TZ: str = "UTC"

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
