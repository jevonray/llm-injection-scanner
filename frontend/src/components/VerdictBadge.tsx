import { Badge } from "@/components/ui/badge"
import type { Verdict } from "@/types/api"

const VARIANTS = {
  COMPROMISED: "compromised",
  SUSPICIOUS: "suspicious",
  CLEAN: "clean",
  ERROR: "error",
} as const

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge variant={VARIANTS[verdict]}>{verdict}</Badge>
}

export function riskLabel(score: number | null | undefined): {
  label: string
  variant: "compromised" | "suspicious" | "clean" | "secondary"
} {
  if (score == null) return { label: "—", variant: "secondary" }
  if (score >= 80) return { label: "CRITICAL", variant: "compromised" }
  if (score >= 60) return { label: "HIGH", variant: "compromised" }
  if (score >= 40) return { label: "MEDIUM", variant: "suspicious" }
  if (score >= 20) return { label: "LOW", variant: "suspicious" }
  return { label: "CLEAN", variant: "clean" }
}
