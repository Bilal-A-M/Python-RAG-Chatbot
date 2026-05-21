import os
from pathlib import Path
import shutil
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

DATA_DIR = Path("data")
CHROMA_DIR = Path("chroma_db")
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def load_documents():
    """Load all .txt files from the data/ directory."""
    print("Loading documents...")
    loader = DirectoryLoader(
        str(DATA_DIR),
        glob="**/*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
        show_progress=True,
    )
    docs = loader.load()
    print(f"Loaded {len(docs)} documents.")
    return docs


def split_documents(docs):
    """Split documents into chunks."""
    print("Splitting documents into chunks...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(docs)
    print(f"Created {len(chunks)} chunks.")
    return chunks


def create_vector_database(chunks):
    """Embed chunks and store them in a Chroma vector database."""
    print("Creating vector database...")
    if (os.path.exists(CHROMA_DIR)):
        shutil.rmtree(CHROMA_DIR)
    embeddings = OpenAIEmbeddings()
    db = Chroma.from_documents(chunks, embeddings, persist_directory=str(CHROMA_DIR))
    print(f"Vector database saved to {CHROMA_DIR}/")
    return db


if __name__ == "__main__":
    if not DATA_DIR.exists():
        print(f"'{DATA_DIR}' folder not found. Run scrape_data.py first.")
        exit(1)

    if CHROMA_DIR.exists():
        print(f"'{CHROMA_DIR}' already exists. Deleting and rebuilding...")

    docs = load_documents()
    chunks = split_documents(docs)
    create_vector_database(chunks)
    print("Done.")
