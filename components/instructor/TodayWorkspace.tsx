'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Phone, ChevronRight, Clock, TrendingUp, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AreaChart } from '@/components/ui/chart';
import { getStatusConfig, isDoneStatus, isActiveStatus } from '@/lib/config/booking-status';
import { resolveTimezone, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone';
import { cn } from '@/lib/cn';

export interface TodayBooking {
  id:            string;
  startTime:     Date | string;
  endTime:       Date | string | null;
  duration:      number | null;
  status:        string;
  customerName:  string | null;
  customerPhone: string | null;
  pickupAddress: string | null;
  price:         number;
}

interface Props {
  bookings:       TodayBooking[];
  instructorName: string;
  timezone?:      string;
  termBooking?:   string;
  termCustomer?:  string;
  weeklyRevenue?: number[];
}

function extractSuburb(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(/,\s*([A-Za-z][A-Za-z\s'-]+?)\s+(?:WA|NSW|VIC|QLD|SA|TAS|NT|ACT)\s+\d{4}/i);
  if (match) return match[1].trim();
  const parts = address.split(',');
  if (parts.length >= 2) return parts[parts.length - 1].trim();
  return null;
}

function greetingFor(name: string, tz: string): string {
  const hourStr = formatLocalTime(new Date(), tz, { hour: 'numeric', hour12: false } as any);
  const hour    = parseInt(String(hourStr), 10);
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${name.split(' ')[0]}`;
}

export default function TodayWorkspace({
  bookings,
  instructorName,
  timezone     = DEFAULT_TIMEZONE,
  termBooking  = 'Booking',
  termCustomer = 'Customer',
  weeklyRevenue,
}: Props) {
  const now        = new Date();
  const resolvedTz = resolveTimezone(timezone);

  const [greeting, setGreeting] = useState('');
  useEffect(() => { setGreeting(greetingFor(instructorName, resolvedTz)); }, [instructorName, resolvedTz]);

  const sorted       = [...bookings].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const total        = sorted.length;
  const completed    = sorted.filter(b => isDoneStatus(b.status)).length;
  const active       = sorted.filter(b => isActiveStatus(b.status)).length;
  const revenueToday = sorted.filter(b => b.status === 'COMPLETED').reduce((s, b) => s + b.price, 0);

  const nextBooking = sorted.find(b => isActiveStatus(b.status) && new Date(b.startTime) > now);
  const inProgress  = sorted.find(b => {
    const start = new Date(b.startTime);
    const end   = b.endTime ? new Date(b.endTime) : null;
    return start <= now && (!end || end > now) && isActiveStatus(b.status);
  });
  const highlighted = inProgress ?? nextBooking;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const todayLabel = now.toLocaleDateString('en-AU', {
    timeZone: resolvedTz,
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const sparkData = weeklyRevenue
    ? weeklyRevenue.map(v => ({ value: v }))
    : null;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Greeting */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">
          Today · {todayLabel}
        </p>
        <h2 className="text-xl font-bold text-foreground">
          {greeting || `Hi, ${instructorName.split(' ')[0]}`}
        </h2>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{termBooking}s Today</p>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{total}</p>
            {total > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{completed} done · {active} remaining</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Next {termBooking}</p>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            {nextBooking ? (
              <>
                <p className="text-lg font-bold text-foreground">
                  {formatLocalTime(nextBooking.startTime, resolvedTz, { hour: 'numeric', minute: '2-digit', hour12: true } as any)}
                </p>
                <p className="text-xs text-primary truncate mt-0.5">{nextBooking.customerName ?? termCustomer}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">None scheduled</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Progress</p>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">
              {completed} <span className="text-muted-foreground font-normal">/ {total}</span>
            </p>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Revenue Today</p>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400">${revenueToday.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">completed {termBooking.toLowerCase()}s</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly revenue sparkline (optional) */}
      {sparkData && sparkData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              7-Day Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AreaChart
              data={sparkData}
              xKey="day"
              series={[{ key: 'value', color: '#3b82f6', label: 'Revenue' }]}
              height={120}
              format={v => `$${v}`}
            />
          </CardContent>
        </Card>
      )}

      {/* Schedule timeline */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <CardTitle>Today&apos;s Schedule</CardTitle>
          <Link href="/dashboard/bookings" className="text-xs text-primary hover:text-foreground transition-colors">
            All {termBooking.toLowerCase()}s →
          </Link>
        </div>

        {total === 0 ? (
          <CardContent className="text-center py-12">
            <p className="text-foreground font-medium mb-1">Nothing scheduled today.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Enjoy the day off — or create a {termBooking.toLowerCase()} to fill it.
            </p>
            <Link
              href="/dashboard/bookings/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + New {termBooking}
            </Link>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map(booking => {
              const cfg        = getStatusConfig(booking.status);
              const isNext     = booking.id === highlighted?.id;
              const isComplete = isDoneStatus(booking.status);
              const suburb     = extractSuburb(booking.pickupAddress);
              const startFmt   = formatLocalTime(booking.startTime, resolvedTz, { hour: '2-digit', minute: '2-digit', hour12: true } as any);
              const endFmt     = booking.endTime ? formatLocalTime(booking.endTime, resolvedTz, { hour: '2-digit', minute: '2-digit', hour12: true } as any) : null;
              const durationH  = booking.duration ? `${booking.duration} min` : null;

              return (
                <Link
                  key={booking.id}
                  href={`/dashboard/bookings/${booking.id}`}
                  className={cn(
                    'flex items-stretch gap-0 group transition-colors no-underline',
                    isNext     ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-secondary/30',
                    isComplete && 'opacity-60',
                  )}
                >
                  {/* Time column */}
                  <div className="w-20 shrink-0 flex flex-col items-end justify-center px-4 py-4">
                    <span className={cn('text-sm font-semibold tabular-nums', isNext ? 'text-primary' : 'text-foreground')}>
                      {startFmt}
                    </span>
                    {endFmt && <span className="text-xs text-muted-foreground tabular-nums">{endFmt}</span>}
                  </div>

                  {/* Accent bar */}
                  <div className={cn('w-0.5 shrink-0 self-stretch my-3 rounded-full', cfg.dot)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {isNext && !inProgress && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Next</span>
                        )}
                        {inProgress && booking.id === inProgress.id && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            In Progress
                          </span>
                        )}
                        <p className={cn('font-semibold truncate', isNext ? 'text-foreground' : 'text-foreground/90')}>
                          {booking.customerName ?? termCustomer}
                        </p>
                        {(suburb || booking.pickupAddress) && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {suburb ?? booking.pickupAddress}
                          </p>
                        )}
                        {durationH && <p className="text-xs text-muted-foreground/60 mt-0.5">{durationH}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cfg.badge}>
                          {cfg.label}
                        </Badge>
                        {booking.customerPhone && (
                          <a
                            href={`tel:${booking.customerPhone}`}
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
