export type Verdict = "COMPROMISED" | "SUSPICIOUS" | "CLEAN" | "ERROR"

export type JudgeMode = "claude" | "ollama" | "keyword"

export type Severity = "critical" | "high" | "medium" | "low"

export type Category =
  | "direct_injection"
  | "jailbreak"
  | "indirect_injection"
  | "data_exfiltration"
  | "privilege_escalation"

export interface Payload {
  id: string
  name: string
  category: Category
  owasp_ref: string
  severity: Severity
  payload: string
  success_indicators: string[]
  description: string
}

export interface ScanResult {
  payload_id: string
  payload_name: string
  category: Category
  owasp_ref: string
  severity: Severity
  payload_text: string
  raw_response: string
  verdict: Verdict
  judge_reasoning: string
  latency_ms: number
}

export interface CategoryBreakdown {
  score: number
  compromised: number
  suspicious: number
  clean: number
}

export interface Job {
  job_id: string
  status: "running" | "complete" | "error"
  target_url: string
  model_name?: string
  total_payloads: number
  completed: number
  results: ScanResult[]
  risk_score: number | null
  summary: string | null
  started_at: number
  completed_at: number | null
  category_breakdown?: Record<string, CategoryBreakdown>
}

export interface JobSummary {
  job_id: string
  status: Job["status"]
  target_url: string
  completed: number
  total: number
  risk_score: number | null
  started_at: number
}

export interface ScanRequest {
  target_url: string
  api_key: string
  anthropic_api_key?: string
  model_name?: string
  system_prompt?: string | null
  categories?: Category[] | null
  provider?: "openai" | "anthropic" | "ollama" | null
  concurrency?: number
  judge_mode?: JudgeMode
  ollama_model?: string | null
  ollama_base_url?: string | null
}

export interface StartScanResponse {
  job_id: string
  total_payloads: number
  status: "running"
}
