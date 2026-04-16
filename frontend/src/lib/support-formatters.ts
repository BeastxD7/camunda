export function formatDate(value?: string) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

export function statusClass(state?: string) {
  const normalized = (state || "").toUpperCase()
  if (normalized === "ACTIVE") {
    return "bg-amber-400/20 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-200"
  }

  if (normalized === "COMPLETED") {
    return "bg-emerald-400/20 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-200"
  }

  if (normalized === "CANCELED") {
    return "bg-rose-400/20 text-rose-700 ring-1 ring-rose-500/30 dark:text-rose-200"
  }

  return "bg-muted text-muted-foreground ring-1 ring-border"
}

export function isDurationMetricName(name: string): boolean {
  const normalized = (name || "").toLowerCase()
  
  // Check for explicit duration indicators (most reliable)
  const explicitDurationPatterns = [
    /duration/i,
    /delay/i,
    /latency/i,
    /\btime\b/i, // word boundary to avoid matching "sometimes"
    /\bcycle\b/i, // word boundary to avoid false matches
  ]
  
  if (explicitDurationPatterns.some((pattern) => pattern.test(normalized))) {
    return true
  }
  
  // Only match "response" if it's part of "response time" or "response duration"
  if (/response\s+(time|duration)/i.test(normalized)) {
    return true
  }
  
  // Only match "resolution" if it's part of "resolution time" or "resolution duration"
  if (/resolution\s+(time|duration)/i.test(normalized)) {
    return true
  }
  
  return false
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "-"
  }

  const totalSeconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(" ")
}
