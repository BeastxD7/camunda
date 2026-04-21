import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRightLeft, Building2, Search } from 'lucide-react'
import { PageContainer } from '../components/layout/PageContainer'
import { api, type BankTransaction } from '../lib/api'

const PAGE_SIZE = 25

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function formatCurrency(value: unknown) {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return 'N/A'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(parsed)
}

function pageLabel(offset: number, pageSize: number, totalCount: number) {
  if (totalCount === 0) return '0-0 of 0'
  const start = offset + 1
  const end = Math.min(offset + pageSize, totalCount)
  return `${start}-${end} of ${totalCount}`
}

function statusTone(status: string | null | undefined) {
  const normalized = (status || '').toLowerCase()

  if (normalized.includes('declin') || normalized.includes('failed') || normalized.includes('flag')) {
    return 'border-destructive/40 bg-destructive/10 text-destructive'
  }

  if (normalized.includes('review') || normalized.includes('pending')) {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-700'
  }

  if (normalized.includes('success') || normalized.includes('approved') || normalized.includes('clear')) {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
  }

  return 'border-border/70 bg-muted/30 text-muted-foreground'
}

export const CustomerTransactionsPage: React.FC = () => {
  const params = useParams<{ email: string }>()
  const customerEmail = decodeURIComponent(params.email || '').trim()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [items, setItems] = useState<BankTransaction[]>([])

  useEffect(() => {
    setOffset(0)
  }, [customerEmail])

  useEffect(() => {
    let mounted = true

    async function loadTransactions() {
      if (!customerEmail) {
        setItems([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await api.bank.getCustomerTransactions(customerEmail, {
          limit: PAGE_SIZE,
          offset,
        })

        if (!mounted) return

        const payload = response.data
        const allItems = payload?.items || []
        const nextTotal = payload?.totalCount || 0

        const filteredItems = search
          ? allItems.filter((tx) => {
              const merchant = (tx.merchantName || '').toLowerCase()
              const status = (tx.internalStatus || '').toLowerCase()
              const id = tx.transactionId.toLowerCase()
              const term = search.toLowerCase()
              return merchant.includes(term) || status.includes(term) || id.includes(term)
            })
          : allItems

        setItems(filteredItems)
        setTotalCount(nextTotal)
      } catch (loadError) {
        if (!mounted) return
        setItems([])
        setTotalCount(0)
        setError(loadError instanceof Error ? loadError.message : 'Failed to load transactions')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadTransactions()

    return () => {
      mounted = false
    }
  }, [customerEmail, offset, search])

  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < totalCount

  const totalVisibleAmount = useMemo(
    () => items.reduce((sum, tx) => sum + (toFiniteNumber(tx.amount) || 0), 0),
    [items],
  )

  return (
    <PageContainer>
      <div className="relative flex flex-col gap-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(60%_120%_at_20%_0%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent)]" />

        <section className="support-header relative rounded-3xl border border-border/70 bg-card/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Transactions</p>
              <h1 className="mt-1 text-2xl font-heading font-bold text-foreground">Customer Ledger</h1>
              <p className="mt-1 text-sm text-muted-foreground">{customerEmail || 'No customer selected'}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/customers"
                className="inline-flex items-center gap-1 rounded-md border border-border/70 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to support desk
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Total Records</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Page Window</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{pageLabel(offset, PAGE_SIZE, totalCount)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
              <p className="text-muted-foreground">Visible Amount</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(totalVisibleAmount)}</p>
            </div>
          </div>
        </section>

        <section className="support-card rounded-2xl border border-border/70 bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Transaction History
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearch(searchInput.trim())
                  }
                }}
                placeholder="Filter this page"
                className="h-9 w-48 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setSearch(searchInput.trim())}
                className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
              >
                Apply
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          ) : error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions found for this page.</p>
          ) : (
            <div className="space-y-2">
              {items.map((tx) => (
                <div key={tx.transactionId} className="rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        {tx.merchantName || 'Merchant unavailable'}
                      </p>
                    </div>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${statusTone(tx.internalStatus)}`}>
                      {tx.internalStatus || 'Unknown'}
                    </span>
                  </div>

                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                    <p>
                      Amount:
                      <span className="ml-1 font-semibold text-foreground">{formatCurrency(tx.amount)}</span>
                    </p>
                    <p>
                      Transaction:
                      <span className="ml-1 font-semibold text-foreground">{tx.transactionId}</span>
                    </p>
                    <p>
                      Email:
                      <span className="ml-1 font-semibold text-foreground">{tx.email || 'N/A'}</span>
                    </p>
                    <p>
                      Time:
                      <span className="ml-1 font-semibold text-foreground">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Unknown'}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{pageLabel(offset, PAGE_SIZE, totalCount)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
                disabled={!canPrev}
                className="rounded-md border border-border/70 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={!canNext}
                className="rounded-md border border-border/70 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
