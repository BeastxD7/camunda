import type { ReactNode } from "react"

type StatsSummary = {
  total: number
  active: number
  completed: number
  flagged: number
}

type StatCardProps = {
  label: string
  value: number
  icon: ReactNode
  variant: "total" | "active" | "completed" | "flagged"
}

const metricVariants: Record<StatCardProps["variant"], string> = {
  total: "brand-metric-card",
  active: "brand-metric-card",
  completed: "brand-metric-card",
  flagged: "brand-metric-card",
}

function StatCard({ label, value, icon, variant }: StatCardProps) {
  return (
    <div
      className={`relative rounded-lg px-4 py-4 text-foreground ${metricVariants[variant]}`}
    >
      <div className="absolute right-3 top-3 text-foreground/65">{icon}</div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-foreground/70">{label}</p>
    </div>
  )
}

type StatsGridProps = {
  stats: StatsSummary
  icons: {
    total: ReactNode
    active: ReactNode
    completed: ReactNode
    flagged: ReactNode
  }
}

export function StatsGrid({ stats, icons }: StatsGridProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Cases" value={stats.total} icon={icons.total} variant="total" />
      <StatCard label="Active" value={stats.active} icon={icons.active} variant="active" />
      <StatCard label="Completed" value={stats.completed} icon={icons.completed} variant="completed" />
      <StatCard label="Incidents" value={stats.flagged} icon={icons.flagged} variant="flagged" />
    </section>
  )
}
