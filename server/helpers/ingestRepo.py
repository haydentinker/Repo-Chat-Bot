import os
import hashlib
import base64
import requests as http_requests
from langchain_community.document_loaders import GithubFileLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient, UpdateOne
from openai import OpenAI
from datetime import datetime, UTC

mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
db = mongo_client[os.getenv("MONGODB_DB_NAME")]
users_collection = db["users"]
vectors_collection = db["vectors"]
repos_collection = db["repos"]

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
# OpenAI enforces 300k tokens per embeddings request; at ~300 tokens/chunk
# this keeps each batch comfortably under that limit.
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "500"))
SUPPORTED_EXTENSIONS = {
    ".md", ".mdx", ".rst", ".txt",
    ".py", ".pyi",
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".html", ".css", ".scss", ".sass",
    ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".env.example",
    ".sh", ".bash", ".zsh",
    ".go", ".rb", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".swift", ".kt",
    ".tf", ".hcl", ".dockerfile", ".sql",
}


def hash_text(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def is_supported(path: str) -> bool:
    return any(path.endswith(ext) for ext in SUPPORTED_EXTENSIONS)


def gh_headers(github_token: str) -> dict:
    return {"Authorization": f"token {github_token}", "Accept": "application/vnd.github+json"}


def get_latest_commit_sha(repo_name: str, branch: str, github_token: str) -> str:
    url = f"https://api.github.com/repos/{repo_name}/commits/{branch}"
    resp = http_requests.get(url, headers=gh_headers(github_token))
    resp.raise_for_status()
    return resp.json()["sha"]


def fetch_repo_summary(repo_name: str, branch: str, github_token: str) -> dict:
    """Return a brief summary dict with the repo description and README excerpt."""
    summary: dict = {"description": "", "readme_excerpt": ""}

    meta_resp = http_requests.get(
        f"https://api.github.com/repos/{repo_name}",
        headers=gh_headers(github_token),
    )
    if meta_resp.ok:
        summary["description"] = meta_resp.json().get("description") or ""

    readme_content = fetch_file_content(repo_name, "README.md", branch, github_token)
    if readme_content:
        summary["readme_excerpt"] = readme_content[:2000]

    return summary


def get_changed_files(repo_name: str, base_sha: str, head_sha: str, github_token: str) -> list:
    url = f"https://api.github.com/repos/{repo_name}/compare/{base_sha}...{head_sha}"
    resp = http_requests.get(url, headers=gh_headers(github_token))
    resp.raise_for_status()
    return resp.json().get("files", [])


def fetch_file_content(repo_name: str, file_path: str, branch: str, github_token: str) -> str | None:
    url = f"https://api.github.com/repos/{repo_name}/contents/{file_path}"
    resp = http_requests.get(url, params={"ref": branch}, headers=gh_headers(github_token))
    if not resp.ok:
        return None
    data = resp.json()
    if data.get("encoding") == "base64":
        return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    return data.get("content")


def embed_and_upsert(
    documents: list,
    user_id: str,
    repo_name: str,
    progress_cb=None,
    progress_start: int = 20,
    progress_end: int = 90,
) -> int:
    if not documents:
        return 0

    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks = splitter.split_documents(documents)
    if not chunks:
        return 0

    total_modified = 0
    num_batches = max(1, (len(chunks) + EMBED_BATCH_SIZE - 1) // EMBED_BATCH_SIZE)

    for batch_idx, i in enumerate(range(0, len(chunks), EMBED_BATCH_SIZE)):
        batch = chunks[i : i + EMBED_BATCH_SIZE]
        texts = [c.page_content for c in batch]
        response = openai_client.embeddings.create(input=texts, model=EMBEDDING_MODEL)
        embeddings_list = [item.embedding for item in response.data]

        operations = [
            UpdateOne(
                {"_id": hash_text(chunk.page_content)},
                {"$set": {
                    "github_id": user_id,
                    "repo_name": repo_name,
                    "text": chunk.page_content,
                    "source": chunk.metadata.get("source"),
                    "embedding": embedding,
                }},
                upsert=True,
            )
            for chunk, embedding in zip(batch, embeddings_list)
        ]

        result = vectors_collection.bulk_write(operations)
        total_modified += result.upserted_count + result.modified_count

        if progress_cb:
            pct = progress_start + int((batch_idx + 1) / num_batches * (progress_end - progress_start))
            progress_cb(pct, f"Embedding chunks… ({min(i + EMBED_BATCH_SIZE, len(chunks))}/{len(chunks)})")

    return total_modified


def ingest_repo(user_id: str, repo_name: str, github_token: str, branch: str = "main", progress_cb=None) -> dict:
    user = users_collection.find_one({"github_id": user_id})
    if not user:
        return {"status": "error", "message": "User does not exist."}

    if progress_cb:
        progress_cb(5, "Fetching latest commit…")

    try:
        current_sha = get_latest_commit_sha(repo_name, branch, github_token)
    except Exception as e:
        return {"status": "error", "message": f"Failed to get latest commit: {str(e)}"}

    repo_doc = repos_collection.find_one({"github_id": user_id, "repo_name": repo_name})
    stored_sha = repo_doc.get("last_commit_sha") if repo_doc else None

    if stored_sha == current_sha:
        return {
            "status": "success",
            "message": "Repository is already up to date.",
            "repo_name": repo_name,
            "updated_chunks": 0,
        }

    if stored_sha is None:
        if progress_cb:
            progress_cb(10, "Loading repository files…")

        try:
            loader = GithubFileLoader(
                repo=repo_name,
                branch=branch,
                access_token=github_token,
                file_filter=is_supported,
            )
            documents = loader.load()
        except Exception as e:
            return {"status": "error", "message": f"Failed to load repo: {str(e)}"}

        if not documents:
            return {"status": "error", "message": "No supported files found in repo."}

        if progress_cb:
            progress_cb(20, f"Loaded {len(documents)} files. Embedding…")

        updated_count = embed_and_upsert(documents, user_id, repo_name, progress_cb=progress_cb)

    else:
        if progress_cb:
            progress_cb(10, "Detecting changed files…")

        try:
            changed_files = get_changed_files(repo_name, stored_sha, current_sha, github_token)
        except Exception as e:
            return {"status": "error", "message": f"Failed to get changed files: {str(e)}"}

        supported_changes = [f for f in changed_files if is_supported(f["filename"])]

        if not supported_changes:
            repos_collection.update_one(
                {"github_id": user_id, "repo_name": repo_name},
                {"$set": {"last_commit_sha": current_sha, "last_ingested": datetime.now(UTC)}},
            )
            return {
                "status": "success",
                "message": "No supported file changes in this commit.",
                "repo_name": repo_name,
                "updated_chunks": 0,
            }

        if progress_cb:
            progress_cb(20, f"Re-indexing {len(supported_changes)} changed file(s)…")

        paths_to_delete = [f["filename"] for f in supported_changes]
        paths_to_delete += [
            f["previous_filename"]
            for f in supported_changes
            if f["status"] == "renamed" and is_supported(f.get("previous_filename", ""))
        ]
        vectors_collection.delete_many({
            "github_id": user_id,
            "repo_name": repo_name,
            "source": {"$in": paths_to_delete},
        })

        documents = []
        for f in supported_changes:
            if f["status"] == "removed":
                continue
            content = fetch_file_content(repo_name, f["filename"], branch, github_token)
            if content:
                documents.append(Document(
                    page_content=content,
                    metadata={"source": f["filename"]},
                ))

        updated_count = embed_and_upsert(documents, user_id, repo_name, progress_cb=progress_cb)

    if progress_cb:
        progress_cb(92, "Saving index metadata…")

    chunk_count = vectors_collection.count_documents({"github_id": user_id, "repo_name": repo_name})
    repo_summary = fetch_repo_summary(repo_name, branch, github_token)

    repos_collection.update_one(
        {"github_id": user_id, "repo_name": repo_name},
        {"$set": {
            "branch": branch,
            "last_ingested": datetime.now(UTC),
            "last_commit_sha": current_sha,
            "chunk_count": chunk_count,
            "description": repo_summary["description"],
            "readme_excerpt": repo_summary["readme_excerpt"],
        }, "$setOnInsert": {
            "github_id": user_id,
            "repo_name": repo_name,
        }},
        upsert=True,
    )

    return {
        "status": "success",
        "repo_name": repo_name,
        "updated_chunks": updated_count,
        "chunk_count": chunk_count,
    }
