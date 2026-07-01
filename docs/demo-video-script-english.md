# CorpMind English Portfolio Demo Script

## Scene 1 - Application Overview
Welcome to CorpMind, an enterprise document question answering application built with a retrieval augmented generation pipeline. The application helps users upload business documents, ask natural language questions, and receive grounded answers with source citations.

## Scene 2 - Document Center
The Document Center is where users manage their knowledge sources. CorpMind supports PDF, text, and Markdown files. After upload, the backend extracts document text, splits it into searchable chunks, creates embeddings, and stores them in a vector database for semantic retrieval.

## Scene 3 - Document Intelligence
Each document can be inspected through the Document Intelligence panel. It shows metadata such as pages, word count, reading time, key terms, risk terms, and a source preview. This makes the app feel like a real document analysis workspace, not just a chatbot.

## Scene 4 - RAG Question Answering
The RAG Q and A workspace allows users to ask questions across all sources or selected documents. Users can choose different analysis modes such as Answer, Risk, Brief, and Compare. The evidence depth control decides how many relevant chunks are retrieved.

## Scene 5 - Grounded Answer And Citations
When a question is submitted, CorpMind retrieves the most relevant document chunks and generates a grounded answer. The evidence panel shows ranked citations with filenames, source snippets, and relevance scores, so the user can verify where the answer came from.

## Scene 6 - Activity And Portfolio Value
The Activity section keeps recent questions, evidence, and analysis sessions organized. This project demonstrates a complete RAG workflow using FastAPI, React, LangChain-style chunking, vector search, document intelligence, and a professional multi-section user interface.
