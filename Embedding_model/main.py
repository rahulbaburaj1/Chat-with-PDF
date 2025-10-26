from fastapi import FastAPI, Request
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

model = SentenceTransformer(MODEL_NAME, device="cuda")

app = FastAPI()

@app.post("/embed")
async def embed(request: Request):
    body = await request.json()
    texts = body.get("texts", [])
    vectors = model.encode(texts, convert_to_tensor=True).cpu().tolist()
    return {"embeddings": vectors}

