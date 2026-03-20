import fs from 'fs';
import path from 'path';

export interface NotifChannels { inApp: boolean; email: boolean; sms: boolean; }

export interface PlatformSettings {
  booking: {
    minAdvanceHours: number;
    maxAdvanceDays: number;
    packageBypassMinAdvance: boolean;
    maxLessonsPerDayPerInstructor: number;
  };
  notifications: Record<string, NotifChannels>;
}

const CONFIG_PATH = path.join(process.cwd(), 'settings-config.json');

const DEFAULTS: PlatformSettings = {
  booking: {
    minAdvanceHours: 2,
    maxAdvanceDays: 60,
    packageBypassMinAdvance: true,
    maxLessonsPerDayPerInstructor: 8,
  },
  notifications: {
    BOOKING_REQUEST:     { inApp: true,  email: false, sms: false },
    BOOKING_CONFIRMED:   { inApp: true,  email: true,  sms: true  },
    BOOKING_CANCELLED:   { inApp: true,  email: true,  sms: false },
    BOOKING_RESCHEDULED: { inApp: true,  email: true,  sms: false },
    PAYMENT_RECEIVED:    { inApp: true,  email: false, sms: false },
    LESSON_REMINDER:     { inApp: true,  email: false, sms: true  },
    DOCUMENT_EXPIRING:   { inApp: true,  email: true,  sms: false },
    REVIEW_RECEIVED:     { inApp: true,  email: false, sms: false },
    NEW_MESSAGE:         { inApp: true,  email: false, sms: false },
    PAYOUT_PROCESSED:    { inApp: true,  email: true,  sms: false },
    NO_SHOW_FLAGGED:     { inApp: true,  email: true,  sms: false },
  },
};

export function getPlatformSettings(): PlatformSettings {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return {
        booking: { ...DEFAULTS.booking, ...(raw.booking || {}) },
        notifications: { ...DEFAULTS.notifications, ...(raw.notifications || {}) },
      };
    }
  } catch {}
  return DEFAULTS;
}

export function getNotifChannels(event: string): NotifChannels {
  const s = getPlatformSettings();
  return s.notifications[event] ?? { inApp: true, email: false, sms: false };
}

export function getBookingSettings() {
  return getPlatformSettings().booking;
}
