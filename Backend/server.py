"""
Flask API server for the Python RAG Chatbot.

Run from the Backend/ directory:
    python server.py

Endpoints:
    GET  /api/health  — liveness check
    POST /api/query   — RAG query returning structured JSON with citations
"""

import os
import re
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

CHROMA_DIR = Path("chroma_db")
TOP_K = 3

SYSTEM_PROMPT = (
    "You are a Python documentation assistant. Answer only from the provided "
    "documentation context. When referencing a specific concept, cite the source "
    "chunk using [[1]], [[2]], or [[3]] inline. "
    "Do NOT generate new code — only quote short examples from the docs. "
    "If the answer is not in the context, say so."
)

CONTEXT_TEMPLATE = """Context from the Python documentation:
{context}

---

Question: {question}"""

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _path_to_title(path: str) -> str:
    """
    Turn a docs path into a human-readable title.
    Examples:
        library/asyncio.html          → asyncio — Asynchronous I/O
        library/asyncio-task.html     → asyncio — Tasks
        library/functools.html        → functools
        reference/expressions.html   → Expressions
    """
    stem = path.removesuffix(".html").removesuffix(".txt")
    parts = stem.split("/")
    last = parts[-1]

    # Handle "asyncio-task" → "asyncio — Tasks"
    dash_idx = last.find("-")
    if dash_idx != -1:
        module = last[:dash_idx]
        sub = last[dash_idx + 1:].replace("-", " ").title()
        return f"{module} — {sub}"

    # Just prettify the stem
    return last.replace("-", " ").replace("_", " ").title()


def _build_citation(n: int, doc) -> dict:
    """Build a citation dict from a LangChain Document."""
    source = doc.metadata.get("source", "")

    # Parse URL to extract path and anchor
    parsed = urlparse(source)
    url_path = parsed.path  # e.g. /3/library/asyncio.html
    anchor = parsed.fragment  # e.g. module-asyncio (without #)

    # Strip everything up to and including "/3/" to get a relative docs path
    # e.g. /3/library/asyncio.html  →  library/asyncio.html
    path_match = re.search(r"/3/(.+)", url_path)
    rel_path = path_match.group(1) if path_match else url_path.lstrip("/")

    anchor_str = f"#{anchor}" if anchor else ""
    title = _path_to_title(rel_path)

    content = doc.page_content
    quote = content[:400]
    excerpt = content[:700]

    return {
        "n": n,
        "title": title,
        "path": rel_path,
        "anchor": anchor_str,
        "version": "Python 3.13",
        "quote": quote,
        "highlight": "",
        "excerpt": excerpt,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "db_exists": CHROMA_DIR.exists()})


@app.post("/api/query")
def query():
    body = request.get_json(force=True, silent=True) or {}
    question = str(body.get("question", "")).strip()
    chat_history_raw = body.get("chat_history", [])

    if not question:
        return jsonify({"error": "question is required"}), 400

    # Validate chat_history is a list of [q, a] pairs
    if not isinstance(chat_history_raw, list):
        chat_history_raw = []

    # ── Retrieve relevant chunks ─────────────────────────────────────────
    embeddings = OpenAIEmbeddings()
    db = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
        collection_metadata={"hnsw:space": "cosine"},
    )

    results = db.similarity_search_with_relevance_scores(question, k=TOP_K)

    if not results or results[0][1] < 0.65:
        return jsonify({
            "answer": "I don't have enough relevant information in the Python docs to answer that.",
            "citations": [],
        })

    # ── Build context string with numbered chunks ─────────────────────────
    # Number each chunk so the model can reference [[1]], [[2]], [[3]].
    context_parts = []
    for i, (doc, _score) in enumerate(results, start=1):
        context_parts.append(f"[{i}] {doc.page_content}")
    context = "\n\n---\n\n".join(context_parts)

    # ── Build message history ────────────────────────────────────────────
    history_msgs = []
    for pair in chat_history_raw:
        if isinstance(pair, (list, tuple)) and len(pair) == 2:
            history_msgs.append(HumanMessage(content=str(pair[0])))
            history_msgs.append(AIMessage(content=str(pair[1])))

    # ── Call the LLM ─────────────────────────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", CONTEXT_TEMPLATE),
    ])

    llm = ChatOpenAI(model="gpt-4o-mini")
    chain = prompt | llm
    response = chain.invoke({
        "chat_history": history_msgs,
        "context": context,
        "question": question,
    })

    answer = response.content

    # ── Build structured citations ────────────────────────────────────────
    citations = [
        _build_citation(i, doc)
        for i, (doc, _score) in enumerate(results, start=1)
    ]

    return jsonify({"answer": answer, "citations": citations})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not CHROMA_DIR.exists():
        print("WARNING: Vector database not found at chroma_db/. Run create_database.py first.")

    port = int(os.environ.get("PORT", 5000))
    print(f"Starting server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
