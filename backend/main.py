"""
main.py — FastAPI Gateway
Thin API layer only. All business logic lives in:
  orchestrator.py  — scan lifecycle, scoring, summaries
  judge.py         — Claude AI verdict engine
  scanner.py       — provider adapters (OpenAI, Anthropic, Ollama)
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid
import time
import json
from pathlib import Path

from orchestrator import run_scan, compute_category_breakdown
from judge import JudgeMode

app = FastAPI(title="LLM Injection Scanner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store (swap for Redis/Postgres in production) ────────────────
jobs: dict = {}

# ── Payload library ────────────────────────────────────────────────────────────
# payloads.json is gitignored. On a fresh clone we fall back to the committed
# payloads.json.example so the app boots; copy it to payloads.json and edit.
PAYLOAD_DIR     = Path(__file__).parent
PAYLOAD_PATH    = PAYLOAD_DIR / "payloads.json"
EXAMPLE_PATH    = PAYLOAD_DIR / "payloads.json.example"
ACTIVE_PAYLOADS = PAYLOAD_PATH if PAYLOAD_PATH.exists() else EXAMPLE_PATH

if not ACTIVE_PAYLOADS.exists():
    raise FileNotFoundError(
        f"No payload library found at {PAYLOAD_PATH} or {EXAMPLE_PATH}."
    )

if ACTIVE_PAYLOADS == EXAMPLE_PATH:
    print(f"[warn] payloads.json not found — using {EXAMPLE_PATH.name} (placeholder payloads).")

with open(ACTIVE_PAYLOADS) as f:
    PAYLOAD_LIBRARY = json.load(f)


# ── Request / Response models ──────────────────────────────────────────────────

class ScanRequest(BaseModel):
    target_url: str
    api_key: str
    anthropic_api_key: Optional[str] = None
    model_name: Optional[str] = "gpt-4o"
    system_prompt: Optional[str] = None
    categories: Optional[List[str]] = None   # None = all categories
    provider: Optional[str] = None           # "openai" | "anthropic" | "ollama"
    concurrency: Optional[int] = 3
    judge_mode: JudgeMode = JudgeMode.CLAUDE  # "claude" | "ollama" | "keyword"
    ollama_model: Optional[str] = None        # override default ollama judge model
    ollama_base_url: Optional[str] = None     # override default ollama base URL


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.post("/scan")
async def start_scan(request: ScanRequest, background_tasks: BackgroundTasks):
    """Kick off an async scan. Returns job_id immediately — poll /scan/{job_id} for results."""
    job_id = str(uuid.uuid4())

    payloads = PAYLOAD_LIBRARY["payloads"]
    if request.categories:
        payloads = [p for p in payloads if p["category"] in request.categories]

    if not payloads:
        raise HTTPException(status_code=400, detail="No payloads matched the requested categories.")

    jobs[job_id] = {
        "job_id":        job_id,
        "status":        "running",
        "target_url":    request.target_url,
        "model_name":    request.model_name,
        "total_payloads": len(payloads),
        "completed":     0,
        "results":       [],
        "risk_score":    None,
        "summary":       None,
        "started_at":    time.time(),
        "completed_at":  None,
    }

    background_tasks.add_task(
        run_scan,
        job_id=job_id,
        jobs=jobs,
        target_url=request.target_url,
        api_key=request.api_key,
        model_name=request.model_name,
        anthropic_api_key=request.anthropic_api_key,
        payloads=payloads,
        system_prompt=request.system_prompt,
        provider_hint=request.provider,
        concurrency=request.concurrency,
        judge_mode=request.judge_mode,
        ollama_model=request.ollama_model,
        ollama_base_url=request.ollama_base_url,
    )

    return {
        "job_id":         job_id,
        "total_payloads": len(payloads),
        "status":         "running",
    }


@app.get("/scan/{job_id}")
async def get_scan(job_id: str):
    """Poll for live scan progress and results."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = jobs[job_id]

    # Attach category breakdown once complete
    if job["status"] == "complete" and job["results"]:
        job["category_breakdown"] = compute_category_breakdown(job["results"])

    return job


@app.delete("/scan/{job_id}")
async def delete_scan(job_id: str):
    """Clean up a completed job from memory."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    del jobs[job_id]
    return {"deleted": job_id}


@app.get("/payloads")
async def list_payloads(category: Optional[str] = None, severity: Optional[str] = None):
    """Browse the payload library with optional filters."""
    payloads = PAYLOAD_LIBRARY["payloads"]
    if category:
        payloads = [p for p in payloads if p["category"] == category]
    if severity:
        payloads = [p for p in payloads if p["severity"] == severity]
    return {
        "total":      len(payloads),
        "categories": PAYLOAD_LIBRARY["categories"],
        "payloads":   payloads,
    }


@app.get("/jobs")
async def list_jobs():
    """List all active and completed scan jobs."""
    return [
        {
            "job_id":     j["job_id"],
            "status":     j["status"],
            "target_url": j["target_url"],
            "completed":  j["completed"],
            "total":      j["total_payloads"],
            "risk_score": j.get("risk_score"),
            "started_at": j["started_at"],
        }
        for j in jobs.values()
    ]


@app.get("/health")
async def health():
    return {
        "status":        "ok",
        "payload_count": len(PAYLOAD_LIBRARY["payloads"]),
        "active_jobs":   sum(1 for j in jobs.values() if j["status"] == "running"),
    }
