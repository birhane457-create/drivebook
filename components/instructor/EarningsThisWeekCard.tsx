'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart } from '@/components/ui/chart'

interface WeeklyEarnings {
  weekStart: string
  weekEnd: string
  weekStartDisplay: string
  weekEndDisplay: string
  completedCount: number
  totalEarned: number
  hourlyRate: number
  bookings: Array<{
    id: string
    date: string | null
    price: number
  }>
}

/** Build a Mon–Sun bar chart from the bookings array */
function buildDayBars(bookings: WeeklyEarnings['bookings']) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const map: Record<string, number> = {}
  days.forEach((d) => (map[d] = 0))

  bookings.forEach((b) => {
    if (!b.date) return
    const d = new Date(b.date)
    // getDay() → 0=Sun…6=Sat; shift so Mon=0
    const idx = (d.getDay() + 6) % 7
    map[days[idx]] = (map[days[idx]] ?? 0) + b.price
  })

  return days.map((day) => ({ day, earnings: parseFloat(map[day].toFixed(2)) }))
}

export function EarningsThisWeekCard() {
  const [data, setData] = useState<WeeklyEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWeeklyEarnings = async () => {
      try {
        const res = await fetch('/api/instructor/earnings/this-week', {
          credentials: 'include',
        })
        if (res.status === 401) {
          setError('Please log in to view earnings')
          return
        }
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`${res.status} — ${text}`)
        }
        setData(await res.json())
      } catch (err) {
        console.error('Earnings fetch error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load earnings')
      } finally {
        setLoading(false)
      }
    }
    fetchWeeklyEarnings()
  }, [])

  /* ── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  /* ── Error ───────────────────────────────────────────── */
  if (error || !data) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Unable to load earnings</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const dayBars = buildDayBars(data.bookings)
  const hasEarnings = data.completedCount > 0

  return (
    <Card className="transition hover:bg-card/90">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
              This Week
            </p>
            <p className="text-xs text-muted-foreground/60">
              {data.weekStartDisplay} – {data.weekEndDisplay}
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
        </div>

        <div className="flex items-baseline gap-2 mt-2">
          <CardTitle className="text-3xl font-semibold text-foreground">
            ${data.totalEarned.toFixed(2)}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.completedCount} lesson{data.completedCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Per-day bar chart */}
        <BarChart
          data={dayBars}
          xKey="day"
          series={[{ key: 'earnings', label: 'Earnings', color: 'hsl(var(--primary))' }]}
          height={80}
          format={(v) => `$${v}`}
          className="w-full"
        />

        {/* Breakdown list */}
        {hasEarnings ? (
          <div className="pt-3 border-t border-border space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">
              {data.completedCount} lesson{data.completedCount !== 1 ? 's' : ''} completed this week
            </p>
            {data.bookings.slice(0, 3).map((booking) => (
              <div key={booking.id} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{booking.date}</span>
                <span className="text-emerald-400 font-medium">
                  ${booking.price.toFixed(2)}
                </span>
              </div>
            ))}
            {data.bookings.length > 3 && (
              <p className="text-xs text-muted-foreground/50 pt-1">
                +{data.bookings.length - 3} more…
              </p>
            )}
          </div>
        ) : (
          <p className="pt-3 border-t border-border text-xs text-muted-foreground">
            No lessons completed yet this week
          </p>
        )}
      </CardContent>
    </Card>
  )
}
