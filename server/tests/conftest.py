"""
Set up environment variables and module stubs before any application
code is imported. pytest loads conftest.py first, so patching here
prevents the module-level MongoClient / OpenAI / LangChain connections
from failing in CI or local runs that have no real services.
"""

import os
import sys
from unittest.mock import MagicMock

os.environ.setdefault("MONGODB_CONNECTION_STRING", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "testdb")
os.environ.setdefault("OPENAI_API_KEY", "test-key-xxxx")
os.environ.setdefault("FLASK_APP_SECRET", "test-secret")
os.environ.setdefault("GITHUB_OAUTH_CLIENT_ID", "test-client-id")
os.environ.setdefault("GITHUB_OAUTH_CLIENT_SECRET", "test-client-secret")

sys.modules.setdefault("agents.ragAgent", MagicMock())
