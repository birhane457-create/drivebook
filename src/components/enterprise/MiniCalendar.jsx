import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, parseISO } from 'date-fns';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function MiniCalendar({ events = [], className }) {
  const [cursor, setCursor] = useState(new Date());
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsByDate = events.reduce((acc, e) => {
    const key = format(typeof e.date === 'string' ? parseISO(e.date) : e.date, 'yyyy-MM-dd');
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-sm font-semibold">{format(cursor, 'MMMM yyyy')}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-xs text-muted-foreground border-b border-border">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1.5 text-center font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate[key] || [];
          const inMonth = isSameMonth(day, cursor);
          const today = isSameDay(day, new Date());
          return (
            <div key={key} className={cn('min-h-[64px] border-b border-r border-border p-1.5', !inMonth && 'bg-muted/20 text-muted-foreground')}>
              <div className={cn('text-xs w-6 h-6 flex items-center justify-center rounded-full', today && 'bg-primary text-primary-foreground font-semibold')}>
                {format(day, 'd')}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 2).map((e, i) => (
                  <div key={i} className={cn('text-[10px] truncate rounded px-1 py-0.5 text-white', e.color || 'bg-primary/80')}>
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 2 && <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}