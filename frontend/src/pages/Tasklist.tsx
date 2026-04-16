import React, { useMemo, useState } from 'react'
import { ClipboardCheck, Loader2, RefreshCw, Send, UserRoundCheck } from 'lucide-react'
import { PageContainer } from '../components/layout/PageContainer'
import { api } from '../lib/api'
import { formatDate, statusClass } from '../lib/support-formatters'
import type {
  TaskFormComponent,
  TasklistTask,
  TasklistTaskDetailsPayload,
} from '../types/support'

type UnknownRecord = Record<string, unknown>
const CONTEXT_ONLY_KEYS = new Set(['customerName', 'customerEmail', 'requestDetails'])

type ToastState = {
  message: string
  type: 'success'
}

const DEFAULT_TASK_ASSIGNEE = (import.meta.env.VITE_CAMUNDA_TASK_ASSIGNEE || 'support-agent').trim() || 'support-agent'

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isInputComponent(component: TaskFormComponent): boolean {
  if (!component.key) return false
  const type = component.type || 'textfield'
  return type === 'textfield' || type === 'textarea' || type === 'checkbox' || type === 'radio'
}

function isContextOnlyField(component: TaskFormComponent): boolean {
  return Boolean(component.key && CONTEXT_ONLY_KEYS.has(component.key))
}

function isSubmittableInput(component: TaskFormComponent): boolean {
  return isInputComponent(component) && !component.readonly
}

function inferVariableValue(raw: unknown): unknown {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'boolean' || typeof raw === 'number') return raw

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    const numeric = Number(trimmed)
    if (!Number.isNaN(numeric) && trimmed !== '') return numeric
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return trimmed
      }
    }
    return trimmed
  }

  return raw
}

function toDisplayString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isComponentHidden(component: TaskFormComponent, values: Record<string, unknown>): boolean {
  const hideExpression = component.conditional?.hide
  if (!hideExpression || typeof hideExpression !== 'string') return false

  const expression = hideExpression.trim()
  if (!expression.startsWith('=')) return false

  const raw = expression.slice(1).trim()
  if (!raw) return false

  // Minimal FEEL-like support used in common Camunda forms: =flag and =!flag
  if (raw.startsWith('!')) {
    const key = raw.slice(1).trim()
    if (!key) return false
    return !Boolean(values[key])
  }

  return Boolean(values[raw])
}

function collectDefaultValues(
  components: TaskFormComponent[],
  target: Record<string, unknown>,
): void {
  for (const component of components) {
    if (component.type === 'group' && Array.isArray(component.components)) {
      collectDefaultValues(component.components, target)
      continue
    }

    if (!component.key) continue

    if (component.type === 'checkbox') {
      const currentValue = target[component.key]
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        target[component.key] = false
      }
    }

    if (component.defaultValue !== undefined && target[component.key] === undefined) {
      target[component.key] = component.defaultValue
    }
  }
}

function collectRequiredErrors(
  components: TaskFormComponent[],
  values: Record<string, unknown>,
  out: string[],
): void {
  for (const component of components) {
    if (isComponentHidden(component, values)) {
      continue
    }

    if (component.type === 'group' && Array.isArray(component.components)) {
      collectRequiredErrors(component.components, values, out)
      continue
    }

    if (!isSubmittableInput(component)) continue
    if (isContextOnlyField(component)) continue
    if (!component.key) continue
    if (!component.validate?.required) continue

    const value = values[component.key]
    const label = component.label || component.key

    if (component.type === 'checkbox') {
      if (value !== true) {
        out.push(`${label} is required.`)
      }
      continue
    }

    const text = toDisplayString(value).trim()
    if (!text) {
      out.push(`${label} is required.`)
    }
  }
}

function collectRequiredFieldLabels(
  components: TaskFormComponent[],
  values: Record<string, unknown>,
  out: string[],
): void {
  for (const component of components) {
    if (isComponentHidden(component, values)) {
      continue
    }

    if (component.type === 'group' && Array.isArray(component.components)) {
      collectRequiredFieldLabels(component.components, values, out)
      continue
    }

    if (!isSubmittableInput(component)) continue
    if (isContextOnlyField(component)) continue
    if (!component.validate?.required) continue

    out.push(component.label || component.key || 'Required field')
  }
}

function textClassForContent(text: string): string {
  if (text.startsWith('###')) return 'text-base font-semibold'
  if (text.startsWith('##')) return 'text-lg font-semibold'
  if (text.startsWith('#')) return 'text-xl font-semibold'
  if (text.startsWith('#####')) return 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'
  if (text.startsWith('####')) return 'text-sm font-semibold text-muted-foreground'
  return 'text-sm text-muted-foreground'
}

function normalizeDisplayText(text: string): string {
  return text.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim()
}

export const TasklistPage: React.FC = () => {
  const [tasks, setTasks] = useState<TasklistTask[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<TasklistTaskDetailsPayload | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const [stateFilter, setStateFilter] = useState<string>('CREATED')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('')

  const [formValues, setFormValues] = useState<Record<string, unknown>>({})

  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  React.useEffect(() => {
    if (!toast) return

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId],
  )

  const currentAssignee = useMemo(
    () => toDisplayString(selectedTaskDetails?.task?.assignee || selectedTask?.assignee).trim(),
    [selectedTaskDetails, selectedTask],
  )

  const formComponents = useMemo(() => {
    const rawComponents = selectedTaskDetails?.form?.schema?.components
    return Array.isArray(rawComponents) ? (rawComponents as TaskFormComponent[]) : []
  }, [selectedTaskDetails])

  const customerSnapshot = useMemo(() => {
    const details = selectedTaskDetails?.variables || {}
    const currentEmail = isRecord(details.currentEmail) ? details.currentEmail : null

    return {
      customerName:
        toDisplayString(details.customerName).trim() ||
        toDisplayString(details.customer_name).trim() ||
        '-',
      customerEmail:
        toDisplayString(details.customerEmail).trim() ||
        toDisplayString(details.customer_email).trim() ||
        toDisplayString(currentEmail?.fromAddress).trim() ||
        '-',
      requestDetails:
        toDisplayString(details.requestDetails).trim() ||
        toDisplayString(details.customerIssue).trim() ||
        toDisplayString(currentEmail?.plainTextBody).trim() ||
        '-',
      emailSubject:
        toDisplayString(currentEmail?.subject).trim() ||
        toDisplayString(details.emailSubject).trim() ||
        '-',
    }
  }, [selectedTaskDetails])

  const requiredFieldLabels = useMemo(() => {
    if (formComponents.length === 0) return []

    const labels: string[] = []
    collectRequiredFieldLabels(formComponents, formValues, labels)
    return Array.from(new Set(labels))
  }, [formComponents, formValues])

  const loadTasks = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const response = await api.tasklist.listTasks({
        state: stateFilter || undefined,
        assignee: assigneeFilter || undefined,
        pageSize: 50,
      })

      const items = response.data?.items || []
      setTasks(items)

      if (!selectedTaskId && items.length > 0) {
        setSelectedTaskId(String(items[0].id || ''))
      }

      if (selectedTaskId && !items.some((task) => task.id === selectedTaskId)) {
        setSelectedTaskId(items[0]?.id || '')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tasks'
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadTaskDetails = async (taskId: string) => {
    if (!taskId) {
      setSelectedTaskDetails(null)
      return
    }

    setDetailsLoading(true)
    setActionMessage(null)

    try {
      const response = await api.tasklist.getTaskDetails(taskId)
      const details = response.data || null
      setSelectedTaskDetails(details)

      const values: Record<string, unknown> = {
        ...(details?.variables || {}),
      }

      const components = Array.isArray(details?.form?.schema?.components)
        ? (details?.form?.schema?.components as TaskFormComponent[])
        : []

      collectDefaultValues(components, values)
      setFormValues(values)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load task details'
      setActionMessage(message)
      setSelectedTaskDetails(null)
      setFormValues({})
    } finally {
      setDetailsLoading(false)
    }
  }

  React.useEffect(() => {
    void loadTasks()
  }, [])

  React.useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTaskDetails(null)
      setFormValues({})
      return
    }
    void loadTaskDetails(selectedTaskId)
  }, [selectedTaskId])

  const onApplyFilters = async () => {
    await loadTasks(true)
  }

  const onAssignToMe = async () => {
    if (!selectedTask?.id) return

    if (currentAssignee) {
      setActionMessage(`Task is already assigned to ${currentAssignee}.`)
      return
    }

    setSubmitting(true)
    setActionMessage(null)

    try {
      await api.tasklist.assignTask(selectedTask.id, DEFAULT_TASK_ASSIGNEE)

      // Optimistically update local state to avoid double-click due to eventual consistency.
      setTasks((previous) =>
        previous.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                assignee: DEFAULT_TASK_ASSIGNEE,
              }
            : task,
        ),
      )
      setSelectedTaskDetails((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          task: {
            ...previous.task,
            assignee: DEFAULT_TASK_ASSIGNEE,
          },
        }
      })

      setActionMessage('Task assigned to you.')
      void loadTasks(true)
      void loadTaskDetails(selectedTask.id)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to assign task')
    } finally {
      setSubmitting(false)
    }
  }

  const onComplete = async () => {
    if (!selectedTask?.id) return

    const assignee = currentAssignee
    if (!assignee) {
      setActionMessage('Assign the task to yourself before completing it.')
      return
    }

    if (formComponents.length > 0) {
      const requiredErrors: string[] = []
      collectRequiredErrors(formComponents, formValues, requiredErrors)
      if (requiredErrors.length > 0) {
        setActionMessage(requiredErrors[0])
        return
      }
    }

    const payload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(formValues)) {
      payload[key] = inferVariableValue(value)
    }

    setSubmitting(true)
    setActionMessage(null)

    try {
      await api.tasklist.completeTask(selectedTask.id, payload)
      setActionMessage('Task completed successfully.')
      setToast({
        message: 'Task completed successfully.',
        type: 'success',
      })
      await loadTasks(true)
      setSelectedTaskDetails(null)
      setFormValues({})
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to complete task')
    } finally {
      setSubmitting(false)
    }
  }

  const setFieldValue = (key: string, value: unknown) => {
    setFormValues((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const renderComponent = (component: TaskFormComponent, index: number): React.ReactNode => {
    if (isComponentHidden(component, formValues)) return null

    const type = component.type || 'textfield'
    const key = component.key
    const value = key ? formValues[key] : undefined
    const required = Boolean(component.validate?.required)
    const readOnly = Boolean(component.readonly)

    if (type === 'text') {
      const rawText = typeof component.text === 'string' ? component.text.trim() : ''
      if (!rawText) return null

      return (
        <p key={component.id || `text-${index}`} className={textClassForContent(rawText)}>
          {normalizeDisplayText(rawText)}
        </p>
      )
    }

    if (type === 'group') {
      const children = Array.isArray(component.components) ? component.components : []
      const renderedChildren = children
        .map((child, childIndex) => renderComponent(child, childIndex))
        .filter(Boolean)

      if (renderedChildren.length === 0) return null

      return (
        <div key={component.id || `group-${index}`} className="rounded-2xl border border-border/60 bg-background/70 p-4 space-y-3">
          {component.label ? <p className="text-sm font-semibold">{component.label}</p> : null}
          {renderedChildren}
        </div>
      )
    }

    if (!isInputComponent(component)) {
      return null
    }

    if (isContextOnlyField(component)) {
      return null
    }

    if (!key) {
      return null
    }

    const label = component.label || key

    if (type === 'textarea') {
      return (
        <label key={component.id || key} className="block text-sm space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {label}{required ? ' *' : ''}
          </p>
          <textarea
            value={toDisplayString(value)}
            onChange={(event) => setFieldValue(key, event.target.value)}
            readOnly={readOnly}
            rows={4}
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm leading-6"
          />
        </label>
      )
    }

    if (type === 'checkbox') {
      return (
        <label key={component.id || key} className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => setFieldValue(key, event.target.checked)}
            disabled={readOnly}
          />
          <span>{label}{required ? ' *' : ''}</span>
        </label>
      )
    }

    if (type === 'radio') {
      const options = Array.isArray(component.values) ? component.values : []
      return (
        <div key={component.id || key} className="space-y-2">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}{required ? ' *' : ''}</p>
          <div className="grid gap-2">
            {options.map((option) => (
              <label key={`${key}-${option.value}`} className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                <input
                  type="radio"
                  name={key}
                  value={option.value}
                  checked={String(value || '') === String(option.value)}
                  onChange={(event) => setFieldValue(key, event.target.value)}
                  disabled={readOnly}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )
    }

    if (type === 'button') {
      return null
    }

    return (
      <label key={component.id || key} className="block text-sm space-y-1">
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {label}{required ? ' *' : ''}
        </p>
        <input
          value={toDisplayString(value)}
          onChange={(event) => setFieldValue(key, event.target.value)}
          readOnly={readOnly}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
        />
      </label>
    )
  }

  return (
    <PageContainer>
      <div className="relative flex flex-col gap-6">
        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 top-20 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 shadow-[0_16px_40px_rgba(16,185,129,0.18)] backdrop-blur dark:text-emerald-100"
          >
            <p className="font-medium">{toast.message}</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-heading font-semibold tracking-tight text-foreground">
              Human Tasklist
            </h1>
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Assign and complete support tasks
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadTasks(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <section className="border border-border/70 bg-background p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">State</p>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2"
              >
                <option value="CREATED">CREATED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELED">CANCELED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </label>

            <label className="text-sm">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Assignee</p>
              <input
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2"
                placeholder="Optional assignee filter"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={onApplyFilters}
                className="w-full rounded-xl border border-border/60 bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="border border-destructive/60 bg-destructive/10 p-5 text-sm text-destructive">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <article className="border border-border/70 bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Tasks</h2>
              <p className="text-xs text-muted-foreground">{tasks.length} total</p>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tasklist...
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks found for current filters.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const selected = selectedTaskId === task.id
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border/60 bg-background/70 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{task.name || 'Unnamed task'}</p>
                          <p className="text-xs text-muted-foreground">{task.processName || '-'} • PI {task.processInstanceKey || '-'}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(task.taskState)}`}>
                          {task.taskState || '-'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Assignee: {task.assignee || 'Unassigned'}</span>
                        <span>Created: {formatDate(task.creationDate)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </article>

          <article className="border border-border/70 bg-background p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Task Form</h2>
            </div>

            {!selectedTask ? (
              <p className="text-sm text-muted-foreground">Select a task from the list to review and complete it.</p>
            ) : detailsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading task details...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm space-y-1">
                  <p className="font-semibold">{selectedTask.name || 'Unnamed task'}</p>
                  <p className="text-xs text-muted-foreground">Task ID: {selectedTask.id}</p>
                  <p className="text-xs text-muted-foreground">Current assignee: {toDisplayString(selectedTaskDetails?.task?.assignee || selectedTask.assignee || 'Unassigned')}</p>
                  <p className="text-xs text-muted-foreground">Form ID: {toDisplayString(selectedTaskDetails?.form?.formId || selectedTask.formId || '-')}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Customer Details</p>
                  <p className="text-sm"><span className="text-muted-foreground">Name:</span> {customerSnapshot.customerName}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Email:</span> {customerSnapshot.customerEmail}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Subject:</span> {customerSnapshot.emailSubject}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Request:</span> {customerSnapshot.requestDetails}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/70 p-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Assignment</p>
                  <p className="text-sm text-muted-foreground">Claim this task before entering your response.</p>
                  <button
                    type="button"
                    onClick={onAssignToMe}
                    disabled={submitting || Boolean(currentAssignee)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
                  >
                    <UserRoundCheck className="h-4 w-4" />
                    {currentAssignee ? `Assigned (${currentAssignee})` : 'Assign To Me'}
                  </button>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Your Input</p>
                  {requiredFieldLabels.length > 0 ? (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Required From Camunda Form</p>
                      <p className="mt-1 text-sm text-muted-foreground">{requiredFieldLabels.join(' • ')}</p>
                    </div>
                  ) : null}
                  {formComponents.length > 0 ? (
                    <div className="space-y-3">
                      {formComponents.map((component, index) => renderComponent(component, index))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No dynamic form schema is available for this task yet.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onComplete}
                  disabled={submitting || !currentAssignee}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Complete Task
                </button>

                {actionMessage ? (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                    {actionMessage}
                  </div>
                ) : null}
              </div>
            )}
          </article>
        </section>
      </div>
    </PageContainer>
  )
}
