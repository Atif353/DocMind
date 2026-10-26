import hmac

from fastapi import Header, HTTPException, status

from app.config import settings


def verify_internal_key(x_internal_api_key: str | None = Header(default=None)) -> None:
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, settings.internal_api_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service credentials")
