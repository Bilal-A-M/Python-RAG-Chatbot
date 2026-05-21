import sys
from pathlib import Path


from dotenv import load_dotenv

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

CHROMA_DIR = Path("chroma_db")
TOP_K = 3

SYSTEM_PROMPT = """You are a Python documentation assistant. Your only job is to help users \
understand Python based on the official Python documentation.

Rules you must follow:
- Do NOT generate new code. You may only quote short example snippets that \
appear directly in the provided context to illustrate a concept.
- If the user asks you to generate, write, or create code, respond with: \
"I can't generate code for you. I can only explain concepts and show examples from the Python documentation."
- Explain concepts clearly so the user can learn and understand.
- If the answer is not found in the context below, say: \
"I don't have enough information in the Python docs to answer that."
- You may use the conversation history to answer follow-up questions."""

CONTEXT_TEMPLATE = """Context from the Python documentation:
{context}

---

Question: {question}"""


def query(question: str, chat_history: list) -> str:
    embeddings = OpenAIEmbeddings()
    db = Chroma(
        persist_directory=str(CHROMA_DIR),
        embedding_function=embeddings,
        collection_metadata={"hnsw:space": "cosine"},
    )

    results = db.similarity_search_with_relevance_scores(question, k=TOP_K)
    if len(results) == 0 or results[0][1] < 0.65:
        return "I don't have enough relevant information in the Python docs to answer that."

    context = "\n\n---\n\n".join(doc.page_content for doc, _score in results)

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", CONTEXT_TEMPLATE),
    ])

    llm = ChatOpenAI(model="gpt-4o-mini")
    chain = prompt | llm
    response = chain.invoke({
        "chat_history": [msg for pair in chat_history for msg in (HumanMessage(content=pair[0]), AIMessage(content=pair[1]))],
        "context": context,
        "question": question,
    })

    sources = list({doc.metadata.get("source", "unknown") for doc, _score in results})
    answer = response.content
    no_info_phrase = "I don't have enough information in the Python docs to answer that."
    if no_info_phrase.lower() not in answer.lower():
        answer += "\n\nSources:\n" + "\n".join(f"  - {s}" for s in sources)

    return answer


if __name__ == "__main__":
    if not CHROMA_DIR.exists():
        print("Vector database not found. Run create_database.py first.")
        sys.exit(1)

    print("Python Docs Chatbot — type 'quit' to exit.\n")
    chat_history = []

    while True:
        question = input("You: ").strip()
        if not question:
            continue
        if question.lower() in ("quit", "exit"):
            break

        answer = query(question, chat_history)
        print(f"\nAssistant: {answer}\n")

        # Store only the plain question and plain answer (no sources) in history
        plain_answer = answer.split("\n\nSources:")[0]
        chat_history.append((question, plain_answer))

