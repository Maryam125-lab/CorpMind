import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  FileText,
  Loader2,
  Search,
  Trash2,
  UploadCloud
} from "lucide-react";
import { askQuestion, deleteDocument, listDocuments, uploadDocument } from "./api";

const sampleQuestions = [
  "What are the key obligations in this document?",
  "Summarize the main risks with citations.",
  "Which dates, parties, or requirements are mentioned?"
];

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    refreshDocuments();
  }, []);

  const selectedCount = useMemo(
    () => selectedIds.filter((id) => documents.some((doc) => doc.document_id === id)).length,
    [documents, selectedIds]
  );

  async function refreshDocuments() {
    try {
      const data = await listDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const uploaded = await uploadDocument(file);
      await refreshDocuments();
      setSelectedIds((current) => [...new Set([...current, uploaded.document_id])]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
      event.target.value = "";
    }
  }

  async function handleAsk(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy("ask");
    setError("");
    setAnswer(null);
    try {
      const data = await askQuestion({
        question: question.trim(),
        documentIds: selectedIds,
        topK
      });
      setAnswer(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleDelete(documentId) {
    setBusy(documentId);
    setError("");
    try {
      await deleteDocument(documentId);
      setSelectedIds((current) => current.filter((id) => id !== documentId));
      await refreshDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function toggleDocument(documentId) {
    setSelectedIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Application header">
        <div className="brand">
          <span className="brand-mark">
            <Brain size={24} strokeWidth={2.2} />
          </span>
          <div>
            <h1>CorpMind</h1>
            <p>Enterprise Document Q&amp;A</p>
          </div>
        </div>
        <div className="status-pill">
          <CheckCircle2 size={16} />
          <span>{documents.length} indexed</span>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="workspace">
        <aside className="sidebar" aria-label="Document library">
          <label className="upload-zone">
            <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} />
            {busy === "upload" ? <Loader2 className="spin" size={24} /> : <UploadCloud size={28} />}
            <span>Upload document</span>
          </label>

          <div className="panel-heading">
            <h2>Documents</h2>
            <span>{selectedCount} selected</span>
          </div>

          <div className="document-list">
            {documents.length === 0 ? (
              <div className="empty-state">
                <FileText size={28} />
                <p>No documents indexed yet.</p>
              </div>
            ) : (
              documents.map((document) => (
                <article
                  className={`document-row ${
                    selectedIds.includes(document.document_id) ? "selected" : ""
                  }`}
                  key={document.document_id}
                >
                  <button
                    className="document-main"
                    type="button"
                    onClick={() => toggleDocument(document.document_id)}
                  >
                    <FileText size={18} />
                    <span>
                      <strong>{document.filename}</strong>
                      <small>{document.chunks} chunks</small>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Delete ${document.filename}`}
                    title="Delete"
                    onClick={() => handleDelete(document.document_id)}
                    disabled={busy === document.document_id}
                  >
                    {busy === document.document_id ? (
                      <Loader2 className="spin" size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </article>
              ))
            )}
          </div>
        </aside>

        <section className="query-pane" aria-label="Question answering">
          <form className="ask-form" onSubmit={handleAsk}>
            <div className="question-box">
              <label htmlFor="question">Question</label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question about your indexed documents..."
                rows={5}
              />
            </div>

            <div className="controls-row">
              <label className="range-control">
                <span>Top matches</span>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={topK}
                  onChange={(event) => setTopK(Number(event.target.value))}
                />
                <strong>{topK}</strong>
              </label>

              <button className="primary-button" type="submit" disabled={busy === "ask"}>
                {busy === "ask" ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                <span>Ask</span>
              </button>
            </div>
          </form>

          <div className="sample-row">
            {sampleQuestions.map((sample) => (
              <button key={sample} type="button" onClick={() => setQuestion(sample)}>
                {sample}
              </button>
            ))}
          </div>

          <section className="answer-panel" aria-label="Answer">
            {answer ? (
              <>
                <div className="answer-header">
                  <h2>Answer</h2>
                  <span>{answer.confidence} confidence</span>
                </div>
                <p className="answer-text">{answer.answer}</p>
              </>
            ) : (
              <div className="empty-answer">
                <Brain size={36} />
                <p>Upload documents, select sources, and ask a question.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="citations-pane" aria-label="Citations">
          <div className="panel-heading">
            <h2>Citations</h2>
            <span>{answer?.citations?.length || 0}</span>
          </div>

          <div className="citation-list">
            {answer?.citations?.length ? (
              answer.citations.map((citation) => (
                <article className="citation-card" key={citation.chunk_id}>
                  <div className="citation-meta">
                    <strong>{citation.filename}</strong>
                    <span>
                      {citation.page ? `Page ${citation.page}` : "Text file"} / Score{" "}
                      {citation.score?.toFixed?.(2) ?? citation.score}
                    </span>
                  </div>
                  <p>{citation.snippet}</p>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <FileText size={28} />
                <p>No citations yet.</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
