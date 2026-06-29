# CorpMind

Enterprise Document Q&A Assistant built with a RAG pipeline, ChromaDB, FastAPI, React, LangChain, OpenAI, and CrewAI-style agent orchestration.

## What It Does

CorpMind lets a user upload PDF or text documents, ask questions, and receive grounded answers with source citations. The backend parses uploaded files, splits text into chunks, embeds each chunk, stores vectors in ChromaDB, retrieves the most relevant chunks for a question, and asks a synthesis agent to produce a cited answer.

## Architecture

```text
React UI
  |
  | upload/query
  v
FastAPI
  |
  | parse + chunk
  v
LangChain text splitter
  |
  | embeddings
  v
ChromaDB vector database
  |
  | top-k retrieval
  v
Retrieval Agent -> Synthesis Agent
  |
  v
Answer + citations
```

## Project Structure

```text
backend/
  app/
    agents/          Multi-agent answer coordination
    core/            App settings
    models/          API schemas
    rag/             Loader, chunker, embeddings, Chroma store
    services/        Document ingestion and query service
    main.py          FastAPI app
frontend/
  src/               React app
docs/
  architecture.md    Portfolio architecture notes
```

## Backend Setup

Use Python 3.11 or 3.12 for the smoothest dependency support with CrewAI and ChromaDB.

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example .env
```

Add your OpenAI key to `.env`:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Run the API:

```powershell
uvicorn app.main:app --reload --port 8010
```

API docs will be available at `http://127.0.0.1:8010/docs`.

### Optional Full Stack

The default install is Windows-friendly and uses a local JSON vector store fallback when ChromaDB is not installed. To enable ChromaDB and CrewAI packages locally, install Microsoft C++ Build Tools first, then run:

```powershell
pip install -r requirements-full.txt
```

## Frontend Setup

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`.

## VS Code

Open the `CorpMind` folder in VS Code. The project includes `.vscode` tasks for creating the backend virtual environment, installing dependencies, running the FastAPI API, and running the React dev server.

## Portfolio Talking Points

- Built an end-to-end RAG system for document question answering.
- Implemented ingestion for PDF and text files with chunking and metadata tracking.
- Used ChromaDB as the vector database for persistent semantic retrieval.
- Added source citations by preserving document, page, chunk, and score metadata.
- Designed a multi-agent layer with retrieval and synthesis responsibilities.
- Exposed the workflow through FastAPI and a React interface.

## Notes

If `OPENAI_API_KEY` is missing, the backend falls back to deterministic local embeddings and extractive answers. This keeps the demo runnable, but the best portfolio-quality answers require OpenAI embeddings and chat completions.
