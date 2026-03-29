import os
import hashlib
from langchain_community.document_loaders import GithubFileLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient
from openai import OpenAI
from agents.ragAgent import ragAgent

mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
db = mongo_client[os.getenv("MONGODB_DB_NAME")]


openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
model = "text-embedding-3-large"
mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
users_collection = mongo_client[os.getenv("MONGODB_DB_NAME")]["users"]


def hash_text(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def create_docs_with_embeddings(embeddings, docs, repo_name):
    mongo_docs = []

    for embedding, doc in zip(embeddings, docs):
        text = doc.page_content
        doc_id = f"{repo_name}_{hash_text(text)}"

        mongo_docs.append({
            "_id": doc_id,
            "text": text,
            "hash": hash_text(text),
            "embedding": embedding,
            "metadata": {
                "repo": repo_name,
                "source": doc.metadata.get("source")
            }
        })
    return mongo_docs


def ingest_repo(user_id: str, repo_name: str, github_token: str):

    user = users_collection.find_one({"github_id": user_id})
    if not user:
        return {"status": "error", "message": "User does not exist."}


    loader = GithubFileLoader(
        repo=repo_name,
        branch="main",
        access_token=github_token,
        file_filter=lambda path: any(path.endswith(ext) for ext in {".md", ".py", ".js", ".ts", ".txt", ".json"})
    )
    documents = loader.load()

    
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    docs = splitter.split_documents(documents)

  
    texts = [doc.page_content for doc in docs]
    response = openai_client.embeddings.create(input=texts, model=model)
    embeddings = [item.embedding for item in response.data]

    new_chunks = []
    for doc, embedding in zip(docs, embeddings):
        chunk_id = hash_text(doc.page_content)
        new_chunks.append({
            "_id": chunk_id,
            "text": doc.page_content,
            "hash": chunk_id,
            "embedding": embedding,
            "source": doc.metadata.get("source")
        })

  
    existing_chunks = user.get("repos", {}).get(repo_name, {}).get("chunks", [])
    existing_chunks_dict = {c["_id"]: c for c in existing_chunks}

    chunks_to_upsert = [c for c in new_chunks if existing_chunks_dict.get(c["_id"], {}).get("hash") != c["hash"]]

    new_chunk_ids = {c["_id"] for c in new_chunks}
    deleted_chunk_ids = [c["_id"] for c in existing_chunks if c["_id"] not in new_chunk_ids]

    updated_chunks = [c for c in existing_chunks if c["_id"] not in deleted_chunk_ids]
    updated_chunks.extend(chunks_to_upsert)

    users_collection.update_one(
        {"github_id": user_id},
        {"$set": {f"repos.{repo_name}.chunks": updated_chunks}}
    )

    return {
        "status": "success",
        "updated": len(chunks_to_upsert),
        "deleted": len(deleted_chunk_ids),
        "total": len(updated_chunks)
    }