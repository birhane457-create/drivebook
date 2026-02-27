import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/config';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear storage
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Analytics API
export const analyticsAPI = {
  get: (period: 'week' | 'month' | 'year') =>
    api.get(`/api/analytics/mobile?period=${period}`),
};

// Subscription API
export const subscriptionAPI = {
  get: () => api.get('/api/instructor/subscription/mobile'),
  changeTier: (tier: 'PRO' | 'BUSINESS') =>
    api.post('/api/instructor/subscription/mobile', { tier }),
  cancel: () => api.delete('/api/instructor/subscription/mobile'),
};

// PDA Tests API
export const pdaTestsAPI = {
  getAll: () => api.get('/api/pda-tests/mobile'),
  updateResult: (id: string, result: 'PASS' | 'FAIL') =>
    api.put(`/api/pda-tests/mobile/${id}`, { result }),
};

export default api;

// API endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/api/auth/mobile-login', { email, password }),
  register: (data: any) => api.post('/api/register', data),
};

export const bookingAPI = {
  getAll: () => api.get('/api/bookings/mobile'),
  getById: (id: string) => api.get(`/api/bookings/mobile/${id}`),
  create: (data: any) => api.post('/api/bookings/mobile', data),
  cancel: (id: string, data: { reason: string }) =>
    api.post(`/api/bookings/${id}/cancel`, data),
  checkIn: (id: string, data: { location: string; photo?: string }) =>
    api.post(`/api/bookings/${id}/check-in`, data),
  checkOut: (id: string, data: { location: string; photo?: string }) =>
    api.post(`/api/bookings/${id}/check-out`, data),
  reschedule: (id: string, data: { newStartTime: string; newEndTime: string; reason?: string }) =>
    api.post(`/api/bookings/${id}/reschedule`, data),
};

export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/mobile'),
};

export const clientsAPI = {
  getAll: () => api.get('/api/clients/mobile'),
};

export const availabilityAPI = {
  getInstructorProfile: () => api.get('/api/instructor/profile/mobile'),
  getSlots: (instructorId: string, date: string, duration: number) =>
    api.get(`/api/availability/slots?instructorId=${instructorId}&date=${date}&duration=${duration}`),
};

export const instructorAPI = {
  getProfile: () => api.get('/api/instructor/profile'),
  updateProfile: (data: any) => api.put('/api/instructor/profile', data),
};

export const settingsAPI = {
  get: () => api.get('/api/instructor/settings/mobile'),
  update: (data: any) => api.put('/api/instructor/settings/mobile', data),
};

export const calendarAPI = {
  getStatus: () => api.get('/api/google-calendar/mobile'),
  connect: () => api.post('/api/google-calendar/mobile'),
  disconnect: () => api.delete('/api/google-calendar/mobile'),
  sync: () => api.post('/api/google-calendar/sync/mobile'),
};

export const profileAPI = {
  get: () => api.get('/api/instructor/profile/mobile'),
  update: (data: any) => api.put('/api/instructor/profile', data),
  getServiceAreas: () => api.get('/api/instructor/service-areas'),
  addServiceArea: (postcode: string) => 
    api.post('/api/instructor/service-areas', { postcode }),
  removeServiceArea: (id: string) => 
    api.delete(`/api/instructor/service-areas/${id}`),
  uploadDocument: (documentType: string, base64file: string) =>
    api.post('/api/instructor/documents/mobile', { documentType, file: base64file }),
};

// Client API
export const clientAPI = {
  getDashboard: () => api.get('/api/client/dashboard/mobile'),
  getBookings: (filter?: 'all' | 'upcoming' | 'completed') =>
    api.get(`/api/client/bookings/mobile${filter ? `?filter=${filter}` : ''}`),
  getWallet: () => api.get('/api/client/wallet/mobile'),
  getPackages: () => api.get('/api/client/packages/mobile'),
  purchasePackage: (packageId: string, paymentMethod: string) =>
    api.post('/api/client/packages/mobile', { packageId, paymentMethod }),
  getInstructors: (query?: { search?: string; sort?: string }) =>
    api.get('/api/client/instructors/mobile', { params: query }),
  rescheduleBooking: (bookingId: string, data: { newDate: string; newTime: string }) =>
    api.post(`/api/bookings/${bookingId}/reschedule`, data),
  cancelBooking: (bookingId: string) =>
    api.post(`/api/bookings/${bookingId}/cancel`),
  submitReview: (bookingId: string, data: { rating: number; comment: string }) =>
    api.post('/api/reviews', { bookingId, ...data }),
  getPendingReviews: () => api.get('/api/client/pending-reviews'),
  getCompletedReviews: () => api.get('/api/reviews'),
};

// Reviews API
export const reviewAPI = {
  getPending: () => api.get('/api/reviews/pending/mobile'),
  getCompleted: () => api.get('/api/reviews/completed/mobile'),
  submit: (data: { instructorId: string; rating: number; comment: string }) =>
    api.post('/api/reviews/mobile', data),
};

// Instructor Earnings API
export const earningsAPI = {
  getSummary: () => api.get('/api/instructor/earnings/summary/mobile'),
  getStatement: (period?: 'week' | 'month' | 'year') =>
    api.get(`/api/instructor/earnings/statement/mobile${period ? `?period=${period}` : ''}`),
  getTransactions: (limit?: number, offset?: number) =>
    api.get('/api/instructor/earnings/transactions/mobile', { params: { limit, offset } }),
  getPendingPayouts: () => api.get('/api/instructor/payouts/pending/mobile'),
  getPayoutHistory: () => api.get('/api/instructor/payouts/history/mobile'),
  requestPayout: (amount: number, method: string) =>
    api.post('/api/instructor/payouts/request/mobile', { amount, method }),
};
