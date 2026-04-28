import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { riskLabel } from "@/components/VerdictBadge"

interface Props {
  onOpenJob: (jobId: string) => void
}

export function JobsHistory({ onOpenJob }: Props) {
  const queryClient = useQueryClient()
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs(),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => api.deleteScan(jobId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent scans</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No scans yet. Launch one above.
          </p>
        ) : (
          <div className="space-y-2">
            {jobs
              .slice()
              .sort((a, b) => b.started_at - a.started_at)
              .map((j) => {
                const risk = riskLabel(j.risk_score)
                return (
                  <div
                    key={j.job_id}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {j.job_id.slice(0, 8)}
                        </span>
                        <Badge
                          variant={
                            j.status === "complete"
                              ? "clean"
                              : j.status === "error"
                              ? "error"
                              : "secondary"
                          }
                        >
                          {j.status}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {j.target_url}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {j.completed}/{j.total} payloads ·{" "}
                        {new Date(j.started_at * 1000).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {j.risk_score != null && (
                        <Badge variant={risk.variant}>
                          {risk.label} · {j.risk_score}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenJob(j.job_id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(j.job_id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
