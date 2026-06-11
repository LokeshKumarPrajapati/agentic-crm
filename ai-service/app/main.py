import threading
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from app.graph.graph import compiled_graph
from app.graph.state import CRMAgentState
from app.rag.ingestion import ingest_document, ingest_documents
from app.utils.callbacks import post_progress
from app.config import settings

app = FastAPI(title="CRM AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store (replace with Redis/MongoDB for production)
sessions: dict[str, dict] = {}


class RunRequest(BaseModel):
    session_id: str
    query: str
    context: dict = {}
    ws_callback: Optional[str] = None


class ResumeRequest(BaseModel):
    approved: bool


class IngestRequest(BaseModel):
    collection: str
    text: str
    metadata: dict = {}


def run_graph_background(session_id: str, query: str, context: dict):
    """Run LangGraph in a background thread so FastAPI stays non-blocking."""
    initial_state: CRMAgentState = {
        "raw_query": query,
        "session_id": session_id,
        "context": context,
        "campaign_plan": None,
        "segment": None,
        "campaign_draft": None,
        "personalized_messages": [],
        "channel_assignments": None,
        "execution_records": [],
        "analytics_report": None,
        "optimization_plan": None,
        "errors": [],
        "current_step": "supervisor",
        "requires_approval": False,
        "marketer_approval": None,
        "final_summary": None,
    }

    try:
        config = {"configurable": {"thread_id": session_id}}
        # stream events — collect final state
        final_state = None
        for event in compiled_graph.stream(initial_state, config=config):
            final_state = event

        sessions[session_id] = {"status": "completed", "state": final_state}

        # notify backend
        with httpx.Client(timeout=10.0) as client:
            client.post(
                f"{settings.backend_url}/api/agent/completed",
                json={
                    "session_id": session_id,
                    "result": {
                        "summary": (final_state or {}).get("final_summary", "Campaign complete"),
                        "analytics": (final_state or {}).get("analytics_report"),
                        "optimization": (final_state or {}).get("optimization_plan"),
                    },
                },
            )
    except Exception as e:
        sessions[session_id] = {"status": "error", "error": str(e)}
        post_progress(session_id, "system", f"Error: {str(e)}", step="error")


@app.post("/run", status_code=202)
async def run_agent(req: RunRequest, background_tasks: BackgroundTasks):
    sessions[req.session_id] = {"status": "running"}
    background_tasks.add_task(
        run_graph_background,
        req.session_id,
        req.query,
        req.context,
    )
    return {"session_id": req.session_id, "status": "started"}


@app.get("/run/{session_id}/status")
async def get_status(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/run/{session_id}/resume")
async def resume_graph(session_id: str, req: ResumeRequest, background_tasks: BackgroundTasks):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # update state with approval and resume
    config = {"configurable": {"thread_id": session_id}}
    compiled_graph.update_state(config, {"marketer_approval": req.approved})

    # resume in background
    def resume_background():
        try:
            final_state = None
            for event in compiled_graph.stream(None, config=config):
                final_state = event
            sessions[session_id] = {"status": "completed", "state": final_state}
            with httpx.Client(timeout=10.0) as client:
                client.post(
                    f"{settings.backend_url}/api/agent/completed",
                    json={"session_id": session_id, "result": {"summary": "Campaign resumed and completed"}},
                )
        except Exception as e:
            sessions[session_id] = {"status": "error", "error": str(e)}

    background_tasks.add_task(resume_background)
    return {"status": "resumed"}


@app.post("/rag/ingest")
async def rag_ingest(req: IngestRequest):
    ingest_document(req.collection, req.text, req.metadata)
    return {"status": "ingested", "collection": req.collection}


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.gemini_model}
