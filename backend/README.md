---
title: CorpMind API
emoji: C
colorFrom: teal
colorTo: emerald
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# CorpMind API

FastAPI backend for the CorpMind Enterprise Document Q&A Assistant.

## Endpoints

- `GET /health`
- `POST /documents`
- `GET /documents`
- `GET /documents/{document_id}/insights`
- `POST /query`
- `GET /history`
- `DELETE /history`

This Space runs the same RAG backend used by the portfolio frontend.
