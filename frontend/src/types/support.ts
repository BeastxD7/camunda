export type ApiSuccess<T> = {
  success: true
  message: string
  data?: T
}

export type ApiError = {
  success: false
  message: string
  error: unknown
}

export type ProcessInstance = {
  key: string
  bpmnProcessId?: string
  processVersion?: number
  state?: string
  startDate?: string
  endDate?: string
  tenantId?: string
  incident?: boolean
}

export type ProcessInstancesPayload = {
  count: number
  items: ProcessInstance[]
}

export type TasklistTask = {
  id: string
  name?: string
  taskDefinitionId?: string
  processName?: string
  processInstanceKey?: string
  taskState?: string
  assignee?: string
  creationDate?: string
  dueDate?: string
  followUpDate?: string
  tenantId?: string
  candidateGroups?: string[]
  candidateUsers?: string[]
  formKey?: string
  formId?: string
  formVersion?: string
  implementation?: string
  variables?: Record<string, unknown>
}

export type TaskFormComponent = {
  id?: string
  type?: string
  key?: string
  label?: string
  text?: string
  readonly?: boolean
  defaultValue?: unknown
  validate?: {
    required?: boolean
  }
  values?: Array<{
    value: string
    label: string
  }>
  conditional?: {
    hide?: string
  }
  components?: TaskFormComponent[]
}

export type TaskFormSchema = {
  id?: string
  type?: string
  components?: TaskFormComponent[]
  [key: string]: unknown
}

export type TasklistTaskDetailsPayload = {
  task: TasklistTask
  form?: {
    formId?: string
    formKey?: string
    version?: number
    schema?: TaskFormSchema
  }
  variables: Record<string, unknown>
  variableEntries: Array<{
    name: string
    value: unknown
  }>
}

export type TasklistTasksPayload = {
  count: number
  items: TasklistTask[]
}

export type ProcessDetailsPayload = {
  instance: Record<string, unknown>
  flowNodes: Array<Record<string, unknown>>
  variables: Array<Record<string, unknown>>
  normalized?: {
    flowData: Record<string, unknown>
    customerData: Record<string, unknown>
    previousConversationData?: {
      available: boolean
      chunkCount: number
      topScore: number
      averageScore: number
      conversationInsights: {
        customerTurns: number
        assistantTurns: number
        hasResolutionSignal: boolean
        latestStatus: string
        keyLesson: string
      }
      topChunks: Array<Record<string, unknown>>
      raw?: unknown
    }
    conversationData: {
      type: string
      conversationId: string
      messageCount: number
      roleCounts: Record<string, number>
      messages: Array<Record<string, unknown>>
    }
    agentData: {
      type: string
      state: string
      conversation: {
        type: string
        conversationId: string
        messageCount: number
        roleCounts: Record<string, number>
        messages: Array<Record<string, unknown>>
      }
      metrics: {
        modelCalls: number
        inputTokenCount: number
        outputTokenCount: number
        totalTokens: number
      }
      toolDefinitions: Array<Record<string, unknown>>
      systemPrompt: {
        hasPrompt: boolean
        preview: string
      }
    }
    toolTrace: Array<Record<string, unknown>>
    securityData: {
      sensitiveVariableCount: number
      sensitiveVariableNames: string[]
      sensitiveVariables: Array<{
        name: string
        value: unknown
        preview: string
        type: string
      }>
      safeSecretReferences: Array<{
        name: string
        value: string
      }>
    }
    parsedVariables?: {
      count: number
      items: Array<{
        key: string
        scopeKey: string
        name: string
        truncated: boolean
        wasJsonString: boolean
        parsedType: string
        value: unknown
      }>
      byName: Record<string, unknown[]>
    }
  }
  rawPayload?: Record<string, unknown>
}
