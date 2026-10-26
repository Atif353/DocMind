# DocMind

Private document Q&A with Retrieval-Augmented Generation. Upload PDFs, ask questions, and get streamed answers with page-level citations.

## Features

- Hybrid retrieval: Gemini embeddings + FAISS semantic search with MMR re-ranking, plus keyword matching
- Corrective RAG: relevance grading with optional Brave web-search fallback
- Answer faithfulness score returned with every response
- Streaming answers over Server-Sent Events
- Durable Postgres-backed ingestion queue with leases and retries
- JWT auth, bcrypt, role-based document access, per-user retrieval scoping
- Model fallback chain for resilience against Gemini capacity errors
- Dockerized services with health checks and non-root containers

## Architecture

```text
React (Vite) ──> Express gateway ──> FastAPI AI engine
                     │                    ├─ Gemini (embeddings + generation)
                     │                    ├─ FAISS vector index
                     │                    └─ Brave Search (optional)
                     └─ Supabase PostgreSQL (users, documents, chats, job queue)
```

| Folder | Purpose |
| --- | --- |
| `frontend/` | React UI, served by Nginx in production |
| `backend/` | API gateway: auth, uploads, chat, SSE proxy, ingestion worker |
| `ai-engine/` | PDF parsing, chunking, embeddings, retrieval, answer generation |
| `database/migrations/` | PostgreSQL schema |

## Quick start

1. Create a [Supabase](https://supabase.com) project and run `database/migrations/001_initial.sql`, then `002_document_jobs.sql`, in the SQL editor.
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, and two random 32+ character secrets (`JWT_SECRET`, `INTERNAL_API_KEY`).
3. Run:

```bash
docker compose up --build
```

Open http://localhost:3000.

## Local development

```bash
# AI engine (Python 3.12)
cd ai-engine && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --port 8000

# Gateway (Node 24)
cd backend && npm ci && npm run dev

# Frontend
cd frontend && npm ci && npm run dev
```

## Tests

```bash
cd backend && npm test
cd ai-engine && pytest && ruff check .
cd frontend && npm run build
```

## Notes

FAISS is single-writer, so run one AI-engine replica per vector volume. For horizontal scaling, swap in a shared vector database.
