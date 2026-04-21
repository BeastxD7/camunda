import type {
  ApiError,
  ApiSuccess,
  ProcessDetailsPayload,
  ProcessInstancesPayload,
  TasklistTaskDetailsPayload,
  TasklistTasksPayload,
} from '@/types/support'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")
const DEFAULT_SUPPORT_BPMN_PROCESS_ID =
  (import.meta.env.VITE_SUPPORT_BPMN_PROCESS_ID || "Process_15wz3ez").trim()

function toUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }

  return `${API_BASE_URL}${path}`
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T>> {
  let response: Response

  try {
    response = await fetch(toUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new Error(
      "Unable to reach backend API. Ensure backend is running and VITE_API_BASE_URL is correct.",
    )
  }

  const payload = (await response.json()) as ApiSuccess<T> | ApiError

  if (!response.ok || payload.success === false) {
    const message = "message" in payload ? payload.message : "Request failed"
    throw new Error(message)
  }

  return payload
}

interface OptimizeDashboard {
  id: string;
  name: string;
  description?: string | null;
  exportEntityType?: string;
  reports?: Array<{ id?: string; name?: string }>;
  tiles?: Array<{ id: string; type: string; position?: any; dimensions?: any }>;
  sourceIndexVersion?: number;
  collectionId?: string | null;
}

interface OptimizeReport {
  id: string;
  name: string;
  description?: string;
}

interface OptimizeEntityId {
  id: string;
}

interface DemoSourceModePayload {
  mode: 'camunda' | 'db';
}

interface DemoSyncPayload {
  collectionId: string;
  processes: { count: number };
  tasks: { count: number };
  optimize: { dashboardsSynced: number; reportsSynced: number };
}

interface BankTableSummary {
  tableSchema: string;
  tableName: string;
  rowCountEstimate: number;
  columnCount: number;
  hasPrimaryKey: boolean;
}

interface BankCustomer {
  id: number;
  createdAt: string | null;
  customerName: string | null;
  email: string | null;
  mobile: string | null;
  age: number | null;
  income: number | null;
  residency: string | null;
  creditScore: number | null;
}

interface BankCustomersPayload {
  limit: number;
  offset: number;
  totalCount: number;
  items: BankCustomer[];
}

interface BankCard {
  id: number;
  createdAt: string | null;
  customerName: string | null;
  email: string | null;
  cardName: string | null;
  annualSpend: number | null;
  latePayments: number | null;
  tenure: number | null;
}

interface BankCardsPayload {
  email: string;
  limit: number;
  offset: number;
  totalCount: number;
  items: BankCard[];
}

interface BankTransaction {
  transactionId: string;
  email: string | null;
  amount: number | null;
  merchantName: string | null;
  internalStatus: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
}

interface BankTransactionsPayload {
  email: string;
  limit: number;
  offset: number;
  totalCount: number;
  items: BankTransaction[];
}

interface ScreeningMember {
  id: string;
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  status: string | null;
  raw: Record<string, unknown>;
}

interface ScreeningMembersPayload {
  limit: number;
  offset: number;
  totalCount: number;
  items: ScreeningMember[];
}

interface ScreeningActivityLog {
  id: string;
  memberId: string | null;
  fullName: string | null;
  actionType: string | null;
  description: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
}

interface ScreeningActivityLogsPayload {
  memberId: string;
  limit: number;
  offset: number;
  totalCount: number;
  items: ScreeningActivityLog[];
}

const api = {
  support: {
    listProcessInstances: (params?: { size?: number; bpmnProcessId?: string }) => {
      const query = new URLSearchParams()
      if (typeof params?.size === 'number') query.set('size', String(params.size))
      const scopedBpmnProcessId =
        typeof params?.bpmnProcessId === 'string' && params.bpmnProcessId.trim()
          ? params.bpmnProcessId.trim()
          : DEFAULT_SUPPORT_BPMN_PROCESS_ID
      if (scopedBpmnProcessId) {
        query.set('bpmnProcessId', scopedBpmnProcessId)
      }
      const suffix = query.toString() ? `?${query.toString()}` : ''

      return request<ProcessInstancesPayload>(`/api/process-instances${suffix}`)
    },
    getProcessInstanceDetails: (instanceKey: string) =>
      request<ProcessDetailsPayload>(`/api/process-instances/${instanceKey}`),
  },
  tasklist: {
    listTasks: (params?: {
      state?: string
      assignee?: string
      processInstanceKey?: string
      candidateGroup?: string
      pageSize?: number
    }) => {
      const query = new URLSearchParams()
      if (params?.state) query.set('state', params.state)
      if (params?.assignee) query.set('assignee', params.assignee)
      if (params?.processInstanceKey) query.set('processInstanceKey', params.processInstanceKey)
      if (params?.candidateGroup) query.set('candidateGroup', params.candidateGroup)
      if (typeof params?.pageSize === 'number') query.set('pageSize', String(params.pageSize))
      const suffix = query.toString() ? `?${query.toString()}` : ''

      return request<TasklistTasksPayload>(`/api/tasklist/tasks${suffix}`)
    },
    getTaskDetails: (taskId: string) =>
      request<TasklistTaskDetailsPayload>(`/api/tasklist/tasks/${taskId}`),
    assignTask: (taskId: string, assignee?: string) =>
      request(`/api/tasklist/tasks/${taskId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assignee }),
      }),
    completeTask: (taskId: string, variables?: Record<string, unknown>) =>
      request(`/api/tasklist/tasks/${taskId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ variables: variables || {} }),
      }),
  },
  optimize: {
    getDashboardIds: (collectionId: string) =>
      request<OptimizeEntityId[]>(`/api/optimize/dashboard-ids?collectionId=${encodeURIComponent(collectionId)}`),
    getReportIds: (collectionId: string) =>
      request<OptimizeEntityId[]>(`/api/optimize/report-ids?collectionId=${encodeURIComponent(collectionId)}`),
    exportDashboardDefinitions: (dashboardIds: string[]) =>
      request<OptimizeDashboard[]>("/api/optimize/dashboard-definitions/export", {
        method: "POST",
        body: JSON.stringify({ dashboardIds }),
      }),
    getReportData: (reportId: string) =>
      request<any>(`/api/optimize/report-data?reportId=${encodeURIComponent(reportId)}`),
  },
  demo: {
    getSourceMode: () => request<DemoSourceModePayload>("/api/demo/source"),
    setSourceMode: (mode: 'camunda' | 'db') =>
      request<DemoSourceModePayload>("/api/demo/source", {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
    syncAll: (collectionId: string) =>
      request<DemoSyncPayload>("/api/demo/sync", {
        method: 'POST',
        body: JSON.stringify({ collectionId }),
      }),
  },
  bank: {
    getTables: () => request<BankTableSummary[]>('/api/bank/tables'),
    getCustomers: (params?: { search?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (params?.search) query.set('search', params.search)
      if (typeof params?.limit === 'number') query.set('limit', String(params.limit))
      if (typeof params?.offset === 'number') query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<BankCustomersPayload>(`/api/bank/customers${suffix}`)
    },
    getCustomerCards: (email: string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (typeof params?.limit === 'number') query.set('limit', String(params.limit))
      if (typeof params?.offset === 'number') query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<BankCardsPayload>(`/api/bank/customers/${encodeURIComponent(email)}/cards${suffix}`)
    },
    getCustomerTransactions: (email: string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (typeof params?.limit === 'number') query.set('limit', String(params.limit))
      if (typeof params?.offset === 'number') query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<BankTransactionsPayload>(`/api/bank/customers/${encodeURIComponent(email)}/transactions${suffix}`)
    },
    getScreeningMembers: (params?: { search?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (params?.search) query.set('search', params.search)
      if (typeof params?.limit === 'number') query.set('limit', String(params.limit))
      if (typeof params?.offset === 'number') query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<ScreeningMembersPayload>(`/api/bank/screening-members${suffix}`)
    },
    getScreeningActivity: (memberId: string, params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams()
      if (typeof params?.limit === 'number') query.set('limit', String(params.limit))
      if (typeof params?.offset === 'number') query.set('offset', String(params.offset))
      const suffix = query.toString() ? `?${query.toString()}` : ''
      return request<ScreeningActivityLogsPayload>(`/api/bank/screening-members/${encodeURIComponent(memberId)}/activity${suffix}`)
    },
  },
}

export { api }
export type {
  OptimizeDashboard,
  OptimizeReport,
  OptimizeEntityId,
  BankTableSummary,
  BankCustomer,
  BankCustomersPayload,
  BankCard,
  BankCardsPayload,
  BankTransaction,
  BankTransactionsPayload,
  ScreeningMember,
  ScreeningMembersPayload,
  ScreeningActivityLog,
  ScreeningActivityLogsPayload,
}
