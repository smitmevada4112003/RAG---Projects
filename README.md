# RAG Chatbot

A Retrieval-Augmented Generation (RAG) chatbot that answers questions from your PDF documents.

## Features

- Ask questions over your PDF documents
- Choose a specific PDF or search across all of them
- Per-session chat memory
- Simple web UI served directly by the backend

## Tech Stack

- **Backend:** FastAPI, Uvicorn
- **RAG pipeline:** LangGraph, LangChain
- **Vector database:** Chroma
- **LLM:** Gemini (Google)
- **Frontend:** HTML, CSS, JavaScript

## Project Structure

```
.
├── api.py              # FastAPI app (API + serves frontend)
├── src/
│   └── rag.py          # RAG logic
├── static/             # Frontend: index.html, Style.css, script.js
├── RAG.ipynb           # Notebook with experiments
├── requirements.txt
└── .env.example
```

## Setup

1. Clone the repo

```bash
git clone https://github.com/smitmevada4112003/RAG---Projects.git
cd RAG---Projects
```

2. Create a virtual environment and install dependencies

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and add your own API keys. Never commit `.env`.

## Run

```bash
python api.py
```

Open http://127.0.0.1:8000 in your browser.

## API

**POST `/chat`**

```json
{
  "question": "What is this document about?",
  "session_id": "default_session",
  "selected_pdf": "all"
}
```

## Author

[smitmevada4112003](https://github.com/smitmevada4112003)