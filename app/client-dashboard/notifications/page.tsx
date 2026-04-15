'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react';
import { useNotifications, type NotificationItem } from '@/lib/hooks/useNotifications';

const TYPE_ICON: Record<string, string> = {
  BOOKING_REQUEST:    '📅',
  BOOKING_CONFIRMED:  '✅',
  BOOKING_CANCELLED:  '❌',
  BOOKING_RESCHEDULED:'🔄',
  PAYMENT_RECEIVED:   '💰',
  LESSON_REMINDER:    '⏰',
  NEW_MESSAGE:        '💬',
  DOCUMENT_EXPIRING:  '⚠️',
  REVIEW_RECEIVED:    '⭐',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function NotificationRow({ n, onRead }: { n: NotificationItem; onRead: (id: string) => void }) {
  const href = n.link || '/client-dashboard';
  return (
    <Link
      href={href}
      onClick={() => !n.isRead && onRead(n.id)}
      className={`flex gap-4 items-start px-4 py-4 hover:bg-gray-50 transition border-b border-gray-100 last:border-0 ${
        !n.isRead ? 'bg-blue-50' : ''
      }`}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
          {n.title}
        </p>
        <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.isRead && (
        <div className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" />
      )}
    </Link>
  );
}

export default function NotificationsPage() {
  const { notifications, unreadCount, fetchNotifications, markAllRead, markOneRead } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/client-dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 p-12 text-center">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">You're all caught up</p>
            <p className="text-sm text-gray-400 mt-1">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 overflow-hidden">
            {notifications.map(n => (
              <NotificationRow key={n.id} n={n} onRead={markOneRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
