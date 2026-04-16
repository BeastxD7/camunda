import React, { type ReactNode, useState } from "react"
import { ChevronDown, ChevronRight, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatDate } from "@/lib/support-formatters"
import { buildCaseAnalytics } from "@/lib/process-analytics"
import type { ProcessDetailsPayload, ProcessInstance } from "@/types/support"

type CaseDetailsProps = {
  details: ProcessDetailsPayload | null
  selectedCase: ProcessInstance | null
  isLoading: boolean
  error: string | null
}

type UnknownRecord = Record<string, unknown>

function toRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as UnknownRecord
}

function readMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ""
  }

  return content
    .map((part) => toRecord(part))
    .filter((part): part is UnknownRecord => Boolean(part))
    .map((part) => String(part.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
}

function roleLabel(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === "user") return "Customer"
  if (normalized === "assistant") return "AI Agent"
  return "Message"
}

function roleClass(role: string): string {
  const normalized = role.toLowerCase()
  if (normalized === "user") return "bg-sky-500/12 text-sky-700"
  if (normalized === "assistant") return "bg-emerald-500/12 text-emerald-700"
  return "bg-muted text-muted-foreground"
}


export function CaseDetails({ details, selectedCase, isLoading, error }: CaseDetailsProps) {
  const analytics = details ? buildCaseAnalytics(details) : null
  const normalized = toRecord(details?.normalized)
  const conversationData = toRecord(normalized?.conversationData)
  const rawMessages = Array.isArray(conversationData?.messages)
    ? (conversationData.messages as UnknownRecord[])
    : []
  const conversationMessages = rawMessages
    .map((message) => {
      const role = String(message.role || "")
      const text = readMessageText(message.content)
      const metadata = toRecord(message.metadata)
      const timestamp = String(metadata?.timestamp || "")
      
      // Extract tool calls and results
      const toolCalls = Array.isArray(message.toolCalls)
        ? (message.toolCalls as UnknownRecord[])
        : []
      const toolResults = Array.isArray(message.results)
        ? (message.results as UnknownRecord[])
        : []

      return {
        role,
        text,
        timestamp,
        toolCalls,
        toolResults,
      }
    })
    .filter((message) => (message.role === "user" || message.role === "assistant") && message.text)
  

  return (
    <article className="support-card rounded-3xl border border-border/60 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Case Details</h2>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading selected case...</p> : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && !details ? (
        <p className="text-sm text-muted-foreground">
          Select a case from the queue to inspect full execution details.
        </p>
      ) : null}

      {!isLoading && !error && details && analytics ? (
        <div className="space-y-4">
          <DetailBlock title="Case Snapshot">
            <KeyValue label="Case ID" value={selectedCase?.key || "-"} />
            <KeyValue label="Status" value={String(details.instance.state ?? "-")} />
            <KeyValue label="Opened" value={formatDate(String(details.instance.startDate ?? ""))} />
          </DetailBlock>

          <DetailBlock title="Customer Details">
            <KeyValue label="Email" value={analytics.customer.email || "-"} />
            <KeyValue label="Subject" value={analytics.customer.subject || "-"} />
            <KeyValue label="Known Customer" value={analytics.customer.isExisting ? "Yes" : "No"} />
          </DetailBlock>

          <DetailBlock title="Customer Query">
            <p className="text-sm leading-relaxed text-foreground/90">
              {analytics.customer.messagePreview || "No customer query found in this case."}
            </p>
          </DetailBlock>

          <DetailBlock title="Customer and AI Conversation">
            {conversationMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversation messages available yet.</p>
            ) : (
              <div className="space-y-3">
                {conversationMessages.map((message, index) => (
                  <ConversationMessageBox key={`${message.role}-${index}`} message={message} index={index} />
                ))}
              </div>
            )}
          </DetailBlock>

        </div>
      ) : null}
    </article>
  )
}

type ConversationMessage = {
  role: string
  text: string
  timestamp: string
  toolCalls: UnknownRecord[]
  toolResults: UnknownRecord[]
}

function ConversationMessageBox({ message, index }: { message: ConversationMessage; index: number }) {
  const [expandedResults, setExpandedResults] = React.useState<Record<number, boolean>>({})
  const [selectedToolIdx, setSelectedToolIdx] = useState<number | null>(null)
  const [selectedResultIdx, setSelectedResultIdx] = useState<number | null>(null)

  const toggleResultExpand = (resultIndex: number) => {
    setExpandedResults((prev) => ({
      ...prev,
      [resultIndex]: !prev[resultIndex],
    }))
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      {/* Message header with role and timestamp */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${roleClass(message.role)}`}>
          {roleLabel(message.role)}
        </span>
        {message.timestamp ? (
          <span className="text-[11px] text-muted-foreground">{formatDate(message.timestamp)}</span>
        ) : null}
      </div>

      {/* Message text */}
      <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{message.text}</p>

      {/* Tool calls with badges */}
      {message.toolCalls.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Tools used:</span>
            {message.toolCalls.map((toolCall, idx) => (
              <Dialog key={`${index}-tool-dialog-${idx}`} open={selectedToolIdx === idx} onOpenChange={(open) => setSelectedToolIdx(open ? idx : null)}>
                <DialogTrigger asChild>
                  <button className="cursor-pointer hover:opacity-80 transition">
                    <Badge variant="info">
                      {String(toolCall.name || "Unknown")}
                    </Badge>
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tool Details: {String(toolCall.name || "Unknown")}</DialogTitle>
                    <DialogDescription>
                      View the input parameters and execution details for this tool call.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Input Parameters</h3>
                      <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                        <ToolParametersDisplay value={toolCall.arguments} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Tool Call ID</h3>
                      <div className="rounded-lg border border-border/40 bg-muted/30 p-2 text-xs font-mono text-muted-foreground break-all">
                        {String(toolCall.id || "-")}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      )}

      {/* Tool results */}
      {message.toolResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tool Results:</p>
          {message.toolResults.map((result, resultIdx) => {
            const isExpanded = expandedResults[resultIdx] ?? false
            const toolName = String(result.name || "Tool Result")
            const toolContent = result.content

            let preview = ""
            if (Array.isArray(toolContent) && toolContent.length > 0) {
              const firstItem = toolContent[0]
              if (firstItem && typeof firstItem === "object") {
                preview = String((firstItem as UnknownRecord).content || "").slice(0, 100)
              }
            } else if (typeof toolContent === "string") {
              preview = toolContent.slice(0, 100)
            }

            return (
              <Dialog key={`${index}-result-dialog-${resultIdx}`} open={selectedResultIdx === resultIdx} onOpenChange={(open) => setSelectedResultIdx(open ? resultIdx : null)}>
                <div className="rounded-lg border border-border/40 bg-background/50">
                  <button
                    type="button"
                    onClick={() => toggleResultExpand(resultIdx)}
                    className="w-full flex items-center gap-2 p-2 transition hover:bg-muted/30 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <DialogTrigger asChild>
                        <button
                          className="cursor-pointer hover:opacity-80 transition text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Badge variant="success" className="mb-1">
                            {toolName}
                          </Badge>
                        </button>
                      </DialogTrigger>
                      {preview && (
                        <p className="text-xs text-muted-foreground truncate">{preview}</p>
                      )}
                    </div>
                  </button>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tool Result: {toolName}</DialogTitle>
                      <DialogDescription>
                        View the complete output and data returned by this tool execution.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      {Array.isArray(toolContent) ? (
                        <div className="space-y-2">
                          {toolContent.map((item, itemIdx) => (
                            <div
                              key={`${index}-result-${resultIdx}-detail-${itemIdx}`}
                              className="rounded p-3 bg-muted/30 border border-border/40"
                            >
                              {typeof item === "object" && item !== null ? (
                                <>
                                  {typeof (item as UnknownRecord).score === "number" && (
                                    <Badge variant="outline" className="mb-2">
                                      score {((item as UnknownRecord).score as number).toFixed(3)}
                                    </Badge>
                                  )}
                                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {String((item as UnknownRecord).content || "")}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-foreground/80">{String(item)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded p-3 bg-muted/30 border border-border/40">
                          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {String(toolContent)}
                          </p>
                        </div>
                      )}
                    </div>
                  </DialogContent>

                  {isExpanded && (
                    <div className="border-t border-border/40 p-2 bg-background/70">
                      {Array.isArray(toolContent) ? (
                        <div className="space-y-2 text-xs">
                          {toolContent.map((item, itemIdx) => (
                            <div
                              key={`${index}-result-${resultIdx}-item-${itemIdx}`}
                              className="rounded p-2 bg-muted/30 border border-border/40"
                            >
                              {typeof item === "object" && item !== null ? (
                                <>
                                  {typeof (item as UnknownRecord).score === "number" && (
                                    <Badge variant="outline" className="mb-1">
                                      score {((item as UnknownRecord).score as number).toFixed(3)}
                                    </Badge>
                                  )}
                                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                    {String((item as UnknownRecord).content || "")}
                                  </p>
                                </>
                              ) : (
                                <p className="text-foreground/80">{String(item)}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {String(toolContent)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Dialog>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 grid grid-cols-[110px_1fr] gap-2 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value}</p>
    </div>
  )
}

function ToolParametersDisplay({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-xs text-muted-foreground">No parameters</p>
  }

  if (typeof value === "string") {
    return <p className="text-xs font-mono text-foreground/80 break-words">{value}</p>
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <p className="text-xs font-mono text-foreground/80">{String(value)}</p>
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div key={idx} className="text-xs">
            <p className="text-muted-foreground mb-1">[{idx}]</p>
            <div className="ml-2 pl-2 border-l border-border/40">
              <ToolParametersDisplay value={item} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === "object") {
    const obj = value as UnknownRecord
    return (
      <div className="space-y-2">
        {Object.entries(obj).map(([key, val]) => (
          <div key={key} className="text-xs">
            <p className="text-muted-foreground font-medium">{key}:</p>
            <div className="ml-2 pl-2 border-l border-border/40">
              <ToolParametersDisplay value={val} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return <p className="text-xs text-muted-foreground">{String(value)}</p>
}


