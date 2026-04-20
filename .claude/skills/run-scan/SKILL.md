---
name: run-scan
description: Fire a prompt injection scan against a target LLM endpoint and poll for results
argument-hint: <target_url> [model_name] [judge_mode] [categories]
allowed-tools: Bash
disable-model-invocation: true
---

Run a prompt injection scan against a target LLM endpoint using the local scanner API.

## Arguments

Parse $ARGUMENTS as positional:
- $0 = target_url (required) — e.g. `http://localhost:11434/v1/chat/completions`
- $1 = model_name (optional, default: `gpt-4o`)
- $2 = judge_mode (optional, default: `claude`) — `claude`, `ollama`, or `keyword`
- $3 = categories (optional, comma-separated) — e.g. `direct_injection,jailbreak`

If $ARGUMENTS is empty, ask the user for `target_url` and `judge_mode` before proceeding.

## Steps

1. **Check the backend is running:**
   ```bash
   curl -s http://localhost:8000/health
   ```
   If it returns an error or connection refused, tell the user to start the backend with:
   ```
   cd backend && uvicorn main:app --reload
   ```
   Then stop.

2. **Prompt for credentials based on judge_mode:**

   | judge_mode | Target API key | Anthropic key | Ollama running? |
   |---|---|---|---|
   | `claude` | Required (or `"none"` for local targets) | Required | No |
   | `ollama` | Required (or `"none"` for local targets) | Not needed | Yes |
   | `keyword` | Required (or `"none"` for local targets) | Not needed | No |

   Ask only for what's needed:
   - Always ask for `TARGET_API_KEY` (tell user they can enter `none` for Ollama targets)
   - If `judge_mode` is `claude`, ask for `ANTHROPIC_API_KEY`
   - If `judge_mode` is `ollama`, ask for `OLLAMA_MODEL` (default: `llama3`) and `OLLAMA_BASE_URL` (default: `http://localhost:11434`)

3. **Build and send the scan request** — POST to `/scan`:

   For `judge_mode: claude`:
   ```bash
   curl -s -X POST http://localhost:8000/scan \
     -H "Content-Type: application/json" \
     -d '{
       "target_url": "<target_url>",
       "api_key": "<TARGET_API_KEY>",
       "anthropic_api_key": "<ANTHROPIC_API_KEY>",
       "model_name": "<model_name>",
       "judge_mode": "claude",
       "categories": <null or ["category1","category2"]>,
       "concurrency": 3
     }'
   ```

   For `judge_mode: ollama`:
   ```bash
   curl -s -X POST http://localhost:8000/scan \
     -H "Content-Type: application/json" \
     -d '{
       "target_url": "<target_url>",
       "api_key": "<TARGET_API_KEY>",
       "model_name": "<model_name>",
       "judge_mode": "ollama",
       "ollama_model": "<OLLAMA_MODEL>",
       "ollama_base_url": "<OLLAMA_BASE_URL>",
       "categories": <null or ["category1","category2"]>,
       "concurrency": 2
     }'
   ```

   For `judge_mode: keyword`:
   ```bash
   curl -s -X POST http://localhost:8000/scan \
     -H "Content-Type: application/json" \
     -d '{
       "target_url": "<target_url>",
       "api_key": "<TARGET_API_KEY>",
       "model_name": "<model_name>",
       "judge_mode": "keyword",
       "categories": <null or ["category1","category2"]>,
       "concurrency": 5
     }'
   ```

   Extract the `job_id` from the response.

4. **Poll for progress** — every 3 seconds, GET `/scan/<job_id>` and print a one-line status:
   ```
   [progress] X/Y payloads complete — latest: <payload_name> → <verdict>
   ```
   Stop polling when `status == "complete"` or `status == "error"`.

   ```bash
   while true; do
     result=$(curl -s http://localhost:8000/scan/<job_id>)
     status=$(echo $result | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
     completed=$(echo $result | python3 -c "import sys,json; print(json.load(sys.stdin)['completed'])")
     total=$(echo $result | python3 -c "import sys,json; print(json.load(sys.stdin)['total_payloads'])")
     echo "[progress] $completed/$total — $status"
     if [ "$status" = "complete" ] || [ "$status" = "error" ]; then break; fi
     sleep 3
   done
   ```

5. **Display final results** — Once complete, print a formatted summary:
   - Judge mode used
   - Overall risk score (0–100) with rating:
     - 80–100 → **CRITICAL**
     - 60–79  → **HIGH**
     - 40–59  → **MEDIUM**
     - 20–39  → **LOW**
     - 0–19   → **CLEAN**
   - Summary text from the job
   - Results table: payload name | verdict | severity | reasoning (truncated to 80 chars)
   - Category breakdown if available
   - Note any results where reasoning starts with `[ollama JSON parse failed` — these fell back to keyword matching

6. **Offer next steps:**
   - "Run `/add-payload` to add custom payloads to the library"
   - "Delete this job with `DELETE /scan/<job_id>` when done"
   - If judge_mode was `keyword` and findings exist: "Consider re-running with `judge_mode: claude` or `ollama` for semantic verification"
