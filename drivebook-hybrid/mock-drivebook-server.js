const express = require('express');
const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/instructors/recommendations', (req, res) => {
  const { location, limit } = req.query;
  res.json({
    recommendations: [
      { id: 'ins_1', name: 'Debesay', hourlyRate: 80, distance: 2.1, reviews: 120, reason: 'Top rated', score: 98 },
      { id: 'ins_2', name: 'Michael', hourlyRate: 65, distance: 5.2, reviews: 80, reason: 'Best value', score: 86 },
      { id: 'ins_3', name: 'Sarah', hourlyRate: 75, distance: 1.8, reviews: 60, reason: 'Closest', score: 82 }
    ].slice(0, Number(limit) || 3),
    count: 3,
    message: `Recommendations for ${location || 'unknown'}`
  });
});

app.get('/api/instructors/search', (req, res) => {
  const { location, name } = req.query;
  const instructors = [
    { id: 'ins_1', name: 'Debesay', hourlyRate: 80 },
    { id: 'ins_2', name: 'Michael', hourlyRate: 65 },
    { id: 'ins_3', name: 'Sarah', hourlyRate: 75 }
  ];
  const filtered = name ? instructors.filter(i => i.name.toLowerCase().includes(name.toLowerCase())) : instructors;
  res.json({ instructors: filtered, count: filtered.length });
});

app.get('/api/packages', (req, res) => {
  const { instructorId } = req.query;
  res.json({ packages: [{ type: 'PACKAGE_6', hours: 6, price: 360, currency: 'AUD' }], testPackage: { available: true, price: 35 } });
});

app.get('/api/availability/slots', (req, res) => {
  const { instructorId, date } = req.query;
  res.json({ slots: [{ slotId: 's1', instructorId, time: '09:00', start: `${date}T09:00:00Z`, end: `${date}T10:00:00Z`, available: true }], date, duration: 60, timezone: 'Australia/Perth' });
});

app.post('/api/availability', (req, res) => {
  res.json({ slots: [], message: 'Availability checked' });
});

app.post('/api/public/bookings/bulk', (req, res) => {
  res.json({ success: true, bookingId: 'bk_123', clientId: 'cl_456', total: 360, pricing: { subtotal: 320, discount: 0, platformFee: 40, total: 360 } });
});

app.get('/api/bookings/lookup', (req, res) => {
  const { phone } = req.query;
  res.json({ bookings: [{ bookingId: 'bk_123', date: '2026-06-01', time: '09:00', status: 'confirmed' }], count: 1 });
});

app.post('/api/verifications/otp', (req, res) => {
  res.json({ verificationId: 'ver_1', delivery: 'sms', expiresIn: 300, maxAttempts: 3, resendAfterSeconds: 60 });
});

app.post('/api/verifications/otp/confirm', (req, res) => {
  res.json({ verified: true, verificationToken: 'vtok_abc', expiresIn: 300 });
});

app.post('/api/public/bookings/:id/cancel', (req, res) => {
  res.json({ success: true, bookingId: req.params.id, refunded: false });
});

app.post('/api/public/bookings/:id/reschedule', (req, res) => {
  res.json({ success: true, bookingId: req.params.id, newDate: '2026-06-02', newTime: '10:00' });
});

const port = process.env.MOCK_DRIVEBOOK_PORT || 3000;

if (require.main === module) {
  app.listen(port, () => console.log(`Mock DriveBook server listening on ${port}`));
}

module.exports = app;
