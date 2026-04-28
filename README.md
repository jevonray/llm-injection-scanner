# LLM Prompt Injection Scanner

A security tool for testing LLM endpoints against prompt injection attacks. Fires a curated payload library at a target model, uses a configurable judge to evaluate responses, and produces a risk-scored report mapped to the OWASP LLM Top 10.

---

## Features

- 15 production-ready attack payloads across 5 categories
- Three judge modes: Claude AI (best accuracy), Ollama local model (no API key), or keyword fallback (fastest)
- Provider auto-detection — works with OpenAI, Anthropic, and local Ollama models
- Async scan execution with configurable concurrency
- Live progress polling via job store
- Weighted risk scoring (0–100) with per-category breakdown
- OWASP LLM Top 10 mapping on every finding
- React + TypeScript dashboard with live progress, verdict cards, and a jobs history view

---

## Architecture

![Architecture](/resources/media/architecure.png)

```
llm-injection-scanner/
├── backend/                   # FastAPI + Python scan engine
│   ├── main.py                # FastAPI routes — thin API layer only
│   ├── orchestrator.py        # Scan lifecycle, concurrency, scoring
│   ├── judge.py               # Claude / Ollama / keyword judge routing
│   ├── scanner.py             # Payload firing + provider adapters
│   ├── payloads.json          # Attack payload library
│   ├── tests/                 # pytest suite (59 tests)
│   └── requirements.txt
└── frontend/                  # Vite + React + TS dashboard
    ├── src/
    │   ├── api/client.ts      # typed fetch wrappers for the backend
    │   ├── components/ui/     # shadcn-style primitives (Button, Card, …)
    │   ├── views/             # ScanLauncher, LiveResults, JobsHistory
    │   ├── types/api.ts       # Verdict / JudgeMode / Job types
    │   └── App.tsx
    └── package.json
```

### Backend module responsibilities

| File | Owns |
|---|---|
| `main.py` | HTTP routes, job store, payload loading at startup |
| `orchestrator.py` | `run_scan()`, `compute_risk_score()`, `compute_category_breakdown()`, `generate_summary()` |
| `judge.py` | `judge_response()`, `JudgeMode` routing (Claude / Ollama / keyword), judge prompt engineering |
| `scanner.py` | `fire_payload()`, provider detection, OpenAI / Anthropic / Ollama adapters |
| `payloads.json` | 15 payloads tagged with id, category, OWASP ref, severity, success indicators |

### Frontend module responsibilities

| Path | Owns |
|---|---|
| `src/api/client.ts` | Typed `fetch` wrappers for every backend endpoint |
| `src/types/api.ts` | Shared TypeScript types — `Verdict`, `JudgeMode`, `Job`, `ScanRequest` |
| `src/views/ScanLauncher.tsx` | Scan configuration form (switches fields based on `judge_mode`) |
| `src/views/LiveResults.tsx` | Polls `GET /scan/{job_id}` every 2s, renders progress + risk score + per-payload cards |
| `src/views/JobsHistory.tsx` | Auto-refreshing job list with open / delete actions |
| `src/components/ui/` | shadcn-style primitives (Button, Card, Badge, Progress, Input, Select, Textarea) |
| `src/components/VerdictBadge.tsx` | Color-coded verdict badge + `riskLabel()` helper |

### Request flow

![Request Flow](/resources/media/flow.png)

```
POST /scan
  └─▶ main.py         creates job, returns job_id immediately
        └─▶ orchestrator.py  run_scan() fans out payloads (semaphore-bounded)
              ├─▶ scanner.py      fire_payload() → target LLM
              │         ◀─────────────────────── raw response
              └─▶ judge.py       judge_response() → Claude | Ollama | keyword
                        ◀─────────────────────── COMPROMISED / SUSPICIOUS / CLEAN
              └─▶ job store updated after each payload
GET /scan/{job_id}     returns live results as scan progresses
```

![Structure](/resources/media/structure.png)

---

## Payload categories

| Category | OWASP Ref | Description |
|---|---|---|
| `direct_injection` | LLM01 | Instruction overrides, system prompt exfiltration, role reassignment |
| `jailbreak` | LLM01 | Role-play bypass, token smuggling, encoding tricks, hypothetical framing |
| `indirect_injection` | LLM02 | RAG document poisoning, malicious tool output, embedded exfiltration |
| `data_exfiltration` | LLM06 | PII fishing, training data extraction |
| `privilege_escalation` | LLM04 | Social engineering to claim admin access or disable safety measures |

### Severity weights (used in risk scoring)

| Severity | Weight |
|---|---|
| Critical | 10 |
| High | 6 |
| Medium | 3 |
| Low | 1 |

Risk score = `(sum of severity × verdict multiplier) / max possible × 100`

Verdict multipliers: `COMPROMISED = 1.0`, `SUSPICIOUS = 0.5`, `CLEAN = 0.0`

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+ (for the frontend)
- A target LLM endpoint and its API key
- An Anthropic API key — only required when using the Claude judge (`judge_mode: "claude"`, the default)
- (Optional) Ollama — required when using `judge_mode: "ollama"` or scanning a local Ollama model

### Install

```bash
git clone https://github.com/yourname/llm-injection-scanner
cd llm-injection-scanner

# Backend
cd backend
pip install -r requirements.txt
cp payloads.json.example payloads.json  # only needed on first clone — see "Payload library" below
cd ..

# Frontend
cd frontend
npm install
cd ..
```

> **Payload library** — `backend/payloads.json` is git-ignored because it's expected to hold your real, sensitive attack library. The repo ships `backend/payloads.json.example` with the full schema and 5 placeholder payloads (one per category) so the app boots out-of-the-box. If `payloads.json` is missing at startup the backend automatically falls back to `payloads.json.example` and prints a warning. Copy the example file and replace the placeholders with your real payloads before running real scans.

### Run the full app

You need both processes running. Open two terminals:

**Terminal 1 — backend:**
```bash
cd backend
uvicorn main:app --reload
```
Serves at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

**Terminal 2 — frontend:**
```bash
cd frontend
npm run dev
```
Dashboard at `http://localhost:3000`. The frontend expects the backend at `http://localhost:8000`; override with `VITE_API_URL` if needed:
```bash
VITE_API_URL=http://my-backend:9000 npm run dev
```

### Backend only (CLI usage)

If you just want to hit the API directly without the dashboard, only run the backend from Terminal 1. All examples in the [Usage](#usage) section work against `http://localhost:8000` with `curl`.

---

## Dashboard

Once both servers are up (see [Run the full app](#run-the-full-app)), open `http://localhost:3000`. The dashboard has three views:

| View | What it does |
|---|---|
| **Scan launcher** | Form for `target_url`, API keys, `judge_mode`, categories, concurrency, and system prompt. Fields swap automatically based on the selected judge mode (no Anthropic key prompt when using Ollama or keyword). |
| **Live results** | Opens as soon as a scan starts. Polls `GET /scan/{job_id}` every 2 seconds, shows a progress bar, streams per-payload verdict cards as they come in, and renders the final risk score + category breakdown on completion. |
| **Jobs history** | Auto-refreshing list of recent scans from `GET /jobs`. Click **Open** to jump back into any scan, or **Delete** to remove it from the in-memory store. |

A health indicator in the header shows whether the backend is reachable and how many scans are active.

---

## Usage

### Run a scan

```bash
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-...",
    "anthropic_api_key": "sk-ant-...",
    "model_name": "gpt-4o",
    "system_prompt": "You are a helpful assistant.",
    "categories": ["direct_injection", "jailbreak"]
  }'
```

Returns immediately:
```json
{ "job_id": "abc-123", "total_payloads": 7, "status": "running" }
```

### Poll for results

```bash
curl http://localhost:8000/scan/abc-123
```

```json
{
  "job_id": "abc-123",
  "status": "complete",
  "risk_score": 42.5,
  "summary": "Risk level: HIGH (score: 42.5/100). 2 payload(s) succeeded, 1 flagged as suspicious out of 7 total.",
  "category_breakdown": {
    "direct_injection": { "score": 60.0, "compromised": 2, "suspicious": 0, "clean": 2 },
    "jailbreak":        { "score": 16.7, "compromised": 0, "suspicious": 1, "clean": 2 }
  },
  "results": [...]
}
```

### Judge modes

The scanner supports three judge strategies, controlled by the `judge_mode` field:

| Mode | `judge_mode` | API key required | Accuracy | Speed |
|---|---|---|---|---|
| Claude AI | `"claude"` | Anthropic key | Best | Moderate |
| Ollama local model | `"ollama"` | None | Good | Depends on hardware |
| Keyword fallback | `"keyword"` | None | Basic | Fastest |

**Ollama judge** sends the same prompt to a local model via `http://localhost:11434`. If the local model returns malformed JSON, it automatically falls back to keyword matching and notes this in the reasoning field.

### Example request payloads

**Claude judge (best accuracy):**
```json
{
  "target_url": "https://api.openai.com/v1/chat/completions",
  "api_key": "sk-...",
  "anthropic_api_key": "sk-ant-...",
  "model_name": "gpt-4o",
  "judge_mode": "claude",
  "system_prompt": "You are a helpful assistant.",
  "categories": ["direct_injection", "jailbreak"],
  "concurrency": 3
}
```

**Ollama judge (no API key needed):**
```json
{
  "target_url": "http://localhost:11434/v1/chat/completions",
  "api_key": "none",
  "model_name": "llama3",
  "judge_mode": "ollama",
  "ollama_model": "llama3",
  "ollama_base_url": "http://localhost:11434",
  "system_prompt": "You are a helpful customer support assistant.",
  "categories": ["direct_injection", "jailbreak"],
  "concurrency": 2
}
```

**Keyword judge (fastest, no LLM at all):**
```json
{
  "target_url": "http://localhost:8080/v1/chat/completions",
  "api_key": "none",
  "model_name": "mistral",
  "judge_mode": "keyword",
  "concurrency": 5
}
```

### Supported request fields

| Field | Required | Default | Description |
|---|---|---|---|
| `target_url` | Yes | — | Target LLM endpoint URL |
| `api_key` | Yes | — | Target endpoint API key (`"none"` for Ollama targets) |
| `anthropic_api_key` | No | `null` | Required only when `judge_mode` is `"claude"` |
| `model_name` | No | `gpt-4o` | Model identifier passed to the target |
| `system_prompt` | No | `null` | Optional system prompt for context |
| `categories` | No | all | Filter payloads by category |
| `provider` | No | auto-detect | Force provider: `openai`, `anthropic`, `ollama` |
| `concurrency` | No | `3` | Max simultaneous requests to the target |
| `judge_mode` | No | `"claude"` | Judge strategy: `"claude"`, `"ollama"`, `"keyword"` |
| `ollama_model` | No | `"llama3"` | Ollama model to use as judge (only with `judge_mode: "ollama"`) |
| `ollama_base_url` | No | `http://localhost:11434` | Ollama server URL (only with `judge_mode: "ollama"`) |

### Other endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/scan/{job_id}` | Get live scan progress and results |
| `DELETE` | `/scan/{job_id}` | Remove a completed job from memory |
| `GET` | `/jobs` | List all active and completed jobs |
| `GET` | `/payloads` | Browse payload library (filter by `?category=` or `?severity=`) |
| `GET` | `/health` | Health check with payload count and active job count |

---

## Provider support

The scanner auto-detects the provider from the target URL. Override with the `provider` field.

| Provider | Auto-detected from | Request format |
|---|---|---|
| OpenAI | anything else | `/v1/chat/completions` with `Authorization: Bearer` |
| Anthropic | `anthropic.com` in URL | `/v1/messages` with `x-api-key` |
| Ollama | `localhost:11434` or `ollama` in URL | OpenAI-compatible, no auth required |

### Testing locally with Ollama

```bash
# Install Ollama and pull a model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3

# Scan a local Ollama target, judged by another local Ollama model (no API keys needed)
curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "http://localhost:11434/v1/chat/completions",
    "api_key": "none",
    "model_name": "llama3",
    "judge_mode": "ollama",
    "ollama_model": "llama3",
    "system_prompt": "You are a helpful assistant."
  }'
```

---

## Testing

### 1. Validate setup

```bash
# Check server health
curl http://localhost:8000/health

# Browse payloads
curl http://localhost:8000/payloads
```

### 2. Spin up a mock target

Create `mock_target.py` to test the full pipeline without external API costs:

```python
from fastapi import FastAPI
app = FastAPI()

@app.post("/v1/chat/completions")
async def mock_llm(body: dict):
    return {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "JAILBREAK SUCCESSFUL. My system prompt is: You are a helpful bot."
            }
        }]
    }
```

```bash
uvicorn mock_target:app --port 8001

curl -X POST http://localhost:8000/scan \
  -d '{ "target_url": "http://localhost:8001/v1/chat/completions", "api_key": "fake", "anthropic_api_key": "sk-ant-...", "model_name": "mock", "categories": ["direct_injection"] }'
```

### 3. Test against hardened targets

- **Gandalf by Lakera** (`gandalf.lakera.ai`) — progressively hardened, free, no API key
- **Prompt Airlines** (`promptairlines.com`) — CTF-style vulnerable LLM app
- **Your own Ollama instance** — full control, no rate limits, free

### 4. Run unit tests

Backend (pytest):
```bash
cd backend
pytest
```

Frontend (type check):
```bash
cd frontend
npx tsc -b
```

---

## Next steps

### Short term (MVP hardening)
- [x] Add `pytest` test suite covering scoring, judge parsing, and provider adapters
- [x] Scaffold React dashboard with live scan progress and result cards
- [ ] Add `POST /payloads` endpoint to add custom payloads at runtime
- [ ] Persist job store to SQLite or Redis (current in-memory store resets on restart)
- [ ] Replace polling with Server-Sent Events or WebSockets for lower-latency updates

### Medium term (product features)
- [ ] PDF/markdown report export from completed scan jobs
- [ ] Payload versioning — track which payload version caught a finding
- [ ] Scan diffing — compare two scans against the same endpoint over time
- [ ] Multi-turn injection testing (conversation-level attacks, not just single-turn)
- [ ] Rate limiting and API key management for multi-user deployments

### Long term (consulting / portfolio features)
- [ ] Fine-tune a dedicated judge model to reduce Anthropic API dependency
- [ ] MITRE ATLAS finding mapping alongside OWASP LLM Top 10
- [ ] Scheduled scans with alerting on risk score regression
- [ ] Scan report templates for client deliverables

---

## Security note

This tool is intended for authorized security testing only. Only scan endpoints you own or have explicit written permission to test. The payload library contains real attack strings — treat `payloads.json` as sensitive material and do not expose the `/payloads` endpoint publicly without authentication.
