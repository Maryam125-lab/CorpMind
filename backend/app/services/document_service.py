import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.agents.coordinator import CorpMindCoordinator
from app.core.config import Settings
from app.models.schemas import Citation, DocumentSummary, QueryResponse
from app.rag.chunker import DocumentChunker
from app.rag.embeddings import build_embeddings
from app.rag.loader import DocumentLoader
from app.rag.vector_store import VectorStore


class DocumentService:
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

    def list_documents(self) -> list[DocumentSummary]:
        return [
            DocumentSummary(**document)
            for document in sorted(
                self._read_manifest().values(),
                key=lambda item: item["uploaded_at"],
                reverse=True,
            )
        ]

    def ingest(self, file: UploadFile) -> DocumentSummary:
        original_name = file.filename or "document"
        safe_name = self._safe_filename(original_name)
        document_id = uuid4().hex
        saved_path = self.settings.upload_path / f"{document_id}_{safe_name}"

        with saved_path.open("wb") as output:
            shutil.copyfileobj(file.file, output)

        pages = self.loader.load(saved_path)
        chunks = self.chunker.split(pages)
        if not chunks:
            raise ValueError("No indexable text chunks were produced.")

        self.vector_store.add_chunks(document_id, original_name, chunks)
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
        return QueryResponse(
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
