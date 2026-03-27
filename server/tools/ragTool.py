import os
from typing import Annotated, List
from langgraph.prebuilt import InjectedState
from langchain.tools import tool
from langchain_core.documents import Document
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv() 

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
def search_mongo(query: str, state: Annotated[dict, InjectedState] ) ->List[Document]:
    """Search the mongodb collection for repository information"""
    repo_name = state.get("repo_name")
    pre_filter = {
        "metadata.repo": {"$eq": repo_name}
    }
    return vector_store.similarity_search(query, pre_filter=pre_filter)
   