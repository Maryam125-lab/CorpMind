const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data;
}

export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`);
  return parseResponse(response);
}

export async function listDocuments() {
  const response = await fetch(`${API_BASE}/documents`);
  return parseResponse(response);
}

export async function getDocumentInsights(documentId) {
  const response = await fetch(`${API_BASE}/documents/${documentId}/insights`);
  return parseResponse(response);
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    body: formData
  });
  return parseResponse(response);
}

export async function deleteDocument(documentId) {
  const response = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "DELETE"
  });
  return parseResponse(response);
}

export async function askQuestion({ question, documentIds, topK }) {
  const response = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question,
      document_ids: documentIds.length ? documentIds : null,
      top_k: topK
    })
  });
  return parseResponse(response);
}

export async function listHistory() {
  const response = await fetch(`${API_BASE}/history`);
  return parseResponse(response);
}

export async function clearHistory() {
  const response = await fetch(`${API_BASE}/history`, {
    method: "DELETE"
  });
  return parseResponse(response);
}
