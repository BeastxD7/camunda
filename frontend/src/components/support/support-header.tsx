import { RefreshCw } from "lucide-react"

type SupportHeaderProps = {
  isRefreshing: boolean
  onRefresh: () => void
}

export function SupportHeader({ isRefreshing, onRefresh }: SupportHeaderProps) {
  return (
    <header className="support-header rounded-3xl border border-border/60 px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Camunda Support Console
          </p>
          <h1 className="font-heading text-3xl leading-tight md:text-4xl">Customer Support Cases</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Operations view for support staff. Browse active process instances and drill into
            execution details instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh Cases
        </button>
      </div>
    </header>
  )
}
