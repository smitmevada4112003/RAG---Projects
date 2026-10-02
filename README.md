# RAG Chatbot

A Retrieval-Augmented Generation (RAG) chatbot that answers questions from PDF documents (Python, Machine Learning and Java references).

## Live Demo

https://rag-projects-bce1.onrender.com

> Hosted on Render's free tier, so the first request after a period of inactivity can take about a minute while the service wakes up.


## Features

- Ask questions over your PDF documents
- Choose a specific PDF (Python, Machine Learning, Java) or search across all of them
- Per-session chat memory
- Markdown answers with code blocks and a copy button
- Simple web UI served directly by the backend

## How It Works

1. PDFs are split into chunks and stored in a Chroma vector database.
2. When you ask a question, the most relevant chunks are retrieved (optionally filtered to one PDF).
3. A LangGraph workflow passes the question and the retrieved context to the LLM.
4. The LLM answers using only the retrieved context, so responses stay grounded in your documents.

## Tech Stack

- **Backend:** FastAPI, Uvicorn
- **RAG pipeline:** LangGraph, LangChain
- **Vector database:** Chroma
- **LLM:** Groq
- **Frontend:** HTML, CSS, JavaScript
- **Hosting:** Render

## Project Structure

```
.
â”œâ”€â”€ api.py              # FastAPI app (API + serves frontend)
â”œâ”€â”€ src/
â”‚   â””â”€â”€ rag.py          # RAG logic
â”œâ”€â”€ static/             # Frontend: index.html, Style.css, script.js
â”œâ”€â”€ RAG.ipynb           # Notebook with experiments
â”œâ”€â”€ requirements.txt
â””â”€â”€ .env.example
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
  "question": "What is Python?",
  "session_id": "default_session",
  "selected_pdf": "all"
}
```

`selected_pdf` can be `all`, `python`, `ml` or `java`.

**GET `/api/health`** returns the service status.

## Author

[smitmevada4112003](https://github.com/smitmevada4112003)
