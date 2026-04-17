import { BarChart3, Zap, ChevronDown } from "lucide-react"
import type { ProcessDetailsPayload } from "@/types/support"
import { useState } from "react"

type TokenUsageProps = {
  details: ProcessDetailsPayload | null
}

interface TokenMetrics {
  agentInput: number
  agentOutput: number
  agentTotal: number
  judgeInput: number
  judgeOutput: number
  judgeTotal: number
  grandTotal: number
}

function extractTokenMetrics(details: ProcessDetailsPayload | null): TokenMetrics | null {
  if (!details) return null

  let agentInput = 0
  let agentOutput = 0
  let agentTotal = 0
  let judgeInput = 0
  let judgeOutput = 0
  let judgeTotal = 0

  // Extract metrics from variables
  if (Array.isArray(details.variables)) {
    for (const variable of details.variables) {
      if (!variable || typeof variable !== "object") continue

      const varName = (variable as Record<string, unknown>).name as string
      let varValue = (variable as Record<string, unknown>).value

      // Handle string values that need parsing
      if (typeof varValue === "string") {
        try {
          varValue = JSON.parse(varValue)
        } catch {
          // If it's a plain string (like a number), try to parse as number
          if (!isNaN(Number(varValue))) {
            varValue = Number(varValue)
          }
        }
      }

      // Get agent metrics
      if (varName === "agentContext" && varValue && typeof varValue === "object") {
        const metrics = (varValue as Record<string, unknown>).metrics as Record<
          string,
          unknown
        > | undefined
        if (metrics) {
          const tokenUsage = metrics.tokenUsage as Record<string, unknown> | undefined
          if (tokenUsage) {
            agentInput = Math.max(
              agentInput,
              Number(tokenUsage.inputTokenCount) || 0
            )
            agentOutput = Math.max(
              agentOutput,
              Number(tokenUsage.outputTokenCount) || 0
            )
          }
        }
      }

      // Get judge metrics
      if (varName === "llmjudge" && varValue && typeof varValue === "object") {
        const context = (varValue as Record<string, unknown>).context as Record<
          string,
          unknown
        > | undefined
        if (context) {
          const metrics = context.metrics as Record<string, unknown> | undefined
          if (metrics) {
            const tokenUsage = metrics.tokenUsage as Record<string, unknown> | undefined
            if (tokenUsage) {
              judgeInput = Number(tokenUsage.inputTokenCount) || 0
              judgeOutput = Number(tokenUsage.outputTokenCount) || 0
            }
          }
        }
      }
    }
  }

  agentTotal = agentInput + agentOutput
  judgeTotal = judgeInput + judgeOutput
  const grandTotal = agentTotal + judgeTotal

  // Return null if no metrics found
  if (grandTotal === 0) return null

  return {
    agentInput,
    agentOutput,
    agentTotal,
    judgeInput,
    judgeOutput,
    judgeTotal,
    grandTotal,
  }
}

function TokenBar({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/70">{label}</span>
        <span className="text-xs font-semibold text-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function TokenUsage({ details }: TokenUsageProps) {
  const metrics = extractTokenMetrics(details)
  const [isExpanded, setIsExpanded] = useState(false)

  // Debug logging
  if (details?.variables) {
    console.log("Token Usage Debug:", {
      variableCount: details.variables.length,
      hasAgentContext: details.variables.some((v: any) => v.name === "agentContext"),
      hasLLMJudge: details.variables.some((v: any) => v.name === "llmjudge"),
      metricsExtracted: metrics,
    })
  }

  if (!metrics) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          No token usage metrics available for this case.
        </p>
      </div>
    )
  }

  const agentPercentage =
    metrics.grandTotal > 0 ? ((metrics.agentTotal / metrics.grandTotal) * 100).toFixed(1) : 0
  const judgePercentage =
    metrics.grandTotal > 0 ? ((metrics.judgeTotal / metrics.grandTotal) * 100).toFixed(1) : 0

  return (
    <div className="space-y-2">
      {/* Compact Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg border border-border/70 bg-background hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Token Usage</span>
          <span className="text-xs text-muted-foreground">
            {metrics.grandTotal.toLocaleString()} tokens
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Compact Summary Row */}
      {!isExpanded && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/70 bg-background p-2.5">
            <p className="text-xs text-muted-foreground mb-1">BankSupportAgent</p>
            <p className="text-sm font-bold text-foreground">{metrics.agentTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{agentPercentage}%</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background p-2.5">
            <p className="text-xs text-muted-foreground mb-1">LLMJudge</p>
            <p className="text-sm font-bold text-foreground">{metrics.judgeTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{judgePercentage}%</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background p-2.5">
            <p className="text-xs text-muted-foreground mb-1">Total</p>
            <p className="text-sm font-bold text-foreground">{metrics.grandTotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">100%</p>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-3 p-3 rounded-lg border border-border/70 bg-background">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {/* Agent Card */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">BankSupportAgent</p>
                  <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {agentPercentage}%
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {metrics.agentTotal.toLocaleString()}
                </p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>In:</span>
                    <span className="font-medium">{metrics.agentInput.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Out:</span>
                    <span className="font-medium">{metrics.agentOutput.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Judge Card */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">LLMJudge</p>
                  <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-700">
                    {judgePercentage}%
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {metrics.judgeTotal.toLocaleString()}
                </p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>In:</span>
                    <span className="font-medium">{metrics.judgeInput.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Out:</span>
                    <span className="font-medium">{metrics.judgeOutput.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Card */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  {metrics.grandTotal.toLocaleString()}
                </p>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Agents:</span>
                    <span className="font-medium">2</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Models:</span>
                    <span className="font-medium">1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed breakdown - compact two-column layout */}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Agent Distribution
              </h4>
              <TokenBar
                label="Input"
                value={metrics.agentInput}
                total={metrics.agentTotal}
                color="bg-blue-400"
              />
              <TokenBar
                label="Output"
                value={metrics.agentOutput}
                total={metrics.agentTotal}
                color="bg-blue-300"
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Judge Distribution
              </h4>
              {metrics.judgeTotal > 0 ? (
                <>
                  <TokenBar
                    label="Input"
                    value={metrics.judgeInput}
                    total={metrics.judgeTotal}
                    color="bg-purple-400"
                  />
                  <TokenBar
                    label="Output"
                    value={metrics.judgeOutput}
                    total={metrics.judgeTotal}
                    color="bg-purple-300"
                  />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No judge evaluation</p>
              )}
            </div>
          </div>

          {/* Efficiency metrics - condensed */}
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <h4 className="text-xs font-semibold mb-2">Metrics</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Avg/Call</p>
                <p className="font-semibold text-foreground">
                  {Math.round(metrics.agentTotal / 3).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Ratio</p>
                <p className="font-semibold text-foreground">
                  {(metrics.agentTotal / Math.max(metrics.judgeTotal, 1)).toFixed(1)}:1
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
