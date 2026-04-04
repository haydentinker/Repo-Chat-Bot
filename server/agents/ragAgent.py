import os
from contextvars import ContextVar
from datetime import datetime, UTC
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, messages_to_dict, messages_from_dict
from langchain_mongodb.cache import MongoDBAtlasSemanticCache
from langchain_core.globals import set_llm_cache
from langchain.agents import create_agent
from tools.ragTool import search_mongo


cache_namespace: ContextVar[str] = ContextVar("cache_namespace", default="")


class NamespacedSemanticCache(MongoDBAtlasSemanticCache):
    """Semantic cache that isolates entries by user + repo.

    The namespace is prepended to `llm_string` so the existing
    ``llm_string`` Atlas index handles scoping without schema changes.
    """

    def _namespaced(self, llm_string: str) -> str:
        ns = cache_namespace.get()
        return f"{ns}::{llm_string}" if ns else llm_string

    def lookup(self, prompt: str, llm_string: str):
        return super().lookup(prompt, self._namespaced(llm_string))

    def update(self, prompt: str, llm_string: str, return_val, **kwargs) -> None:
        super().update(prompt, self._namespaced(llm_string), return_val, **kwargs)


class TimestampedMongoDBChatMessageHistory(BaseChatMessageHistory):
    """Stores LangChain messages as BSON docs with timestamps and supports last-N retrieval."""

    def __init__(
        self,
        connection_string: str,
        session_id: str,
        database_name: str,
        collection_name: str,
    ):
        self.client = MongoClient(connection_string)
        self.collection = self.client[database_name][collection_name]
        self.session_id = session_id

    def get_last_messages(self, limit: int) -> list[BaseMessage]:
        """Fetch last N messages in correct chronological order."""
        docs = list(
            self.collection.find(
                {"session_id": self.session_id},
                {"history": 1, "_id": 1}, 
                sort=[("createdAt", -1), ("_id", -1)],
            ).limit(limit)
        )
        docs.reverse()

        return messages_from_dict([d["history"] for d in docs])

    @property
    def messages(self) -> list[BaseMessage]:
        """Default behavior: return last 50 messages."""
        return self.get_last_messages(limit=50)

    def add_messages(self, messages: list[BaseMessage]) -> None:
        """Insert messages with timestamps."""
        print(messages)
        docs = [
            {
                "session_id": self.session_id,
                "createdAt": datetime.now(UTC),
                "history": msg_dict,
            }
            for msg_dict in messages_to_dict(messages)
        ]

        if docs:
            self.collection.insert_many(docs)

    def clear(self) -> None:
        """Delete all messages for this session."""
        self.collection.delete_many({"session_id": self.session_id})


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

baseAgent = create_agent(
    llm,
    tools=[search_mongo],
    system_prompt=SYSTEM_PROMPT,
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


def get_thread_history(session_id: str) -> TimestampedMongoDBChatMessageHistory:
    return TimestampedMongoDBChatMessageHistory(
        connection_string=os.getenv("MONGODB_CONNECTION_STRING"),
        session_id=session_id,
        database_name=os.getenv("MONGODB_DB_NAME"),
        collection_name="thread_store",
    )


