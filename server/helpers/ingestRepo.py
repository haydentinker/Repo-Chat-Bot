import os
import hashlib
from langchain_community.document_loaders import GithubFileLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient, UpdateOne
from openai import OpenAI

mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
db = mongo_client[os.getenv("MONGODB_DB_NAME")]
users_collection = db["users"]
vectors_collection =db["vectors"]

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBEDDING_MODEL = "text-embedding-3-small"


def hash_text(text: str) -> str:
    """Create a consistent hash for a given text."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def ingest_repo(user_id: str, repo_name: str, github_token: str, branch="main"):
    """Ingest a GitHub repo into MongoDB with flattened embeddings and change detection."""

    user = users_collection.find_one({"github_id": user_id})
    if not user:
        return {"status": "error", "message": "User does not exist."}

  
    loader = GithubFileLoader(
        repo=repo_name,
        branch=branch,
        access_token=github_token,
        file_filter=lambda path: any(
            path.endswith(ext) for ext in {".md", ".py", ".js", ".ts", ".txt", ".json"}
        )
    )

    try:
        documents = loader.load()
    except Exception as e:
        return {"status": "error", "message": f"Failed to load repo: {str(e)}"}

    if not documents:
        return {"status": "error", "message": "No files found in repo."}

 
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    docs = splitter.split_documents(documents)

    if not docs:
        return {"status": "error", "message": "No chunks created from documents."}

  
    chunk_hashes = {hash_text(doc.page_content): doc for doc in docs}
    existing_chunks = vectors_collection.find(
        {"github_id": user_id, "repo_name": repo_name, "_id": {"$in": list(chunk_hashes.keys())}},
        {"_id": 1, "text": 1, "embedding": 1}
    )
    existing_hashes = {chunk["_id"]: chunk for chunk in existing_chunks}

   
    chunks_to_embed = []
    for chunk_id, doc in chunk_hashes.items():
        if chunk_id not in existing_hashes or existing_hashes[chunk_id]["text"] != doc.page_content:
            chunks_to_embed.append((chunk_id, doc))

    if not chunks_to_embed:
        return {
            "status": "success",
            "message": "No new or updated chunks to ingest.",
            "total_chunks": len(docs),
            "updated_chunks": 0
        }

  
    texts = [doc.page_content for _, doc in chunks_to_embed]
    response = openai_client.embeddings.create(input=texts, model=EMBEDDING_MODEL)
    embeddings = [item.embedding for item in response.data]

  
    operations = []
    for (chunk_id, doc), embedding in zip(chunks_to_embed, embeddings):
        mongo_doc = {
            "_id": chunk_id,
            "github_id": user_id,
            "repo_name": repo_name,
            "text": doc.page_content,
            "source": doc.metadata.get("source"),
            "embedding": embedding
        }
        operations.append(UpdateOne({"_id": chunk_id}, {"$set": mongo_doc}, upsert=True))

    result = vectors_collection.bulk_write(operations)
    updated_count = result.upserted_count + result.modified_count

    return {
        "status": "success",
        "total_chunks": len(docs),
        "updated_chunks": updated_count,
        "repo_name": repo_name
    }