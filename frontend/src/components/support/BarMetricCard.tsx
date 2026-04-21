import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart'

type BarSlice = {
  label: string
  value: number
  color: string
}

type BarMetricCardProps = {
  title: string
  subtitle?: string
  slices: BarSlice[]
}

function compactLabel(label: string) {
  if (label.length <= 18) return label
  return `${label.slice(0, 16)}...`
}

export function BarMetricCard({ title, subtitle, slices }: BarMetricCardProps) {
  const chartConfig = useMemo(
    () =>
      slices.reduce<ChartConfig>((acc, slice) => {
        acc[slice.label] = { label: slice.label, color: slice.color }
        return acc
      }, {}),
    [slices],
  )

  return (
    <Card className="border-border/60 bg-gradient-to-b from-background to-muted/20 transition-all duration-300 hover:border-border hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>

      <CardContent>
        {slices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-xs text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="space-y-3">
            <ChartContainer config={chartConfig} className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slices} margin={{ left: 8, right: 10, top: 6, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.35} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tickFormatter={(value) => compactLabel(String(value || ''))}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={42} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent formatter={(value) => Number(value).toLocaleString()} />}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {slices.map((slice) => (
                      <Cell key={slice.label} fill={slice.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            <div className="flex flex-wrap gap-1.5">
              {slices.map((slice) => (
                <Badge key={slice.label} variant="outline" className="text-[10px]">
                  {slice.label}: {slice.value}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
