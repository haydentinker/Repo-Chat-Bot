import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
from flask import Flask, redirect, request, jsonify, make_response, session, url_for
from flask_cors import CORS, cross_origin
from flask_dance.contrib.github import make_github_blueprint, github
from flask_dance.consumer import oauth_authorized
from dotenv import load_dotenv
from pymongo import MongoClient
from langchain_core.messages import HumanMessage, AIMessage
from openai import OpenAI
from agents.ragAgent import ragAgent
from helpers.ingestRepo import ingest_repo
from flask_socketio import SocketIO, emit
from bson import ObjectId
from datetime import datetime, UTC
load_dotenv()


app = Flask("Github-Repo-Analysis-Bot")
app.secret_key = os.getenv("FLASK_APP_SECRET")
app.config["MONGO_URI"] = os.getenv("MONGODB_CONNECTION_STRING")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = False

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

    user = users_collection.find_one({"github_id": github_user_id})
    if not user:
        new_user = {
            "github_id": github_user_id,
            "username": github_info["login"],
            "email": github_info.get("email"),
        }
        users_collection.insert_one(new_user)
    
    session["github_id"] = github_user_id

@app.route("/users/repos", methods=["GET"])
def list_repos():
    
    resp = github.get("/user/repos")
    if not resp.ok:
        return "Error fetching repos", 500
        
    repos = resp.json()
    return {"repos": repos}

def get_repo_id(repo_url):
    return repo_url.replace("https://github.com/", "").replace(".git", "")

@app.route("/load_repo", methods=["POST"])
def load_repo():
    data = request.json
    repo_url = data.get("repo_url")

    if not repo_url:
        return jsonify({"error": "No repo_url provided"}), 400

    try:
        ingest_repo(repo_url)
        
        return jsonify({
            "status": "success",
            "message": "Repo loaded and ready"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/ingest", methods=["POST"])
def ingest():

    github_id = session["github_id"]
    if not github_id:
        return jsonify({"status": "error", "message": "User not logged in"}), 401
    user = users_collection.find_one({"github_id": github_id})
    if not user:
        return jsonify({"status": "error", "message": "User not found"}), 400

    github_token = github.token["access_token"]

    data = request.get_json()
    if not data or "repo_name" not in data:
        return jsonify({"status": "error", "message": "Missing 'repo_name' in request body"}), 400

    repo_name = data["repo_name"]

    github_token = github.token["access_token"]
    result = ingest_repo(github_id, repo_name, github_token)
    return jsonify(result)

@app.route("/auth/github")
def auth_github():
    return redirect("/login/github")


@app.route("/auth/success")
def github_login_success():
    if not github.authorized:
        return redirect("http://localhost:3000")

    resp = github.get("/user")

    if not resp.ok:
        return jsonify({"error": "Failed to fetch user"}), 500

    response = make_response(redirect("http://localhost:5173/dashboard"))
    response.set_cookie(
        "logged_in",
        "true",
        httponly=True,
        samesite="Lax",
        secure=False,
    )

    return response

@app.route("/me")
def me():
    if not github.authorized:
        return jsonify({"authenticated": False}), 401

    
    user = session.get("user")
    if not user:
        resp = github.get("/user")
        if not resp.ok:
            return jsonify({"authenticated": False}), 401
        user = resp.json()
        session["user"] = user

    return jsonify(user)


@app.before_request
def check_authentication():
    
    public_endpoints = ['github.login', 'github.authorized', 'auth_github']

    if request.endpoint in public_endpoints or request.method == "OPTIONS":
        return

   
    github_id = session.get("github_id")
    if not github_id:
        return jsonify({"error": "Not authenticated"}), 401

   
    user = users_collection.find_one({"github_id": github_id})
    if not user:
        session.clear()
        return jsonify({"error": "User not found"}), 401

    return
@app.route("/user/loaded/repos")
def user_repos():
    github_id = session.get("github_id")
    if not github_id:
        return jsonify({"error": "Not logged in"}), 401

    pipeline = [
        {"$match": {"github_id": github_id}},
        {
            "$project": {
                "_id": 0,
                "github_id": 1,
                "username": 1,
                "repoNames": {
                    "$map": {
                        "input": {"$objectToArray": "$repos"},
                        "as": "r",
                        "in": "$$r.k"
                    }
                }
            }
        }
    ]

    user_cursor = users_collection.aggregate(pipeline)
    user_data = list(user_cursor)
    if not user_data:
        return jsonify({"error": "User not found"}), 404

    return jsonify(user_data[0])
@socketio.on("message")
def handle_message(data):
    message = data.get("message")
    repo_name = data.get("repo_name")
    session_id = data.get("session_id")
    github_id =session.get("github_id")
    now = datetime.now(UTC)
    if session_id:
        thread_collection.update_one({
            "session_id" : session_id,},
            {"$set":{"last_updated": now }})
    else:
        session_id = str(ObjectId())
        thread_collection.insert_one({
            "session_id": session_id,
            "github_id": github_id,
            "repo_name": repo_name,
            "created_at": now ,
            "last_updated": now,
            "name":message
        })
    if not message or not repo_name:
        emit("response", {"error": "Both 'message' and 'repo_name' are required"})
        return

    input_data = {
        "messages": [HumanMessage(content=message)],
    }

    user_context = {
        "configurable": {
            "github_id": github_id ,
            "repo_name": repo_name,
            "session_id": session_id
        }
    }
    try:
        for chunk in ragAgent.stream(input_data, config=user_context):

            messages = chunk.get("model", {}).get("messages", [])
            if not messages:
                continue

            msg = messages[0]

     
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                print("Tool call detected:", msg.tool_calls)
                continue

  
            if hasattr(msg, "content") and msg.content:
                emit('chat_token', {'text': msg.content})
                socketio.sleep(0)

    except Exception as e:
        emit('chat_token', {'text': "\nAn error occurred while processing your request."})
        print(f"Stream error: {e}")

    finally:
        emit('stream_complete', {'status': 'done', 'session_id':session_id})

if __name__ == "__main__":
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
