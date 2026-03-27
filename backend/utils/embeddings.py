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
