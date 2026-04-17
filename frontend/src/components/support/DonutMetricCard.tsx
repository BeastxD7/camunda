import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart'

type DonutSlice = {
  label: string
  value: number
  color: string
}

type DonutMetricCardProps = {
  title: string
  subtitle?: string
  slices: DonutSlice[]
  onSliceClick?: (slice: DonutSlice) => void
}

function formatPercent(value: number, total: number) {
  if (total <= 0) return '0.0'
  return ((value / total) * 100).toFixed(1)
}

export function DonutMetricCard({ title, subtitle, slices, onSliceClick }: DonutMetricCardProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const nonZeroSlices = useMemo(() => slices.filter((slice) => slice.value > 0), [slices])
  const chartConfig = useMemo(
    () =>
      nonZeroSlices.reduce<ChartConfig>((acc, slice) => {
        acc[slice.label] = { label: slice.label, color: slice.color }
        return acc
      }, {}),
    [nonZeroSlices],
  )

  return (
    <Card className="border-border/60 bg-gradient-to-b from-background to-muted/20 transition-all duration-300 hover:border-border hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>

      {total === 0 ? (
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
            No data available
          </div>
        </CardContent>
      ) : (
        <CardContent>
          <div className="grid grid-cols-[auto,1fr] items-center gap-4">
            <div className="relative h-28 w-28">
              <ChartContainer config={chartConfig} className="h-28 w-28">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={nonZeroSlices}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={50}
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive
                      animationBegin={80}
                      animationDuration={1400}
                      animationEasing="ease-in-out"
                      onClick={(slice) => {
                        if (slice && typeof slice === 'object' && 'payload' in slice) {
                          onSliceClick?.((slice as { payload: DonutSlice }).payload)
                        }
                      }}
                      className={onSliceClick ? 'cursor-pointer' : ''}
                    >
                      {nonZeroSlices.map((slice) => (
                        <Cell key={slice.label} fill={slice.color} stroke="hsl(var(--background))" strokeWidth={1.6} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <>
                              {value}
                              <span className="ml-1 text-xs font-medium text-muted-foreground">
                                ({formatPercent(Number(value), total)}%)
                              </span>
                            </>
                          )}
                        />
                      }
                      wrapperStyle={{ zIndex: 40, outline: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold leading-none text-foreground">{total}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">cases</p>
              </div>
            </div>

            <ul className="space-y-1.5">
              {slices.map((slice) => (
                <li
                  key={slice.label}
                  className={`flex items-center justify-between gap-3 text-xs ${onSliceClick ? 'cursor-pointer rounded-md px-1.5 py-1 hover:bg-muted/30' : ''}`}
                  onClick={() => onSliceClick?.(slice)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate text-muted-foreground">{slice.label}</span>
                  </div>
                  <Badge variant="outline" className="font-medium">
                    {slice.value} ({formatPercent(slice.value, total)}%)
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
