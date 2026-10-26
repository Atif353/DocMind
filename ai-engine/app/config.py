import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = SERVICE_ROOT.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(SERVICE_ROOT / ".env")


def _integer(name: str, default: int, minimum: int, maximum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum or value > maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


@dataclass(frozen=True)
class Settings:
    app_env: str
    host: str
    port: int
    log_level: str
    gemini_api_key: str
    gemini_embedding_model: str
    gemini_chat_model: str
    gemini_fallback_models: tuple[str, ...]
    embedding_dimension: int
    brave_search_api_key: str
    internal_api_key: str
    upload_dir: Path
    vector_store_dir: Path
    chunk_size: int
    chunk_overlap: int

    @property
    def production(self) -> bool:
        return self.app_env == "production"


def load_settings() -> Settings:
    settings = Settings(
        app_env=os.getenv("APP_ENV", "development").lower(),
        host=os.getenv("AI_HOST", "127.0.0.1"),
        port=_integer("AI_PORT", 8000, 1, 65535),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
        gemini_chat_model=os.getenv("GEMINI_CHAT_MODEL", "gemini-3.8-flash"),
        gemini_fallback_models=tuple(
            name.strip() for name in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if name.strip()
        ),
        embedding_dimension=_integer("GEMINI_EMBEDDING_DIMENSION", 768, 128, 3072),
        brave_search_api_key=os.getenv("BRAVE_SEARCH_API_KEY", "").strip(),
        internal_api_key=os.getenv("INTERNAL_API_KEY", "").strip(),
        upload_dir=Path(os.getenv("DOCMIND_UPLOAD_DIR", PROJECT_ROOT / "backend" / "uploads")).resolve(),
        vector_store_dir=Path(os.getenv("VECTOR_STORE_DIR", SERVICE_ROOT / "vector_store")).resolve(),
        chunk_size=_integer("CHUNK_SIZE", 1200, 400, 4000),
        chunk_overlap=_integer("CHUNK_OVERLAP", 180, 0, 1000),
    )
    if settings.chunk_overlap >= settings.chunk_size:
        raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
    if len(settings.internal_api_key) < 32 or "replace-with" in settings.internal_api_key:
        raise ValueError("INTERNAL_API_KEY must contain at least 32 random characters")
    return settings


settings = load_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.vector_store_dir.mkdir(parents=True, exist_ok=True)
