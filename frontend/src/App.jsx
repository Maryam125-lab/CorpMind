import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Eye,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  History,
  Layers3,
  LayoutDashboard,
  Loader2,
  MessageSquareText,
  Network,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  Wand2
} from "lucide-react";
import {
  askQuestion,
  clearHistory,
  deleteDocument,
  getDocumentInsights,
  healthCheck,
  listDocuments,
  listHistory,
  uploadDocument
} from "./api";

const sampleQuestions = [
  "Summarize the document with the most important decisions.",
  "What obligations, risks, and deadlines are mentioned?",
  "Which facts should I cite in a project explanation?"
];

const analysisModes = [
  {
    id: "answer",
    label: "Answer",
    icon: MessageSquareText,
    prefix: ""
  },
  {
    id: "risk",
    label: "Risk",
    icon: ShieldAlert,
    prefix:
      "Analyze this as an enterprise risk review. Highlight obligations, deadlines, missing context, and risk severity. Question: "
  },
  {
    id: "brief",
    label: "Brief",
    icon: ClipboardList,
    prefix:
      "Create a portfolio-ready executive brief with key findings, evidence, and action items. Question: "
  },
  {
    id: "compare",
    label: "Compare",
    icon: GitBranch,
    prefix:
      "Compare the selected sources and identify agreements, conflicts, and unique facts. Question: "
  }
];

const appViews = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    title: "Command Overview",
    description: "Corpus health, active scope, intelligence, and recent analysis in one place."
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderOpen,
    title: "Document Center",
    description: "Upload, inspect, filter, select, and manage the knowledge sources."
  },
  {
    id: "ask",
    label: "Ask",
    icon: MessageSquareText,
    title: "RAG Q&A",
    description: "Ask grounded questions, switch analysis modes, and review cited answers."
  },
  {
    id: "activity",
    label: "Activity",
    icon: History,
    title: "Evidence & History",
    description: "Review citations, query history, and reusable analysis sessions."
  }
];

const demoDocuments = [
  {
    document_id: "demo-policy",
    filename: "Acme-Data-Protection-Policy.pdf",
    chunks: 18,
    uploaded_at: "2026-06-28T10:20:00.000Z"
  },
  {
    document_id: "demo-contract",
    filename: "Vendor-Service-Agreement.pdf",
    chunks: 24,
    uploaded_at: "2026-06-28T10:26:00.000Z"
  },
  {
    document_id: "demo-report",
    filename: "Q2-Risk-Review.md",
    chunks: 11,
    uploaded_at: "2026-06-28T10:34:00.000Z"
  }
];

const demoInsights = {
  "demo-policy": {
    document_id: "demo-policy",
    filename: "Acme-Data-Protection-Policy.pdf",
    chunks: 18,
    uploaded_at: "2026-06-28T10:20:00.000Z",
    pages: 8,
    words: 3850,
    estimated_read_minutes: 18,
    key_terms: ["retention", "access", "encryption", "audit", "privacy", "incident"],
    risk_terms: ["breach", "compliance", "confidential", "violation"],
    preview:
      "Acme requires confidential data to be encrypted at rest and in transit. Access reviews must be completed quarterly. Incidents must be escalated to Security within 24 hours and documented for audit readiness."
  },
  "demo-contract": {
    document_id: "demo-contract",
    filename: "Vendor-Service-Agreement.pdf",
    chunks: 24,
    uploaded_at: "2026-06-28T10:26:00.000Z",
    pages: 13,
    words: 6120,
    estimated_read_minutes: 28,
    key_terms: ["vendor", "service", "sla", "termination", "payment", "liability"],
    risk_terms: ["deadline", "liability", "penalty", "termination"],
    preview:
      "The vendor must maintain 99.5% monthly uptime and respond to priority incidents within four business hours. Either party may terminate after a material breach if the breach remains uncured for 30 days."
  },
  "demo-report": {
    document_id: "demo-report",
    filename: "Q2-Risk-Review.md",
    chunks: 11,
    uploaded_at: "2026-06-28T10:34:00.000Z",
    pages: 5,
    words: 2400,
    estimated_read_minutes: 11,
    key_terms: ["controls", "audit", "vendors", "evidence", "exceptions", "remediation"],
    risk_terms: ["delay", "risk", "deadline", "compliance"],
    preview:
      "The Q2 review found delayed evidence collection for vendor controls and incomplete remediation notes. The recommended action is to centralize evidence ownership and review high-risk vendors weekly."
  }
};

const demoHistory = [
  {
    history_id: "demo-history-1",
    question: "What are the biggest compliance risks?",
    answer_preview: "The strongest risk areas are delayed control evidence, breach escalation, and SLA penalties.",
    citation_count: 3,
    confidence: "high",
    created_at: "2026-06-28T11:00:00.000Z"
  }
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
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [analysisMode, setAnalysisMode] = useState("answer");
  const [activeView, setActiveView] = useState("overview");
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState("checking");
  const [demoMode, setDemoMode] = useState(false);
  const [insights, setInsights] = useState({});
  const [activeCitation, setActiveCitation] = useState(null);
  const [sessions, setSessions] = useState(() => {
    const stored = window.localStorage.getItem("corpmind-sessions");
    return stored
      ? JSON.parse(stored)
      : [
          {
            id: "session-default",
            title: "Portfolio Review",
            messages: []
          }
        ];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    return window.localStorage.getItem("corpmind-active-session") || "session-default";
  });

  useEffect(() => {
    bootstrapWorkspace();
  }, []);

  useEffect(() => {
    window.localStorage.setItem("corpmind-sessions", JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    window.localStorage.setItem("corpmind-active-session", activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    if (!activeDocumentId) return;
    loadInsight(activeDocumentId);
  }, [activeDocumentId, demoMode]);

  const selectedCount = useMemo(
    () => selectedIds.filter((id) => documents.some((doc) => doc.document_id === id)).length,
    [documents, selectedIds]
  );

  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunks, 0),
    [documents]
  );

  const activeInsight = activeDocumentId ? insights[activeDocumentId] : null;

  const filteredDocuments = useMemo(() => {
    const query = documentFilter.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.filename.toLowerCase().includes(query));
  }, [documents, documentFilter]);

  const selectedLabel = selectedCount ? `${selectedCount} selected` : "All sources";
  const vectorStore = demoMode ? "demo-vector" : answer?.metadata?.vector_store || "ready";
  const currentMode = analysisModes.find((mode) => mode.id === analysisMode) || analysisModes[0];
  const currentView = appViews.find((view) => view.id === activeView) || appViews[0];
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const confidenceScore = answer?.confidence === "high" ? 94 : answer?.confidence === "medium" ? 72 : answer ? 48 : 0;

  async function bootstrapWorkspace() {
    try {
      await healthCheck();
      setApiStatus("online");
      await refreshDocuments();
      await refreshHistory();
    } catch (err) {
      activateDemoMode();
    }
  }

  function activateDemoMode(message = "") {
    setDemoMode(true);
    setApiStatus("demo");
    setDocuments(demoDocuments);
    setHistory(demoHistory);
    setInsights(demoInsights);
    setSelectedIds([]);
    setActiveDocumentId("demo-policy");
    if (message) setError(message);
  }

  async function refreshDocuments() {
    try {
      const data = await listDocuments();
      setDocuments(data);
      setDemoMode(false);
      setApiStatus("online");
      if (!activeDocumentId && data[0]) setActiveDocumentId(data[0].document_id);
    } catch (err) {
      activateDemoMode("Backend is offline, so CorpMind is showing a safe portfolio demo workspace.");
    }
  }

  async function refreshHistory() {
    try {
      const data = await listHistory();
      setHistory(data);
    } catch (err) {
      if (!demoMode) setError(err.message);
    }
  }

  async function loadInsight(documentId) {
    if (insights[documentId]) return;
    if (demoMode) {
      setInsights((current) => ({ ...current, [documentId]: demoInsights[documentId] }));
      return;
    }
    try {
      const data = await getDocumentInsights(documentId);
      setInsights((current) => ({ ...current, [documentId]: data }));
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
      if (demoMode) {
        const documentId = `demo-upload-${Date.now()}`;
        const uploaded = {
          document_id: documentId,
          filename: file.name,
          chunks: Math.max(4, Math.round(file.size / 1200)),
          uploaded_at: new Date().toISOString()
        };
        setDocuments((current) => [uploaded, ...current]);
        setInsights((current) => ({
          ...current,
          [documentId]: {
            ...uploaded,
            pages: 1,
            words: Math.max(260, Math.round(file.size / 7)),
            estimated_read_minutes: 2,
            key_terms: ["uploaded", "source", "demo", "analysis"],
            risk_terms: [],
            preview:
              "Demo Mode accepted this file locally for the UI preview. Run the FastAPI backend locally or deploy it to process real document text."
          }
        }));
        setSelectedIds((current) => [...new Set([documentId, ...current])]);
        setActiveDocumentId(documentId);
        setActiveView("documents");
      } else {
        const uploaded = await uploadDocument(file);
        await refreshDocuments();
        setSelectedIds((current) => [...new Set([...current, uploaded.document_id])]);
        setActiveDocumentId(uploaded.document_id);
        setActiveView("documents");
      }
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
    setActiveCitation(null);
    const prompt = `${currentMode.prefix}${question.trim()}`;
    try {
      const data = demoMode
        ? buildDemoAnswer(prompt, selectedIds, topK, currentMode.id)
        : await askQuestion({
            question: prompt,
            documentIds: selectedIds,
            topK
          });
      setAnswer(data);
      setActiveCitation(data.citations[0] || null);
      setActiveView("ask");
      appendSessionMessage(question.trim(), data);
      if (demoMode) {
        setHistory((current) => [
          {
            history_id: `demo-history-${Date.now()}`,
            question: question.trim(),
            answer_preview: data.answer.slice(0, 180),
            citation_count: data.citations.length,
            confidence: data.confidence,
            created_at: new Date().toISOString()
          },
          ...current
        ]);
      } else {
        await refreshHistory();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleSummarize() {
    const prompt = selectedIds.length
      ? "Create an executive summary of the selected documents. Include key facts, risks, decisions, and citations."
      : "Create an executive summary of all indexed documents. Include key facts, risks, decisions, and citations.";
    setQuestion(prompt);
    setBusy("ask");
    setError("");
    setAnswer(null);
    setActiveCitation(null);
    try {
      const data = demoMode
        ? buildDemoAnswer(prompt, selectedIds, Math.max(topK, 6), "brief")
        : await askQuestion({
            question: prompt,
            documentIds: selectedIds,
            topK: Math.max(topK, 6)
          });
      setAnswer(data);
      setActiveCitation(data.citations[0] || null);
      setActiveView("ask");
      appendSessionMessage(prompt, data);
      if (!demoMode) await refreshHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleClearHistory() {
    setBusy("history");
    setError("");
    try {
      if (demoMode) {
        setHistory([]);
      } else {
        await clearHistory();
        setHistory([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function exportAnswer() {
    if (!answer) return;
    const citationLines = answer.citations
      .map(
        (citation, index) =>
          `${index + 1}. ${citation.filename} ${
            citation.page ? `(page ${citation.page})` : "(text file)"
          } - score ${citation.score}\n   ${citation.snippet}`
      )
      .join("\n\n");
    const markdown = `# CorpMind Answer\n\n## Mode\n${currentMode.label}\n\n## Question\n${question}\n\n## Answer\n${answer.answer}\n\n## Citations\n${citationLines || "No citations returned."}\n`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "corpmind-answer.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(documentId) {
    setBusy(documentId);
    setError("");
    try {
      if (demoMode) {
        setDocuments((current) => current.filter((document) => document.document_id !== documentId));
      } else {
        await deleteDocument(documentId);
        await refreshDocuments();
      }
      setSelectedIds((current) => current.filter((id) => id !== documentId));
      if (activeDocumentId === documentId) setActiveDocumentId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function appendSessionMessage(prompt, data) {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              messages: [
                {
                  id: `message-${Date.now()}`,
                  question: prompt,
                  answer: data.answer,
                  citations: data.citations.length,
                  createdAt: new Date().toISOString()
                },
                ...session.messages
              ].slice(0, 8)
            }
          : session
      )
    );
  }

  function createSession() {
    const id = `session-${Date.now()}`;
    setSessions((current) => [
      {
        id,
        title: `Analysis ${current.length + 1}`,
        messages: []
      },
      ...current
    ]);
    setActiveSessionId(id);
    setAnswer(null);
    setQuestion("");
    setActiveView("activity");
  }

  function toggleDocument(documentId) {
    setActiveDocumentId(documentId);
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
          <div className={`status-pill ${apiStatus === "demo" ? "warning" : ""}`}>
            {apiStatus === "online" ? <CheckCircle2 size={16} /> : <Activity size={16} />}
            <span>{apiStatus === "online" ? "API online" : apiStatus === "demo" ? "Demo mode" : "Checking"}</span>
          </div>
          <div className="status-pill muted">
            <Database size={16} />
            <span>{vectorStore}</span>
          </div>
        </div>
      </section>

      <section className="app-navigation" aria-label="Primary navigation">
        <div>
          <h2>{currentView.title}</h2>
          <p>{currentView.description}</p>
        </div>
        <div className="nav-tabs">
          {appViews.map((view) => {
            const Icon = view.icon;
            return (
              <button
                className={activeView === view.id ? "active" : ""}
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
              >
                <Icon size={16} />
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="insight-strip" aria-label="Corpus summary">
        <Metric icon={FileText} label="Documents" value={documents.length} />
        <Metric icon={Layers3} label="Chunks indexed" value={totalChunks} />
        <Metric icon={Filter} label="Scope" value={selectedLabel} />
        <Metric icon={Target} label="Confidence" value={answer ? `${confidenceScore}%` : "Ready"} />
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className={`workspace view-${activeView}`}>
        <aside className="sidebar" aria-label="Document library">
          <label className="upload-zone">
            <input type="file" accept=".pdf,.txt,.md" onChange={handleUpload} />
            {busy === "upload" ? <Loader2 className="spin" size={24} /> : <UploadCloud size={28} />}
            <span>
              <strong>{demoMode ? "Preview upload" : "Upload source"}</strong>
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
                  } ${activeDocumentId === document.document_id ? "active" : ""}`}
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
                  <div className="row-actions">
                    <button
                      className="icon-button neutral"
                      type="button"
                      aria-label={`Inspect ${document.filename}`}
                      title="Inspect"
                      onClick={() => {
                        setActiveDocumentId(document.document_id);
                        setActiveView("documents");
                      }}
                    >
                      <Eye size={16} />
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
                  </div>
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
                {answer?.confidence || currentMode.label}
              </span>
            </div>

            <div className="mode-tabs" aria-label="Analysis mode">
              {analysisModes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    className={analysisMode === mode.id ? "active" : ""}
                    key={mode.id}
                    type="button"
                    onClick={() => setAnalysisMode(mode.id)}
                  >
                    <Icon size={15} />
                    {mode.label}
                  </button>
                );
              })}
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

            <div className="action-row">
              <button
                className="secondary-button"
                type="button"
                onClick={handleSummarize}
                disabled={busy === "ask" || !documents.length}
              >
                <Sparkles size={17} />
                <span>Executive summary</span>
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={exportAnswer}
                disabled={!answer}
              >
                <Download size={17} />
                <span>Export answer</span>
              </button>
              <button className="secondary-button" type="button" onClick={createSession}>
                <Wand2 size={17} />
                <span>New session</span>
              </button>
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
                <span>{busy === "ask" ? "Searching" : "Run query"}</span>
              </button>
            </div>
          </form>

          <section className="intelligence-grid" aria-label="Advanced analysis">
            <DocumentIntel insight={activeInsight} onOpenAsk={() => setActiveView("ask")} />
            <SessionPanel
              activeSession={activeSession}
              sessions={sessions}
              setActiveSessionId={setActiveSessionId}
            />
          </section>

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

          <CitationPreview citation={activeCitation} />

          <div className="citation-list">
            {answer?.citations?.length ? (
              answer.citations.map((citation, index) => (
                <article
                  className={`citation-card ${
                    activeCitation?.chunk_id === citation.chunk_id ? "active" : ""
                  }`}
                  key={citation.chunk_id}
                >
                  <button
                    className="citation-rank"
                    type="button"
                    onClick={() => setActiveCitation(citation)}
                    title="Preview evidence"
                  >
                    {index + 1}
                  </button>
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

          <section className="history-panel" aria-label="Recent questions">
            <div className="history-header">
              <div>
                <h2>Recent Questions</h2>
                <p>{history.length ? "Reusable analysis trail" : "No query history yet"}</p>
              </div>
              <button
                className="quiet-button"
                type="button"
                onClick={handleClearHistory}
                disabled={!history.length || busy === "history"}
              >
                {busy === "history" ? <Loader2 className="spin" size={14} /> : <RefreshCcw size={14} />}
                Clear
              </button>
            </div>
            <div className="history-list">
              {history.length ? (
                history.map((item) => (
                  <button
                    className="history-item"
                    key={item.history_id}
                    type="button"
                    onClick={() => setQuestion(item.question)}
                  >
                    <History size={16} />
                    <span>
                      <strong>{item.question}</strong>
                      <small>
                        {item.citation_count} citations / {item.confidence} confidence
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="history-empty">
                  <History size={18} />
                  <span>Ask a question to build an analysis trail.</span>
                </div>
              )}
            </div>
          </section>
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

function DocumentIntel({ insight, onOpenAsk }) {
  if (!insight) {
    return (
      <section className="intel-card">
        <div className="mini-heading">
          <BookOpenCheck size={17} />
          <h2>Document Intelligence</h2>
        </div>
        <p className="muted-copy">Select a source to inspect pages, key terms, risks, and preview text.</p>
      </section>
    );
  }

  return (
    <section className="intel-card">
      <div className="mini-heading">
        <BookOpenCheck size={17} />
        <h2>Document Intelligence</h2>
      </div>
      <strong className="intel-title">{insight.filename}</strong>
      <div className="intel-stats">
        <span>{insight.pages} pages</span>
        <span>{insight.words} words</span>
        <span>{insight.estimated_read_minutes} min read</span>
      </div>
      <p className="preview-copy">{insight.preview}</p>
      <TagList label="Key terms" values={insight.key_terms} />
      <TagList label="Risk terms" values={insight.risk_terms} tone="risk" />
      <button className="secondary-button intel-action" type="button" onClick={onOpenAsk}>
        <MessageSquareText size={16} />
        Ask this source
      </button>
    </section>
  );
}

function TagList({ label, values, tone = "default" }) {
  return (
    <div className="tag-block">
      <span>{label}</span>
      <div>
        {values.length ? (
          values.map((value) => (
            <strong className={tone === "risk" ? "risk" : ""} key={value}>
              {value}
            </strong>
          ))
        ) : (
          <small>None detected</small>
        )}
      </div>
    </div>
  );
}

function SessionPanel({ activeSession, sessions, setActiveSessionId }) {
  return (
    <section className="intel-card session-card">
      <div className="mini-heading">
        <Network size={17} />
        <h2>Analysis Sessions</h2>
      </div>
      <div className="session-tabs">
        {sessions.map((session) => (
          <button
            className={activeSession?.id === session.id ? "active" : ""}
            key={session.id}
            type="button"
            onClick={() => setActiveSessionId(session.id)}
          >
            {session.title}
          </button>
        ))}
      </div>
      <div className="session-log">
        {activeSession?.messages?.length ? (
          activeSession.messages.map((message) => (
            <article key={message.id}>
              <strong>{message.question}</strong>
              <small>
                {message.citations} citations / {formatDate(message.createdAt)}
              </small>
            </article>
          ))
        ) : (
          <p className="muted-copy">This session is ready for a new analysis trail.</p>
        )}
      </div>
    </section>
  );
}

function CitationPreview({ citation }) {
  if (!citation) {
    return (
      <section className="citation-preview">
        <BarChart3 size={18} />
        <p>Select evidence after asking a question to inspect the strongest cited passage.</p>
      </section>
    );
  }

  return (
    <section className="citation-preview active">
      <div>
        <BarChart3 size={18} />
        <strong>Evidence Preview</strong>
      </div>
      <p>{citation.snippet}</p>
      <small>
        {citation.filename} / {citation.page ? `Page ${citation.page}` : "Text file"} / Score{" "}
        {citation.score?.toFixed?.(2) ?? citation.score}
      </small>
    </section>
  );
}

function buildDemoAnswer(question, documentIds, topK, mode) {
  const scopedIds = documentIds.length ? documentIds : demoDocuments.map((document) => document.document_id);
  const sources = scopedIds
    .map((id) => demoInsights[id])
    .filter(Boolean)
    .slice(0, Math.max(1, Math.min(topK, 5)));
  const citations = sources.map((source, index) => ({
    document_id: source.document_id,
    filename: source.filename,
    page: index + 2,
    chunk_id: `${source.document_id}:demo-${index}`,
    snippet: source.preview,
    score: Number((0.91 - index * 0.07).toFixed(2))
  }));
  const riskTerms = [...new Set(sources.flatMap((source) => source.risk_terms))];
  const keyTerms = [...new Set(sources.flatMap((source) => source.key_terms))].slice(0, 6);

  const modeLead =
    mode === "risk"
      ? "Risk review: the strongest signals are compliance exposure, deadline ownership, and vendor accountability."
      : mode === "compare"
        ? "Comparison brief: the selected sources agree on stronger evidence ownership, but each source highlights a different operational risk."
        : mode === "brief"
          ? "Executive brief: CorpMind found the main decisions, risks, and evidence points across the selected sources."
          : "Grounded answer: CorpMind found relevant evidence in the selected sources.";

  return {
    answer: `${modeLead}\n\nQuestion reviewed: ${question}\n\nKey findings: ${keyTerms.join(", ") || "source evidence"}. ${
      riskTerms.length
        ? `Risk terms detected include ${riskTerms.join(", ")}.`
        : "No major risk keywords were detected in the selected sources."
    }\n\nThis is Demo Mode output for the hosted portfolio link. Running the FastAPI backend locally or deploying it will process real uploaded document text with the same UI workflow.`,
    citations,
    confidence: "high",
    metadata: {
      matches: citations.length,
      used_crewai: false,
      uses_openai: false,
      vector_store: "demo-vector"
    }
  };
}

export default App;
