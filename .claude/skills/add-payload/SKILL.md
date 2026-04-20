---
name: add-payload
description: Scaffold and append a new injection payload to backend/payloads.json
argument-hint: payload_name
allowed-tools: Read Edit Bash
disable-model-invocation: true
---

Add a new prompt injection payload to the scanner's payload library at `backend/payloads.json`.

## Arguments

$ARGUMENTS (optional) — a short name or description for the new payload. If not provided, ask the user.

## Steps

1. **Read the current payload library:**
   Read `backend/payloads.json` to understand the existing payloads and determine:
   - The next available ID in each category prefix (DI-xxx, JB-xxx, II-xxx, DE-xxx, PE-xxx)
   - What categories already exist

2. **Gather payload details from the user** — Ask for each field:

   | Field | Description | Options |
   |-------|-------------|---------|
   | `name` | Short descriptive name | free text |
   | `category` | Attack category | `direct_injection`, `jailbreak`, `indirect_injection`, `data_exfiltration`, `privilege_escalation` |
   | `owasp_ref` | OWASP LLM Top 10 ref | `LLM01` (direct/jailbreak), `LLM02` (indirect), `LLM04` (privilege), `LLM06` (data exfil) |
   | `severity` | Impact level | `critical`, `high`, `medium`, `low` |
   | `payload` | The actual injection text to send | free text (can be multi-line) |
   | `success_indicators` | Keywords that indicate compromise | comma-separated list |
   | `description` | One sentence explaining what this tests | free text |

   Category → ID prefix mapping:
   - `direct_injection` → `DI-`
   - `jailbreak` → `JB-`
   - `indirect_injection` → `II-`
   - `data_exfiltration` → `DE-`
   - `privilege_escalation` → `PE-`

3. **Generate the new payload object:**
   ```json
   {
     "id": "<PREFIX-NNN>",
     "name": "<name>",
     "category": "<category>",
     "owasp_ref": "<owasp_ref>",
     "severity": "<severity>",
     "payload": "<payload text>",
     "success_indicators": ["<indicator1>", "<indicator2>"],
     "description": "<description>"
   }
   ```

4. **Show the user the generated payload** and ask for confirmation before writing:
   > "Here's the payload I'll add. Confirm to write it to payloads.json, or tell me what to change."

5. **Append to payloads.json** — Edit `backend/payloads.json` to insert the new payload object at the end of the `"payloads"` array (before the closing `]`). Preserve all existing formatting (2-space indent, blank lines between entries).

6. **Verify** — Read back the file and confirm the JSON is still valid by running:
   ```bash
   python3 -c "import json; json.load(open('backend/payloads.json')); print('valid')"
   ```

7. **Confirm success** — Tell the user:
   - The payload ID assigned
   - Total payload count now in the library
   - Reminder: the backend auto-reloads payloads.json on startup (needs restart if running)
