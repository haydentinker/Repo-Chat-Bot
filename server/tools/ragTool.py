import os
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

EMBEDDING_MODEL = "text-embedding-3-small"
RAG_K = int(os.getenv("RAG_K", "5"))

embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
collection = client[os.getenv("MONGODB_DB_NAME")]["vectors"]

vector_store = MongoDBAtlasVectorSearch(
    collection=collection,
    embedding=embeddings,
    index_name="vector_index",
    relevance_score_fn="cosine"
)


@tool
def search_mongo(query: str, config: RunnableConfig) -> str:
    """
    Use this tool to search a MongoDB vector store containing GitHub repository chunks.
    Inputs: query (the user's question), and config (github_id and repo_name).
    Returns relevant code/content from the repository with source file references.
    Search the MongoDB vector store for repository chunks based on github_id and repo_name.
    """
    configurable = config.get("configurable", {})
    github_id = configurable.get("github_id")
    repo_name = configurable.get("repo_name")

    if not github_id or not repo_name:
        raise ValueError("Both 'github_id' and 'repo_name' must be provided in config.")

    pre_filter = {
        "github_id": {"$eq": github_id},
        "repo_name": {"$eq": repo_name},
    }

    results = vector_store.similarity_search(query, pre_filter=pre_filter, k=RAG_K)

    if not results:
        return "__SOURCES__:\n\nNo relevant content found in the repository for this query."

    source_files = sorted({
        doc.metadata.get("source", "")
        for doc in results
        if doc.metadata.get("source")
    })

    sources_line = "__SOURCES__:" + ",".join(source_files)
    content_sections = "\n\n---\n\n".join(
        f"[{doc.metadata.get('source', 'unknown')}]\n{doc.page_content}"
        for doc in results
    )

    return f"{sources_line}\n\n{content_sections}"
