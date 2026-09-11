import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(env_path, override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(env_path), env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    DATA_DIR: str = "./data"
    REDIS_URL: str = "redis://localhost:6379/0"
    LOCAL_MODEL_URL: str = ""
    BLOCKCHAIN_RPC_URL: str = "http://127.0.0.1:8545"
    BLOCKCHAIN_CONTRACT_ADDRESS: str = ""
    BLOCKCHAIN_PRIVATE_KEY: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    INITIAL_ADMIN_USERNAME: str = "arhamk_17"
    INITIAL_ADMIN_EMAIL: str = "hiarham17@gmail.com"
    INITIAL_ADMIN_PASSWORD: str = ""


settings = Settings()


