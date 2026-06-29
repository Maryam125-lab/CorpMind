from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DocumentSummary(BaseModel):
    document_id: str
    filename: str
    chunks: int
    uploaded_at: datetime


class Citation(BaseModel):
    document_id: str
    filename: str
    page: int | None = None
    chunk_id: str
    snippet: str
    score: float | None = None


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3)
    document_ids: list[str] | None = None
    top_k: int = Field(default=5, ge=1, le=12)


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryHistoryItem(BaseModel):
    history_id: str
    question: str
    answer_preview: str
    citation_count: int
    confidence: str
    created_at: datetime
