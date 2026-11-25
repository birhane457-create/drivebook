'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2, CheckCircle } from 'lucide-react';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (typeFilter) params.append('type', typeFilter);
      const res = await fetch(`/api/client/notifications?${params}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to load notifications.');
      if (!data || !Array.isArray(data.notifications) || !Number.isFinite(data.unreadCount) || !Number.isFinite(data.totalPages)) {
        throw new Error('Notification information was incomplete. Please try again.');
      }
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalPages(Math.max(1, data.totalPages));
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: string) => {
    setActionError(null);
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.isRead) return;
    try {
      const res = await fetch(`/api/client/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      if (!res.ok) throw new Error('Could not mark this notification as read.');
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((items) => items.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setActionError(error instanceof Error ? error.message : 'Could not update this notification.');
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/client/notifications/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete this notification.');
      const wasUnread = notifications.find((notification) => notification.id === id)?.isRead === false;
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
      if (notifications.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      } else {
        setNotifications((items) => items.filter((notification) => notification.id !== id));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setActionError(error instanceof Error ? error.message : 'Could not delete this notification.');
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionError(null);
    try {
      const res = await fetch('/api/client/notifications', { method: 'PATCH' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not mark all notifications as read.');
      setUnreadCount(0);
      setNotifications((items) => items.map((notification) => ({ ...notification, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
      setActionError(error instanceof Error ? error.message : 'Could not update all notifications.');
    }
  };

  // Get unique notification types from current notifications
  const types = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="bg-card/60 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link
                href="/client-dashboard"
                className="p-2 hover:bg-secondary rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-foreground" />
                <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-foreground text-xs font-bold px-2 py-1 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-1.5 text-sm px-3 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
              >
                <CheckCircle className="w-4 h-4" />
                Mark all as read
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loadError && (
          <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <p className="text-sm text-foreground">{loadError}</p>
            <button type="button" onClick={() => void loadNotifications()} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Retry</button>
          </div>
        )}
        {actionError && <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">{actionError}</p>}

        {/* Filter */}
        {(types.length > 0 || typeFilter !== '') && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => { setPage(1); setTypeFilter(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                typeFilter === ''
                  ? 'bg-primary text-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/70'
              }`}
            >
              All
            </button>
            {types.map(type => (
              <button
                key={type}
                onClick={() => { setPage(1); setTypeFilter(type); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  typeFilter === type
                    ? 'bg-primary text-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/70'
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
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Notifications List */}
        {!loading && notifications.length === 0 && (
          <div className="bg-card/60 backdrop-blur rounded-2xl border border-border shadow-lg shadow-slate-950/20 p-12 text-center">
            <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-foreground font-semibold mb-2">You're all caught up</p>
            <p className="text-muted-foreground">
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
              className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
