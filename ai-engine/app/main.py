import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models import ProcessRequest, QueryRequest
from app.security import verify_internal_key
from app.services.answering import AnswerService
from app.services.vector_store import VectorStore

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)
store = VectorStore(settings)
answers = AnswerService(settings, store)
app = FastAPI(
    title="DocMind AI Engine",
    version="2.0.0",
    docs_url=None if settings.production else "/docs",
    redoc_url=None,
)


def safe_upload_path(value: str) -> Path:
    candidate = Path(value).resolve()
    try:
        candidate.relative_to(settings.upload_dir)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="File path is outside the upload directory"
        ) from error
    if candidate.suffix.lower() != ".pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF files are supported")
    if not candidate.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return candidate


@app.get("/health/live")
def live() -> dict:
    return {"status": "ok"}


@app.get("/health/ready")
def ready() -> dict:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gemini is not configured"
        )
    return {"status": "ready", "vectors": store.stats()["index_vectors"]}


@app.get("/health")
def health() -> dict:
    return {
        "status": "ready" if settings.gemini_api_key else "degraded",
        "gemini_configured": bool(settings.gemini_api_key),
        "web_search_configured": bool(settings.brave_search_api_key),
    }


@app.post("/process", dependencies=[Depends(verify_internal_key)])
async def process_document(payload: ProcessRequest) -> dict:
    file_path = safe_upload_path(payload.file_path)
    try:
        result = await run_in_threadpool(
            store.ingest,
            payload.doc_id,
            payload.doc_title or file_path.name,
            file_path,
        )
        return {"success": True, "chunk_count": result["stored"], "storage": result}
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except Exception as error:
        logger.exception("Document processing failed for %s", payload.doc_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Document processing failed"
        ) from error


@app.post("/query", dependencies=[Depends(verify_internal_key)])
def query_document(payload: QueryRequest) -> StreamingResponse:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Gemini is not configured"
        )
    allowed = list(dict.fromkeys(payload.allowed_doc_ids))
    if payload.doc_id and payload.doc_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Document is outside the allowed scope"
        )
    return StreamingResponse(
        answers.stream(payload.query.strip(), allowed, payload.doc_title),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@app.delete("/documents/{doc_id}", dependencies=[Depends(verify_internal_key)])
async def delete_document(doc_id: str) -> dict:
    removed = await run_in_threadpool(store.remove, doc_id)
    return {"success": True, "doc_id": doc_id, "removed_chunks": removed}


@app.get("/stats", dependencies=[Depends(verify_internal_key)])
def stats() -> dict:
    return store.stats()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=not settings.production)
