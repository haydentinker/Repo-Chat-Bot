import os
import hashlib
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_community.document_loaders import GithubFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from pymongo import MongoClient, UpdateOne
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from langchain.schema import HumanMessage
from github import GHClient
from openai import OpenAI
load_dotenv()

app = Flask("Github-Repo-Analysis-Bot")
model = "text-embedding-3-small"
openai_client = OpenAI()
client = MongoClient(os.getenv("MONGODB_CONNECTION_STRING"))
collection = client[os.getenv("MONGODB_DB_NAME")][os.getenv("MONGODB_COLLECTION_NAME")]


llm = ChatOpenAI(
        model="gpt-5-mini-2025-08-07",
        api_key=os.getenv("OPENAI_API_KEY")
    )
K= 3
def get_repo_id(repo_url):
    return repo_url.replace("https://github.com/", "").replace(".git", "")

def hash_text(text):
    return hashlib.md5(text.encode()).hexdigest()

def get_embedding(text):
   """Generates vector embeddings for the given text."""
   embedding = openai_client.embeddings.create(input = text, model=model).data[0].embedding
   return embedding

def create_docs_with_embeddings(embeddings, docs, repo_id):
    mongo_docs = []

    for embedding, doc in zip(embeddings, docs):
        text = doc.page_content
        doc_id = f"{repo_id}_{hash_text(text)}"

        mongo_docs.append({
            "_id": doc_id,
            "text": text,
            "embedding": embedding,
            "metadata": {
                "repo": repo_id,
                "source": doc.metadata.get("source")
            }
        })

    return mongo_docs


def upsert_documents(docs):
    operations = [
        UpdateOne(
            {"_id": doc["_id"]},
            {"$set": doc},
            upsert=True
        )
        for doc in docs
    ]

    if operations:
        collection.bulk_write(operations)
def ingest_repo(repo_url):
    repo_id = get_repo_id(repo_url)
    parts = repo_id

    # Initialize GitHub client
    g = GHClient(token=os.getenv("GITHUB_ACCESS_TOKEN"))
    repo = g.get_repo(repo=parts)
    latest_sha = repo.get_branch("main").commit.sha

    # Check SHA to skip ingestion if unchanged
    existing_sha_doc = sha_collection.find_one({"repo": repo_id})
    if existing_sha_doc and existing_sha_doc.get("sha") == latest_sha:
        print(f"No updates found for {repo_id}, skipping ingestion.")
        return {"status": "up-to-date"}

    # Load repo files
    loader = GithubFileLoader(
        repo=parts,
        branch="main",
        access_token=os.getenv("GITHUB_ACCESS_TOKEN"),
        github_api_url="https://api.github.com",
        file_filter=lambda file_path: any(
            file_path.endswith(ext) for ext in {".md", ".py", ".js", ".ts", ".txt", ".json"}
        )
    )
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )
    docs = splitter.split_documents(documents)

    # Generate embeddings
    texts = [doc.page_content for doc in docs]
    response = openai_client.embeddings.create(
        input=texts,
        model=model
    )
    embeddings = [item.embedding for item in response.data]

    # Prepare MongoDB docs
    mongo_docs = create_docs_with_embeddings(embeddings, docs, repo_id)

    # --- Automatic removal of deleted files ---
    current_doc_ids = {doc["_id"] for doc in mongo_docs}
    existing_doc_ids = {doc["_id"] for doc in collection.find({"metadata.repo": repo_id}, {"_id": 1})}
    deleted_doc_ids = existing_doc_ids - current_doc_ids

    if deleted_doc_ids:
        collection.delete_many({"_id": {"$in": list(deleted_doc_ids)}})
        print(f"Deleted {len(deleted_doc_ids)} removed chunks for {repo_id}.")

    # Upsert new/updated chunks
    upsert_documents(mongo_docs)
    print(f"Ingested/updated {len(mongo_docs)} chunks for {repo_id}.")

    # Update SHA
    sha_collection.update_one(
        {"repo": repo_id},
        {"$set": {"sha": latest_sha}},
        upsert=True
    )

    return {"status": "success"}
@app.route("/load_repo", methods=["POST"])
def load_repo():
    global qa_chain

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


@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    repo_url = data.get("repo_url")
    question = data.get("question")

    if not repo_url or not question:
        return jsonify({"error": "Missing repo_url or question"}), 400

    repo_id = get_repo_id(repo_url)


    existing_docs = collection.count_documents({"metadata.repo": repo_id})
    if existing_docs == 0:
        return jsonify({"error": "No documents found for this repo. Please load it first."}), 400


    query_embedding = get_embedding(question)
    
    results = list(collection.aggregate([
        {
            "$vectorSearch": {
                "index": "vectorSearch",
                "queryVector": query_embedding,
                "path": "embedding",
                "numCandidates": 100,
                "limit": K
            }
        },
        {
            "$match": {
                "metadata.repo": repo_id
            }
        }
    ]))

    if not results:
        return jsonify({"error": "No relevant documents found for this query."}), 404

    context = "\n\n".join([doc["text"] for doc in results])

    custom_prompt = PromptTemplate(
        template="""You are a code assistant. Context from repository:
{context}

Question: {question}
Answer:""",
        input_variables=["context", "question"]
    )

    context = "\n\n".join([doc["text"] for doc in results])

    prompt_text = custom_prompt.format(context=context, question=question)

    llm_response = llm([HumanMessage(content=prompt_text)])


    answer = llm_response[0].content if isinstance(llm_response, list) else llm_response.content

    return jsonify({"question": question, "answer": answer})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
