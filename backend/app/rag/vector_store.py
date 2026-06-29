import json
import math
from collections.abc import Iterable
from pathlib import Path

from langchain_core.embeddings import Embeddings

from app.rag.chunker import TextChunk

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
except Exception:
    chromadb = None
    ChromaSettings = None


class VectorStore:
    def __init__(self, persist_path: Path, embeddings: Embeddings) -> None:
        if chromadb and ChromaSettings:
            self.backend = ChromaVectorStore(persist_path, embeddings)
        else:
            self.backend = LocalJsonVectorStore(persist_path, embeddings)

    @property
    def backend_name(self) -> str:
        return self.backend.backend_name

    def add_chunks(self, document_id: str, filename: str, chunks: list[TextChunk]) -> list[str]:
        return self.backend.add_chunks(document_id, filename, chunks)

    def query(
        self,
        question: str,
        top_k: int,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        return self.backend.query(question, top_k, document_ids)

    def delete_document(self, document_id: str) -> None:
        self.backend.delete_document(document_id)


class ChromaVectorStore:
    backend_name = "chromadb"

    def __init__(self, persist_path: Path, embeddings: Embeddings) -> None:
        self.embeddings = embeddings
        self.client = chromadb.PersistentClient(
            path=str(persist_path),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name="corpmind_documents",
            metadata={"hnsw:space": "cosine"},
        )

    def add_chunks(self, document_id: str, filename: str, chunks: list[TextChunk]) -> list[str]:
        ids = [f"{document_id}:{chunk.chunk_index}" for chunk in chunks]
        documents = [chunk.text for chunk in chunks]
        embeddings = self.embeddings.embed_documents(documents)
        metadatas = [
            {
                "document_id": document_id,
                "filename": filename,
                "page": chunk.page or 0,
                "chunk_index": chunk.chunk_index,
            }
            for chunk in chunks
        ]
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return ids

    def query(
        self,
        question: str,
        top_k: int,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        query_embedding = self.embeddings.embed_query(question)
        where = self._build_where(document_ids)
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        return self._flatten_query_result(result)

    def delete_document(self, document_id: str) -> None:
        self.collection.delete(where={"document_id": document_id})

    def _build_where(self, document_ids: list[str] | None) -> dict | None:
        if not document_ids:
            return None
        if len(document_ids) == 1:
            return {"document_id": document_ids[0]}
        return {"document_id": {"$in": document_ids}}

    def _flatten_query_result(self, result: dict) -> list[dict]:
        ids: Iterable[str] = result.get("ids", [[]])[0]
        documents: Iterable[str] = result.get("documents", [[]])[0]
        metadatas: Iterable[dict] = result.get("metadatas", [[]])[0]
        distances: Iterable[float] = result.get("distances", [[]])[0]

        matches: list[dict] = []
        for chunk_id, text, metadata, distance in zip(ids, documents, metadatas, distances, strict=False):
            matches.append(
                {
                    "chunk_id": chunk_id,
                    "text": text,
                    "metadata": metadata or {},
                    "score": round(1 - float(distance), 4),
                }
            )
        return matches


class LocalJsonVectorStore:
    backend_name = "local-json"

    def __init__(self, persist_path: Path, embeddings: Embeddings) -> None:
        self.embeddings = embeddings
        self.persist_path = persist_path
        self.persist_path.mkdir(parents=True, exist_ok=True)
        self.store_path = self.persist_path / "local_vectors.json"

    def add_chunks(self, document_id: str, filename: str, chunks: list[TextChunk]) -> list[str]:
        records = self._read_records()
        ids = [f"{document_id}:{chunk.chunk_index}" for chunk in chunks]
        documents = [chunk.text for chunk in chunks]
        vectors = self.embeddings.embed_documents(documents)

        for chunk_id, chunk, vector in zip(ids, chunks, vectors, strict=False):
            records.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk.text,
                    "embedding": vector,
                    "metadata": {
                        "document_id": document_id,
                        "filename": filename,
                        "page": chunk.page or 0,
                        "chunk_index": chunk.chunk_index,
                    },
                }
            )

        self._write_records(records)
        return ids

    def query(
        self,
        question: str,
        top_k: int,
        document_ids: list[str] | None = None,
    ) -> list[dict]:
        query_embedding = self.embeddings.embed_query(question)
        allowed_ids = set(document_ids or [])
        matches = []

        for record in self._read_records():
            metadata = record["metadata"]
            if allowed_ids and metadata.get("document_id") not in allowed_ids:
                continue
            score = self._cosine_similarity(query_embedding, record["embedding"])
            matches.append(
                {
                    "chunk_id": record["chunk_id"],
                    "text": record["text"],
                    "metadata": metadata,
                    "score": round(score, 4),
                }
            )

        return sorted(matches, key=lambda item: item["score"], reverse=True)[:top_k]

    def delete_document(self, document_id: str) -> None:
        records = [
            record
            for record in self._read_records()
            if record["metadata"].get("document_id") != document_id
        ]
        self._write_records(records)

    def _read_records(self) -> list[dict]:
        if not self.store_path.exists():
            return []
        return json.loads(self.store_path.read_text(encoding="utf-8"))

    def _write_records(self, records: list[dict]) -> None:
        self.store_path.write_text(
            json.dumps(records),
            encoding="utf-8",
        )

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        dot = sum(a * b for a, b in zip(left, right, strict=False))
        left_norm = math.sqrt(sum(value * value for value in left))
        right_norm = math.sqrt(sum(value * value for value in right))
        if left_norm == 0 or right_norm == 0:
            return 0.0
        return dot / (left_norm * right_norm)
