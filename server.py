import json
import uuid
import time
import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from ollamafreeapi import OllamaFreeAPI

# ============== Configuration ==============
class Config:
    DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "deepseek-r1:latest")
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 8000))

app = FastAPI(
    title="OllamaFree OpenAI-Compatible Proxy",
    description=f"Default model: {Config.DEFAULT_MODEL}",
    version="1.0.0"
)
client = OllamaFreeAPI()

class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = Field(None, description="Model to use. If not provided, default model will be used.")
    messages: List[Message]
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = 1.0

class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str = "ollamafree"

class ModelsListResponse(BaseModel):
    object: str = "list"
    data: List[ModelInfo]

class ModelResponse(BaseModel):
    models: List[str]
    default_model: str
    total_models: int

def generate_sse_chunks(model: str, content_generator, request_id: str):
    created = int(time.time())
    role_chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]
    }
    yield f"data: {json.dumps(role_chunk)}\n\n"
    for text_piece in content_generator:
        content_chunk = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"content": text_piece}, "finish_reason": None}]
        }
        yield f"data: {json.dumps(content_chunk)}\n\n"
    final_chunk = {
        "id": request_id,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
    }
    yield f"data: {json.dumps(final_chunk)}\n\n"
    yield "data: [DONE]\n\n"

def generate_non_stream_response(model: str, full_response: str, request_id: str):
    created = int(time.time())
    return {
        "id": request_id,
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": full_response}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": len(full_response.split()), "total_tokens": len(full_response.split())}
    }

@app.get("/")
async def root():
    return {"service": "OllamaFree OpenAI-Compatible Proxy", "version": "1.0.0", "default_model": Config.DEFAULT_MODEL, "endpoints": {"models": "/models", "openai_models": "/v1/models", "chat_completions": "/v1/chat/completions", "health": "/health"}}

@app.get("/models")
async def list_models_simple():
    try:
        models = client.list_models()
        return ModelResponse(models=models, default_model=Config.DEFAULT_MODEL, total_models=len(models))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

@app.get("/v1/models")
async def list_models_openai():
    try:
        models = client.list_models()
        created = int(time.time())
        model_list = [ModelInfo(id=m, created=created, owned_by="ollamafree") for m in models]
        return ModelsListResponse(data=model_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    request_id = f"chatcmpl-{uuid.uuid4().hex[:8]}"
    model = request.model if request.model else Config.DEFAULT_MODEL
    try:
        available_models = client.list_models()
        if model not in available_models:
            raise HTTPException(status_code=400, detail=f"Model '{model}' not found. Available models: {available_models}")
    except Exception as e:
        print(f"Warning: Could not validate model: {e}")
    user_messages = [m.content for m in request.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found")
    prompt = user_messages[-1]
    try:
        if request.stream:
            def stream_wrapper():
                return generate_sse_chunks(model=model, content_generator=client.stream_chat(prompt, model=model), request_id=request_id)
            return StreamingResponse(stream_wrapper(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"})
        else:
            full_response = "".join(client.stream_chat(prompt, model=model))
            return JSONResponse(content=generate_non_stream_response(model=model, full_response=full_response, request_id=request_id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/config")
async def get_config():
    try:
        models = client.list_models()
    except:
        models = []
    return {"default_model": Config.DEFAULT_MODEL, "host": Config.HOST, "port": Config.PORT, "available_models": models, "model_count": len(models)}

if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║     OllamaFree OpenAI-Compatible Proxy Server               ║
╠══════════════════════════════════════════════════════════════╣
║  Default Model: {Config.DEFAULT_MODEL:<42} ║
║  Server URL:    http://{Config.HOST}:{Config.PORT:<32} ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                 ║
║    • GET  /models              - List all available models  ║
║    • GET  /v1/models           - OpenAI format models       ║
║    • POST /v1/chat/completions - Chat completions           ║
║    • GET  /health              - Health check               ║
║    • GET  /config              - Server configuration       ║
╚══════════════════════════════════════════════════════════════╝
    """.strip())
    uvicorn.run("server:app", host=Config.HOST, port=Config.PORT, reload=True)
