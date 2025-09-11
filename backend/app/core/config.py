import os
from dotenv import load_dotenv

# 热重载支持：每次访问都重新加载环境变量
def reload_env():
    load_dotenv(override=True)

# 初始加载
reload_env()

class Settings:
    def __init__(self):
        self._env_cache = {}
        self._reload_settings()
    
    def _reload_settings(self):
        """重新加载所有设置"""
        reload_env()
        self._env_cache = {
            'OPENAI_API_KEY': os.getenv("OPENAI_API_KEY", "sk-kE7sYiXtSTNK6MLWMyV3oXOFYDJg9CYohKhhA6ZgGenvm7Fo"),
            'OPENAI_API_BASE': os.getenv("OPENAI_API_BASE", "https://api.kkyyxx.xyz/v1"),
            'OPENAI_MODEL_NAME': os.getenv("OPENAI_MODEL_NAME", "openai/gpt-oss-120b"),
            'DATABASE_URL': os.getenv("DATABASE_URL", ""),
            'DEBUG': os.getenv("DEBUG", "False").lower() == "true"
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
    
    def reload(self):
        """手动重载配置"""
        self._reload_settings()
    
    @property
    def openai_api_key(self) -> str:
        if not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in environment variables")
        return self.OPENAI_API_KEY
    
    @property
    def openai_api_base(self) -> str:
        return self.OPENAI_API_BASE
    
    @property
    def openai_model_name(self) -> str:
        return self.OPENAI_MODEL_NAME

settings = Settings()