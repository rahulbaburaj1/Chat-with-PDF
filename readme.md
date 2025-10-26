# Chat with PDF

## Setup Instructions

### 1. Set Up the Embedding Model

Build and serve your local embedding model using Docker:

```bash
docker build -t embedding-server .
docker run --gpus all -d -p 8081:8000 embedding-server
```

The embedding service will be accessible at `http://localhost:8081`. This service is used by the backend to convert text into vector embeddings before storing them in Qdrant.

### 2. Run the LLM Model (TinyLlama with vLLM)

Run this in a separate terminal or on a GPU node:

```bash
docker run --gpus all -it -p 11434:11434 vllm/vllm-openai \
    --model TinyLlama/TinyLlama-1.1B-Chat-v1.0 \
    --dtype float16 \
    --host 0.0.0.0 \
    --gpu-memory-utilization 0.7 \
    --port 11434
```

This exposes the OpenAI-compatible API on `http://localhost:11434/v1`.