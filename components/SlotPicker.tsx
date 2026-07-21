'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

interface SlotPickerProps {
  instructorId: string;
  duration?: number; // minutes, default 60
  onSelect: (date: string, time: string, isShortNotice?: boolean) => void;
  selected?: { date: string; time: string } | null;
  primaryColor?: string;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getDateString(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

export default function SlotPicker({
  instructorId,
  duration = 60,
  onSelect,
  selected,
  primaryColor = '#3B82F6',
}: SlotPickerProps) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week, etc.
  const [selectedDate, setSelectedDate] = useState<string>(selected?.date || '');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [noAvailability, setNoAvailability] = useState(false);

  // Build 7-day window starting from weekOffset * 7 days from today
  const days = Array.from({ length: 7 }, (_, i) => getDateString(weekOffset * 7 + i));

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSlots([]);
    setNoAvailability(false);
    fetch(`/api/availability/slots?instructorId=${instructorId}&date=${selectedDate}&duration=${duration}&bypassDurationCheck=true`)
      .then(r => r.json())
      .then(data => {
        const allSlots = (data.slots || []) as TimeSlot[];
        const available = allSlots.filter((s: TimeSlot) => s.available);
        const shortNotice = allSlots.filter((s: TimeSlot) => !s.available && s.reason === 'short_notice');
        setSlots([...available, ...shortNotice]);
        setNoAvailability(available.length === 0 && shortNotice.length === 0);
      })
      .catch(() => setNoAvailability(true))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, instructorId, duration]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // Clear time selection when date changes
    if (selected?.date !== date) onSelect(date, '');
  };

  const handleTimeSelect = (time: string) => {
    const slot = slots.find(s => s.time === time);
    onSelect(selectedDate, time, slot?.reason === 'short_notice');
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="p-2 rounded-lg border border-white/25 bg-slate-800/80 hover:bg-slate-700 hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed text-white/80 hover:text-white transition-all duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-white/85">
          {weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : `+${weekOffset} weeks`}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset(w => w + 1)}
          className="p-2 rounded-lg border border-white/25 bg-slate-800/80 hover:bg-slate-700 hover:border-white/40 text-white/80 hover:text-white transition-all duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day selector */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(date => {
          const d = new Date(date + 'T00:00:00');
          const isSelected = selectedDate === date;
          const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
          return (
            <button
              key={date}
              type="button"
              disabled={isPast}
              onClick={() => handleDateSelect(date)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all duration-200 border
                ${isSelected
                  ? 'text-white border-transparent shadow-[0_0_0_2px_rgba(56,189,248,0.5)]'
                  : isPast
                  ? 'text-white/35 border-white/10 cursor-not-allowed'
                  : 'text-white/85 border-white/20 hover:border-sky-400/70 hover:bg-sky-500/10 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]'
                }`}
              style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
            >
              <span className="text-xs opacity-70">{d.toLocaleDateString('en-AU', { weekday: 'short' })}</span>
              <span className="text-sm font-bold">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-white/85">
              {formatDateLabel(selectedDate)}
            </span>
          </div>

          {loadingSlots ? (
            <div className="text-center py-6 text-white/65 text-sm">Loading available times...</div>
          ) : noAvailability ? (
            <div className="text-center py-6 text-white/65 text-sm">
              No availability on this day — try another date
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map(slot => {
                const isChosen = selected?.date === selectedDate && selected?.time === slot.time;
                const isShortNotice = slot.reason === 'short_notice';
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => handleTimeSelect(slot.time)}
                    className={`py-2 px-1 rounded-lg text-sm font-semibold border-2 transition-all duration-200
                      ${isChosen
                        ? 'text-white border-transparent shadow-[0_0_0_2px_rgba(56,189,248,0.5)]'
                        : isShortNotice
                        ? 'text-amber-100 border-amber-500/60 bg-amber-700/30 hover:bg-amber-700/50 hover:border-amber-400 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.3)]'
                        : 'text-white border-white/30 bg-slate-700/60 hover:border-sky-400/80 hover:bg-slate-600/80 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.25)]'
                      }`}
                    style={isChosen ? { backgroundColor: isShortNotice ? '#d97706' : primaryColor, borderColor: isShortNotice ? '#d97706' : primaryColor } : {}}
                    title={isShortNotice ? 'Last-minute slot — requires instructor approval' : undefined}
                  >
                    {slot.time}
                    {isShortNotice && <span className="block text-[9px] leading-tight">⚡ approval</span>}
                  </button>
                );
              })}
            </div>
          )}

          {selected?.date === selectedDate && selected?.time && (
            <p className="text-sm mt-2 font-medium text-sky-200">
              ✓ {formatDateLabel(selectedDate)} at {selected.time}
            </p>
          )}

          {slots.some(s => s.reason === 'short_notice') && (
            <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mt-2">
              ⚡ Amber slots are within 2 hours and require instructor approval before confirming.
            </p>
          )}
        </div>
      )}

      {!selectedDate && (
        <p className="text-sm text-white/65 text-center py-4">Select a day to see available times</p>
      )}
    </div>
  );
}
