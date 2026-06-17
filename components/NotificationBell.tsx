'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  actionButtonLabel?: string;
  createdAt: string;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    // Refresh unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/client/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchRecentNotifications = async () => {
    if (loading || notifications.length > 0) return;
    
    try {
      setLoading(true);
      const res = await fetch('/api/client/notifications?limit=5&isRead=false');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown && notifications.length === 0) {
      fetchRecentNotifications();
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/client/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      setUnreadCount(Math.max(0, unreadCount - 1));
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="font-semibold text-slate-100">Notifications</h3>
            <p className="text-xs text-slate-400 mt-1">
              {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </p>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="px-4 py-3 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-100">
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(notif.createdAt).toLocaleDateString('en-AU', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                        title="Mark as read"
                      >
                        ✕
                      </button>
                    </div>
                    {notif.actionUrl && (
                      <Link
                        href={notif.actionUrl}
                        onClick={() => setShowDropdown(false)}
                        className="inline-block mt-2 text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        {notif.actionButtonLabel || 'View'}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-400">No new notifications</p>
              </div>
            )}
          </div>

          {/* Footer - See All Link */}
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-950">
            <Link
              href="/client-dashboard/notifications"
              onClick={() => setShowDropdown(false)}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              See all notifications →
            </Link>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
