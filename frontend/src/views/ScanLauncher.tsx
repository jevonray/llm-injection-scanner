import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { Category, JudgeMode, ScanRequest } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

interface Props {
  onJobStarted: (jobId: string) => void
}

export function ScanLauncher({ onJobStarted }: Props) {
  const [targetUrl, setTargetUrl] = useState(
    "http://localhost:11434/v1/chat/completions",
  )
  const [apiKey, setApiKey] = useState("none")
  const [modelName, setModelName] = useState("llama3")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [concurrency, setConcurrency] = useState(3)
  const [judgeMode, setJudgeMode] = useState<JudgeMode>("ollama")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [ollamaModel, setOllamaModel] = useState("llama3")
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434")
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(
    new Set(),
  )

  const payloadsQuery = useQuery({
    queryKey: ["payloads"],
    queryFn: () => api.listPayloads(),
  })

  const mutation = useMutation({
    mutationFn: (body: ScanRequest) => api.startScan(body),
    onSuccess: (data) => onJobStarted(data.job_id),
  })

  const toggleCategory = (cat: Category) => {
    const next = new Set(selectedCategories)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    setSelectedCategories(next)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body: ScanRequest = {
      target_url: targetUrl,
      api_key: apiKey,
      model_name: modelName || undefined,
      system_prompt: systemPrompt || null,
      concurrency,
      judge_mode: judgeMode,
      categories:
        selectedCategories.size > 0 ? Array.from(selectedCategories) : null,
    }
    if (judgeMode === "claude") {
      body.anthropic_api_key = anthropicKey
    }
    if (judgeMode === "ollama") {
      body.ollama_model = ollamaModel
      body.ollama_base_url = ollamaBaseUrl
    }
    mutation.mutate(body)
  }

  const categories = payloadsQuery.data?.categories ?? {}

  return (
    <Card>
      <CardHeader>
        <CardTitle>Launch a scan</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Target URL</Label>
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://api.openai.com/v1/chat/completions"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Target API key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Model name</Label>
              <Input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="gpt-4o"
              />
            </div>
            <div className="space-y-2">
              <Label>Concurrency</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>System prompt (optional)</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Judge mode</Label>
            <Select
              value={judgeMode}
              onChange={(e) => setJudgeMode(e.target.value as JudgeMode)}
            >
              <option value="claude">Claude AI (best accuracy)</option>
              <option value="ollama">Ollama local model (no API key)</option>
              <option value="keyword">Keyword fallback (fastest)</option>
            </Select>
          </div>

          {judgeMode === "claude" && (
            <div className="space-y-2">
              <Label>Anthropic API key</Label>
              <Input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                required
              />
            </div>
          )}

          {judgeMode === "ollama" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Ollama judge model</Label>
                <Input
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ollama base URL</Label>
                <Input
                  value={ollamaBaseUrl}
                  onChange={(e) => setOllamaBaseUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Categories (leave empty for all)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(categories).map((cat) => {
                const active = selectedCategories.has(cat as Category)
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat as Category)}
                    className="cursor-pointer"
                  >
                    <Badge variant={active ? "default" : "outline"}>
                      {cat}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-verdict-compromised">
              {(mutation.error as Error).message}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Starting…" : "Start scan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
