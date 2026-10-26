import hashlib
import json
import logging
import os
import re
import threading
from pathlib import Path

import faiss
import numpy as np
from google import genai
from google.genai import types
from pypdf import PdfReader

from app.config import Settings
from app.services.text import chunk_pages

logger = logging.getLogger(__name__)
token_pattern = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9+#.-]+")


class VectorStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.dimension = settings.embedding_dimension
        self.index = faiss.IndexFlatIP(self.dimension)
        self.chunks: list[dict] = []
        self.lock = threading.RLock()
        self.client = genai.Client(
            api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=60000)
        ) if settings.gemini_api_key else None
        self.snapshot_path = settings.vector_store_dir / "snapshot.npz"
        self.index_path = settings.vector_store_dir / "faiss.index"
        self.metadata_path = settings.vector_store_dir / "metadata.json"
        self._load()

    def _load(self) -> None:
        if self.snapshot_path.exists():
            with np.load(self.snapshot_path, allow_pickle=False) as snapshot:
                manifest = json.loads(str(snapshot["manifest"].item()))
                if manifest["embedding_model"] != self.settings.gemini_embedding_model:
                    raise ValueError("Embedding model changed. Restore it or reindex all documents.")
                index = faiss.deserialize_index(snapshot["index"])
                chunks = manifest["chunks"]
            if index.d != self.dimension or index.ntotal != len(chunks):
                raise ValueError("Vector snapshot has an invalid dimension or record count")
            self.index, self.chunks = index, chunks
            return
        if not self.index_path.exists() and not self.metadata_path.exists():
            return
        try:
            loaded_index = faiss.read_index(str(self.index_path))
            with self.metadata_path.open("r", encoding="utf-8") as handle:
                chunks = json.load(handle)
            if loaded_index.d != self.dimension or loaded_index.ntotal != len(chunks):
                raise ValueError("Vector index and metadata do not match the configured dimension")
            self.index = loaded_index
            self.chunks = chunks
            logger.info("Loaded %s vector chunks", len(chunks))
        except Exception:
            logger.exception("Unable to load the vector store")
            raise

    def _persist(self, index, chunks: list[dict]) -> None:
        self.settings.vector_store_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.snapshot_path.with_suffix(".npz.tmp")
        manifest = json.dumps({
            "embedding_model": self.settings.gemini_embedding_model, "chunks": chunks
        }, ensure_ascii=False, separators=(",", ":"))
        with temporary.open("wb") as handle:
            np.savez_compressed(handle, index=faiss.serialize_index(index), manifest=np.asarray(manifest))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self.snapshot_path)

    def _embed(self, texts: list[str], task_type: str) -> np.ndarray:
        if not self.client:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        vectors: list[list[float]] = []
        embedding_two = self.settings.gemini_embedding_model.startswith("gemini-embedding-2")
        batch_size = 1 if embedding_two else 32
        for offset in range(0, len(texts), batch_size):
            batch = texts[offset : offset + batch_size]
            config = {"output_dimensionality": self.dimension}
            if embedding_two:
                is_query = task_type == "RETRIEVAL_QUERY"
                prefix = "task: search result | query: " if is_query else "title: none | text: "
                batch = [prefix + text for text in batch]
            else:
                config["task_type"] = task_type
            response = self.client.models.embed_content(
                model=self.settings.gemini_embedding_model,
                contents=batch,
                config=types.EmbedContentConfig(**config),
            )
            embeddings = response.embeddings or []
            if len(embeddings) != len(batch):
                raise RuntimeError("The embedding provider returned an unexpected vector count")
            vectors.extend(embedding.values for embedding in embeddings)
        array = np.asarray(vectors, dtype=np.float32)
        if array.ndim != 2 or array.shape[1] != self.dimension or not np.isfinite(array).all():
            raise RuntimeError("The embedding provider returned an unexpected vector shape")
        faiss.normalize_L2(array)
        return array

    def extract_pdf(self, file_path: Path) -> list[dict]:
        if file_path.stat().st_size > 50 * 1024 * 1024:
            raise ValueError("The PDF must be 50 MB or smaller")
        reader = PdfReader(str(file_path))
        if reader.is_encrypted:
            raise ValueError("Password-protected PDFs are not supported")
        if len(reader.pages) > 500:
            raise ValueError("The PDF must contain 500 pages or fewer")
        pages = []
        for number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": number, "text": text})
        return pages

    def ingest(self, doc_id: str, title: str, file_path: Path) -> dict:
        pages = self.extract_pdf(file_path)
        chunks = chunk_pages(pages, self.settings.chunk_size, self.settings.chunk_overlap)
        if not chunks:
            raise ValueError("No text could be extracted from the PDF")
        if len(chunks) > 5000:
            raise ValueError("The PDF exceeds the 5000-chunk processing limit")

        vectors = self._embed([chunk["text"] for chunk in chunks], "RETRIEVAL_DOCUMENT")
        records = [
            {
                "id": hashlib.sha256(f"{doc_id}:{position}:{chunk['text']}".encode()).hexdigest(),
                "doc_id": doc_id,
                "title": title,
                "text": chunk["text"],
                "page": chunk["page"],
            }
            for position, chunk in enumerate(chunks)
        ]

        with self.lock:
            next_index, next_chunks = self._without(doc_id)
            next_index.add(vectors)
            next_chunks.extend(records)
            self._persist(next_index, next_chunks)
            self.index, self.chunks = next_index, next_chunks
            total = len(self.chunks)
        return {"stored": len(records), "total": total}

    def _without(self, doc_id: str):
        keep = [index for index, chunk in enumerate(self.chunks) if chunk.get("doc_id") != doc_id]
        next_index = faiss.IndexFlatIP(self.dimension)
        if keep:
            vectors = np.vstack([self.index.reconstruct(index) for index in keep]).astype(np.float32)
            next_index.add(vectors)
        return next_index, [self.chunks[index] for index in keep]

    def remove(self, doc_id: str) -> int:
        with self.lock:
            next_index, next_chunks = self._without(doc_id)
            removed = len(self.chunks) - len(next_chunks)
            if removed:
                self._persist(next_index, next_chunks)
                self.index, self.chunks = next_index, next_chunks
            return removed

    def _keywords(self, query: str, allowed: set[str], limit: int) -> list[dict]:
        query_terms = set(token_pattern.findall(query.lower()))
        if not query_terms:
            return []
        scored = []
        for chunk in self.chunks:
            if chunk.get("doc_id") not in allowed:
                continue
            terms = set(token_pattern.findall(chunk.get("text", "").lower()))
            overlap = len(query_terms & terms)
            if overlap:
                scored.append((overlap / len(query_terms), chunk))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [chunk for _, chunk in scored[:limit]]

    def _mmr(self, query: np.ndarray, candidates: list[tuple[int, dict, float]], limit: int) -> list[dict]:
        vectors = np.vstack([self.index.reconstruct(item[0]) for item in candidates])
        relevance = vectors @ query
        selected: list[int] = []
        remaining = list(range(len(candidates)))
        while remaining and len(selected) < limit:
            if not selected:
                best = max(remaining, key=lambda index: relevance[index])
            else:
                best = max(
                    remaining,
                    key=lambda index: 0.65 * relevance[index]
                    - 0.35 * max(float(vectors[index] @ vectors[chosen]) for chosen in selected),
                )
            selected.append(best)
            remaining.remove(best)
        return [candidates[index][1] for index in selected]

    def search(self, query: str, allowed_doc_ids: list[str], limit: int = 5) -> list[dict]:
        allowed = set(allowed_doc_ids)
        if not allowed:
            return []

        with self.lock:
            if not self.chunks or self.index.ntotal == 0:
                return []
            try:
                query_vector = self._embed([query], "RETRIEVAL_QUERY")[0]
                scope = [index for index, chunk in enumerate(self.chunks) if chunk.get("doc_id") in allowed]
                if not scope:
                    return []
                scoped_index = faiss.IndexFlatIP(self.dimension)
                scoped_index.add(np.vstack([self.index.reconstruct(index) for index in scope]))
                fetch_count = min(max(limit * 8, 40), len(scope))
                scores, indices = scoped_index.search(query_vector.reshape(1, -1), fetch_count)
                candidates = [
                    (scope[int(index)], self.chunks[scope[int(index)]], float(score))
                    for score, index in zip(scores[0], indices[0], strict=False)
                    if index >= 0
                ]
                semantic = self._mmr(query_vector, candidates, limit) if candidates else []
            except Exception:
                logger.exception("Semantic retrieval failed; using keyword retrieval")
                semantic = []

            keyword = self._keywords(query, allowed, limit)
            merged = semantic + [chunk for chunk in keyword if chunk not in semantic]
            return merged[:limit]

    def stats(self) -> dict:
        with self.lock:
            return {
                "chunk_count": len(self.chunks),
                "document_count": len({chunk.get("doc_id") for chunk in self.chunks}),
                "index_vectors": int(self.index.ntotal),
                "embedding_model": self.settings.gemini_embedding_model,
                "chat_model": self.settings.gemini_chat_model,
            }
