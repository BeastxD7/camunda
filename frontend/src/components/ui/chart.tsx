import * as React from "react"
import { Tooltip as RechartsTooltip } from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode
    color?: string
  }
>

const ChartContext = React.createContext<{ config: ChartConfig }>({ config: {} })

function ChartContainer({
  config,
  className,
  children,
}: React.PropsWithChildren<{ config: ChartConfig; className?: string }>) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn("relative", className)}>{children}</div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsTooltip

function ChartTooltipContent({
  active,
  payload,
  formatter,
  className,
}: {
  active?: boolean
  payload?: Array<Record<string, any>>
  formatter?: (value: number, label: string, entry: Record<string, any>) => React.ReactNode
  className?: string
}) {
  const { config } = React.useContext(ChartContext)

  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0] || {}
  const data = (entry.payload || {}) as Record<string, any>
  const rawLabel = String(data.label || entry.name || "Value")
  const resolvedConfig = config[rawLabel] || {}
  const label = (resolvedConfig.label || rawLabel) as React.ReactNode
  const color = String(data.color || entry.color || resolvedConfig.color || "hsl(var(--primary))")
  const value = Number(data.value || entry.value || 0)

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-background/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-foreground/75">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-xs font-semibold text-foreground">
        {formatter ? formatter(value, rawLabel, entry) : value}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
