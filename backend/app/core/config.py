import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_API_BASE: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "gpt-4o")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
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