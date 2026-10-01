import os
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.rag import ask_rag

app = FastAPI(
    title="RAG Chatbot API",
    description="FastAPI + LangGraph + Chroma + Gemini",
    version="1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    session_id: str = "default_session"
    selected_pdf: str = "all"


class ChatResponse(BaseModel):
    question: str
    answer: str
    session_id: str
    selected_pdf: str = "all"


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "message": "RAG Chatbot API Running Successfully"
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    answer = ask_rag(request.question, request.session_id, request.selected_pdf)

    return ChatResponse(
        question=request.question,
        answer=answer,
        session_id=request.session_id,
        selected_pdf=request.selected_pdf
    )


# Serve root directory for index.html, Style.css, script.js
base_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/", StaticFiles(directory=base_dir, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
