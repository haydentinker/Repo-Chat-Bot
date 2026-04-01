# Repo Chat Bot

A RAG-powered chat application that lets you have a conversation with any of your GitHub repositories. Ingest a repo, ask questions about the code, and get streamed responses from an AI assistant that has read and indexed the entire codebase.

---

## How it works

```
Browser (React + Mantine)
        │  GitHub OAuth (flask-dance)
        │  WebSocket (socket.io)
        ▼
Flask Server (Python)
        │  Embed & store chunks        │  Vector similarity search
        ▼
MongoDB Atlas
        │  Semantic cache
        │  Chat history
        │  User / repo registry
        ▼
OpenAI API  ──►  LangGraph ReAct Agent  ──►  Streamed tokens back to browser
```

1. **Auth** — Users sign in with GitHub OAuth. flask-login manages the session via a MongoDB-backed user loader.
2. **Ingest** — A repository's supported files (`.py`, `.ts`, `.js`, `.md`, `.json`, `.txt`) are fetched from GitHub, split into overlapping chunks, embedded with `text-embedding-3-small`, and stored in a MongoDB Atlas vector index. Subsequent ingests compare the latest commit SHA against the stored one and only re-embed changed files.
3. **Chat** — Messages are sent over a WebSocket. The Flask server invokes a LangGraph ReAct agent that calls a `search_mongo` tool to retrieve relevant chunks, then streams the response token-by-token back to the browser using a LangChain `BaseCallbackHandler`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Mantine v8, socket.io-client |
| Backend | Python, Flask, Flask-SocketIO (eventlet), flask-login, flask-dance |
| AI / RAG | LangGraph, LangChain, OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |
| Database | MongoDB Atlas (vectors, users, repos, threads, semantic cache) |
| Auth | GitHub OAuth 2.0 |

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster with a vector search index named `vector_index` on the `vectors` collection
- A GitHub OAuth App ([create one here](https://github.com/settings/developers)) with callback URL `http://localhost:5000/login/github/authorized`
- An OpenAI API key

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/Repo-Chat-Bot.git
cd Repo-Chat-Bot
```

**Frontend:**
```bash
cd app
npm install
```

**Backend:**
```bash
cd server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o-mini`) |
| `MONGODB_CONNECTION_STRING` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret |
| `FLASK_APP_SECRET` | Random secret key for Flask sessions |
| `LANGSMITH_API_KEY` | (Optional) LangSmith API key for tracing |
| `LANGSMITH_TRACING` | (Optional) `true` to enable LangSmith tracing |
| `LANGSMITH_PROJECT` | (Optional) LangSmith project name |

### 3. Create the MongoDB Atlas vector search index

On the `vectors` collection, create a vector search index named `vector_index` with this definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "github_id" },
    { "type": "filter", "path": "repo_name" }
  ]
}
```

---

## Running the app

**Backend** (from `server/`):
```bash
python app.py
```
Runs on `http://localhost:5000`.

**Frontend** (from `app/`):
```bash
npm run dev
```
Runs on `http://localhost:5173`.

Then open `http://localhost:5173` in your browser and sign in with GitHub.

---

## Running tests

**Backend** (from `server/`):
```bash
pytest tests/ -v
```

**Frontend** (from `app/`):
```bash
npm test           # single run
npm run test:watch # watch mode
```

---

## Project structure

```
├── app/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.tsx        # Streaming chat UI with mock mode
│   │   │   ├── Navbar.tsx      # Repo selector sidebar
│   │   │   └── PrivateRoute.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx   # Main app shell
│   │   │   └── Home.tsx
│   │   └── providers/
│   │       └── AuthProvider.tsx
│   └── package.json
│
└── server/                     # Flask backend
    ├── agents/
    │   └── ragAgent.py         # LangGraph ReAct agent + message history
    ├── helpers/
    │   └── ingestRepo.py       # GitHub ingestion + incremental updates
    ├── tools/
    │   └── ragTool.py          # MongoDB vector search tool
    ├── tests/
    │   ├── test_ingest.py      # Unit + integration tests for ingest logic
    │   └── test_routes.py      # Flask route tests
    ├── app.py                  # Flask app, routes, SocketIO handlers
    └── requirements.txt
```
