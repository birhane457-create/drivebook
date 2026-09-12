import React from 'react'
import { cn } from '@/lib/cn'

/**
 * StatCard — compact KPI card matching WMS StatCard quality.
 *
 * Features:
 *   - 26px tight value with tracking-tight (not text-3xl)
 *   - Icon in w-10 h-10 bg-primary/10 rounded-xl ring badge
 *   - Trend text at text-xs with emerald/red semantic colour
 *   - Hover: bottom gradient bar slides in
 *   - Optional sub-text below value
 *   - Optional href to make the whole card a link
 */

interface StatCardProps {
  title:     string
  value:     string | number
  icon?:     React.ElementType
  trend?:    string
  trendUp?:  boolean | null
  sub?:      string
  color?:    string     // Tailwind text-* class applied to the value
  href?:     string
  className?: string
}

export function StatCard({
  title, value, icon: Icon, trend, trendUp, sub, color, href, className,
}: StatCardProps) {
  const content = (
    <div className={cn(
      'p-5 relative overflow-hidden group rounded-xl border border-border bg-card',
      'transition-colors hover:bg-card/80 cursor-default',
      href && 'cursor-pointer',
      className,
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase truncate">
            {title}
          </p>
          <p className={cn(
            'text-[26px] font-semibold mt-1 tracking-tight leading-none',
            color ?? 'text-foreground',
          )}>
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground/60 mt-1.5 leading-snug">{sub}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs mt-2.5 font-semibold tracking-tight flex items-center gap-1',
              trendUp === false ? 'text-destructive' :
              trendUp === true  ? 'text-emerald-400' :
              'text-muted-foreground',
            )}>
              {trend}
            </p>
          )}
        </div>

        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/5 shrink-0 ml-3">
            <Icon className="w-[18px] h-[18px] text-primary" />
          </div>
        )}
      </div>

      {/* Bottom hover bar — matches WMS StatCard */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/40 via-primary/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {content}
      </a>
    )
  }

  return content
}
