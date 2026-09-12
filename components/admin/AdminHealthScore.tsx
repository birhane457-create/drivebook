'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface Signal  { key: string; label: string; score: number; maxScore: number; detail: string }
interface HealthScoreData {
  score: number;
  status: 'healthy' | 'watch' | 'critical';
  signals: Signal[];
  generatedAt: string;
}

const STATUS_CONFIG = {
  healthy:  { badge: 'success'  as const, text: 'text-emerald-400', ring: 'stroke-emerald-400', label: 'Healthy'          },
  watch:    { badge: 'warning'  as const, text: 'text-amber-400',   ring: 'stroke-amber-400',   label: 'Watch'            },
  critical: { badge: 'destructive' as const, text: 'text-red-400',  ring: 'stroke-red-400',     label: 'Needs Attention'  },
};

function ScoreRing({ score, status }: { score: number; status: keyof typeof STATUS_CONFIG }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const fill = ((100 - score) / 100) * circ;
  const cfg  = STATUS_CONFIG[status];
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-secondary" />
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={fill}
          className={cn(cfg.ring, 'transition-all duration-700 ease-out')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold leading-none', cfg.text)}>{score}</span>
        <span className="text-xs text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const pct      = signal.maxScore > 0 ? (signal.score / signal.maxScore) * 100 : 0;
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{signal.label}</span>
        <span className="text-xs text-muted-foreground/60">{signal.score}/{signal.maxScore}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground/50">{signal.detail}</p>
    </div>
  );
}

export default function AdminHealthScore() {
  const [data,       setData]       = useState<HealthScoreData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health-score');
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch { setError('Could not load health score'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-5">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 bg-destructive/10 p-4 mb-4 flex items-center justify-between">
        <span className="text-red-300 text-sm">{error ?? 'Health score unavailable'}</span>
        <button onClick={() => load()} className="text-xs text-red-400 hover:text-red-200 underline">Retry</button>
      </Card>
    );
  }

  const cfg = STATUS_CONFIG[data.status];

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-center gap-5 px-5 py-4">
        <ScoreRing score={data.score} status={data.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-1.5">
              <Activity className={cn('w-4 h-4', cfg.text)} />
              <span className="text-sm font-semibold text-foreground">Platform Health</span>
            </div>
            <Badge variant={cfg.badge}>{cfg.label}</Badge>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.signals.map(s => {
              const pct   = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
              const color = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
              return (
                <span key={s.key} className="flex items-center gap-1 text-xs text-muted-foreground">
                  {pct >= 80 ? <TrendingUp className={cn('w-3 h-3', color)} /> :
                   pct >= 50 ? <Minus className={cn('w-3 h-3', color)} /> :
                   <TrendingDown className={cn('w-3 h-3', color)} />}
                  <span className={color}>{s.label}</span>
                </span>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground/50 mt-2">
            Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button onClick={() => load(true)} disabled={refreshing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-3">Score Breakdown</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            {data.signals.map(s => <SignalBar key={s.key} signal={s} />)}
          </div>
          <p className="text-xs text-muted-foreground/50 mt-4">
            Score is calculated from the last 30 days across 6 weighted signals.
          </p>
        </div>
      )}
    </Card>
  );
}
