import type {
  Job,
  JobSummary,
  Payload,
  ScanRequest,
  StartScanResponse,
} from "@/types/api"

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  health: () =>
    request<{ status: string; payload_count: number; active_jobs: number }>(
      "/health",
    ),

  listPayloads: (filters?: { category?: string; severity?: string }) => {
    const params = new URLSearchParams()
    if (filters?.category) params.set("category", filters.category)
    if (filters?.severity) params.set("severity", filters.severity)
    const qs = params.toString()
    return request<{
      total: number
      categories: Record<string, string>
      payloads: Payload[]
    }>(`/payloads${qs ? `?${qs}` : ""}`)
  },

  startScan: (body: ScanRequest) =>
    request<StartScanResponse>("/scan", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getScan: (jobId: string) => request<Job>(`/scan/${jobId}`),

  deleteScan: (jobId: string) =>
    request<{ deleted: string }>(`/scan/${jobId}`, { method: "DELETE" }),

  listJobs: () => request<JobSummary[]>("/jobs"),
}
