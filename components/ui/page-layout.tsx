'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from './skeleton'
import { Badge } from './badge'

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */

export interface KPI {
  label:     string
  value:     string | number
  sub?:      string
  icon?:     React.ReactNode
  trend?:    string
  trendUp?:  boolean | null   // true=up green, false=down red, null=neutral grey
  color?:    string            // Tailwind text-* class for the value
  href?:     string
}

export interface PageAction {
  label:    string
  icon?:    React.ReactNode
  onClick?: () => void
  href?:    string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  disabled?: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface TabItem {
  id:      string
  label:   string
  icon?:   React.ReactNode
  badge?:  string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'warning' | 'success'
}

export interface StatusBadge {
  label:   string
  variant: 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'info' | 'violet' | 'sky'
  icon?:   React.ReactNode
}

/* ─────────────────────────────────────────────────────────────────────────────
   DashboardPageLayout
   Standard instructor-portal page shell. Works inside the .dark layout.
───────────────────────────────────────────────────────────────────────────── */

interface DashboardPageLayoutProps {
  /* Header */
  title:             string
  description?:      string
  breadcrumbs?:      BreadcrumbItem[]
  status?:           StatusBadge
  primaryAction?:    PageAction
  secondaryActions?: PageAction[]

  /* KPI row */
  kpis?:             KPI[]
  kpiColumns?:       2 | 3 | 4 | 5

  /* Tabs — if provided, renders a tab strip; active tab managed internally or externally */
  tabs?:             TabItem[]
  activeTab?:        string
  onTabChange?:      (id: string) => void

  /* Decorative hero gradient behind the header */
  showHeroBanner?:   boolean

  /* State */
  isLoading?:        boolean
  error?:            string | null

  children:          React.ReactNode
  className?:        string
}

export default function DashboardPageLayout({
  title,
  description,
  breadcrumbs,
  status,
  primaryAction,
  secondaryActions = [],
  kpis = [],
  kpiColumns,
  tabs,
  activeTab: controlledTab,
  onTabChange,
  showHeroBanner = false,
  isLoading = false,
  error,
  children,
  className,
}: DashboardPageLayoutProps) {
  const [internalTab, setInternalTab] = useState(tabs?.[0]?.id ?? '')
  const activeTab = controlledTab ?? internalTab
  const handleTab = (id: string) => {
    setInternalTab(id)
    onTabChange?.(id)
  }

  /* Responsive KPI grid columns */
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

      {/* ── Hero banner (optional decorative gradient) ─────────────────── */}
      {showHeroBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(225_73%_57%_/_0.18),transparent_55%),radial-gradient(ellipse_at_top_right,_hsl(262_83%_58%_/_0.14),transparent_50%)]" />
        </div>
      )}

      {/* ── Header block ────────────────────────────────────────────────── */}
      <div className="pb-5">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/40" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors no-underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground/70">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            {status && (
              <Badge variant={status.variant} className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </Badge>
            )}
          </div>

          {/* Actions */}
          {(primaryAction || secondaryActions.length > 0) && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {secondaryActions.map((action, i) => (
                <PageActionButton key={i} action={action} defaultVariant="outline" />
              ))}
              {primaryAction && (
                <PageActionButton action={primaryAction} defaultVariant="primary" />
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>
        )}
      </div>

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2 mb-4">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      {kpis.length > 0 && (
        <div className={cn('grid gap-3 mb-5', gridClass)}>
          {kpis.map((kpi, i) => (
            <KpiCard key={i} kpi={kpi} isLoading={isLoading} />
          ))}
        </div>
      )}

      {/* ── Tab strip ───────────────────────────────────────────────────── */}
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
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {tab.icon}
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

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────────────────── */

function PageActionButton({
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
    'inline-flex items-center gap-2 rounded-lg px-4 h-9 text-sm font-medium transition-colors',
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

function KpiCard({ kpi, isLoading }: { kpi: KPI; isLoading: boolean }) {
  const trendIcon =
    kpi.trendUp === true  ? <TrendingUp  className="w-3 h-3" /> :
    kpi.trendUp === false ? <TrendingDown className="w-3 h-3" /> :
    kpi.trendUp === null  ? <Minus       className="w-3 h-3" /> : null

  const trendColor =
    kpi.trendUp === true  ? 'text-emerald-400' :
    kpi.trendUp === false ? 'text-destructive'  :
    'text-muted-foreground'

  const inner = (
    <div className={cn(
      'rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-card transition-colors',
      kpi.href && 'hover:bg-card/80 cursor-pointer',
    )}>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {kpi.label}
        </p>
        {kpi.icon && (
          <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
            {kpi.icon}
          </div>
        )}
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-7 w-24 mt-1" />
          <Skeleton className="h-3 w-16 mt-1" />
        </>
      ) : (
        <>
          <p className={cn('text-2xl font-bold text-foreground leading-none tracking-tight', kpi.color)}>
            {kpi.value}
          </p>
          {kpi.sub && (
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          )}
          {kpi.trend && (
            <p className={cn('text-xs font-medium mt-0.5 flex items-center gap-1', trendColor)}>
              {trendIcon}{kpi.trend}
            </p>
          )}
        </>
      )}
    </div>
  )

  return kpi.href ? <Link href={kpi.href} className="no-underline block">{inner}</Link> : inner
}
