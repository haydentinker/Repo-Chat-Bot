import os
from typing import List
from langgraph.prebuilt import InjectedState
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool
from langchain_core.documents import Document
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv() 


EMBEDDING_MODEL = "text-embedding-3-small"
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
def search_mongo(query: str, config: RunnableConfig) -> List[Document]:
    """
     Use this tool to search a MongoDB vector store containing GitHub repository chunks. 
    Inputs: query (the user's question), and config (user_id and repo_name). 
    Returns a list of Documents relevant to the repo.
    Search the MongoDB vector store for repository chunks
    based on user_id and repo_name.
    """
    configurable = config.get("configurable", {})
    github_id = configurable.get("user_id")
    repo_name = configurable.get("repo_name")
    
    if not github_id or not repo_name:
        raise ValueError("Both 'user_id' and 'repo_name' must be provided in config.")

    

    pre_filter = {
    "github_id": {"$eq":github_id},
    "repo_name": {"$eq": repo_name}
}


    results: List[Document] = vector_store.similarity_search(
        query,
        pre_filter=pre_filter,
        k=5
    )

    return results
