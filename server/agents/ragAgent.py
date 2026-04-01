import os
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_mongodb import MongoDBChatMessageHistory
from langchain_mongodb.cache import MongoDBAtlasSemanticCache
from langchain_core.globals import set_llm_cache
from langgraph.prebuilt import create_react_agent
from tools.ragTool import search_mongo

load_dotenv()
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))

SYSTEM_PROMPT = (
    "You are a helpful coding assistant that can answer questions about GitHub repositories. "
    "You have access to the following tools: search_mongo. "
    "Always use search_mongo to retrieve information from the repository before answering "
    "if the question is about repository code, files, or content. "
    "If you do not know the answer, say you do not know."
)

llm = ChatOpenAI(
    model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    streaming=True,
)

baseAgent = create_react_agent(
    llm,
    tools=[search_mongo],
    prompt=SYSTEM_PROMPT,
)

EMBEDDING_MODEL = "text-embedding-3-small"
embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
set_llm_cache(MongoDBAtlasSemanticCache(
    connection_string=os.getenv("MONGODB_CONNECTION_STRING"),
    database_name=os.getenv("MONGODB_DB_NAME"),
    collection_name="semantic_cache",
    embedding=embeddings,
    index_name="vector_index",
    similarity_threshold=0.5,
))


def get_thread_history(session_id: str):
    return MongoDBChatMessageHistory(
        connection_string=os.getenv("MONGODB_CONNECTION_STRING"),
        session_id=session_id,
        database_name=os.getenv("MONGODB_DB_NAME"),
        collection_name="thread_store",
    )


ragAgent = RunnableWithMessageHistory(
    baseAgent,
    get_thread_history,
    input_messages_key="messages",
    output_messages_key="messages",
)
