import os
import hashlib
from flask import Flask, request, jsonify
from dotenv import load_dotenv

from langchain_community.document_loaders import GitLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.chains import RetrievalQA
from pymongo import MongoClient
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from flask_socketio import SocketIO, send, emit
load_dotenv()

app = Flask("Github-Repo-Analysis-Bot")
# socketio = SocketIO(app, async_mode='eventlet')
VECTOR_DIR = "vectorstores"
# eventlet.monkey_patch()
os.makedirs(VECTOR_DIR, exist_ok=True)

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
collection = client[os.getenv("MONGODB_DB_NAME")][os.getenv("MONGODB_COLLECTION_NAME")]
vector_store = MongoDBAtlasVectorSearch(
    collection=collection,
    embedding=embeddings,
    index_name="vector_index"
)
qa_chain = None
repo_chains = {}
def get_repo_id(repo_url):
    return hashlib.md5(repo_url.encode()).hexdigest()


def ingest_repo(repo_url):
    repo_id = get_repo_id(repo_url)
    repo_path = f"./repos/{repo_id}"
    db_path = f"{VECTOR_DIR}/{repo_id}"

    # If already processed → load it
    if os.path.exists(db_path):
        print("Loading cached vector DB...")
        db = FAISS.load_local(db_path, embeddings, allow_dangerous_deserialization=True)
        return db

    print("Cloning and processing repo...")

    loader = GitLoader(
        clone_url=repo_url,
        repo_path=repo_path,
        branch="main",
    )
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    docs = splitter.split_documents(documents)

    vector_store.add_documents(docs)

    return db


@app.route("/load_repo", methods=["POST"])
def load_repo():
    global qa_chain

    data = request.json
    repo_url = data.get("repo_url")

    if not repo_url:
        return jsonify({"error": "No repo_url provided"}), 400

    try:
        db = ingest_repo(repo_url)
    
        llm = ChatOpenAI(
            model="gpt-5-mini-2025-08-07",
            api_key=os.getenv("OPENAI_API_KEY")
        )
        qa_chain = RetrievalQA.from_chain_type(
            llm,
            retriever=db.as_retriever()
        )
        repo_id = get_repo_id(repo_url)
        repo_chains[repo_id] = qa_chain
        return jsonify({
            "status": "success",
            "message": "Repo loaded and ready"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ask", methods=["POST"])
def ask():
    global qa_chain
    repo_url = data.get("repo_url")
    question = data.get("question")

    if qa_chain is None:
        return jsonify({"error": "No repo loaded yet"}), 400

    data = request.json
    question = data.get("question")

    if not question:
        return jsonify({"error": "No question provided"}), 400
    repo_id = get_repo_id(repo_url)
    qa_chain = repo_chains.get(repo_id)
    if not qa_chain:
        return jsonify({"error": "Repo not loaded yet"}), 400

    answer = qa_chain.run(question)

    return jsonify({
        "question": question,
        "answer": answer
    })
# @socketio.on('message')
# def handle_message(msg):
#     print('Message: ' + msg)
#     send(msg, broadcast=False)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
    # socketio.run(app)