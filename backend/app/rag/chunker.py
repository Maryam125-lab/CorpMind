from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter


@dataclass(frozen=True)
class RawPage:
    text: str
    page: int | None


@dataclass(frozen=True)
class TextChunk:
    text: str
    page: int | None
    chunk_index: int


class DocumentChunker:
    def __init__(self, chunk_size: int = 900, chunk_overlap: int = 180) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def split(self, pages: list[RawPage]) -> list[TextChunk]:
        chunks: list[TextChunk] = []
        for page in pages:
            for text in self.splitter.split_text(page.text):
                cleaned = " ".join(text.split())
                if cleaned:
                    chunks.append(
                        TextChunk(
                            text=cleaned,
                            page=page.page,
                            chunk_index=len(chunks),
                        )
                    )
        return chunks

