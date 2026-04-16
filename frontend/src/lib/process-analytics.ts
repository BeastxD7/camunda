import type { ProcessDetailsPayload } from "@/types/support"

type UnknownRecord = Record<string, unknown>

type KnowledgeChunk = {
  score: string
  preview: string
}

export type ToolExecution = {
  scopeKey: string
  toolName: string
  parameters: UnknownRecord
  result: unknown
  summary: string
}

export type SensitiveVariable = {
  name: string
  value: unknown
  preview: string
  type: string
}

export type SafeSecretReference = {
  name: string
  value: string
}

const SENSITIVE_KEY = /(^|[^a-z])(password|passcode|secret|api[_-]?key|access[_-]?key|authorization|auth(?:entication)?|bearer|refresh[_-]?token|access[_-]?token|token)([^a-z]|$)/i
const NON_SENSITIVE_KEYS = [
  /^metrics[_-]?inputtoken(count)?$/i,
  /^metrics[_-]?outputtoken(count)?$/i,
  /^inputtoken(count)?$/i,
  /^outputtoken(count)?$/i,
]

function isSensitiveName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false

  if (NON_SENSITIVE_KEYS.some((pattern) => pattern.test(trimmed))) {
    return false
  }

  return SENSITIVE_KEY.test(trimmed)
}

function isSecretReference(value: unknown): value is string {
  if (typeof value !== "string") return false
  return /^\{\{\s*secrets\.[^}]+\}\}$/i.test(value.trim())
}

function safeParseJson(input: unknown): unknown {
  if (typeof input !== "string") return input
  try {
    return JSON.parse(input)
  } catch {
    return input
  }
}

function extractAgentContextFromTruncatedString(raw: string): UnknownRecord | null {
  if (!raw || (!raw.includes("conversation") && !raw.includes("modelCalls") && !raw.includes("toolDefinitions"))) {
    return null
  }

  const state = raw.match(/"state":"([^"]+)"/)?.[1] || ""
  const modelCalls = Number(raw.match(/"modelCalls":(\d+)/)?.[1] || 0)
  const inputTokenCount = Number(raw.match(/"inputTokenCount":(\d+)/)?.[1] || 0)
  const outputTokenCount = Number(raw.match(/"outputTokenCount":(\d+)/)?.[1] || 0)
  const conversationType = raw.match(/"conversation"\s*:\s*\{\s*"type":"([^"]+)"/)?.[1] || ""
  const conversationId = raw.match(/"conversationId":"([^"]+)"/)?.[1] || ""

  const hasSignal = Boolean(state || modelCalls || inputTokenCount || outputTokenCount || conversationType || conversationId)
  if (!hasSignal) return null

  return {
    state,
    metrics: {
      modelCalls,
      tokenUsage: {
        inputTokenCount,
        outputTokenCount,
      },
    },
    conversation: {
      type: conversationType,
      conversationId,
      messages: [],
    },
  }
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue)
  }

  if (value && typeof value === "object") {
    const obj = value as UnknownRecord
    const out: UnknownRecord = {}
    for (const [k, v] of Object.entries(obj)) {
      if (isSensitiveName(k)) {
        out[k] = "[REDACTED]"
      } else {
        out[k] = sanitizeValue(v)
      }
    }
    return out
  }

  return value
}

function summarizeSensitiveValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim()
    return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? "" : "s"}`
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value as UnknownRecord)
    return keys.length ? `${keys.length} field${keys.length === 1 ? "" : "s"}: ${keys.slice(0, 4).join(", ")}` : "Empty object"
  }
  return String(value)
}

function resolveTimelineTimestamp(node: UnknownRecord): number {
  const candidate = String(node.startDate || node.endDate || "").trim()
  if (!candidate) return Number.POSITIVE_INFINITY

  const parsed = Date.parse(candidate)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function toRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as UnknownRecord
}

function unwrapRuntimeContext(value: unknown): UnknownRecord | null {
  const record = toRecord(value)
  if (!record) return null

  if (
    record.metrics ||
    record.conversation ||
    record.toolDefinitions ||
    record.systemPrompt
  ) {
    return record
  }

  const nestedCandidates = [record.agentContext, record.data, record.context, record.runtime]
  for (const candidate of nestedCandidates) {
    const nested = unwrapRuntimeContext(candidate)
    if (nested) return nested
  }

  return null
}

export function findAgentContext(variables: ProcessDetailsPayload["variables"]): UnknownRecord | null {
  const preferredNames = ["agentContext", "agent_context", "runtimeContext", "agentRuntime", "data", "context"]

  const preferredAgentVariable = variables.find(
    (item) => String(item.name || "") === "agentContext" || String(item.name || "") === "agent_context",
  )

  if (preferredAgentVariable) {
    const parsed = unwrapRuntimeContext(safeParseJson(preferredAgentVariable.value))
    if (parsed) return parsed

    if (typeof preferredAgentVariable.value === "string") {
      const recovered = extractAgentContextFromTruncatedString(preferredAgentVariable.value)
      if (recovered) return recovered
    }
  }

  for (const name of preferredNames) {
    const variable = variables.find((item) => String(item.name || "") === name)
    if (!variable) continue

    const parsed = unwrapRuntimeContext(safeParseJson(variable?.value))
    if (parsed) return parsed

    if ((name === "agentContext" || name === "agent_context") && typeof variable.value === "string") {
      const recovered = extractAgentContextFromTruncatedString(variable.value)
      if (recovered) return recovered
    }
  }

  for (const variable of variables) {
    const parsed = unwrapRuntimeContext(safeParseJson(variable.value))
    if (parsed) return parsed
  }

  return null
}

export function extractToolExecutions(details: ProcessDetailsPayload): ToolExecution[] {
  const scoped = new Map<string, { call?: UnknownRecord; result?: unknown }>()

  for (const raw of details.variables) {
    const name = String(raw.name || "")
    const scopeKey = String(raw.scopeKey || raw.key || "")
    if (!scopeKey) continue

    const parsed = safeParseJson(raw.value)
    const entry = scoped.get(scopeKey) || {}

    if (name === "toolCall") {
      entry.call = toRecord(parsed) || { value: parsed }
    }

    if (name === "toolCallResult") {
      entry.result = sanitizeValue(parsed)
    }

    scoped.set(scopeKey, entry)
  }

  const executions: ToolExecution[] = []

  for (const [scopeKey, entry] of scoped.entries()) {
    if (!entry.call) continue

    const meta = toRecord(entry.call._meta)
    const toolName = String(meta?.name || "Unknown tool")
    const parameters: UnknownRecord = {}

    for (const [k, v] of Object.entries(entry.call)) {
      if (k === "_meta") continue
      parameters[k] = sanitizeValue(v)
    }

    const resultObj = entry.result
    let summary = "No result captured"

    if (resultObj !== undefined && resultObj !== null) {
      const resultRecord = toRecord(resultObj)
      const chunks = resultRecord && Array.isArray(resultRecord.chunks)
        ? (resultRecord.chunks as UnknownRecord[])
        : null

      if (chunks && chunks.length > 0) {
        const top = chunks[0]
        const score = typeof top.score === "number" ? top.score.toFixed(3) : "-"
        summary = `${chunks.length} evidence chunk(s), top score ${score}`
      } else if (typeof resultObj === "string" && resultObj.trim() === "") {
        summary = "Executed successfully (empty output)"
      } else {
        summary = "Result payload available"
      }
    }

    executions.push({
      scopeKey,
      toolName,
      parameters,
      result: resultObj,
      summary,
    })
  }

  return executions
}

export function buildCaseAnalytics(details: ProcessDetailsPayload) {
  const flowNodes = details.flowNodes
  const variables = details.variables
  const normalized = toRecord(details.normalized)
  const normalizedFlow = toRecord(normalized?.flowData)
  const normalizedCustomer = toRecord(normalized?.customerData)
  const normalizedConversation = toRecord(normalized?.conversationData)
  const normalizedAgent = toRecord(normalized?.agentData)
  const normalizedSecurity = toRecord(normalized?.securityData)
  const normalizedToolTrace = Array.isArray(normalized?.toolTrace) ? (normalized?.toolTrace as UnknownRecord[]) : []
  const toolExecutions: ToolExecution[] = normalizedToolTrace.length > 0
    ? normalizedToolTrace.map((execution) => ({
        scopeKey: String(execution.scopeKey || ""),
        toolName: String(execution.toolName || "Unknown tool"),
        parameters: toRecord(execution.parameters) || {},
        result: execution.result,
        summary: String(execution.summary || "Result payload available"),
      }))
    : extractToolExecutions(details)

  const completedNodes = flowNodes.filter((node) => String(node.state) === "COMPLETED")
  const activeNodes = flowNodes.filter((node) => String(node.state) === "ACTIVE")

  const sortedTimeline = [...flowNodes]
    .sort((a, b) => {
      const aTs = resolveTimelineTimestamp(a)
      const bTs = resolveTimelineTimestamp(b)

      if (aTs !== bTs) {
        return aTs - bTs
      }

      return String(a.key || a.flowNodeId || a.flowNodeName || "").localeCompare(
        String(b.key || b.flowNodeId || b.flowNodeName || ""),
      )
    })

  const getVar = (name: string) => variables.find((item) => String(item.name) === name)

  const currentEmail = toRecord(safeParseJson(getVar("currentEmail")?.value))
  const ourReplyEmail = toRecord(safeParseJson(getVar("ourReplyEmail")?.value))
  const isExistingUser = safeParseJson(getVar("isExistingUser")?.value)
  const agentContext = findAgentContext(variables)
  const conversation = toRecord(agentContext?.conversation)
  const messages = Array.isArray(normalizedConversation?.messages)
    ? (normalizedConversation.messages as UnknownRecord[])
    : Array.isArray(conversation?.messages)
      ? conversation?.messages
      : []
  const toolDefinitions = Array.isArray(normalizedAgent?.toolDefinitions)
    ? (normalizedAgent.toolDefinitions as UnknownRecord[])
    : Array.isArray(agentContext?.toolDefinitions)
      ? agentContext.toolDefinitions
      : []
  const systemPrompt = toRecord(agentContext?.systemPrompt)
  const normalizedSystemPrompt = toRecord(normalizedAgent?.systemPrompt) || {}
  const systemPromptText = String(normalizedSystemPrompt.preview || systemPrompt?.prompt || "")

  const roleCounts = messages.reduce(
    (counts, message) => {
      const role = String(toRecord(message)?.role || "other").toLowerCase()
      if (role === "system") counts.system += 1
      else if (role === "user") counts.user += 1
      else if (role === "assistant") counts.assistant += 1
      else if (role === "tool") counts.tool += 1
      else counts.other += 1
      return counts
    },
    { system: 0, user: 0, assistant: 0, tool: 0, other: 0 },
  )

  const resultVars = details.variables
    .filter((item) => String(item.name) === "toolCallResult")
    .map((item) => toRecord(safeParseJson(item.value)))
    .filter((item): item is UnknownRecord => item !== null)

  const chunkList = resultVars
    .flatMap((item) => (Array.isArray(item.chunks) ? (item.chunks as UnknownRecord[]) : []))
    .slice(0, 4)

  const knowledge: KnowledgeChunk[] = chunkList.map((chunk) => ({
    score: typeof chunk.score === "number" ? chunk.score.toFixed(3) : "-",
    preview: String(chunk.content || "").replace(/\s+/g, " ").trim().slice(0, 220) || "No content",
  }))

  const sensitiveVariableRecords: SensitiveVariable[] = normalizedSecurity && Array.isArray(normalizedSecurity.sensitiveVariables)
    ? (normalizedSecurity.sensitiveVariables as UnknownRecord[]).map((item) => ({
        name: String(item.name || ""),
        value: item.value,
        preview: String(item.preview || summarizeSensitiveValue(item.value)),
        type: String(item.type || typeof item.value),
      }))
    : variables
        .filter((item) => isSensitiveName(String(item.name)))
        .map((item) => {
          const parsed = safeParseJson(item.value)
          return {
            name: String(item.name || ""),
            value: parsed,
            preview: summarizeSensitiveValue(parsed),
            type: Array.isArray(parsed) ? "array" : parsed === null ? "null" : typeof parsed,
          }
        })
  const safeSecretReferences: SafeSecretReference[] = []
  const trulySensitiveVariables: SensitiveVariable[] = []

  for (const record of sensitiveVariableRecords) {
    if (isSecretReference(record.value)) {
      safeSecretReferences.push({ name: record.name, value: record.value })
      continue
    }
    trulySensitiveVariables.push(record)
  }
  const sensitiveVariableNames = normalizedSecurity && Array.isArray(normalizedSecurity.sensitiveVariableNames)
    ? Array.from(
        new Set(
          (normalizedSecurity.sensitiveVariableNames as unknown[])
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ),
      )
    : Array.from(
        new Set(
          variables
            .map((item) => String(item.name || "").trim())
            .filter((name) => Boolean(name) && isSensitiveName(name)),
        ),
      )
  const metrics = toRecord(normalizedAgent?.metrics) || toRecord(agentContext?.metrics) || {}
  const tokenUsage = toRecord(metrics.tokenUsage) || {}
  const normalizedMetrics = toRecord(normalizedAgent?.metrics) || {}
  const inputTokens = Number(normalizedMetrics.inputTokenCount || tokenUsage.inputTokenCount || 0)
  const outputTokens = Number(normalizedMetrics.outputTokenCount || tokenUsage.outputTokenCount || 0)
  const conversationData = normalizedConversation || toRecord(conversation)
  const normalizedRoleCounts = toRecord(conversationData?.roleCounts) || roleCounts
  const normalizedConversationId = String(conversationData?.conversationId || conversation?.conversationId || "")
  const normalizedConversationType = String(conversationData?.type || conversation?.type || "")
  const normalizedMessageCount = Number(conversationData?.messageCount || messages.length || 0)

  return {
    flow: {
      total: Number(normalizedFlow?.total || flowNodes.length),
      completed: Number(normalizedFlow?.completed || completedNodes.length),
      active: Number(normalizedFlow?.active || activeNodes.length),
      activeNode: normalizedFlow?.activeNode !== undefined
        ? String(normalizedFlow.activeNode || null)
        : String(activeNodes[0]?.flowNodeName || activeNodes[0]?.flowNodeId || "") || null,
    },
    timeline: sortedTimeline,
    customer: {
      email: String(normalizedCustomer?.email || currentEmail?.fromAddress || ""),
      subject: String(normalizedCustomer?.subject || currentEmail?.subject || ""),
      isExisting: typeof normalizedCustomer?.isExistingUser === "boolean"
        ? Boolean(normalizedCustomer.isExistingUser)
        : Array.isArray(isExistingUser) && isExistingUser.length > 0,
      replySent: typeof normalizedCustomer?.hasReplied === "boolean"
        ? Boolean(normalizedCustomer.hasReplied)
        : Boolean(ourReplyEmail?.sent),
      messagePreview: String(normalizedCustomer?.messagePreview || currentEmail?.plainTextBody || "").replace(/\s+/g, " ").trim().slice(0, 240),
    },
    agent: {
      type: String(normalizedAgent?.type || agentContext?.type || ""),
      state: String(normalizedAgent?.state || agentContext?.state || ""),
      conversationType: normalizedConversationType,
      conversationId: normalizedConversationId,
      messageCount: normalizedMessageCount,
      roleCounts: normalizedRoleCounts,
      toolDefinitionCount: toolDefinitions.length,
      toolNames: toolDefinitions.map((tool) => String(toRecord(tool)?.name || "")).filter(Boolean),
      hasSystemPrompt: Boolean(normalizedSystemPrompt.hasPrompt || systemPromptText),
      systemPromptPreview: String(normalizedSystemPrompt.preview || systemPromptText).replace(/\s+/g, " ").trim().slice(0, 220),
      modelCalls: Number(normalizedMetrics.modelCalls || metrics.modelCalls || 0),
      inputTokens,
      outputTokens,
      totalTokens: Number(normalizedMetrics.totalTokens || inputTokens + outputTokens),
    },
    tools: {
      total: toolExecutions.length,
      names: Array.from(new Set(toolExecutions.map((tool) => tool.toolName).filter(Boolean))),
      executions: toolExecutions,
    },
    knowledge,
    security: {
      sensitiveVariableCount: trulySensitiveVariables.length,
      sensitiveVariableNames,
      sensitiveVariables: trulySensitiveVariables,
      safeSecretReferences,
    },
  }
}
