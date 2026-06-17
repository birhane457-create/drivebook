'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2, Trash2, CheckCircle } from 'lucide-react';
import NotificationItem from '@/components/NotificationItem';

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadNotifications();
  }, [page, typeFilter]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const res = await fetch(`/api/client/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
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
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/client/notifications/${id}`, {
        method: 'DELETE',
      });
      const wasUnread = notifications.find(n => n.id === id)?.isRead === false;
      if (wasUnread) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      await Promise.all(
        unreadNotifications.map(n =>
          fetch(`/api/client/notifications/${n.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRead: true }),
          })
        )
      );
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Get unique notification types from current notifications
  const types = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Header */}
      <header className="bg-slate-900/60 border-b border-white/10 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link
                href="/client-dashboard"
                className="p-2 hover:bg-slate-800 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-300" />
                <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                <CheckCircle className="w-4 h-4" />
                Mark all as read
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter */}
        {types.length > 0 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter('')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                typeFilter === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {types.map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  typeFilter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length === 0 && (
          <div className="bg-slate-900/60 backdrop-blur rounded-3xl border border-white/10 shadow-lg shadow-slate-950/20 p-12 text-center">
            <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-100 font-semibold mb-2">You're all caught up</p>
            <p className="text-slate-400">
              {typeFilter ? 'No notifications of this type' : 'No notifications yet'}
            </p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="space-y-4">
            {notifications.map(notif => (
              <NotificationItem
                key={notif.id}
                {...notif}
                onRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
