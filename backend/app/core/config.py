import os
from dotenv import load_dotenv


# 热重载支持：每次访问都重新加载环境变量
def reload_env():
    load_dotenv(override=True)


# 初始加载
reload_env()


def _parse_int(value: str, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


class Settings:
    def __init__(self):
        self._env_cache = {}
        self._reload_settings()

    def _reload_settings(self):
        """重新加载所有设置"""
        reload_env()
        self._env_cache = {
            'OPENAI_API_KEY': os.getenv("OPENAI_API_KEY", ""),
            'OPENAI_API_BASE': os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1"),
            'OPENAI_MODEL_NAME': os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini"),
            'WRITING_LLM_JSON_FALLBACK': os.getenv("WRITING_LLM_JSON_FALLBACK", "true"),
            'DATABASE_URL': os.getenv("DATABASE_URL", ""),
            'DEBUG': os.getenv("DEBUG", "False").lower() == "true",
            'BACKEND_CORS_ORIGINS': os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"),
            'APP_SECRET_KEY': os.getenv("APP_SECRET_KEY", "dev-only-change-me"),
            'ACCESS_TOKEN_EXPIRE_MINUTES': _parse_int(
                os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"),
                60,
            ),
            'MODEL_SETTINGS_ENCRYPTION_KEY': os.getenv(
                "MODEL_SETTINGS_ENCRYPTION_KEY",
                "dev-only-model-settings-key-change-me",
            ),
        }

    @property
    def OPENAI_API_KEY(self) -> str:
        return self._env_cache['OPENAI_API_KEY']

    @property
    def OPENAI_API_BASE(self) -> str:
        return self._env_cache['OPENAI_API_BASE']

    @property
    def OPENAI_MODEL_NAME(self) -> str:
        return self._env_cache['OPENAI_MODEL_NAME']

    @property
    def DATABASE_URL(self) -> str:
        return self._env_cache['DATABASE_URL']

    @property
    def DEBUG(self) -> bool:
        return self._env_cache['DEBUG']

    @property
    def BACKEND_CORS_ORIGINS(self) -> list[str]:
        raw = self._env_cache['BACKEND_CORS_ORIGINS']
        if not raw:
            return []
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def WRITING_LLM_JSON_FALLBACK(self) -> str:
        return self._env_cache.get('WRITING_LLM_JSON_FALLBACK', 'true')

    @property
    def APP_SECRET_KEY(self) -> str:
        return self._env_cache['APP_SECRET_KEY']

    @property
    def ACCESS_TOKEN_EXPIRE_MINUTES(self) -> int:
        return int(self._env_cache['ACCESS_TOKEN_EXPIRE_MINUTES'])

    @property
    def MODEL_SETTINGS_ENCRYPTION_KEY(self) -> str:
        return self._env_cache['MODEL_SETTINGS_ENCRYPTION_KEY']

    def reload(self):
        """手动重载配置"""
        self._reload_settings()


settings = Settings()
