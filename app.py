import os
import hashlib
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_community.document_loaders import GithubFileLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from pymongo import MongoClient, UpdateOne
from langchain_core.messages import HumanMessage
from openai import OpenAI
from agents.ragAgent import ragAgent
load_dotenv()

app = Flask("Github-Repo-Analysis-Bot")
model = "text-embedding-3-small"
openai_client = OpenAI()
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
collection = client[os.getenv("MONGODB_DB_NAME")][os.getenv("MONGODB_COLLECTION_NAME")]


llm = ChatOpenAI(
        model="gpt-5-mini-2025-08-07",
        api_key=os.getenv("OPENAI_API_KEY")
    )
K= 3
def get_repo_id(repo_url):
    return repo_url.replace("https://github.com/", "").replace(".git", "")

def hash_text(text):
    return hashlib.md5(text.encode()).hexdigest()

def get_embedding(text):
   """Generates vector embeddings for the given text."""
   embedding = openai_client.embeddings.create(input = text, model=model).data[0].embedding
   return embedding

def create_docs_with_embeddings(embeddings, docs, repo_id):
    mongo_docs = []

    for embedding, doc in zip(embeddings, docs):
        text = doc.page_content
        doc_id = f"{repo_id}_{hash_text(text)}"

        mongo_docs.append({
            "_id": doc_id,
            "text": text,
            "embedding": embedding,
            "metadata": {
                "repo": repo_id,
                "source": doc.metadata.get("source")
            }
        })

    return mongo_docs


def upsert_documents(docs):
    operations = [
        UpdateOne(
            {"_id": doc["_id"]},
            {"$set": doc},
            upsert=True
        )
        for doc in docs
    ]

    if operations:
        collection.bulk_write(operations)
def ingest_repo(repo_url):
    repo_id = get_repo_id(repo_url)
    parts = repo_id

    loader = GithubFileLoader(
        repo=parts,
        branch="main",
        access_token=os.getenv("GITHUB_ACCESS_TOKEN"),
        github_api_url="https://api.github.com",
        file_filter=lambda file_path: any(
            file_path.endswith(ext) for ext in {".md", ".py", ".js", ".ts", ".txt", ".json"}
        )
    )
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    docs = splitter.split_documents(documents)
    texts = [doc.page_content for doc in docs]
    response = openai_client.embeddings.create(
        input=texts,
        model=model
    )
    embeddings = [item.embedding for item in response.data]


    mongo_docs = create_docs_with_embeddings(embeddings, docs, repo_id)

   
    current_doc_ids = {doc["_id"] for doc in mongo_docs}
    existing_doc_ids = {doc["_id"] for doc in collection.find({"metadata.repo": repo_id}, {"_id": 1})}
    deleted_doc_ids = existing_doc_ids - current_doc_ids

    if deleted_doc_ids:
        collection.delete_many({"_id": {"$in": list(deleted_doc_ids)}})
        print(f"Deleted {len(deleted_doc_ids)} removed chunks for {repo_id}.")


    upsert_documents(mongo_docs)
    print(f"Ingested/updated {len(mongo_docs)} chunks for {repo_id}.")



    return {"status": "success"}
@app.route("/load_repo", methods=["POST"])
def load_repo():
    data = request.json
    repo_url = data.get("repo_url")

    if not repo_url:
        return jsonify({"error": "No repo_url provided"}), 400

    try:
        ingest_repo(repo_url)
        
        return jsonify({
            "status": "success",
            "message": "Repo loaded and ready"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data.get("question")
    repo_name = data.get("repo_name")
    humanMessage = HumanMessage(content=question)
    input= {
        "messages": humanMessage,
        "repo_name" : repo_name
    }
    response = ragAgent.invoke(
    input,
    {"configurable": {"thread_id": "2"}}
   
    )
    return {"question": question , "response": response['messages'][-1].content}

if __name__ == "__main__":
    app.run(debug=True, port=5000)
