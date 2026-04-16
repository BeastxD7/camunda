import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowRight,
  BadgeInfo,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react"
import { PageContainer } from "../components/layout/PageContainer"
import { api } from "../lib/api"
import { buildCaseAnalytics, findAgentContext } from "../lib/process-analytics"
import { formatDate, statusClass } from "../lib/support-formatters"
import type { ProcessDetailsPayload } from "../types/support"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null
}

function parseJson(input: unknown): unknown {
  if (typeof input !== "string") return input
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function compactText(value: unknown, maxLength = 220): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim()
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`
  }
  if (isRecord(value)) {
    const keys = Object.keys(value)
    return keys.length ? `${keys.length} field${keys.length === 1 ? "" : "s"}: ${keys.slice(0, 4).join(", ")}` : "Empty object"
  }
  return String(value)
}

function StructuredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>
  }

  if (typeof value === "string") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{value}</p>
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return <span className="font-mono text-sm text-foreground">{String(value)}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Empty list</span>
    }

    return (
      <div className="space-y-2">
        {value.slice(0, 4).map((item, index) => (
          <div key={index} className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Item {index + 1}
            </p>
            <StructuredValue value={item} depth={depth + 1} />
          </div>
        ))}
        {value.length > 4 ? (
          <p className="text-xs text-muted-foreground">+{value.length - 4} more item{value.length - 4 === 1 ? "" : "s"}</p>
        ) : null}
      </div>
    )
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      return <span className="text-muted-foreground">Empty object</span>
    }

    const visibleEntries = entries.slice(0, depth > 0 ? 3 : 6)

    return (
      <div className="space-y-2">
        {visibleEntries.map(([key, entryValue]) => (
          <div key={key} className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{key}</p>
            <StructuredValue value={entryValue} depth={depth + 1} />
          </div>
        ))}
        {entries.length > visibleEntries.length ? (
          <p className="text-xs text-muted-foreground">
            +{entries.length - visibleEntries.length} more field{entries.length - visibleEntries.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
    )
  }

  return <span className="text-muted-foreground">{String(value)}</span>
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content
  }

  if (!Array.isArray(content)) {
    return ""
  }

  const textParts: string[] = []
  for (const part of content) {
    if (!isRecord(part)) continue
    if (typeof part.text === "string") {
      textParts.push(part.text)
    }
  }

  return textParts.join("\n\n")
}

function roleLabel(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === "user") return "Customer"
  if (normalized === "assistant") return "Agent"
  if (normalized === "tool_call_result") return "Tool Result"
  if (normalized === "system") return "System"
  return role || "Unknown"
}

function rolePillClass(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === "user") return "bg-sky-500/15 text-sky-700 dark:text-sky-200"
  if (normalized === "assistant") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
  if (normalized === "tool_call_result") return "bg-amber-500/15 text-amber-700 dark:text-amber-200"
  if (normalized === "system") return "bg-secondary text-foreground"
  return "bg-muted text-muted-foreground"
}

function ConversationMessageCard({ message, index }: { message: UnknownRecord; index: number }) {
  const role = String(message.role || "unknown")
  const contentText = extractMessageText(message.content)
  const toolCalls = Array.isArray(message.toolCalls) ? (message.toolCalls as UnknownRecord[]) : []
  const toolResults = Array.isArray(message.results) ? (message.results as UnknownRecord[]) : []
  const timestamp = String(toRecord(message.metadata)?.timestamp || "")

  const isSystemMessage = role.toLowerCase() === "system"

  const [expandedSystem, setExpandedSystem] = useState(!isSystemMessage)
  const [expandedResults, setExpandedResults] = useState<Record<number, boolean>>({})

  const toggleSystemExpand = () => setExpandedSystem(!expandedSystem)
  const toggleResultExpand = (resultIndex: number) => {
    setExpandedResults((prev) => ({
      ...prev,
      [resultIndex]: !prev[resultIndex],
    }))
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-medium ${rolePillClass(role)}`}>
          {roleLabel(role)}
        </span>
        <span className="rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">
          Message {index + 1}
        </span>
        {timestamp ? (
          <span className="rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground">
            {formatDate(timestamp)}
          </span>
        ) : null}
      </div>

      {isSystemMessage ? (
        <div className="space-y-2">
          <button
            onClick={toggleSystemExpand}
            className="group flex w-full items-center gap-2 rounded-lg border border-border/40 bg-muted/30 p-3 text-left text-sm font-medium transition hover:border-border/60 hover:bg-muted/50"
          >
            {expandedSystem ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="flex-1">System Prompt</span>
          </button>

          {expandedSystem ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm leading-6 whitespace-pre-wrap break-words text-foreground/90">
              {contentText}
            </div>
          ) : null}
        </div>
      ) : contentText ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm leading-6 whitespace-pre-wrap break-words text-foreground/90">
          {contentText}
        </div>
      ) : null}

      {toolCalls.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tool calls</p>
          {toolCalls.map((toolCall, toolIndex) => (
            <div key={`${String(toolCall.id || toolIndex)}-${toolIndex}`} className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-sm font-medium">{String(toolCall.name || "Unknown tool")}</p>
              <p className="mt-1 text-xs text-muted-foreground">id: {String(toolCall.id || "-")}</p>
              <div className="mt-2">
                <StructuredValue value={toolCall.arguments} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {toolResults.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tool results</p>
          {toolResults.map((toolResult, resultIndex) => {
            const isExpandedResult = expandedResults[resultIndex] ?? false
            const toolName = String(toolResult.name || "Tool result")
            const toolContent = toolResult.content

            let preview = ""
            let previewScore: number | null = null
            let previewDocId = ""

            if (Array.isArray(toolContent)) {
              const firstChunk = toolContent[0]
              if (isRecord(firstChunk)) {
                previewScore =
                  typeof firstChunk.score === "number" ? firstChunk.score : null
                const docRef = toRecord(firstChunk.documentReference)
                const docMeta = toRecord(docRef?.metadata)
                previewDocId = String(docMeta?.fileName || docRef?.documentId || "")
                preview = compactText(firstChunk.content, 120)
              }
            } else if (typeof toolContent === "string") {
              preview = compactText(toolContent, 120)
            }

            return (
              <div key={`${String(toolResult.id || resultIndex)}-${resultIndex}`} className="space-y-1">
                <button
                  onClick={() => toggleResultExpand(resultIndex)}
                  className="group flex w-full items-start gap-3 rounded-lg border border-border/40 bg-background p-3 text-left transition hover:border-border/60 hover:bg-muted/30"
                >
                  {isExpandedResult ? <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{toolName}</p>
                    {preview && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {preview}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {previewScore !== null && (
                        <span className="rounded-full bg-secondary/30 px-2 py-0.5">
                          score {previewScore.toFixed(3)}
                        </span>
                      )}
                      {previewDocId && (
                        <span className="rounded-full bg-secondary/30 px-2 py-0.5 truncate">
                          {previewDocId}
                        </span>
                      )}
                      <span className="rounded-full bg-secondary/30 px-2 py-0.5">
                        id: {String(toolResult.id || "-")}
                      </span>
                    </div>
                  </div>
                </button>

                {isExpandedResult ? (
                  <div className="rounded-xl border border-border/60 bg-background p-3">
                    <StructuredValue value={toolContent} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ToolExecutionCard({ execution }: { execution: { scopeKey: string; toolName: string; parameters: UnknownRecord; result: unknown; summary: string } }) {
  const resultRecord = toRecord(execution.result)
  const resultChunks = Array.isArray(resultRecord?.chunks) ? (resultRecord?.chunks as UnknownRecord[]) : []

  return (
    <details className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm transition hover:border-border/80">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                <Wrench className="h-3.5 w-3.5" />
                {execution.toolName}
              </span>
              <span className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
                {execution.summary}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Tool output and parameters for this scope are grouped together so the call is readable at a glance.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">scopeKey: {execution.scopeKey}</p>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Parameters</p>
          <StructuredValue value={execution.parameters} />
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-muted-foreground">Result</p>
          {resultChunks.length > 0 ? (
            <div className="space-y-3">
              {resultChunks.slice(0, 3).map((chunk, index) => {
                const documentReference = toRecord(chunk.documentReference)
                const documentMetadata = toRecord(documentReference?.metadata)

                return (
                  <div key={String(chunk.chunkId || index)} className="rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-foreground">
                        Chunk {index + 1}
                      </span>
                      <span>score {typeof chunk.score === "number" ? chunk.score.toFixed(3) : "-"}</span>
                      <span>{String(documentMetadata?.fileName || documentReference?.documentId || "source")}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/90">
                      {compactText(chunk.content, 260)}
                    </p>
                  </div>
                )
              })}
              {resultChunks.length > 3 ? (
                <p className="text-xs text-muted-foreground">+{resultChunks.length - 3} more evidence chunk{resultChunks.length - 3 === 1 ? "" : "s"}</p>
              ) : null}
            </div>
          ) : typeof execution.result === "string" ? (
            <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm leading-6 text-foreground/90">
              {String(execution.result)}
            </div>
          ) : (
            <StructuredValue value={execution.result} />
          )}
        </div>
      </div>
    </details>
  )
}

function FlowNodeCard({ node }: { node: UnknownRecord }) {
  const typeLabel = String(node.type || "-")
  const state = String(node.state || "-")
  const startDate = String(node.startDate || node.endDate || "")
  const endDate = String(node.endDate || "")
  const duration = startDate && endDate && startDate !== endDate ? `${formatDate(startDate)} → ${formatDate(endDate)}` : formatDate(startDate)

  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{String(node.flowNodeName || node.flowNodeId || "Unknown node")}</p>
          <p className="text-xs text-muted-foreground">{String(node.flowNodeId || "-")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(state)}`}>{state}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-border/60 px-2.5 py-1">{typeLabel}</span>
        <span className="rounded-full border border-border/60 px-2.5 py-1">key {String(node.key || "-")}</span>
        <span className="rounded-full border border-border/60 px-2.5 py-1">{duration}</span>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="support-card rounded-2xl border border-border/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between text-muted-foreground">{icon}</div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </div>
  )
}

export const ProcessToolTrace: React.FC = () => {
  const navigate = useNavigate()
  const { instanceKey } = useParams<{ instanceKey: string }>()
  const [details, setDetails] = useState<ProcessDetailsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analytics = useMemo(() => (details ? buildCaseAnalytics(details) : null), [details])
  const conversationMessages = useMemo(() => {
    if (!details) return []

    const context = findAgentContext(details.variables)
    const conversation = toRecord(context?.conversation)
    const messages = conversation?.messages

    if (!Array.isArray(messages)) {
      return []
    }

    return messages.filter(isRecord)
  }, [details])

  const load = async () => {
    if (!instanceKey) return
    setLoading(true)
    setError(null)
    try {
      const response = await api.support.getProcessInstanceDetails(instanceKey)
      if (response.success && response.data) {
        setDetails(response.data)
      } else {
        setError("Failed to load tool trace")
      }
    } catch (e) {
      console.error(e)
      setError("Failed to load tool trace")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [instanceKey])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const activeNode = analytics?.flow.activeNode || "Waiting for the latest state"
  const instance = details?.instance
  const currentEmail = details?.variables.find((variable) => String(variable.name) === "currentEmail")
  const currentEmailValue = currentEmail ? parseJson(currentEmail.value) : null
  const currentEmailRecord = toRecord(currentEmailValue)

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <button
          onClick={() => navigate(`/process/${instanceKey}`)}
          className="support-card inline-flex w-fit items-center gap-2 rounded-xl border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft size={16} />
          Back to Process Overview
        </button>

        <section className="support-header rounded-3xl border border-border/60 px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Structured Execution View
              </div>
              <h1 className="font-heading text-3xl leading-tight md:text-4xl">{instanceKey}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This view turns the raw process payload into an operator-friendly story: what ran, what the customer said, which tools were called, and which values matter.
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Trace
            </button>
          </div>
        </section>

        {loading ? (
          <section className="support-card rounded-3xl border border-border/60 p-8 text-sm text-muted-foreground">
            Loading tool execution details...
          </section>
        ) : error ? (
          <section className="support-card rounded-3xl border border-destructive/60 bg-destructive/10 p-8 text-sm text-destructive">
            {error}
          </section>
        ) : !analytics || !instance ? (
          <section className="support-card rounded-3xl border border-border/60 p-8 text-sm text-muted-foreground">
            No tool execution data available.
          </section>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="Flow Nodes" value={String(analytics.flow.total)} icon={<CircleDot className="h-4 w-4" />} />
              <SummaryTile label="Completed" value={String(analytics.flow.completed)} icon={<Clock3 className="h-4 w-4" />} />
              <SummaryTile label="Active" value={String(analytics.flow.active)} icon={<ArrowRight className="h-4 w-4" />} />
              <SummaryTile label="Tool Calls" value={String(analytics.tools.total)} icon={<Wrench className="h-4 w-4" />} />
              <SummaryTile label="Messages" value={String(analytics.agent.messageCount)} icon={<MessageSquare className="h-4 w-4" />} />
              <SummaryTile label="Agent State" value={analytics.agent.state || "-"} icon={<BadgeInfo className="h-4 w-4" />} />
              <SummaryTile label="Incident" value={String(Boolean(instance.incident))} icon={<Database className="h-4 w-4" />} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="support-card rounded-3xl border border-border/60 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BadgeInfo className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Instance Snapshot</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="State" value={String(instance.state || "-")} />
                  <InfoRow label="Incident" value={String(Boolean(instance.incident))} />
                  <InfoRow label="Process Version" value={String(instance.processVersion || "-")} />
                  <InfoRow label="BPMN Process ID" value={String(instance.bpmnProcessId || "-")} />
                  <InfoRow label="Process Definition Key" value={String(instance.processDefinitionKey || "-")} />
                  <InfoRow label="Tenant" value={String(instance.tenantId || "-")} />
                </div>
                <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Current focus</p>
                  <p className="text-sm leading-6 text-foreground/90">{activeNode}</p>
                </div>
              </div>

              <div className="support-card rounded-3xl border border-border/60 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <h2 className="text-sm font-semibold">Customer Snapshot</h2>
                </div>
                <div className="space-y-3">
                  <InfoRow label="Customer" value={String(analytics.customer.email || currentEmailRecord?.fromAddress || "-")} />
                  <InfoRow label="Subject" value={String(analytics.customer.subject || currentEmailRecord?.subject || "-")} />
                  <InfoRow label="Known Customer" value={analytics.customer.isExisting ? "Yes" : "No"} />
                  <InfoRow label="Reply Sent" value={analytics.customer.replySent ? "Yes" : "No"} />
                </div>
                <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Message preview</p>
                  <p className="text-sm leading-6 text-foreground/90">
                    {analytics.customer.messagePreview || compactText(currentEmailRecord?.plainTextBody || currentEmailRecord?.htmlBody || "No customer message available.", 260)}
                  </p>
                </div>
              </div>
            </section>

            <section className="support-card rounded-3xl border border-border/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Execution Timeline</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                The sequence below is ordered from earliest execution to latest so you can follow the case step by step.
              </p>
              <div className="space-y-3">
                {analytics.timeline.slice(-10).map((node, index) => (
                  <div key={`${String(node.key || index)}-${index}`} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span className="h-3 w-3 rounded-full bg-primary/80" />
                      {index < analytics.timeline.slice(-10).length - 1 ? <span className="mt-1 h-full w-px bg-border/70" /> : null}
                    </div>
                    <div className="flex-1">
                      <FlowNodeCard node={node} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="support-card rounded-3xl border border-border/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Tool Calls</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Each tool call is grouped with its inputs and its result summary so the case can be understood without opening a JSON blob.
              </p>
              <div className="space-y-4">
                {analytics.tools.executions.map((execution, index) => (
                  <ToolExecutionCard key={`${execution.scopeKey}-${index}`} execution={execution} />
                ))}
              </div>
            </section>

            <section className="support-card rounded-3xl border border-border/60 p-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Agent Conversation</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Timeline of customer, agent, and tool-result messages extracted from the `agentContext` payload.
              </p>

              {conversationMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversation messages found in agent context.</p>
              ) : (
                <div className="space-y-3">
                  {conversationMessages.map((message, index) => (
                    <ConversationMessageCard
                      key={`${String(message.role || "message")}-${index}`}
                      message={message}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </PageContainer>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground">{value}</p>
    </div>
  )
}