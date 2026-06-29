# CorpMind Architecture

## RAG Pipeline

1. The user uploads a PDF or text file through the React frontend.
2. FastAPI saves the file and passes it to the document loader.
3. PDF pages or text files are parsed into raw text records with metadata.
4. LangChain's recursive splitter breaks text into overlapping chunks.
5. Each chunk is embedded and stored in ChromaDB with document metadata.
6. A question is embedded and used to retrieve the most relevant chunks.
7. The retrieval agent prepares grounded evidence.
8. The synthesis agent writes a concise answer and attaches citations.

## Why Chunking Matters

Large documents are too big to send to an LLM in one prompt. Chunking converts a document into smaller searchable passages. Overlap preserves context across boundaries, which improves retrieval quality when an answer spans two nearby paragraphs.

## Why ChromaDB

ChromaDB gives persistent vector search without needing a managed cloud database. That makes it suitable for a portfolio project because the whole system can run locally while still demonstrating real vector database concepts.

## Agent Responsibilities

Retrieval Agent:
- Finds relevant document chunks for the user question.
- Keeps source metadata attached to each retrieved passage.
- Filters evidence before synthesis.

Synthesis Agent:
- Answers only from retrieved evidence.
- Avoids unsupported claims.
- Produces citations that point back to the source chunks.

## API Surface

- `POST /documents` uploads and indexes a document.
- `GET /documents` lists uploaded documents.
- `POST /query` asks a question over the indexed corpus.
- `DELETE /documents/{document_id}` removes a document and its chunks.

