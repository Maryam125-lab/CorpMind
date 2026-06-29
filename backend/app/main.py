from functools import lru_cache

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.models.schemas import DocumentSummary, QueryHistoryItem, QueryRequest, QueryResponse
from app.services.document_service import DocumentService


app = FastAPI(title="CorpMind API", version="1.0.0")


@lru_cache
def get_document_service() -> DocumentService:
    return DocumentService(get_settings())


settings: Settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name}


@app.post("/documents", response_model=DocumentSummary)
def upload_document(
    file: UploadFile = File(...),
    service: DocumentService = Depends(get_document_service),
) -> DocumentSummary:
    try:
        return service.ingest(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/documents", response_model=list[DocumentSummary])
def list_documents(service: DocumentService = Depends(get_document_service)) -> list[DocumentSummary]:
    return service.list_documents()


@app.get("/history", response_model=list[QueryHistoryItem])
def list_history(service: DocumentService = Depends(get_document_service)) -> list[QueryHistoryItem]:
    return service.list_history()


@app.delete("/history")
def clear_history(service: DocumentService = Depends(get_document_service)) -> dict:
    service.clear_history()
    return {"deleted": True}


@app.delete("/documents/{document_id}")
def delete_document(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
) -> dict:
    deleted = service.delete(document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}


@app.post("/query", response_model=QueryResponse)
def query_documents(
    request: QueryRequest,
    service: DocumentService = Depends(get_document_service),
) -> QueryResponse:
    return service.query(
        question=request.question,
        top_k=request.top_k,
        document_ids=request.document_ids,
    )
