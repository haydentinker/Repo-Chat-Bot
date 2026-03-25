import os

from langchain.tools import tool
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient

model = "text-embedding-3-small"

client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
collection = client[os.getenv("MONGODB_DB_NAME")][os.getenv("MONGODB_COLLECTION_NAME")]

embeddings = OpenAIEmbeddings(model=model)

vector_store = MongoDBAtlasVectorSearch(
    collection=collection,
    embedding=embeddings,
    index_name="vectorSearch",
    relevance_score_fn="cosine"
)

@tool
def search_mongo(query: str, repo_name) -> str:
    """Search the mongodb collection for repository information"""

    pre_filter = {
        "metadata.repo.name": {"$eq": repo_name}
    }
    results = vector_store.similarity_search(query, pre_filter=pre_filter)
    return results[0].page_content