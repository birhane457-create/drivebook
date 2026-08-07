// SMS Service using Twilio
// Add to .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
// All student-facing messages use getDisplayName() — never raw instructor.name.

import { getDisplayName, type DisplayIdentitySource } from '@/lib/branding/getDisplayIdentity'
import { resolveTimezone, timezoneFromState, formatLocalDate, formatLocalTime, DEFAULT_TIMEZONE } from '@/lib/utils/timezone'

interface SendSMSParams {
  to: string;
  message: string;
}

class SMSService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private enabled: boolean;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.enabled = !!(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendSMS({ to, message }: SendSMSParams): Promise<boolean> {
    if (!this.enabled) {
      console.log('SMS not configured. Would send:', { to, message });
      return false;
    }

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: this.fromNumber,
            Body: message,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Twilio SMS error:', error);
        return false;
      }

      console.log('SMS sent to:', to.slice(-4).padStart(to.length, '*')); // last 4 only
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  // Booking confirmation — student only
  async sendBookingConfirmation(data: {
    clientPhone: string;
    clientName: string;
    instructorName: string;
    provider?: DisplayIdentitySource;
    startTime: Date;
    price: number;
    timezone?: string;
  }) {
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const providerName = data.provider ? getDisplayName(data.provider) : data.instructorName;
    const dateStr = formatLocalDate(data.startTime, tz);
    const timeStr = formatLocalTime(data.startTime, tz, { hour: '2-digit', minute: '2-digit' });
    const clientMessage = `Booking confirmed! Your lesson with ${providerName} is on ${dateStr} at ${timeStr}. Price: $${data.price}`;
    return this.sendSMS({ to: data.clientPhone, message: clientMessage });
  }

  // 24hr lesson reminder — student
  async sendLessonReminderStudent(data: {
    clientPhone: string;
    clientName: string;
    instructorName: string;
    provider?: DisplayIdentitySource;
    startTime: Date;
    pickupAddress?: string;
    timezone?: string;
  }) {
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const providerName = data.provider ? getDisplayName(data.provider) : data.instructorName;
    const timeStr = formatLocalTime(data.startTime, tz, { hour: '2-digit', minute: '2-digit' });
    const dateStr = formatLocalDate(data.startTime, tz, { weekday: 'short', day: 'numeric', month: 'short' } as any);
    const pickup = data.pickupAddress ? ` Pickup: ${data.pickupAddress}.` : '';
    const message = `Hi ${data.clientName}! Reminder: your driving lesson with ${providerName} is tomorrow ${dateStr} at ${timeStr}.${pickup}`;
    return this.sendSMS({ to: data.clientPhone, message });
  }

  // 24hr lesson reminder — instructor
  async sendLessonReminderInstructor(data: {
    instructorPhone: string;
    instructorName: string;
    clientName: string;
    startTime: Date;
    pickupAddress?: string;
    timezone?: string;
  }) {
    const tz = resolveTimezone(data.timezone ?? DEFAULT_TIMEZONE)
    const timeStr = formatLocalTime(data.startTime, tz, { hour: '2-digit', minute: '2-digit' });
    const dateStr = formatLocalDate(data.startTime, tz, { weekday: 'short', day: 'numeric', month: 'short' } as any);
    const pickup = data.pickupAddress ? ` Pickup: ${data.pickupAddress}.` : '';
    const message = `Hi ${data.instructorName}! Reminder: lesson with ${data.clientName} tomorrow ${dateStr} at ${timeStr}.${pickup}`;
    return this.sendSMS({ to: data.instructorPhone, message });
  }

  // Check-in notification
  async sendCheckInNotification(data: {
    phone: string;
    name: string;
    bookingId: string;
    checkInUrl: string;
  }) {
    const message = `Hi ${data.name}! Your lesson is starting. Please check in: ${data.checkInUrl}`;
    
    return this.sendSMS({
      to: data.phone,
      message,
    });
  }

  // Check-out notification
  async sendCheckOutNotification(data: {
    phone: string;
    name: string;
    bookingId: string;
    checkOutUrl: string;
  }) {
    const message = `Hi ${data.name}! Your lesson is ending. Please check out: ${data.checkOutUrl}`;
    
    return this.sendSMS({
      to: data.phone,
      message,
    });
  }

  // Dispute alert
  async sendDisputeAlert(data: {
    adminPhone: string;
    bookingId: string;
    reason: string;
  }) {
    const message = `DISPUTE ALERT: Booking ${data.bookingId} - ${data.reason}. Check admin dashboard.`;
    
    return this.sendSMS({
      to: data.adminPhone,
      message,
    });
  }
}

export const smsService = new SMSService();
