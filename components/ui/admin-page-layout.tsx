'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, ArrowLeft,
  TrendingUp, TrendingDown, Minus,
  RefreshCw, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from './skeleton'
import { Badge } from './badge'
import type { KPI, PageAction, BreadcrumbItem, TabItem, StatusBadge } from './page-layout'

/* ─────────────────────────────────────────────────────────────────────────────
   AdminPageLayout
   Dark-shell page template for every admin screen. Designed for the .dark
   layout wrapper on /admin. Matches WMS EnterprisePageLayout quality:
   - Breadcrumb nav with optional back button
   - Title + status badge + action zone
   - KPI row (2–5 columns, auto-responsive)
   - Tab strip with badge counts
   - Refresh button + last-updated timestamp
   - Full-width error / loading states
───────────────────────────────────────────────────────────────────────────── */

interface AdminPageLayoutProps {
  /* Header */
  title:              string
  description?:       string
  breadcrumbs?:       BreadcrumbItem[]
  backHref?:          string
  status?:            StatusBadge

  /* Actions */
  primaryAction?:     PageAction
  secondaryActions?:  PageAction[]

  /* Optional refresh */
  onRefresh?:         () => void | Promise<void>
  lastUpdated?:       string      // display string e.g. "2 min ago"

  /* KPI row */
  kpis?:              KPI[]
  kpiColumns?:        2 | 3 | 4 | 5

  /* Tabs */
  tabs?:              TabItem[]
  activeTab?:         string
  onTabChange?:       (id: string) => void

  /* Alert banner — yellow attention bar below header */
  alertBanner?:       React.ReactNode

  /* State */
  isLoading?:         boolean
  error?:             string | null

  children:           React.ReactNode
  className?:         string
}

export default function AdminPageLayout({
  title,
  description,
  breadcrumbs,
  backHref,
  status,
  primaryAction,
  secondaryActions = [],
  onRefresh,
  lastUpdated,
  kpis = [],
  kpiColumns,
  tabs,
  activeTab: controlledTab,
  onTabChange,
  alertBanner,
  isLoading = false,
  error,
  children,
  className,
}: AdminPageLayoutProps) {
  const [internalTab, setInternalTab] = useState(tabs?.[0]?.id ?? '')
  const [refreshing, setRefreshing]   = useState(false)

  const activeTab = controlledTab ?? internalTab

  const handleTab = (id: string) => {
    setInternalTab(id)
    onTabChange?.(id)
  }

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try { await onRefresh() } finally { setRefreshing(false) }
  }

  const cols = kpiColumns ?? (
    kpis.length <= 2 ? 2 :
    kpis.length === 3 ? 3 :
    kpis.length === 5 ? 5 : 4
  )
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[cols]

  return (
    <div className={cn('space-y-0 animate-fade-in', className)}>

      {/* ── Header block ─────────────────────────────────────────────────── */}
      <div className="pb-5">

        {/* Back + breadcrumbs row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors no-underline group mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Back
            </Link>
          )}

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/40" />}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-foreground transition-colors no-underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground/60">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Title + status + actions row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          {/* Left: title + status */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
                {title}
              </h1>
              {status && (
                <Badge variant={status.variant} className="flex items-center gap-1 shrink-0">
                  {status.icon}
                  {status.label}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
            )}
          </div>

          {/* Right: refresh + actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground/50 hidden sm:inline">
                Updated {lastUpdated}
              </span>
            )}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </button>
            )}
            {secondaryActions.map((action, i) => (
              <AdminActionButton key={i} action={action} defaultVariant="outline" />
            ))}
            {primaryAction && (
              <AdminActionButton action={primaryAction} defaultVariant="primary" />
            )}
          </div>
        </div>
      </div>

      {/* ── Alert banner ─────────────────────────────────────────────────── */}
      {alertBanner && (
        <div className="mb-4">{alertBanner}</div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Something went wrong</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <div className={cn('grid gap-3 mb-5', gridClass)}>
          {kpis.map((kpi, i) => (
            <AdminKpiCard key={i} kpi={kpi} isLoading={isLoading} />
          ))}
        </div>
      )}

      {/* ── Tab strip ────────────────────────────────────────────────────── */}
      {tabs && tabs.length > 0 && (
        <div className="border-b border-border mb-5">
          <div className="flex items-end gap-0 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/60',
                )}
              >
                {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
                {tab.label}
                {tab.badge !== undefined && (
                  <Badge
                    variant={tab.badgeVariant ?? (activeTab === tab.id ? 'default' : 'secondary')}
                    className="ml-0.5 text-xs px-1.5 py-0 min-w-[1.25rem] justify-center"
                  >
                    {tab.badge}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

function AdminActionButton({
  action,
  defaultVariant,
}: {
  action: PageAction
  defaultVariant: 'primary' | 'outline'
}) {
  const v = action.variant ?? defaultVariant

  const variants: Record<string, string> = {
    primary:     'bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground hover:opacity-90 shadow-sm shadow-primary/20',
    secondary:   'bg-secondary text-foreground hover:bg-secondary/80',
    outline:     'border border-border bg-transparent text-foreground hover:bg-secondary',
    ghost:       'bg-transparent text-foreground hover:bg-secondary',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }

  const cls = cn(
    'inline-flex items-center gap-2 rounded-lg px-3.5 h-9 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:opacity-50 disabled:pointer-events-none',
    variants[v],
  )

  if (action.href) {
    return (
      <Link href={action.href} className={cn(cls, 'no-underline')}>
        {action.icon}{action.label}
      </Link>
    )
  }
  return (
    <button onClick={action.onClick} disabled={action.disabled} className={cls}>
      {action.icon}{action.label}
    </button>
  )
}

function AdminKpiCard({ kpi, isLoading }: { kpi: KPI; isLoading: boolean }) {
  const trendColor =
    kpi.trendUp === true  ? 'text-emerald-400' :
    kpi.trendUp === false ? 'text-destructive'  :
    kpi.trendUp === null  ? 'text-muted-foreground' : ''

  const TrendIcon =
    kpi.trendUp === true  ? TrendingUp  :
    kpi.trendUp === false ? TrendingDown :
    kpi.trendUp === null  ? Minus : null

  const inner = (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 flex flex-col gap-1',
      'shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-colors',
      kpi.href && 'hover:bg-card/80 cursor-pointer',
    )}>
      {/* Label + icon */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
          {kpi.label}
        </p>
        {kpi.icon && (
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
            {kpi.icon}
          </div>
        )}
      </div>

      {/* Value */}
      {isLoading ? (
        <>
          <Skeleton className="h-7 w-20 mt-0.5" />
          <Skeleton className="h-3 w-14 mt-1" />
        </>
      ) : (
        <>
          <p className={cn(
            'text-2xl font-bold text-foreground leading-none tracking-tight',
            kpi.color,
          )}>
            {kpi.value}
          </p>
          {kpi.sub && (
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          )}
          {kpi.trend && TrendIcon && (
            <p className={cn('text-xs font-medium mt-0.5 flex items-center gap-1', trendColor)}>
              <TrendIcon className="w-3 h-3" />{kpi.trend}
            </p>
          )}
        </>
      )}
    </div>
  )

  return kpi.href
    ? <Link href={kpi.href} className="no-underline block">{inner}</Link>
    : inner
}

/* ─────────────────────────────────────────────────────────────────────────────
   Re-export shared types so consumers only need one import
───────────────────────────────────────────────────────────────────────────── */
export type { KPI, PageAction, BreadcrumbItem, TabItem, StatusBadge }
