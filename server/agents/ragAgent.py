from langchain.agents import create_agent
from tools.ragTool import search_mongo
from langgraph.checkpoint.mongodb import MongoDBSaver
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_mongodb import MongoDBChatMessageHistory
from dotenv import load_dotenv
from pymongo import MongoClient
import os
load_dotenv()
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))



baseAgent = create_agent(
    model="gpt-5-nano",
    tools=[search_mongo],
    system_prompt="You are a helpful coding assistant that can answer questions about GitHub repositories. You have access to the following tools: search_mongo. Always use search_mongo to retrieve information from the repository before answering, if the question is about repository code, files, or content. If you do not know the answer, say you do not know.",
    )

def get_thread_history(session_id: str):
    return MongoDBChatMessageHistory(
        connection_string=os.getenv("MONGODB_CONNECTION_STRING"),
        session_id=session_id, 
        database_name=os.getenv("MONGODB_DB_NAME"),
        collection_name="thread_store"
    )

ragAgent = RunnableWithMessageHistory(
    baseAgent, 
    get_thread_history,
    input_messages_key="messages",
    output_messages_key="messages",
)