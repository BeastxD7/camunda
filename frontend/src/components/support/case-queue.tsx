import { formatDate, statusClass } from "@/lib/support-formatters"
import type { ProcessInstance } from "@/types/support"

type CaseQueueProps = {
  instances: ProcessInstance[]
  selectedKey: string | null
  isLoading: boolean
  error: string | null
  onSelect: (instanceKey: string) => void
}

export function CaseQueue({
  instances,
  selectedKey,
  isLoading,
  error,
  onSelect,
}: CaseQueueProps) {
  return (
    <article className="support-card rounded-3xl border border-border/60 p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Case Queue</h2>
        <p className="text-xs text-muted-foreground">GET /api/process-instances</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
        {isLoading && instances.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">Loading cases...</p>
        ) : null}

        {!isLoading && instances.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">
            No cases available. Try refreshing when a process instance is created.
          </p>
        ) : null}

        {instances.map((item) => {
          const isSelected = item.key === selectedKey

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? "border-primary/50 bg-primary/8 shadow-sm"
                  : "border-border/70 hover:border-primary/30 hover:bg-muted/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{item.bpmnProcessId || "Unknown Process"}</p>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(item.state)}`}>
                  {item.state || "UNKNOWN"}
                </span>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <p>Instance Key: {item.key}</p>
                <p>Version: {item.processVersion ?? "-"}</p>
                <p>Started: {formatDate(item.startDate)}</p>
              </div>
            </button>
          )
        })}
      </div>
    </article>
  )
}
