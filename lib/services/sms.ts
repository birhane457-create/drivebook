// SMS Service using Twilio
// Add to .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

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

      console.log('SMS sent successfully to:', to);
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  // Booking reminder (24 hours before)
  async sendBookingReminder(data: {
    clientPhone: string;
    clientName: string;
    instructorName: string;
    startTime: Date;
    pickupAddress?: string;
  }) {
    const message = `Hi ${data.clientName}! Reminder: Your driving lesson with ${data.instructorName} is tomorrow at ${data.startTime.toLocaleTimeString()}. ${data.pickupAddress ? `Pickup: ${data.pickupAddress}` : ''} Reply CONFIRM to confirm.`;
    
    return this.sendSMS({
      to: data.clientPhone,
      message,
    });
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

  // Booking confirmation
  async sendBookingConfirmation(data: {
    clientPhone: string;
    instructorPhone: string;
    clientName: string;
    instructorName: string;
    startTime: Date;
    price: number;
  }) {
    const clientMessage = `Booking confirmed! Your lesson with ${data.instructorName} is on ${data.startTime.toLocaleDateString()} at ${data.startTime.toLocaleTimeString()}. Price: $${data.price}`;
    
    const instructorMessage = `New booking from ${data.clientName} on ${data.startTime.toLocaleDateString()} at ${data.startTime.toLocaleTimeString()}. Price: $${data.price}`;
    
    await Promise.all([
      this.sendSMS({ to: data.clientPhone, message: clientMessage }),
      this.sendSMS({ to: data.instructorPhone, message: instructorMessage }),
    ]);
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
