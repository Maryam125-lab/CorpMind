const API_BASE = "/api";

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data;
}

export async function listDocuments() {
  const response = await fetch(`${API_BASE}/documents`);
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

