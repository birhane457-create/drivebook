'use client';
/**
 * Chart primitives — thin wrappers around Recharts that enforce the
 * DriveBook dark design system. Import these instead of Recharts directly.
 *
 * Usage:
 *   import { AreaChart, BarChart, StatSparkline } from '@/components/ui/chart';
 */

import React from 'react';
import {
  AreaChart as ReAreaChart, Area,
  BarChart as ReBarChart, Bar,
  LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';

/* ── Brand palette ─────────────────────────────────────────────────────────── */
export const CHART_COLORS = {
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  sky:     '#0ea5e9',
  emerald: '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
  slate:   '#64748b',
};

/** Shared tooltip style — dark card matching design tokens */
const TooltipStyle = {
  contentStyle: {
    background: 'hsl(222 40% 9%)',
    border:     '1px solid hsl(222 28% 18%)',
    borderRadius: '10px',
    color:      'hsl(210 20% 94%)',
    fontSize:   '12px',
    padding:    '8px 12px',
  },
  labelStyle:  { color: 'hsl(220 10% 55%)', marginBottom: 4 },
  cursor:      { fill: 'rgba(59,130,246,0.06)' },
};

const GridStyle = {
  strokeDasharray: '3 3',
  stroke: 'hsl(222 28% 18%)',
  vertical: false,
};

const AxisStyle = {
  tick:       { fill: 'hsl(220 10% 55%)', fontSize: 11 },
  axisLine:   false as const,
  tickLine:   false as const,
};

/* ── Area Chart ──────────────────────────────────────────────────────────── */
interface AreaChartProps {
  data:     Record<string, any>[];
  xKey:     string;
  series:   { key: string; color?: string; label?: string }[];
  height?:  number;
  format?:  (v: number) => string;
  className?: string;
}

export function AreaChart({ data, xKey, series, height = 260, format, className }: AreaChartProps) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            {series.map(s => {
              const color = s.color ?? CHART_COLORS.blue;
              return (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid {...GridStyle} />
          <XAxis dataKey={xKey} {...AxisStyle} />
          <YAxis {...AxisStyle} tickFormatter={format} width={48} />
          <Tooltip {...TooltipStyle} formatter={format ? (v: any) => [format(v)] : undefined} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(220 10% 55%)' }} />}
          {series.map(s => {
            const color = s.color ?? CHART_COLORS.blue;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              />
            );
          })}
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Bar Chart ───────────────────────────────────────────────────────────── */
interface BarChartProps {
  data:    Record<string, any>[];
  xKey:    string;
  series:  { key: string; color?: string; label?: string }[];
  height?: number;
  format?: (v: number) => string;
  stacked?: boolean;
  className?: string;
}

export function BarChart({ data, xKey, series, height = 240, format, stacked, className }: BarChartProps) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GridStyle} />
          <XAxis dataKey={xKey} {...AxisStyle} />
          <YAxis {...AxisStyle} tickFormatter={format} width={48} />
          <Tooltip {...TooltipStyle} formatter={format ? (v: any) => [format(v)] : undefined} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(220 10% 55%)' }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label ?? s.key}
              fill={s.color ?? Object.values(CHART_COLORS)[i % 8]}
              stackId={stacked ? 'stack' : undefined}
              radius={stacked ? [0,0,0,0] : [4,4,0,0]}
              maxBarSize={48}
            />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Line Chart ──────────────────────────────────────────────────────────── */
interface LineChartProps {
  data:    Record<string, any>[];
  xKey:    string;
  series:  { key: string; color?: string; label?: string }[];
  height?: number;
  format?: (v: number) => string;
  className?: string;
}

export function LineChart({ data, xKey, series, height = 240, format, className }: LineChartProps) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...GridStyle} />
          <XAxis dataKey={xKey} {...AxisStyle} />
          <YAxis {...AxisStyle} tickFormatter={format} width={48} />
          <Tooltip {...TooltipStyle} formatter={format ? (v: any) => [format(v)] : undefined} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(220 10% 55%)' }} />}
          {series.map((s, i) => {
            const color = s.color ?? Object.values(CHART_COLORS)[i % 8];
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
              />
            );
          })}
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Donut / Pie Chart ───────────────────────────────────────────────────── */
interface DonutChartProps {
  data:    { name: string; value: number; color?: string }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
}

export function DonutChart({ data, height = 220, innerRadius = 55, outerRadius = 85, className }: DonutChartProps) {
  const defaultColors = Object.values(CHART_COLORS);
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RePieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.color ?? defaultColors[i % defaultColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TooltipStyle.contentStyle}
            labelStyle={TooltipStyle.labelStyle}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'hsl(220 10% 55%)' }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Stat sparkline (mini area, no axes) ─────────────────────────────────── */
interface SparklineProps {
  data:   { value: number }[];
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color = CHART_COLORS.blue, height = 48, className }: SparklineProps) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReAreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill="url(#spark-grad)" dot={false} />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
