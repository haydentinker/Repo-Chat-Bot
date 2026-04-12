import eventlet
eventlet.monkey_patch()

import logging
import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
from flask import Flask, redirect, request, jsonify
from flask_cors import CORS
from flask_dance.contrib.github import make_github_blueprint, github
from flask_dance.consumer import oauth_authorized
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.runnables import RunnableConfig
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument
from langchain_core.messages import HumanMessage, SystemMessage
from openai import OpenAI
from agents.ragAgent import baseAgent, get_thread_history, cache_namespace
from helpers.ingestRepo import ingest_repo, get_latest_commit_sha
from flask_socketio import SocketIO, emit, join_room
from bson import ObjectId
from datetime import datetime, UTC
import stripe
load_dotenv()

stripe.api_key = (os.getenv("STRIPE_SECRET_KEY") or "").strip()
STRIPE_WEBHOOK_SECRET = (os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip()
STRIPE_PRO_PRICE_ID = (os.getenv("STRIPE_PRO_PRICE_ID") or "").strip()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

THREADS_PAGE_LIMIT = 20


class TokenStreamHandler(BaseCallbackHandler):
    def __init__(self, sid: str):
        self.sid = sid
        self._sources: set[str] = set()

    def on_llm_new_token(self, token: str, **__) -> None:
        if token:
            socketio.emit("chat_token", {"text": token}, to=self.sid)
            socketio.sleep(0)

    def on_tool_end(self, output, **__) -> None:
        output_str = str(output) if not isinstance(output, str) else output
        for line in output_str.split("\n"):
            if line.startswith("__SOURCES__:"):
                sources_part = line[len("__SOURCES__:"):]
                for src in sources_part.split(","):
                    src = src.strip()
                    if src:
                        self._sources.add(src)
                break

    @property
    def sources(self) -> list[str]:
        return sorted(self._sources)


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
thread_collection = mongo_client[os.getenv("MONGODB_DB_NAME")]['threads']
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
    origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet', ping_timeout=60, ping_interval=25)


def _rate_limit_key():
    if current_user.is_authenticated:
        return f"user:{current_user.github_id}"
    return get_remote_address()


limiter = Limiter(
    key_func=_rate_limit_key,
    app=app,
    default_limits=[],
    storage_uri="memory://",
)


_socket_message_timestamps: dict[str, list[float]] = {}
_SOCKET_RATE_WINDOW = 60.0
_SOCKET_RATE_LIMIT = 30


def _socket_rate_limited(github_id: str) -> bool:
    import time
    now = time.monotonic()
    window_start = now - _SOCKET_RATE_WINDOW
    timestamps = _socket_message_timestamps.get(github_id, [])
    timestamps = [t for t in timestamps if t > window_start]
    if len(timestamps) >= _SOCKET_RATE_LIMIT:
        _socket_message_timestamps[github_id] = timestamps
        return True
    timestamps.append(now)
    _socket_message_timestamps[github_id] = timestamps
    return False


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
@limiter.limit("10 per minute")
def ingest():
    data = request.get_json()
    if not data or "repo_name" not in data:
        return jsonify({"status": "error", "message": "Missing 'repo_name' in request body"}), 400

    repo_name = data["repo_name"]
    github_token = github.token["access_token"]
    github_id = current_user.github_id
    user_room = f"user:{github_id}"

    existing = repos_collection.find_one(
        {"github_id": github_id, "repo_name": repo_name},
        {"last_commit_sha": 1},
    )
    had_data = bool(existing and existing.get("last_commit_sha"))

    if not had_data and not existing:
        user_doc = users_collection.find_one({"github_id": github_id}, {"plan": 1})
        user_plan = (user_doc or {}).get("plan", "free")
        repo_limit = PRO_PLAN_REPO_LIMIT if user_plan == "pro" else FREE_PLAN_REPO_LIMIT
        repo_count = repos_collection.count_documents({
            "github_id": github_id,
            "status": {"$in": ["complete", "ingesting"]},
        })
        if repo_count >= repo_limit:
            return jsonify({
                "status": "error",
                "message": f"Repo limit reached. Your {user_plan} plan allows up to {repo_limit} repositories.",
                "limit_reached": True,
            }), 403

    repos_collection.update_one(
        {"github_id": github_id, "repo_name": repo_name},
        {"$set": {"status": "ingesting", "github_id": github_id, "repo_name": repo_name}},
        upsert=True,
    )

    def ingest_task():
        def progress(pct: int, message: str) -> None:
            socketio.emit(
                "ingest_progress",
                {"repo_name": repo_name, "progress": pct, "message": message},
                to=user_room,
            )

        try:
            result = ingest_repo(github_id, repo_name, github_token, progress_cb=progress)
            if result.get("status") == "success":
                repos_collection.update_one(
                    {"github_id": github_id, "repo_name": repo_name},
                    {"$set": {"status": "complete"}},
                )
            else:
                _revert_ingesting_status(github_id, repo_name, had_data)
            socketio.emit("ingest_complete", result, to=user_room)
        except Exception as e:
            logger.exception("Ingestion error for %s/%s: %s", github_id, repo_name, e)
            _revert_ingesting_status(github_id, repo_name, had_data)
            socketio.emit("ingest_complete", {
                "status": "error",
                "repo_name": repo_name,
                "message": str(e),
            }, to=user_room)

    socketio.start_background_task(ingest_task)
    return jsonify({"status": "queued", "repo_name": repo_name})


def _revert_ingesting_status(github_id: str, repo_name: str, had_data: bool) -> None:
    if had_data:
        repos_collection.update_one(
            {"github_id": github_id, "repo_name": repo_name},
            {"$set": {"status": "complete"}},
        )
    else:
        repos_collection.delete_one({"github_id": github_id, "repo_name": repo_name})

@app.route("/auth/github")
def auth_github():
    return redirect("/login/github")


@app.route("/auth/success")
def github_login_success():
    if not current_user.is_authenticated:
        return redirect(os.getenv("FRONTEND_URL", "http://localhost:5173"))
    return redirect(f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/dashboard")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"status": "logged out"})


def _user_payload(user_doc: dict | None = None) -> dict:
    doc = user_doc or users_collection.find_one({"_id": ObjectId(current_user.id)}) or {}
    plan = doc.get("plan")
    credits_remaining = doc.get("credits_remaining")
    if credits_remaining is None and plan == "free":
        credits_remaining = FREE_PLAN_CREDITS
    return {
        "authenticated": True,
        "github_id": current_user.github_id,
        "username": current_user.username,
        "email": current_user.email,
        "plan": plan,
        "credits_remaining": credits_remaining,
    }


FREE_PLAN_CREDITS = int(os.getenv("FREE_PLAN_CREDITS", "100"))
FREE_PLAN_REPO_LIMIT = 2
PRO_PLAN_REPO_LIMIT = 5


@app.route("/auth/status")
def auth_status():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False})
    return jsonify(_user_payload())


@app.route("/me")
def me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 401
    return jsonify(_user_payload())


@app.route("/user/plan/activate", methods=["POST"])
def activate_plan():
    data = request.get_json(silent=True) or {}
    plan = data.get("plan")
    if plan not in ("free", "pro", "team"):
        return jsonify({"error": "Invalid plan. Must be one of: free, pro, team"}), 400

    update: dict = {"plan": plan}
    if plan == "free":
        update["credits_remaining"] = FREE_PLAN_CREDITS
    else:
        update["credits_remaining"] = -1

    users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": update},
    )
    return jsonify(_user_payload())


@app.route("/stripe/create-checkout-session", methods=["POST"])
@limiter.limit("5 per hour")
def create_checkout_session():
    data = request.get_json(silent=True) or {}
    plan = data.get("plan", "pro")

    price_id = STRIPE_PRO_PRICE_ID if plan == "pro" else None
    if not price_id:
        return jsonify({"error": "Invalid plan"}), 400

    user_doc = users_collection.find_one(
        {"github_id": current_user.github_id},
        {"stripe_customer_id": 1, "email": 1},
    )
    customer_id = (user_doc or {}).get("stripe_customer_id")

    params: dict = {
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "subscription",
        "success_url": (
            f"{os.getenv('FRONTEND_URL')}/checkout/success"
            "?session_id={CHECKOUT_SESSION_ID}"
        ),
        "cancel_url": f"{os.getenv('FRONTEND_URL')}/plans",
        "metadata": {"github_id": current_user.github_id},
    }
    if customer_id:
        params["customer"] = customer_id
    elif current_user.email:
        params["customer_email"] = current_user.email

    try:
        session = stripe.checkout.Session.create(**params)
        return jsonify({"url": session.url})
    except stripe.StripeError as e:
        logger.exception("Stripe checkout error: %s", e)
        return jsonify({"error": str(e)}), 400


@app.route("/stripe/webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data(cache=True)
    sig = request.headers.get("Stripe-Signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET is not set")
        return jsonify({"error": "Webhook secret not configured"}), 500

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except ValueError as e:
        logger.error("Stripe webhook: invalid payload — %s", e)
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.SignatureVerificationError as e:
        logger.error("Stripe webhook: signature mismatch — %s", e)
        return jsonify({"error": "Invalid signature"}), 400

    event_type = event.type
    obj = event.data.object

    if event_type == "checkout.session.completed":
        payment_status = getattr(obj, "payment_status", None)
        metadata = getattr(obj, "metadata", None)
        github_id = metadata["github_id"] if metadata and "github_id" in metadata else None
        customer = getattr(obj, "customer", None)
        subscription = getattr(obj, "subscription", None)

        if github_id and payment_status == "paid":
            users_collection.update_one(
                {"github_id": github_id},
                {"$set": {
                    "plan": "pro",
                    "credits_remaining": -1,
                    "stripe_customer_id": customer,
                    "stripe_subscription_id": subscription,
                }},
            )
        elif not github_id:
            logger.warning("checkout.session.completed: no github_id in session metadata")
        else:
            logger.warning("checkout.session.completed: payment_status=%s — skipping", payment_status)

    elif event_type == "invoice.payment_succeeded":
        billing_reason = getattr(obj, "billing_reason", None)
        if billing_reason == "subscription_create":
            customer = getattr(obj, "customer", None)
            subscription = getattr(obj, "subscription", None)
            if customer:
                users_collection.update_one(
                    {"stripe_customer_id": customer},
                    {"$set": {
                        "plan": "pro",
                        "credits_remaining": -1,
                        "stripe_subscription_id": subscription,
                    }},
                )

    elif event_type == "customer.subscription.deleted":
        customer_id = getattr(obj, "customer", None)
        if customer_id:
            users_collection.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {
                    "plan": "free",
                    "credits_remaining": FREE_PLAN_CREDITS,
                    "stripe_subscription_id": None,
                }},
            )

    elif event_type == "customer.subscription.updated":
        customer_id = getattr(obj, "customer", None)
        status = getattr(obj, "status", None)
        if customer_id and status == "active":
            users_collection.update_one(
                {"stripe_customer_id": customer_id},
                {"$set": {"plan": "pro", "credits_remaining": -1}},
            )

    return jsonify({"status": "ok"})


@app.route("/stripe/portal", methods=["POST"])
def billing_portal():
    user_doc = users_collection.find_one(
        {"github_id": current_user.github_id},
        {"stripe_customer_id": 1},
    )
    customer_id = (user_doc or {}).get("stripe_customer_id")
    if not customer_id:
        return jsonify({"error": "No billing account found"}), 404

    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{os.getenv('FRONTEND_URL')}/dashboard",
        )
        return jsonify({"url": portal.url})
    except stripe.StripeError as e:
        logger.exception("Stripe portal error: %s", e)
        return jsonify({"error": str(e)}), 400


@app.before_request
def check_authentication():
    public_endpoints = {'github.login', 'github.authorized', 'auth_github', 'github_login_success', 'static', 'auth_status'}

    if request.endpoint in public_endpoints or request.method == "OPTIONS":
        return

    if request.path.startswith("/socket.io"):
        return

    if request.path == "/stripe/webhook":
        return

    if not current_user.is_authenticated:
        return jsonify({"error": "Not authenticated"}), 401

@app.route("/user/loaded/repos")
def user_repos():
    docs = repos_collection.find(
        {
            "github_id": current_user.github_id,
            "$or": [{"status": "complete"}, {"status": {"$exists": False}}],
        },
        {"_id": 0, "github_id": 0, "status": 0},
    )
    return jsonify(list(docs))


@app.route("/user/ingesting/repos")
def ingesting_repos():
    docs = repos_collection.find(
        {"github_id": current_user.github_id, "status": "ingesting"},
        {"_id": 0, "repo_name": 1},
    )
    return jsonify([d["repo_name"] for d in docs])


@app.route("/user/repo/<path:repo_name>/status")
def repo_status(repo_name):
    repo_doc = repos_collection.find_one(
        {"github_id": current_user.github_id, "repo_name": repo_name},
        {"_id": 0, "last_commit_sha": 1, "branch": 1},
    )
    if not repo_doc:
        return jsonify({"error": "Repo not found"}), 404
    stored_sha = repo_doc.get("last_commit_sha")
    branch = repo_doc.get("branch", "main")
    try:
        github_token = github.token["access_token"]
        latest_sha = get_latest_commit_sha(repo_name, branch, github_token)
        up_to_date = stored_sha == latest_sha
    except Exception as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({
        "up_to_date": up_to_date,
        "stored_sha": stored_sha[:7] if stored_sha else None,
        "latest_sha": latest_sha[:7],
    })

@app.route("/user/threads")
def user_threads():
    repo_name = request.args.get("repo_name")
    if not repo_name:
        return jsonify({"error": "Missing 'repo_name' query parameter"}), 400

    try:
        page = max(1, int(request.args.get("page", "1")))
        limit = min(50, max(1, int(request.args.get("limit", str(THREADS_PAGE_LIMIT)))))
    except ValueError:
        return jsonify({"error": "Invalid pagination parameters"}), 400

    skip = (page - 1) * limit
    query = {"github_id": current_user.github_id, "repo_name": repo_name}
    total = thread_collection.count_documents(query)
    docs = list(
        thread_collection.find(query, {"_id": 0, "github_id": 0})
        .sort("last_updated", -1)
        .skip(skip)
        .limit(limit)
    )
    return jsonify({"threads": docs, "total": total, "page": page, "limit": limit})


@app.route("/user/thread/<session_id>/name", methods=["PATCH"])
def rename_thread(session_id):
    data = request.get_json(silent=True) or {}
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "Missing 'name'"}), 400
    result = thread_collection.update_one(
        {"session_id": session_id, "github_id": current_user.github_id},
        {"$set": {"name": new_name}},
    )
    if result.matched_count == 0:
        return jsonify({"error": "Thread not found"}), 404
    return jsonify({"session_id": session_id, "name": new_name})


@app.route("/user/thread/<session_id>", methods=["DELETE"])
def delete_thread(session_id):
    result = thread_collection.delete_one({
        "session_id": session_id,
        "github_id": current_user.github_id,
    })
    if result.deleted_count == 0:
        return jsonify({"error": "Thread not found"}), 404
    get_thread_history(session_id).clear()
    return jsonify({"deleted": session_id})


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

@socketio.on("connect")
def handle_connect():
    if not current_user.is_authenticated:
        return False
    join_room(f"user:{current_user.github_id}")


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

    if github_id and _socket_rate_limited(github_id):
        emit("response", {"error": "rate_limited"})
        return

    user_object_id = ObjectId(current_user.id) if current_user.is_authenticated else None

    user_plan = None
    if current_user.is_authenticated:
        user_doc = users_collection.find_one(
            {"_id": user_object_id},
            {"plan": 1, "credits_remaining": 1},
        )
        user_plan = (user_doc or {}).get("plan")
        user_credits = (user_doc or {}).get("credits_remaining", FREE_PLAN_CREDITS)
        if user_plan == "free" and isinstance(user_credits, int) and user_credits <= 0:
            emit("response", {"error": "credits_exhausted"})
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

    ns = f"{github_id}::{repo_name}" if github_id and repo_name else ""

    def stream_task():
        token = cache_namespace.set(ns)
        handler = TokenStreamHandler(sid)
        if user_plan == "free":
            users_collection.update_one(
                {"_id": user_object_id, "credits_remaining": {"$gt": 0}},
                {"$inc": {"credits_remaining": -1}},
            )
        try:
            config = RunnableConfig(
                callbacks=[handler],
                configurable={
                    "github_id": github_id,
                    "repo_name": repo_name,
                    "session_id": session_id,
                },
            )
            repo_doc = repos_collection.find_one(
                {"github_id": github_id, "repo_name": repo_name},
                {"description": 1, "readme_excerpt": 1},
            ) or {}
            repo_context_parts = [f"Repository: {repo_name}"]
            if repo_doc.get("description"):
                repo_context_parts.append(f"Description: {repo_doc['description']}")
            if repo_doc.get("readme_excerpt"):
                repo_context_parts.append(f"README:\n{repo_doc['readme_excerpt']}")
            repo_context = SystemMessage(content="\n".join(repo_context_parts))

            history = get_thread_history(session_id)
            prior_messages = history.messages
            all_messages = [repo_context] + prior_messages + [HumanMessage(content=message)]
            result = baseAgent.invoke({"messages": all_messages}, config=config)
            new_messages = result["messages"][len(prior_messages):]
            history.add_messages(new_messages)
        except Exception as e:
            logger.exception("Stream error for session %s: %s", session_id, e)
            socketio.emit("chat_token", {"text": "\nAn error occurred while processing your request."}, to=sid)
        finally:
            cache_namespace.reset(token)
            socketio.emit(
                "stream_complete",
                {"status": "done", "session_id": session_id, "sources": handler.sources},
                to=sid,
            )

    socketio.start_background_task(stream_task)

if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
