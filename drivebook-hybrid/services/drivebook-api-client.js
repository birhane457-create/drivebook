const fetch = global.fetch || require('node-fetch');
const logger = require('../utils/logger');
const config = require('../utils/config');

// DriveBook API Client
// Handles all communication with the main DriveBook platform

class DriveBookAPIClient {
  constructor() {
    this.baseUrl = config.DRIVEBOOK_BASE_URL || 'http://localhost:3001';
    this.apiKey = config.DRIVEBOOK_API_KEY || '';
    this.timeout = 10000;
  }

  async _request(method, endpoint, body = null, isRetry = false) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      'User-Agent': 'DriveBook-Hybrid/1.0'
    };

    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout)
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      logger.logInfo(`${method} ${endpoint}`, { url });
      const res = await fetch(url, options);
      
      if (!res.ok) {
        const error = await res.text();
        logger.logWarning(`${method} ${endpoint} failed`, { 
          status: res.status, 
          error 
        });
        return { success: false, status: res.status, error };
      }

      const data = await res.json();
      logger.logInfo(`${method} ${endpoint} success`, { status: res.status });
      return { success: true, data, status: res.status };
    } catch (err) {
      logger.logError(err, { endpoint, method });
      
      // Retry once on timeout or network error
      if (!isRetry && (err.name === 'AbortError' || err.message.includes('ECONNREFUSED'))) {
        logger.logWarning(`Retry ${method} ${endpoint}`, { attempt: 2 });
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s
        return this._request(method, endpoint, body, true);
      }
      
      return { success: false, error: err.message };
    }
  }

  // Find instructor by phone number
  async findInstructorByPhone(phone) {
    const res = await this._request('GET', `/api/instructors?phone=${encodeURIComponent(phone)}`);
    if (!res.success) return null;
    
    const instructors = Array.isArray(res.data) ? res.data : [res.data];
    if (instructors.length === 0) return null;
    
    const instructor = instructors[0];
    return {
      id: instructor.id,
      name: instructor.name,
      phone: instructor.phone,
      hourlyRate: instructor.hourlyRate,
      approvalStatus: instructor.approvalStatus,
      subscriptionStatus: instructor.subscriptionStatus,
      serviceRadiusKm: instructor.serviceRadiusKm,
      workingHours: instructor.workingHours,
      baseLatitude: instructor.baseLatitude,
      baseLongitude: instructor.baseLongitude,
      copilotAgentEndpoint: instructor.copilotAgentEndpoint || ''
    };
  }

  // Get instructor details
  async getInstructor(instructorId) {
    const res = await this._request('GET', `/api/instructors/${instructorId}`);
    if (!res.success) return null;
    return res.data;
  }

  // Check availability for time slot
  async checkAvailability(instructorId, startTime, endTime) {
    const res = await this._request('POST', `/api/availability/check`, {
      instructorId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString()
    });
    
    if (!res.success) return { available: false, reason: res.error };
    return res.data; // { available: boolean, reason: string }
  }

  // Get available time slots for a date range
  async getAvailableSlots(instructorId, date, durationMinutes = 60) {
    const res = await this._request('POST', `/api/availability/slots`, {
      instructorId,
      date, // YYYY-MM-DD
      durationMinutes
    });
    
    if (!res.success) return [];
    return res.data; // Array of {time: "HH:MM", available: boolean}
  }

  // Create a booking
  async createBooking(bookingData) {
    const res = await this._request('POST', `/api/bookings`, {
      instructorId: bookingData.instructorId,
      clientId: bookingData.clientId,
      startTime: new Date(bookingData.startTime).toISOString(),
      endTime: new Date(bookingData.endTime).toISOString(),
      pickupAddress: bookingData.pickupAddress,
      pickupLatitude: bookingData.pickupLatitude,
      pickupLongitude: bookingData.pickupLongitude,
      dropoffAddress: bookingData.dropoffAddress,
      dropoffLatitude: bookingData.dropoffLatitude,
      dropoffLongitude: bookingData.dropoffLongitude,
      notes: bookingData.notes,
      price: bookingData.price,
      createdBy: 'voice'
    });

    if (!res.success) return { success: false, error: res.error };
    return { 
      success: true, 
      bookingId: res.data.id,
      confirmationCode: res.data.confirmationCode || res.data.id.substring(0, 8).toUpperCase()
    };
  }

  // Get or create client
  async getOrCreateClient(instructorId, clientData) {
    // First try to find by phone/email
    const res = await this._request('GET', `/api/clients?instructorId=${instructorId}&phone=${encodeURIComponent(clientData.phone)}`);
    
    if (res.success && res.data && res.data.id) {
      return { success: true, clientId: res.data.id };
    }

    // Create new client
    const createRes = await this._request('POST', `/api/clients`, {
      instructorId,
      name: clientData.name,
      phone: clientData.phone,
      email: clientData.email,
      notes: 'Created via voice booking'
    });

    if (!createRes.success) return { success: false, error: createRes.error };
    return { success: true, clientId: createRes.data.id };
  }

  // Create payment intent
  async createPaymentIntent(bookingId, amount) {
    const res = await this._request('POST', `/api/create-payment-intent`, {
      bookingId,
      amount
    });

    if (!res.success) return { success: false, error: res.error };
    return { 
      success: true, 
      paymentIntentId: res.data.id,
      clientSecret: res.data.clientSecret,
      stripePublishableKey: res.data.stripePublishableKey
    };
  }

  // Send SMS via DriveBook
  async sendSMS(phoneNumber, message) {
    const res = await this._request('POST', `/api/notifications/sms`, {
      to: phoneNumber,
      message
    });

    return { success: res.success, messageId: res.data?.messageId };
  }

  // Get booking details
  async getBooking(bookingId) {
    const res = await this._request('GET', `/api/bookings/${bookingId}`);
    if (!res.success) return null;
    return res.data;
  }

  // Update booking status
  async updateBooking(bookingId, updates) {
    const res = await this._request('PUT', `/api/bookings/${bookingId}`, updates);
    if (!res.success) return null;
    return res.data;
  }

  // Record voicemail transcript
  async recordVoicemail(instructorId, callerPhone, callerName, message, recordingUrl) {
    const res = await this._request('POST', `/api/voicemails`, {
      instructorId,
      callerPhone,
      callerName,
      message,
      recordingUrl,
      source: 'twilio'
    });

    return { success: res.success, voicemailId: res.data?.id };
  }

  // Health check
  async healthCheck() {
    const res = await this._request('GET', `/api/health`);
    return res.success;
  }
}

// Singleton instance
let client = null;

function getDriveBookClient() {
  if (!client) {
    client = new DriveBookAPIClient();
  }
  return client;
}

module.exports = { DriveBookAPIClient, getDriveBookClient };