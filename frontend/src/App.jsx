import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  Filter,
  Layers3,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud
} from "lucide-react";
import { askQuestion, deleteDocument, listDocuments, uploadDocument } from "./api";

const sampleQuestions = [
  "Summarize the document with the most important decisions.",
  "What obligations, risks, and deadlines are mentioned?",
  "Which facts should I cite in a project explanation?"
];

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");

  useEffect(() => {
    refreshDocuments();
  }, []);

  const selectedCount = useMemo(
    () => selectedIds.filter((id) => documents.some((doc) => doc.document_id === id)).length,
    [documents, selectedIds]
  );

  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunks, 0),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const query = documentFilter.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.filename.toLowerCase().includes(query));
  }, [documents, documentFilter]);

  const selectedLabel = selectedCount ? `${selectedCount} selected` : "All sources";
  const vectorStore = answer?.metadata?.vector_store || "ready";

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

  function toggleAllDocuments() {
    if (selectedCount === documents.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(documents.map((document) => document.document_id));
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
            <p>Enterprise Document Q&amp;A Workspace</p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="status-pill">
            <CheckCircle2 size={16} />
            <span>API online</span>
          </div>
          <div className="status-pill muted">
            <Database size={16} />
            <span>{vectorStore}</span>
          </div>
        </div>
      </section>

      <section className="insight-strip" aria-label="Corpus summary">
        <Metric icon={FileText} label="Documents" value={documents.length} />
        <Metric icon={Layers3} label="Chunks indexed" value={totalChunks} />
        <Metric icon={Filter} label="Scope" value={selectedLabel} />
        <Metric icon={ShieldCheck} label="Citations" value={answer?.citations?.length || 0} />
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="workspace">
        <aside className="sidebar" aria-label="Document library">
          <label className="upload-zone">
            <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} />
            {busy === "upload" ? <Loader2 className="spin" size={24} /> : <UploadCloud size={28} />}
            <span>
              <strong>Upload source</strong>
              <small>PDF, TXT, or Markdown</small>
            </span>
          </label>

          <div className="panel-heading">
            <div>
              <h2>Source Library</h2>
              <p>{documents.length ? `${totalChunks} searchable chunks` : "No indexed files yet"}</p>
            </div>
            <button
              className="quiet-button"
              type="button"
              onClick={toggleAllDocuments}
              disabled={!documents.length}
            >
              {selectedCount === documents.length && documents.length ? "Clear" : "All"}
            </button>
          </div>

          <label className="search-field">
            <Search size={16} />
            <input
              value={documentFilter}
              onChange={(event) => setDocumentFilter(event.target.value)}
              placeholder="Filter sources"
            />
          </label>

          <div className="document-list">
            {filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <FileSearch size={30} />
                <p>{documents.length ? "No matching source." : "Upload a document to begin."}</p>
              </div>
            ) : (
              filteredDocuments.map((document) => (
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
                    <span className="file-icon">
                      <FileText size={18} />
                    </span>
                    <span>
                      <strong>{document.filename}</strong>
                      <small>
                        {document.chunks} chunks / {formatDate(document.uploaded_at)}
                      </small>
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
            <div className="query-header">
              <div>
                <h2>Ask the Corpus</h2>
                <p>{selectedIds.length ? "Scoped to selected sources" : "Searching all indexed sources"}</p>
              </div>
              <span className="confidence-chip">
                <Sparkles size={15} />
                {answer?.confidence || "ready"}
              </span>
            </div>

            <div className="question-box">
              <label htmlFor="question">Question</label>
              <textarea
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a grounded question about policies, contracts, reports, notes, or research..."
                rows={5}
              />
            </div>

            <div className="sample-row">
              {sampleQuestions.map((sample) => (
                <button key={sample} type="button" onClick={() => setQuestion(sample)}>
                  {sample}
                </button>
              ))}
            </div>

            <div className="controls-row">
              <label className="range-control">
                <span>Evidence depth</span>
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
                <span>{busy === "ask" ? "Searching" : "Ask"}</span>
              </button>
            </div>
          </form>

          <section className="answer-panel" aria-label="Answer">
            {answer ? (
              <>
                <div className="answer-header">
                  <div>
                    <h2>Grounded Answer</h2>
                    <p>
                      {answer.metadata?.matches || 0} matches /{" "}
                      {answer.metadata?.uses_openai ? "LLM synthesis" : "extractive synthesis"}
                    </p>
                  </div>
                  <span>{answer.confidence} confidence</span>
                </div>
                <p className="answer-text">{answer.answer}</p>
              </>
            ) : (
              <div className="empty-answer">
                <Brain size={36} />
                <p>Ask a question to generate an answer with traceable evidence.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="citations-pane" aria-label="Citations">
          <div className="panel-heading">
            <div>
              <h2>Evidence</h2>
              <p>{answer?.citations?.length ? "Ranked source passages" : "Waiting for a query"}</p>
            </div>
            <span className="count-badge">{answer?.citations?.length || 0}</span>
          </div>

          <div className="citation-list">
            {answer?.citations?.length ? (
              answer.citations.map((citation, index) => (
                <article className="citation-card" key={citation.chunk_id}>
                  <div className="citation-rank">{index + 1}</div>
                  <div className="citation-body">
                    <div className="citation-meta">
                      <strong>{citation.filename}</strong>
                      <span>
                        {citation.page ? `Page ${citation.page}` : "Text file"} / Score{" "}
                        {citation.score?.toFixed?.(2) ?? citation.score}
                      </span>
                    </div>
                    <div className="score-track">
                      <span style={{ width: `${Math.max((citation.score || 0) * 100, 8)}%` }} />
                    </div>
                    <p>{citation.snippet}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <ShieldCheck size={30} />
                <p>Citations will appear here after each answer.</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="metric-tile">
      <span>
        <Icon size={18} />
      </span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </article>
  );
}

export default App;
