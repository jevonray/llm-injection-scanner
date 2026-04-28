import { useState } from "react"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { api } from "@/api/client"
import { ScanLauncher } from "@/views/ScanLauncher"
import { LiveResults } from "@/views/LiveResults"
import { JobsHistory } from "@/views/JobsHistory"
import { Badge } from "@/components/ui/badge"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      retry: 1,
    },
  },
})

function Header() {
  const { data, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.health(),
    refetchInterval: 10000,
  })

  return (
    <header className="border-b border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">LLM Injection Scanner</h1>
          <p className="text-xs text-muted-foreground">
            Prompt injection testing dashboard
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {isError ? (
            <Badge variant="error">Backend offline</Badge>
          ) : data ? (
            <>
              <Badge variant="clean">Backend online</Badge>
              <span className="text-muted-foreground">
                {data.payload_count} payloads · {data.active_jobs} active
              </span>
            </>
          ) : (
            <Badge variant="secondary">Checking…</Badge>
          )}
        </div>
      </div>
    </header>
  )
}

function Dashboard() {
  const [activeJob, setActiveJob] = useState<string | null>(null)

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {activeJob ? (
          <LiveResults jobId={activeJob} onBack={() => setActiveJob(null)} />
        ) : (
          <>
            <ScanLauncher onJobStarted={setActiveJob} />
            <JobsHistory onOpenJob={setActiveJob} />
          </>
        )}
      </main>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}
