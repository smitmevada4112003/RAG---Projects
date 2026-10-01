import os
import time
from typing import TypedDict
from dotenv import load_dotenv

from langchain_chroma import Chroma
from langgraph.graph import StateGraph, START, END
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.embeddings import Embeddings
import chromadb.utils.embedding_functions as ef

# Load Environment Variables
load_dotenv(override=True)

class ChromaLocalEmbeddings(Embeddings):
    """Local, offline embedding model powered by Chroma's bundled ONNX all-MiniLM-L6-v2."""
    def __init__(self):
        self._func = ef.DefaultEmbeddingFunction()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._func(texts)

    def embed_query(self, text: str) -> list[float]:
        return self._func([text])[0]

# Determine provider (Groq or Google Gemini)
groq_key = os.getenv("GROQ_API_KEY", "").strip()
google_key = os.getenv("GOOGLE_API_KEY", "").strip()

if groq_key:
    from langchain_groq import ChatGroq
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    print(f"Using Groq LLM: {groq_model}")
    llm = ChatGroq(
        model=groq_model,
        temperature=0,
        api_key=groq_key
    )
    embeddings = ChromaLocalEmbeddings()
    vector_collection_name = "chroma_db_local"
    chat_collection_name = "chat_history_local"
elif google_key:
    from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    print(f"Using Google Gemini LLM: {gemini_model}")
    llm = ChatGoogleGenerativeAI(
        model=gemini_model,
        temperature=0,
        google_api_key=google_key
    )
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=google_key
    )
    vector_collection_name = "chroma_db"
    chat_collection_name = "chat_history_collection"
else:
    # Default to Groq placeholder or fallback
    from langchain_groq import ChatGroq
    llm = ChatGroq(model="openai/gpt-oss-120b", temperature=0)
    embeddings = ChromaLocalEmbeddings()
    vector_collection_name = "chroma_db_local"
    chat_collection_name = "chat_history_local"

# Reference PDF files
pdf_files = [
    "Python_100_Interview_Questions.pdf",
    "python_reference.pdf",
    "machine_learning_reference.pdf",
    "java_reference.pdf"
]

# Initialize Chroma Vector Store for PDFs
vectorstore = Chroma(
    collection_name=vector_collection_name,
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

def ensure_documents_indexed():
    """Ensure reference PDFs are indexed into ChromaDB."""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        existing_data = vectorstore.get()
        indexed_sources = set()
        if existing_data and existing_data.get("metadatas"):
            for meta in existing_data["metadatas"]:
                if meta and "source" in meta:
                    indexed_sources.add(os.path.basename(meta["source"]))

        documents = []
        for pdf_file in pdf_files:
            pdf_path = os.path.join(base_dir, pdf_file)
            if os.path.exists(pdf_path) and pdf_file not in indexed_sources:
                loader = PyPDFLoader(pdf_path)
                docs = loader.load()
                for d in docs:
                    d.metadata["source"] = pdf_file
                documents.extend(docs)
                print(f"Loaded {len(docs)} pages from {pdf_file}")
            elif not os.path.exists(pdf_path) and pdf_file not in indexed_sources:
                print(f"Warning: {pdf_file} not found at {pdf_path}")

        if documents:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=500,
                chunk_overlap=50
            )
            chunks = text_splitter.split_documents(documents)
            print(f"Splitting into {len(chunks)} chunks and storing in ChromaDB...")
            vectorstore.add_documents(chunks)
            total = vectorstore._collection.count()
            print(f"New PDF documents indexed! ChromaDB now has {total} chunks in {vector_collection_name}.")
        else:
            count = vectorstore._collection.count()
            print(f"ChromaDB ready with {count} indexed document chunks in {vector_collection_name}.")
    except Exception as e:
        print(f"Error in document indexing: {e}")

# Trigger indexing on module initialization
ensure_documents_indexed()

retriever = vectorstore.as_retriever(
    search_kwargs={"k": 6}
)

# Initialize Chroma Store for Chat History Memory
chat_history_store = Chroma(
    collection_name=chat_collection_name,
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

def save_chat_history(session_id: str, question: str, answer: str):
    """Save user question and bot answer into ChromaDB chat history collection."""
    try:
        doc_text = f"User: {question}\nAssistant: {answer}"
        doc_id = f"{session_id}_{int(time.time() * 1000)}"
        chat_history_store.add_texts(
            texts=[doc_text],
            metadatas=[{
                "session_id": session_id,
                "timestamp": time.time(),
                "question": question,
                "answer": answer
            }],
            ids=[doc_id]
        )
    except Exception as e:
        print(f"Error saving chat history to Chroma: {e}")

def get_chat_history(session_id: str, limit: int = 5) -> str:
    """Retrieve recent conversation turns for session_id from ChromaDB."""
    try:
        results = chat_history_store.get(
            where={"session_id": session_id}
        )
        if not results or not results.get("metadatas"):
            return ""

        metadatas = results["metadatas"]
        metadatas = sorted(metadatas, key=lambda x: x.get("timestamp", 0))
        recent = metadatas[-limit:]

        formatted = []
        for item in recent:
            q = item.get("question", "")
            a = item.get("answer", "")
            formatted.append(f"User: {q}\nAssistant: {a}")
        return "\n\n".join(formatted)
    except Exception as e:
        print(f"Error fetching chat history from Chroma: {e}")
        return ""

# LangGraph State Schema
class State(TypedDict):
    question: str
    session_id: str
    chat_history: str
    selected_pdf: str
    documents: list
    answer: str

def contextualize_query(question: str, chat_history: str) -> str:
    """Reformulate follow-up questions (e.g. 'key points', 'explain its features') into standalone search queries."""
    if not chat_history:
        return question

    q_lower = question.lower().strip()
    follow_up_cues = ["key point", "key points", "feature", "features", "advantage", "advantages", 
                      "example", "examples", "it", "its", "this", "that", "why", "how", "more", "explain"]
    words = q_lower.split()
    is_likely_followup = len(words) <= 8 and (
        any(cue in q_lower for cue in follow_up_cues) or len(words) <= 3
    )

    if not is_likely_followup:
        return question

    try:
        reformulate_prompt = f"""Given this chat history and a follow-up user question, formulate a concise standalone search query for vector retrieval that identifies the specific topic/subject being discussed. Output ONLY the standalone query, nothing else.

Chat History:
{chat_history}

Follow-up Question: {question}

Standalone Search Query:"""
        res = llm.invoke(reformulate_prompt)
        text = res.content
        if isinstance(text, list):
            text = "".join(item["text"] if isinstance(item, dict) and "text" in item else str(item) for item in text)
        query = str(text).strip().strip('"').strip("'")
        return query if query else question
    except Exception as e:
        print(f"Contextualization skipped: {e}")
        return question

# Retrieve Node
def retrieve_node(state: State):
    question = state["question"]
    chat_history = state.get("chat_history", "")
    selected_pdf = state.get("selected_pdf", "all")

    search_query = contextualize_query(question, chat_history)

    # Determine filter based on selected_pdf
    pdf_filter = None
    if selected_pdf and selected_pdf.lower() != "all":
        sel_clean = selected_pdf.lower().strip()
        if "java" in sel_clean:
            pdf_filter = {"source": "java_reference.pdf"}
        elif "ml" in sel_clean or "machine" in sel_clean:
            pdf_filter = {"source": "machine_learning_reference.pdf"}
        elif "python" in sel_clean:
            pdf_filter = {"source": {"$in": ["Python_100_Interview_Questions.pdf", "python_reference.pdf"]}}
        else:
            pdf_filter = {"source": selected_pdf}

    if pdf_filter:
        try:
            documents = vectorstore.similarity_search(search_query, k=6, filter=pdf_filter)
        except Exception as e:
            print(f"Filtered search error: {e}, falling back to unrestricted search")
            documents = vectorstore.similarity_search(search_query, k=6)
    else:
        documents = vectorstore.similarity_search(search_query, k=6)

    return {"documents": documents}

# Generate Node
def generate_node(state: State):
    question = state["question"]
    documents = state["documents"]
    chat_history = state.get("chat_history", "")
    selected_pdf = state.get("selected_pdf", "all")

    # Format scope description
    scope_desc = "All uploaded PDF documents"
    if selected_pdf and selected_pdf.lower() != "all":
        sel_clean = selected_pdf.lower().strip()
        if "java" in sel_clean:
            scope_desc = "Java Reference (java_reference.pdf)"
        elif "ml" in sel_clean or "machine" in sel_clean:
            scope_desc = "Machine Learning Reference (machine_learning_reference.pdf)"
        elif "python" in sel_clean:
            scope_desc = "Python Reference (Python_100_Interview_Questions.pdf & python_reference.pdf)"
        else:
            scope_desc = f"{selected_pdf} Reference"

    # Format retrieved document context with source metadata
    context_blocks = []
    for doc in documents:
        src = os.path.basename(doc.metadata.get("source", "Reference PDF"))
        context_blocks.append(f"[Document: {src}]\n{doc.page_content}")
    context = "\n\n".join(context_blocks) if context_blocks else ""

    q_clean = question.lower().strip("?!. ")

    # Check for pure greetings
    pure_greetings = {"hi", "hello", "hey", "hii", "hiii", "namaste", "kem cho", "kaise ho", "good morning", "good evening"}
    if q_clean in pure_greetings:
        return {"answer": "Hello! How can I help you? Ask me any question based on your uploaded reference PDFs."}

    prompt = f"""
You are an expert RAG Assistant.

Selected Document Scope: {scope_desc}

Retrieved Document Context:
{context if context else "No document context available."}

Previous Chat History:
{chat_history if chat_history else "No previous chat history."}

Current User Question:
{question}

CRITICAL RULES ON ANSWER SCOPE AND STRUCTURE:
1. Document Scope Enforcement:
   - When a specific Document Scope is active ({scope_desc}):
     * You must answer ONLY questions that belong to the topic and content of this selected reference.
     * If the user asks about a different topic outside this selected document (for example, asking about Python or Machine Learning when Java Reference is selected), or if the question cannot be answered from this document's content, DO NOT answer from general knowledge. Instead, immediately respond with:
       "Selected reference document ({scope_desc}) does not contain information about this question. Please select 'All Documents' or the relevant reference to search for it."
   - When Document Scope is "All uploaded PDF documents" (no specific document selected):
     * The user has not filtered by a single document. Answer ANY question asked by retrieving the relevant information across all reference documents or explaining the standard technical concept clearly.

2. Answer Scope & Brevity:
   - When the user asks "What is [Topic]?" or asks for definition / overview only:
     Provide ONLY a crisp, high-quality, professional technical definition (strictly 1 to 3 sentences).
     Follow this exact tone and standard requested by the user:
     "Python is a high-level, dynamically typed, interpreted programming language known for its simple syntax and extensive standard library. It supports procedural, object-oriented, and functional programming paradigms."
     Apply this exact interview-standard pattern across all questions (e.g. What is Variables, What is OOP, What is Decorators, etc.):
     - State what it is (technical definition and classification).
     - State its key mechanism or characteristics.
     - State its purpose / utility.
     DO NOT include unrequested code blocks, multi-language comparisons, bullet points, or long drawn-out explanations. Keep it strictly concise, direct, and professional.
   - When the user asks for "Key points", "features", "advantages", or bullet points only (including follow-ups like "key points", "what are its key points?"):
     Provide ONLY the key points as clean, focused bullet points (3 to 5 bullets). DO NOT include a definition paragraph or background.
   - When the user asks for BOTH together (e.g. "What is [Topic] and its key points?" or "Explain [Topic] with key points"):
     Provide BOTH sections clearly:
     ### Definition
     [The crisp 1-3 sentence definition]

     ### Key Points
     [Clean bullet points]
   - When the user explicitly asks for code / examples (e.g. "give code", "show example"):
     Provide only the concise code snippet requested.

3. Language Matching:
   - If the user asks in Hindi or Hinglish, answer in Hindi / Hinglish while following the exact same conciseness rules above.

4. Grounding & Strict Truthfulness:
   - Base technical concepts accurately on the reference documents and standard software engineering facts.
   - If the user asks about something completely unrelated to the documents or programming, politely decline or state:
     "I don't know based on the provided documents."

5. Clean Formatting:
   - Output clean Markdown directly.
   - Do NOT include conversational filler, greetings ("Sure!", "Here is..."), or sign-offs. Jump straight to the answer.
"""

    response = llm.invoke(prompt)
    content = response.content
    if isinstance(content, list):
        answer = "".join(item["text"] if isinstance(item, dict) and "text" in item else str(item) for item in content)
    else:
        answer = str(content)
    return {"answer": answer}

# Build LangGraph Pipeline
graph = StateGraph(State)
graph.add_node("retrieve", retrieve_node)
graph.add_node("generate", generate_node)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "generate")
graph.add_edge("generate", END)

rag_app = graph.compile()

# Primary function exposed to API
def ask_rag(question: str, session_id: str = "default_session", selected_pdf: str = "all") -> str:
    try:
        # Check API key configuration
        current_groq = os.getenv("GROQ_API_KEY", "").strip()
        current_google = os.getenv("GOOGLE_API_KEY", "").strip()
        if not current_groq and not current_google:
            return "[Configuration Error] Please provide a valid GROQ_API_KEY or GOOGLE_API_KEY in your .env file."

        # Retrieve previous chat history stored in ChromaDB
        history_str = get_chat_history(session_id, limit=5)

        result = rag_app.invoke({
            "question": question,
            "session_id": session_id,
            "chat_history": history_str,
            "selected_pdf": selected_pdf or "all",
            "documents": [],
            "answer": ""
        })
        answer = result.get("answer", "No answer generated.")
        if isinstance(answer, list):
            answer = "".join(item["text"] if isinstance(item, dict) and "text" in item else str(item) for item in answer)

        # Persist this turn into ChromaDB chat history
        if answer and not str(answer).startswith("Error processing") and not str(answer).startswith("["):
            save_chat_history(session_id, question, str(answer))

        return str(answer)
    except Exception as e:
        err_msg = str(e)
        print(f"Error in ask_rag: {err_msg}")
        if any(keyword in err_msg for keyword in ["401", "UNAUTHENTICATED", "API_KEY_INVALID", "ACCESS_TOKEN_TYPE_UNSUPPORTED"]):
            return "[Authentication Error] Your API key appears to be invalid or expired. Please check GROQ_API_KEY or GOOGLE_API_KEY in your .env file."
        return f"Error processing request: {err_msg}"