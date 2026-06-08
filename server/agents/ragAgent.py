import logging
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

logger = logging.getLogger(__name__)

cache_namespace: ContextVar[str] = ContextVar("cache_namespace", default="")

MESSAGE_HISTORY_LIMIT = int(os.getenv("MESSAGE_HISTORY_LIMIT", "50"))
CACHE_SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.5"))


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

    def __init__(self, collection, session_id: str):
        self.collection = collection
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
        """Return last N messages (configurable via MESSAGE_HISTORY_LIMIT)."""
        return self.get_last_messages(limit=MESSAGE_HISTORY_LIMIT)

    def add_messages(self, messages: list[BaseMessage]) -> None:
        """Insert messages with timestamps."""
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
            logger.debug("Stored %d message(s) for session %s", len(docs), self.session_id)

    def clear(self) -> None:
        """Delete all messages for this session."""
        self.collection.delete_many({"session_id": self.session_id})


load_dotenv()
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
thread_store_collection = client[os.getenv("MONGODB_DB_NAME")]["thread_store"]

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
set_llm_cache(NamespacedSemanticCache(
    connection_string=os.getenv("MONGODB_CONNECTION_STRING"),
    database_name=os.getenv("MONGODB_DB_NAME"),
    collection_name="semantic_cache",
    embedding=embeddings,
    index_name="vector_index",
    similarity_threshold=CACHE_SIMILARITY_THRESHOLD,
))


def get_thread_history(session_id: str) -> TimestampedMongoDBChatMessageHistory:
    return TimestampedMongoDBChatMessageHistory(
        collection=thread_store_collection,
        session_id=session_id,
    )
