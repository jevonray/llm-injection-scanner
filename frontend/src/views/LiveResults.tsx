import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VerdictBadge, riskLabel } from "@/components/VerdictBadge"

interface Props {
  jobId: string
  onBack: () => void
}

export function LiveResults({ jobId, onBack }: Props) {
  const { data: job, isLoading, error } = useQuery({
    queryKey: ["scan", jobId],
    queryFn: () => api.getScan(jobId),
    refetchInterval: (query) => {
      const j = query.state.data
      return j && j.status !== "running" ? false : 2000
    },
  })

  if (isLoading) return <p className="text-muted-foreground">Loading job…</p>
  if (error)
    return (
      <p className="text-verdict-compromised">
        Error: {(error as Error).message}
      </p>
    )
  if (!job) return null

  const pct = job.total_payloads
    ? (job.completed / job.total_payloads) * 100
    : 0
  const risk = riskLabel(job.risk_score)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Scan {jobId.slice(0, 8)}</h2>
          <p className="text-sm text-muted-foreground">{job.target_url}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Progress</CardTitle>
            <Badge variant={job.status === "complete" ? "clean" : "secondary"}>
              {job.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} />
          <p className="text-sm text-muted-foreground">
            {job.completed}/{job.total_payloads} payloads
          </p>
        </CardContent>
      </Card>

      {job.status === "complete" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Risk score</CardTitle>
              <Badge variant={risk.variant}>{risk.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-5xl font-bold">{job.risk_score ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{job.summary}</p>
          </CardContent>
        </Card>
      )}

      {job.category_breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {Object.entries(job.category_breakdown).map(([cat, data]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3"
                >
                  <div>
                    <p className="font-medium">{cat}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.compromised} compromised · {data.suspicious} sus ·{" "}
                      {data.clean} clean
                    </p>
                  </div>
                  <Badge variant={riskLabel(data.score).variant}>
                    {data.score.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {job.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Waiting for first result…
            </p>
          ) : (
            <div className="space-y-2">
              {job.results.map((r) => (
                <div
                  key={r.payload_id}
                  className="rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.payload_id}
                      </span>
                      <span className="font-medium">{r.payload_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.severity}</Badge>
                      <VerdictBadge verdict={r.verdict} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.judge_reasoning}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
