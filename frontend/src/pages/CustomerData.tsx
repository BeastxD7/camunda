import React, { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRightLeft, CreditCard, Mail, Phone, Search } from "lucide-react"
import { PageContainer } from "../components/layout/PageContainer"
import {
  api,
  type BankCard,
  type BankCustomer,
  type BankTransaction,
} from "../lib/api"

const CUSTOMER_PAGE_SIZE = 10
const MEMBER_PAGE_SIZE = 8
const DETAIL_PAGE_SIZE = 8
const CUSTOMER_POLL_INTERVAL_MS = 10000

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function formatNumber(value: unknown) {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return "N/A"
  return parsed.toLocaleString()
}

function formatCurrency(value: unknown) {
  const parsed = toFiniteNumber(value)
  if (parsed === null) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed)
}

function clampOffset(offset: number, totalCount: number, pageSize: number) {
  if (totalCount <= 0) return 0
  const maxOffset = Math.max(Math.ceil(totalCount / pageSize) - 1, 0) * pageSize
  return Math.min(Math.max(offset, 0), maxOffset)
}

function pageLabel(offset: number, pageSize: number, totalCount: number) {
  if (totalCount === 0) return "0-0 of 0"
  const start = offset + 1
  const end = Math.min(offset + pageSize, totalCount)
  return `${start}-${end} of ${totalCount}`
}

type PaginationControlsProps = {
  offset: number
  pageSize: number
  totalCount: number
  onPrevious: () => void
  onNext: () => void
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  offset,
  pageSize,
  totalCount,
  onPrevious,
  onNext,
}) => {
  const canGoPrevious = offset > 0
  const canGoNext = offset + pageSize < totalCount

  return (
    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{pageLabel(offset, pageSize, totalCount)}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="rounded-md border border-border/70 px-2 py-1 transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-md border border-border/70 px-2 py-1 transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function riskTagFromScore(score: unknown) {
  const normalizedScore = toFiniteNumber(score)

  if (normalizedScore === null) {
    return {
      label: "Unknown",
      tone: "border-border/70 bg-muted/30 text-muted-foreground",
    }
  }

  if (normalizedScore < 580) {
    return {
      label: "High Risk",
      tone: "border-destructive/40 bg-destructive/10 text-destructive",
    }
  }

  if (normalizedScore < 700) {
    return {
      label: "Watch",
      tone: "border-amber-500/40 bg-amber-500/10 text-amber-700",
    }
  }

  return {
    label: "Healthy",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  }
}

function statusTone(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase()

  if (
    normalized.includes("declin") ||
    normalized.includes("failed") ||
    normalized.includes("flag")
  ) {
    return "border-destructive/40 bg-destructive/10 text-destructive"
  }

  if (normalized.includes("review") || normalized.includes("pending")) {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700"
  }

  if (
    normalized.includes("success") ||
    normalized.includes("approved") ||
    normalized.includes("clear")
  ) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
  }

  return "border-border/70 bg-muted/30 text-muted-foreground"
}

export const CustomerDataPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollTick, setPollTick] = useState(0)

  const [customers, setCustomers] = useState<BankCustomer[]>([])
  const [customerSearchInput, setCustomerSearchInput] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerOffset, setCustomerOffset] = useState(0)
  const [customerTotalCount, setCustomerTotalCount] = useState(0)
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState<string>("")

  const [cards, setCards] = useState<BankCard[]>([])
  const [cardsOffset, setCardsOffset] = useState(0)
  const [cardsTotalCount, setCardsTotalCount] = useState(0)

  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [transactionsOffset, setTransactionsOffset] = useState(0)
  const [transactionsTotalCount, setTransactionsTotalCount] = useState(0)

  const screeningSearch = ""
  const [screeningOffset, setScreeningOffset] = useState(0)
  const [screeningTotalCount, setScreeningTotalCount] = useState(0)

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.email === selectedCustomerEmail) ||
      null,
    [customers, selectedCustomerEmail]
  )

  const riskTag = useMemo(
    () => riskTagFromScore(selectedCustomer?.creditScore),
    [selectedCustomer?.creditScore]
  )

  const totalCardSpend = useMemo(
    () =>
      cards.reduce(
        (sum, card) => sum + (toFiniteNumber(card.annualSpend) || 0),
        0
      ),
    [cards]
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPollTick((previous) => previous + 1)
    }, CUSTOMER_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadCustomers() {
      try {
        const response = await api.bank.getCustomers({
          search: customerSearch,
          limit: CUSTOMER_PAGE_SIZE,
          offset: customerOffset,
        })

        if (!mounted) return

        const payload = response.data
        const items = payload?.items || []
        const totalCount = payload?.totalCount || 0

        setCustomers(items)
        setCustomerTotalCount(totalCount)

        const safeOffset = clampOffset(
          customerOffset,
          totalCount,
          CUSTOMER_PAGE_SIZE
        )
        if (safeOffset !== customerOffset) {
          setCustomerOffset(safeOffset)
          return
        }

        if (
          !items.some((customer) => customer.email === selectedCustomerEmail)
        ) {
          const nextEmail =
            items.find((customer) => customer.email)?.email || ""
          setSelectedCustomerEmail(nextEmail)
        }
      } catch {
        if (!mounted) return
        setCustomers([])
        setCustomerTotalCount(0)
        setSelectedCustomerEmail("")
        setError("Failed to load customer queue")
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadCustomers()

    return () => {
      mounted = false
    }
  }, [customerSearch, customerOffset, selectedCustomerEmail, pollTick])

  useEffect(() => {
    let mounted = true

    async function loadMembers() {
      try {
        const response = await api.bank.getScreeningMembers({
          search: screeningSearch,
          limit: MEMBER_PAGE_SIZE,
          offset: screeningOffset,
        })

        if (!mounted) return

        const payload = response.data
        const totalCount = payload?.totalCount || 0

        setScreeningTotalCount(totalCount)

        const safeOffset = clampOffset(
          screeningOffset,
          totalCount,
          MEMBER_PAGE_SIZE
        )
        if (safeOffset !== screeningOffset) {
          setScreeningOffset(safeOffset)
        }
      } catch {
        if (!mounted) return
        setScreeningTotalCount(0)
      }
    }

    void loadMembers()

    return () => {
      mounted = false
    }
  }, [screeningSearch, screeningOffset, pollTick])

  useEffect(() => {
    setCardsOffset(0)
    setTransactionsOffset(0)
  }, [selectedCustomerEmail])

  useEffect(() => {
    let mounted = true

    async function loadCustomerRelatedData() {
      if (!selectedCustomerEmail) {
        setCards([])
        setCardsTotalCount(0)
        setTransactions([])
        setTransactionsTotalCount(0)
        return
      }

      try {
        const [cardsResponse, txResponse] = await Promise.all([
          api.bank.getCustomerCards(selectedCustomerEmail, {
            limit: DETAIL_PAGE_SIZE,
            offset: cardsOffset,
          }),
          api.bank.getCustomerTransactions(selectedCustomerEmail, {
            limit: DETAIL_PAGE_SIZE,
            offset: transactionsOffset,
          }),
        ])

        if (!mounted) return

        const cardsPayload = cardsResponse.data
        const txPayload = txResponse.data

        const nextCards = cardsPayload?.items || []
        const nextCardsTotal = cardsPayload?.totalCount || 0
        const nextTransactions = txPayload?.items || []
        const nextTransactionsTotal = txPayload?.totalCount || 0

        setCards(nextCards)
        setCardsTotalCount(nextCardsTotal)
        setTransactions(nextTransactions)
        setTransactionsTotalCount(nextTransactionsTotal)

        const safeCardsOffset = clampOffset(
          cardsOffset,
          nextCardsTotal,
          DETAIL_PAGE_SIZE
        )
        if (safeCardsOffset !== cardsOffset) {
          setCardsOffset(safeCardsOffset)
        }

        const safeTransactionsOffset = clampOffset(
          transactionsOffset,
          nextTransactionsTotal,
          DETAIL_PAGE_SIZE
        )
        if (safeTransactionsOffset !== transactionsOffset) {
          setTransactionsOffset(safeTransactionsOffset)
        }
      } catch {
        if (!mounted) return
        setCards([])
        setCardsTotalCount(0)
        setTransactions([])
        setTransactionsTotalCount(0)
      }
    }

    void loadCustomerRelatedData()

    return () => {
      mounted = false
    }
  }, [selectedCustomerEmail, cardsOffset, transactionsOffset, pollTick])

  return (
    <PageContainer>
      <div className="relative flex flex-col gap-5 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_120%_at_18%_0%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent)]" />
        <section className="support-header relative overflow-hidden rounded-3xl border border-border/70 bg-card/90 p-6">
          <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 -left-8 h-20 w-40 rotate-3 rounded-full bg-accent/20 blur-2xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Support Desk
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
                Customer Operations Console
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Triage customer issues, review payments, inspect card behavior,
                and validate screening activity from one workflow-focused
                workspace.
              </p>
            </div>

            {/* <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs"> */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3">
              <p className="text-muted-foreground">Queue Size</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatNumber(customerTotalCount)}
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="support-card rounded-2xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
            Loading support workspace...
          </section>
        ) : error ? (
          <section className="support-card rounded-2xl border border-destructive/50 bg-destructive/10 p-5 text-sm text-destructive">
            {error}
          </section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-[300px_1fr_1fr]">
            <aside className="support-card rounded-2xl border border-border/70 bg-card p-4 xl:sticky xl:top-5 xl:h-[calc(100vh-10rem)] xl:overflow-hidden">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Active Queue
                </h2>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                  Live
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={customerSearchInput}
                  onChange={(event) =>
                    setCustomerSearchInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setCustomerOffset(0)
                      setCustomerSearch(customerSearchInput.trim())
                    }
                  }}
                  placeholder="Search customer"
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomerOffset(0)
                    setCustomerSearch(customerSearchInput.trim())
                  }}
                  className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
                >
                  Go
                </button>
              </div>

              <div className="space-y-2 xl:max-h-[calc(100vh-20rem)] xl:overflow-auto xl:pr-1">
                {customers.map((customer) => {
                  const email = customer.email || ""
                  const selected = email === selectedCustomerEmail
                  const thisRisk = riskTagFromScore(customer.creditScore)

                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerEmail(email)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent)]"
                          : "border-border/60 bg-background hover:border-primary/40 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {customer.customerName || "Unnamed customer"}
                        </p>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${thisRisk.tone}`}
                        >
                          {thisRisk.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {customer.email || "No email"}
                      </p>
                    </button>
                  )
                })}
              </div>

              <PaginationControls
                offset={customerOffset}
                pageSize={CUSTOMER_PAGE_SIZE}
                totalCount={customerTotalCount}
                onPrevious={() =>
                  setCustomerOffset((prev) =>
                    Math.max(prev - CUSTOMER_PAGE_SIZE, 0)
                  )
                }
                onNext={() =>
                  setCustomerOffset((prev) => prev + CUSTOMER_PAGE_SIZE)
                }
              />
            </aside>

            <div className="flex flex-col gap-4">
              <article className="support-card rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
                      Customer 360
                    </p>
                    <h3 className="mt-1 font-heading text-2xl font-bold text-foreground">
                      {selectedCustomer?.customerName || "No customer selected"}
                    </h3>
                  </div>
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${riskTag.tone}`}
                  >
                    {riskTag.label}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                    <p className="text-muted-foreground">Credit Score</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {formatNumber(selectedCustomer?.creditScore)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                    <p className="text-muted-foreground">Declared Income</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {formatCurrency(selectedCustomer?.income)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                    <p className="text-muted-foreground">Card Spend (Page)</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {formatCurrency(totalCardSpend)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {selectedCustomer?.email || "No email"}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {selectedCustomer?.mobile || "No mobile number"}
                  </p>
                  <p className="text-muted-foreground">
                    Residency:{" "}
                    <span className="text-foreground">
                      {selectedCustomer?.residency || "N/A"}
                    </span>
                  </p>
                </div>
              </article>

              <article className="support-card rounded-2xl border border-border/70 bg-card p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Card Portfolio
                  </h3>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {cards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No cards found for this customer.
                    </p>
                  ) : (
                    cards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-xl border border-border/60 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary)_10%,transparent),transparent)] p-3"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {card.cardName || "Card Product"}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <p className="text-muted-foreground">Annual Spend</p>
                          <p className="text-right font-medium text-foreground">
                            {formatCurrency(card.annualSpend)}
                          </p>
                          <p className="text-muted-foreground">Late Payments</p>
                          <p className="text-right font-medium text-foreground">
                            {formatNumber(card.latePayments)}
                          </p>
                          <p className="text-muted-foreground">Tenure</p>
                          <p className="text-right font-medium text-foreground">
                            {formatNumber(card.tenure)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <PaginationControls
                  offset={cardsOffset}
                  pageSize={DETAIL_PAGE_SIZE}
                  totalCount={cardsTotalCount}
                  onPrevious={() =>
                    setCardsOffset((prev) =>
                      Math.max(prev - DETAIL_PAGE_SIZE, 0)
                    )
                  }
                  onNext={() =>
                    setCardsOffset((prev) => prev + DETAIL_PAGE_SIZE)
                  }
                />
              </article>
            </div>

            <div className="flex flex-col gap-4">
              <article className="support-card rounded-2xl border border-border/70 bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Recent Transactions
                    </h3>
                  </div>
                  {selectedCustomerEmail ? (
                    <Link
                      to={`/customers/${encodeURIComponent(selectedCustomerEmail)}/transactions`}
                      className="rounded-md border border-border/70 px-2.5 py-1 text-xs font-semibold text-foreground transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      View full history
                    </Link>
                  ) : null}
                </div>

                <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No transactions found for this customer.
                    </p>
                  ) : (
                    transactions.map((transaction) => {
                      const txStatus = transaction.internalStatus || "Unknown"

                      return (
                        <div
                          key={transaction.transactionId}
                          className="rounded-xl border border-border/60 bg-muted/20 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {transaction.merchantName ||
                                  "Merchant unavailable"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {transaction.createdAt
                                  ? new Date(
                                      transaction.createdAt
                                    ).toLocaleString()
                                  : "Unknown timestamp"}
                              </p>
                            </div>
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] ${statusTone(txStatus)}`}
                            >
                              {txStatus}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                <PaginationControls
                  offset={transactionsOffset}
                  pageSize={DETAIL_PAGE_SIZE}
                  totalCount={transactionsTotalCount}
                  onPrevious={() =>
                    setTransactionsOffset((prev) =>
                      Math.max(prev - DETAIL_PAGE_SIZE, 0)
                    )
                  }
                  onNext={() =>
                    setTransactionsOffset((prev) => prev + DETAIL_PAGE_SIZE)
                  }
                />
              </article>

              {/* <article className="support-card rounded-2xl border border-border/70 bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Screening Watchlist
                    </h3>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-[11px] ${statusTone(selectedMember?.status)}`}>
                    {selectedMember?.status || 'Unknown'}
                  </span>
                </div>

                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={screeningSearchInput}
                    onChange={(event) => setScreeningSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setScreeningOffset(0)
                        setScreeningSearch(screeningSearchInput.trim())
                      }
                    }}
                    placeholder="Search screening member"
                    className="h-9 w-full bg-transparent text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScreeningOffset(0)
                      setScreeningSearch(screeningSearchInput.trim())
                    }}
                    className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
                  >
                    Go
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-2 md:max-h-52 md:overflow-auto md:pr-1">
                    {screeningMembers.map((member) => {
                      const selected = member.id === selectedMemberId

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedMemberId(member.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            selected
                              ? 'border-primary/60 bg-primary/10'
                              : 'border-border/60 bg-muted/20 hover:border-primary/30'
                          }`}
                        >
                          <p className="text-sm font-medium text-foreground">
                            {member.fullName || 'Unnamed member'}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.email || 'No email'}</p>
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-2 md:max-h-52 md:overflow-auto md:pr-1">
                    {activityLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No activity logs for this profile.</p>
                    ) : (
                      activityLogs.map((log) => (
                        <div key={log.id} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                          <p className="text-xs font-semibold text-foreground">{log.actionType || 'Activity'}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {log.description || 'No description available.'}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown timestamp'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <PaginationControls
                    offset={screeningOffset}
                    pageSize={MEMBER_PAGE_SIZE}
                    totalCount={screeningTotalCount}
                    onPrevious={() => setScreeningOffset((prev) => Math.max(prev - MEMBER_PAGE_SIZE, 0))}
                    onNext={() => setScreeningOffset((prev) => prev + MEMBER_PAGE_SIZE)}
                  />
                </div>
              </article> */}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  )
}
