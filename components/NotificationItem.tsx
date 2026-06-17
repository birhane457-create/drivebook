'use client';

import { Trash2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface NotificationItemProps {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  actionButtonLabel?: string;
  createdAt: string;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function NotificationItem({
  id,
  type,
  title,
  message,
  isRead,
  actionUrl,
  actionButtonLabel,
  createdAt,
  onRead,
  onDelete,
}: NotificationItemProps) {
  // Icon for notification type
  const getTypeIcon = () => {
    switch (type) {
      case 'BOOKING_REMINDER':
        return '🕒';
      case 'PACKAGE_EXPIRY':
        return '⏰';
      case 'FEEDBACK_RECEIVED':
        return '✅';
      case 'BOOKING_CONFIRMED':
        return '📅';
      case 'BOOKING_CANCELLED':
        return '❌';
      case 'BOOKING_RESCHEDULED':
        return '↻';
      case 'PACKAGE_PURCHASED':
        return '🎁';
      default:
        return '📌';
    }
  };

  const getTypeBadgeColor = () => {
    switch (type) {
      case 'BOOKING_REMINDER':
      case 'BOOKING_CONFIRMED':
        return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
      case 'PACKAGE_EXPIRY':
        return 'bg-amber-900/30 text-amber-300 border-amber-700/50';
      case 'FEEDBACK_RECEIVED':
        return 'bg-green-900/30 text-green-300 border-green-700/50';
      case 'BOOKING_CANCELLED':
      case 'BOOKING_RESCHEDULED':
        return 'bg-red-900/30 text-red-300 border-red-700/50';
      case 'PACKAGE_PURCHASED':
        return 'bg-purple-900/30 text-purple-300 border-purple-700/50';
      default:
        return 'bg-slate-700/30 text-slate-300 border-slate-600/50';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'BOOKING_REMINDER':
        return 'Lesson Reminder';
      case 'PACKAGE_EXPIRY':
        return 'Package Expiry';
      case 'FEEDBACK_RECEIVED':
        return 'Feedback';
      case 'BOOKING_CONFIRMED':
        return 'Booking Confirmed';
      case 'BOOKING_CANCELLED':
        return 'Booking Cancelled';
      case 'BOOKING_RESCHEDULED':
        return 'Booking Rescheduled';
      case 'PACKAGE_PURCHASED':
        return 'Package Purchase';
      default:
        return type;
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        isRead
          ? 'border-slate-700 bg-slate-900/30'
          : 'border-blue-700/50 bg-blue-900/20'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-2xl flex-shrink-0">{getTypeIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="font-semibold text-slate-100 text-sm md:text-base">
                {title}
              </p>
              <p
                className={`text-xs px-2 py-1 rounded-full border inline-block mt-1 ${getTypeBadgeColor()}`}
              >
                {getTypeLabel()}
              </p>
            </div>
            {!isRead && (
              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
            )}
          </div>

          {/* Message */}
          <p className="text-slate-300 text-sm mt-2">{message}</p>

          {/* Timestamp */}
          <p className="text-xs text-slate-500 mt-3">
            {new Date(createdAt).toLocaleDateString('en-AU', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>

          {/* Action Button */}
          {actionUrl && (
            <Link
              href={actionUrl}
              className="inline-block mt-3 text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              {actionButtonLabel || 'View'}
            </Link>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex gap-2 ml-2">
          {!isRead && (
            <button
              onClick={() => onRead(id)}
              title="Mark as read"
              className="p-2 text-slate-400 hover:text-green-400 hover:bg-green-900/20 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(id)}
            title="Delete"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
