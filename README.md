# Repo Chat Bot

A RAG-powered chat application that lets you have a conversation with any of your GitHub repositories. Ingest a repo, ask questions about the code, and get streamed AI responses that have read and indexed your entire codebase.

---

## How it works

```
Browser (React + Mantine)
        │  GitHub OAuth (flask-dance)
        │  WebSocket (socket.io)
        ▼
Flask Server (Python)
        │  Rate limiting (flask-limiter)
        │  Async ingestion (eventlet background tasks)
        ▼
MongoDB Atlas
        │  Vector index (text-embedding-3-small, 1536 dims)
        │  Semantic cache · Chat history · User / repo registry
        ▼
OpenAI API  ──►  LangGraph ReAct Agent  ──►  Streamed tokens → browser
```

1. **Auth** — GitHub OAuth via flask-dance. flask-login manages the session; user records live in MongoDB.
2. **Ingest** — Supported files are fetched from GitHub, split into overlapping chunks, embedded with `text-embedding-3-small`, and bulk-upserted into a MongoDB Atlas vector index. Subsequent ingests diff the latest commit SHA against the stored one and only re-embed changed files. Progress is streamed back to the browser over WebSocket.
3. **Chat** — Messages go over a WebSocket. A LangGraph ReAct agent calls a `search_mongo` tool to retrieve relevant chunks, then streams the response token-by-token via a LangChain `BaseCallbackHandler`.
4. **Billing** — Stripe Checkout and webhooks gate access to paid plans. Free users get 100 messages and 2 repos; Pro users get unlimited messages and 5 repos.

---

## Tech stack

| Layer    | Technology                                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Mantine v8, socket.io-client                          |
| Backend  | Python, Flask, Flask-SocketIO (eventlet), flask-login, flask-dance, flask-limiter |
| AI / RAG | LangGraph, LangChain, OpenAI (`gpt-4o-mini`, `text-embedding-3-small`)            |
| Database | MongoDB Atlas (vectors, users, repos, threads, semantic cache)                    |
| Auth     | GitHub OAuth 2.0                                                                  |
| Billing  | Stripe (Checkout, webhooks, billing portal)                                       |
| CI       | GitHub Actions (pytest + Vite build on every push/PR)                             |

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster with a vector search index (see below)
- A GitHub OAuth App ([create one here](https://github.com/settings/developers)) with callback URL `http://localhost:5000/login/github/authorized`
- An OpenAI API key
- A Stripe account with a Pro subscription product (for billing features)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/haydentinker/Repo-Chat-Bot.git
cd Repo-Chat-Bot
```

**Frontend:**

```bash
cd app && npm install
```

**Backend:**

```bash
cd server
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

| Variable                     | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `OPENAI_API_KEY`             | OpenAI API key                                     |
| `OPENAI_MODEL`               | Model to use (default: `gpt-4o-mini`)              |
| `MONGODB_CONNECTION_STRING`  | MongoDB Atlas connection string                    |
| `MONGODB_DB_NAME`            | Database name                                      |
| `MONGODB_COLLECTION_NAME`    | Vectors collection name                            |
| `MONGODB_INDEX_NAME`         | Vector search index name                           |
| `GITHUB_ACCESS_TOKEN`        | Personal access token for private repo ingestion   |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub OAuth App client ID                         |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret                     |
| `FLASK_APP_SECRET`           | Random secret for Flask sessions                   |
| `FRONTEND_URL`               | Frontend origin (default: `http://localhost:5173`) |
| `STRIPE_SECRET_KEY`          | Stripe secret key (`sk_live_…` or `sk_test_…`)     |
| `STRIPE_WEBHOOK_SECRET`      | Stripe webhook signing secret (`whsec_…`)          |
| `STRIPE_PRO_PRICE_ID`        | Price ID for the Pro plan (`price_…`)              |
| `LANGSMITH_API_KEY`          | (Optional) LangSmith API key for tracing           |
| `LANGSMITH_TRACING`          | (Optional) `true` to enable tracing                |
| `LANGSMITH_PROJECT`          | (Optional) LangSmith project name                  |

### 3. Create the MongoDB Atlas vector search index

On the `vectors` collection, create an index named `vector_index`:

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

---

## Running tests

**Backend** (from `server/`):

```bash
pytest tests/ -v
```

**Frontend** (from `app/`):

```bash
npm test
```

Tests run automatically on every push and pull request via GitHub Actions.

---

## Project structure

```
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: pytest + Vite build on push/PR
│
├── app/                        # React frontend
│   └── src/
│       ├── components/
│       │   ├── Chat.tsx        # Streaming chat UI
│       │   ├── Navbar.tsx      # Repo + thread sidebar
│       │   ├── UpgradeModal.tsx
│       │   └── Logo.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx   # Main app shell
│       │   ├── Home.tsx        # Marketing / pricing page
│       │   ├── Plans.tsx       # Plan selection
│       │   └── CheckoutSuccess.tsx
│       ├── providers/
│       │   └── AuthProvider.tsx
│       └── lib/
│           ├── api.ts
│           └── stripe.ts       # redirectToCheckout / redirectToBillingPortal
│
└── server/                     # Flask backend
    ├── agents/
    │   └── ragAgent.py         # LangGraph ReAct agent + message history
    ├── helpers/
    │   └── ingestRepo.py       # GitHub ingestion, incremental updates, progress callbacks
    ├── tools/
    │   └── ragTool.py          # MongoDB vector search tool
    ├── tests/
    │   ├── conftest.py
    │   ├── test_ingest.py
    │   ├── test_routes.py
    │   └── test_socket.py
    ├── app.py                  # Routes, SocketIO handlers, rate limiting, Stripe webhooks
    └── requirements.txt
```
