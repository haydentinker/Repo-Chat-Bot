import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
from flask import Flask, redirect, request, jsonify
from flask_cors import CORS, cross_origin
from flask_dance.contrib.github import make_github_blueprint, github
from flask_dance.consumer import oauth_authorized
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
from langchain_core.messages import HumanMessage
from openai import OpenAI
from agents.ragAgent import baseAgent, get_thread_history
from helpers.ingestRepo import ingest_repo
from flask_socketio import SocketIO, emit
from bson import ObjectId
from datetime import datetime, UTC
load_dotenv()


class TokenStreamHandler(BaseCallbackHandler):
    """Forwards each LLM token to the correct SocketIO client."""

    def __init__(self, sid: str):
        self.sid = sid

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        if token:
            socketio.emit("chat_token", {"text": token}, to=self.sid)
            socketio.sleep(0)


app = Flask("Github-Repo-Analysis-Bot")
app.secret_key = os.getenv("FLASK_APP_SECRET")
app.config["MONGO_URI"] = os.getenv("MONGODB_CONNECTION_STRING")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False

login_manager = LoginManager(app)
login_manager.login_view = "auth_github"


class User(UserMixin):
    def __init__(self, user_doc):
        self.id = str(user_doc["_id"])
        self.github_id = user_doc["github_id"]
        self.username = user_doc["username"]
        self.email = user_doc.get("email")

    def get_id(self):
        return self.id


blueprint = make_github_blueprint(
    client_id=os.getenv("GITHUB_OAUTH_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_OAUTH_CLIENT_SECRET"),
    scope="repo",
    redirect_to="github_login_success"
)
app.register_blueprint(blueprint, url_prefix="/login")



github_client_id = os.getenv("GITHUB_OAUTH_CLIENT_ID")
github_client_secret = os.getenv("GITHUB_OAUTH_CLIENT_SECRET")
model = "text-embedding-3-small"
openai_client = OpenAI()
mongo_client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
thread_collection =mongo_client[os.getenv("MONGODB_DB_NAME")]['threads']
collection = mongo_client[os.getenv("MONGODB_DB_NAME")]['vectors']
users_collection = mongo_client[os.getenv("MONGODB_DB_NAME")]["users"]
repos_collection = mongo_client[os.getenv("MONGODB_DB_NAME")]["repos"]


@login_manager.user_loader
def load_user(user_id):
    user_doc = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        return None
    return User(user_doc)


CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:5173"],
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', ping_timeout=60, ping_interval=25)


@oauth_authorized.connect_via(blueprint)
def github_logged_in(blueprint, token):
    if not token:
        return False

    resp = blueprint.session.get("/user")
    if not resp.ok:
        return False

    github_info = resp.json()
    github_user_id = str(github_info["id"])

    user_doc = users_collection.find_one_and_update(
        {"github_id": github_user_id},
        {"$setOnInsert": {
            "github_id": github_user_id,
            "username": github_info["login"],
            "email": github_info.get("email"),
        }},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    login_user(User(user_doc))

@app.route("/users/repos", methods=["GET"])
def list_repos():
    
    resp = github.get("/user/repos")
    if not resp.ok:
        return "Error fetching repos", 500
        
    repos = resp.json()
    return {"repos": repos}

def get_repo_id(repo_url):
    return repo_url.replace("https://github.com/", "").replace(".git", "")
    
@app.route("/ingest", methods=["POST"])
def ingest():
    data = request.get_json()
    if not data or "repo_name" not in data:
        return jsonify({"status": "error", "message": "Missing 'repo_name' in request body"}), 400

    repo_name = data["repo_name"]
    github_token = github.token["access_token"]
    result = ingest_repo(current_user.github_id, repo_name, github_token)
    return jsonify(result)

@app.route("/auth/github")
def auth_github():
    return redirect("/login/github")


@app.route("/auth/success")
def github_login_success():
    if not current_user.is_authenticated:
        return redirect("http://localhost:3000")
    return redirect("http://localhost:5173/dashboard")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"status": "logged out"})


@app.route("/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 401
    return jsonify({
        "github_id": current_user.github_id,
        "username": current_user.username,
        "email": current_user.email,
        "authenticated": True,
    })


@app.before_request
def check_authentication():
    public_endpoints = {'github.login', 'github.authorized', 'auth_github', 'github_login_success', 'static'}

    if request.endpoint in public_endpoints or request.method == "OPTIONS":
        return

    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401
@app.route("/user/loaded/repos")
def user_repos():
    docs = repos_collection.find(
        {"github_id": current_user.github_id},
        {"_id": 0, "github_id": 0}
    )
    return jsonify(list(docs))

@app.route("/user/threads")
def user_threads():
    repo_name = request.args.get("repo_name")
    if not repo_name:
        return jsonify({"error": "Missing 'repo_name' query parameter"}), 400
    docs = thread_collection.find(
        {"github_id": current_user.github_id, "repo_name": repo_name},
        {"_id": 0, "github_id": 0},
    ).sort("last_updated", -1)
    return jsonify(list(docs))


@app.route("/user/thread/<session_id>/messages")
def thread_messages(session_id):
    thread_doc = thread_collection.find_one({
        "session_id": session_id,
        "github_id": current_user.github_id,
    })
    if not thread_doc:
        return jsonify({"error": "Thread not found"}), 404

    history = get_thread_history(session_id)
    lc_messages = history.get_last_messages(limit=50)

    messages = []
    for msg in lc_messages:
        if msg.type not in ("human", "ai"):
            continue
        content = msg.content if isinstance(msg.content, str) else ""
        if not content:
            continue
        role = "user" if msg.type == "human" else "assistant"
        messages.append({"role": role, "content": content})

    return jsonify(messages)
@socketio.on("message")
def handle_message(data):
    message = data.get("message")
    repo_name = data.get("repo_name")
    session_id = data.get("session_id")
    github_id = current_user.github_id if current_user.is_authenticated else None
    sid = request.sid
    now = datetime.now(UTC)

    if not message or not repo_name:
        emit("response", {"error": "Both 'message' and 'repo_name' are required"})
        return

    if session_id:
        thread_collection.update_one(
            {"session_id": session_id},
            {"$set": {"last_updated": now}}
        )
    else:
        session_id = str(ObjectId())
        thread_collection.insert_one({
            "session_id": session_id,
            "github_id": github_id,
            "repo_name": repo_name,
            "created_at": now,
            "last_updated": now,
            "name": message
        })

    user_context = {
        "configurable": {
            "github_id": github_id,
            "repo_name": repo_name,
            "session_id": session_id
        }
    }

    def stream_task():
        try:
            config = RunnableConfig(
                callbacks=[TokenStreamHandler(sid)],
                configurable=user_context["configurable"],
            )
            history = get_thread_history(session_id)
            prior_messages = history.messages
            all_messages = prior_messages + [HumanMessage(content=message)]
            result = baseAgent.invoke({"messages": all_messages}, config=config)
            new_messages = result["messages"][len(prior_messages):]
            history.add_messages(new_messages)
        except Exception as e:
            print(f"Stream error: {e}")
            socketio.emit("chat_token", {"text": "\nAn error occurred while processing your request."}, to=sid)
        finally:
            socketio.emit("stream_complete", {"status": "done", "session_id": session_id}, to=sid)

    socketio.start_background_task(stream_task)

if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
