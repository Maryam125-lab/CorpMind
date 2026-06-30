import json
import re
import shutil
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.agents.coordinator import CorpMindCoordinator
from app.core.config import Settings
from app.models.schemas import Citation, DocumentInsight, DocumentSummary, QueryHistoryItem, QueryResponse
from app.rag.chunker import DocumentChunker
from app.rag.embeddings import build_embeddings
from app.rag.loader import DocumentLoader
from app.rag.vector_store import VectorStore


class DocumentService:
    STOP_WORDS = {
        "about",
        "after",
        "also",
        "and",
        "are",
        "because",
        "been",
        "between",
        "but",
        "can",
        "could",
        "from",
        "have",
        "into",
        "its",
        "may",
        "more",
        "must",
        "not",
        "our",
        "shall",
        "should",
        "that",
        "the",
        "their",
        "there",
        "this",
        "through",
        "was",
        "were",
        "which",
        "will",
        "with",
        "within",
        "you",
        "your",
    }
    RISK_TERMS = {
        "breach",
        "compliance",
        "confidential",
        "deadline",
        "delay",
        "dispute",
        "fine",
        "liability",
        "penalty",
        "risk",
        "termination",
        "violation",
    }

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.loader = DocumentLoader()
        self.chunker = DocumentChunker()
        self.vector_store = VectorStore(
            persist_path=settings.chroma_path,
            embeddings=build_embeddings(settings.openai_api_key),
        )
        self.coordinator = CorpMindCoordinator(
            openai_api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
        self.manifest_path = settings.upload_path.parent / "documents.json"
        self.history_path = settings.upload_path.parent / "history.json"

    def list_documents(self) -> list[DocumentSummary]:
        return [
            DocumentSummary(**document)
            for document in sorted(
                self._read_manifest().values(),
                key=lambda item: item["uploaded_at"],
                reverse=True,
            )
        ]

    def get_document_insight(self, document_id: str) -> DocumentInsight | None:
        manifest = self._read_manifest()
        document = manifest.get(document_id)
        if not document:
            return None

        chunks = self.vector_store.list_document_chunks(document_id)
        text = " ".join(chunk["text"] for chunk in chunks)
        words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text.lower())
        pages = {
            chunk["metadata"].get("page")
            for chunk in chunks
            if chunk["metadata"].get("page")
        }
        terms = [
            word
            for word in words
            if word not in self.STOP_WORDS and len(word) > 3
        ]
        key_terms = [term for term, _ in Counter(terms).most_common(8)]
        risk_terms = sorted({term for term in words if term in self.RISK_TERMS})

        return DocumentInsight(
            **document,
            pages=max(len(pages), 1 if chunks else 0),
            words=len(words),
            estimated_read_minutes=max(1, round(len(words) / 220)) if words else 0,
            key_terms=key_terms,
            risk_terms=risk_terms,
            preview=self._snippet(text, limit=520) if text else "No indexed text preview is available.",
        )

    def list_history(self, limit: int = 10) -> list[QueryHistoryItem]:
        history = sorted(
            self._read_history(),
            key=lambda item: item["created_at"],
            reverse=True,
        )
        return [QueryHistoryItem(**item) for item in history[:limit]]

    def clear_history(self) -> None:
        self._write_history([])

    def ingest(self, file: UploadFile) -> DocumentSummary:
        original_name = file.filename or "document"
        safe_name = self._safe_filename(original_name)
        document_id = uuid4().hex
        saved_path = self.settings.upload_path / f"{document_id}_{safe_name}"

        with saved_path.open("wb") as output:
            shutil.copyfileobj(file.file, output)

        try:
            pages = self.loader.load(saved_path)
            chunks = self.chunker.split(pages)
            if not chunks:
                raise ValueError("No indexable text chunks were produced.")

            self.vector_store.add_chunks(document_id, original_name, chunks)
        except Exception:
            saved_path.unlink(missing_ok=True)
            raise

        summary = DocumentSummary(
            document_id=document_id,
            filename=original_name,
            chunks=len(chunks),
            uploaded_at=datetime.now(UTC),
        )
        manifest = self._read_manifest()
        manifest[document_id] = summary.model_dump(mode="json")
        self._write_manifest(manifest)
        return summary

    def delete(self, document_id: str) -> bool:
        manifest = self._read_manifest()
        if document_id not in manifest:
            return False
        self.vector_store.delete_document(document_id)
        for path in self.settings.upload_path.glob(f"{document_id}_*"):
            path.unlink(missing_ok=True)
        del manifest[document_id]
        self._write_manifest(manifest)
        return True

    def query(
        self,
        question: str,
        top_k: int,
        document_ids: list[str] | None,
    ) -> QueryResponse:
        matches = self.vector_store.query(question, top_k=top_k, document_ids=document_ids)
        citations = [self._match_to_citation(match) for match in matches]
        agent_answer = self.coordinator.answer(question, matches, citations)
        response = QueryResponse(
            answer=agent_answer.answer,
            citations=citations,
            confidence=agent_answer.confidence,
            metadata={
                "matches": len(matches),
                "used_crewai": agent_answer.used_crewai,
                "uses_openai": bool(self.settings.openai_api_key),
                "vector_store": self.vector_store.backend_name,
            },
        )
        self._record_history(question, response)
        return response

    def _match_to_citation(self, match: dict) -> Citation:
        metadata = match["metadata"]
        page = metadata.get("page") or None
        return Citation(
            document_id=metadata.get("document_id", ""),
            filename=metadata.get("filename", "unknown"),
            page=page,
            chunk_id=match["chunk_id"],
            snippet=self._snippet(match["text"]),
            score=match["score"],
        )

    def _snippet(self, text: str, limit: int = 420) -> str:
        cleaned = " ".join(text.split())
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 3].rstrip() + "..."

    def _safe_filename(self, filename: str) -> str:
        stem = re.sub(r"[^a-zA-Z0-9_.-]+", "_", filename).strip("._")
        return stem or "document"

    def _read_manifest(self) -> dict:
        if not self.manifest_path.exists():
            return {}
        return json.loads(self.manifest_path.read_text(encoding="utf-8"))

    def _write_manifest(self, manifest: dict) -> None:
        self.manifest_path.write_text(
            json.dumps(manifest, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _record_history(self, question: str, response: QueryResponse) -> None:
        history = self._read_history()
        history.append(
            {
                "history_id": uuid4().hex,
                "question": question,
                "answer_preview": self._snippet(response.answer, limit=220),
                "citation_count": len(response.citations),
                "confidence": response.confidence,
                "created_at": datetime.now(UTC).isoformat(),
            }
        )
        self._write_history(history[-50:])

    def _read_history(self) -> list[dict]:
        if not self.history_path.exists():
            return []
        return json.loads(self.history_path.read_text(encoding="utf-8"))

    def _write_history(self, history: list[dict]) -> None:
        self.history_path.write_text(
            json.dumps(history, indent=2, sort_keys=True),
            encoding="utf-8",
        )
