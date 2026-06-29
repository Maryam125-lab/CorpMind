from pathlib import Path

from pypdf import PdfReader

from app.rag.chunker import RawPage


class DocumentLoader:
    supported_extensions = {".pdf", ".txt", ".md"}

    def load(self, file_path: Path) -> list[RawPage]:
        extension = file_path.suffix.lower()
        if extension not in self.supported_extensions:
            allowed = ", ".join(sorted(self.supported_extensions))
            raise ValueError(f"Unsupported file type. Allowed: {allowed}")

        if extension == ".pdf":
            return self._load_pdf(file_path)

        return self._load_text(file_path)

    def _load_pdf(self, file_path: Path) -> list[RawPage]:
        reader = PdfReader(str(file_path))
        pages: list[RawPage] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(RawPage(text=text, page=index))
        if not pages:
            raise ValueError("No readable text found in this PDF.")
        return pages

    def _load_text(self, file_path: Path) -> list[RawPage]:
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        if not text.strip():
            raise ValueError("No readable text found in this file.")
        return [RawPage(text=text, page=None)]

