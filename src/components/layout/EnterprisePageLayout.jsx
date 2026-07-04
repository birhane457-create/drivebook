import React from 'react';
import { cn } from '@/lib/utils';
import Breadcrumbs from '@/components/ux/Breadcrumbs';
import ActivityFeed from '@/components/enterprise/ActivityFeed';
import { Star, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * EnterprisePageLayout — standardized page template for every screen.
 *
 * Every page gets:
 *   1.  Breadcrumb            — auto from route, or override via `breadcrumbs`
 *   2.  Page Title             — `title`
 *   3.  Description            — `description`
 *   4.  Primary Action          — `primaryAction` ({ label, icon, onClick })
 *   5.  Secondary Actions       — `secondaryActions` (array of { label, icon, onClick })
 *   6.  KPIs                   — `kpis` (array of { label, value, icon, trend })
 *   7.  Filters                — `filters` (ReactNode, typically a FilterBar)
 *   8.  Toolbar                — `toolbar` (ReactNode, batch actions / view toggles)
 *   9.  Content               — `children` (main body)
 *  10.  Right Panel            — `rightPanel` (ReactNode, detail / metadata)
 *  11.  Activity Feed          — `activityFeed` (array for ActivityFeed) or `activity` (ReactNode)
 *
 * Usage:
 *   <EnterprisePageLayout
 *     title="Products"
 *     description="Manage your product catalog"
 *     primaryAction={{ label: 'New Product', icon: Plus, onClick: handleNew }}
 *     kpis={[...]}
 *     filters={<FilterBar ... />}
 *     rightPanel={<DetailPanel ... />}
 *   >
 *     <ProductsTable />
 *   </EnterprisePageLayout>
 */
export default function EnterprisePageLayout({
  breadcrumbs,
  title,
  description,
  primaryAction,
  secondaryActions = [],
  kpis = [],
  filters,
  toolbar,
  rightPanel,
  activityFeed,
  activity,
  isFavorite,
  onToggleFavorite,
  children,
  className,
}) {
  const hasRightPanel = rightPanel || activityFeed || activity;
  const showKpis = kpis.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* 1. Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      {/* 2-5. Header: Title + Description + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              className="mt-1.5 p-1 rounded hover:bg-accent transition-colors"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("w-5 h-5 transition-colors", isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="text-muted-foreground mt-1 max-w-2xl">{description}</p>}
          </div>
        </div>

        {(primaryAction || secondaryActions.length > 0) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {secondaryActions.slice(0, 2).map((action, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={action.onClick}
              >
                {action.icon && <action.icon className="w-4 h-4" />}
                {action.label}
              </Button>
            ))}
            {secondaryActions.length > 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {secondaryActions.slice(2).map((action, idx) => (
                    <DropdownMenuItem key={idx} onClick={action.onClick}>
                      {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {primaryAction && (
              <Button onClick={primaryAction.onClick} size="sm">
                {primaryAction.icon && <primaryAction.icon className="w-4 h-4" />}
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 6. KPIs */}
      {showKpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <Card key={idx} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                {kpi.icon && <kpi.icon className="w-4 h-4 text-muted-foreground" />}
              </div>
              <p className="text-2xl font-bold mt-2">{kpi.value}</p>
              {kpi.trend != null && (
                <p className={cn("text-xs mt-1", kpi.trend >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {kpi.trend >= 0 ? "↑" : "↓"} {Math.abs(kpi.trend)}% vs last period
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* 7-8. Filters + Toolbar */}
      {(filters || toolbar) && (
        <div className="flex flex-col gap-3">
          {filters}
          {toolbar}
        </div>
      )}

      {/* 9-11. Content + Right Panel */}
      <div className={cn("flex gap-6", !hasRightPanel && "flex-col")}>
        <div className={cn("flex-1 min-w-0", hasRightPanel && "max-w-[calc(100%-340px)]")}>
          {children}
        </div>
        {hasRightPanel && (
          <aside className="w-80 flex-shrink-0 hidden xl:block">
            <div className="sticky top-20 flex flex-col gap-4">
              {rightPanel}
              {activityFeed && <ActivityFeed activities={activityFeed} />}
              {activity}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}