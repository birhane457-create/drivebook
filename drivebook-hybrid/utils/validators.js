const { z } = require('zod');

const phoneSchema = z.string().transform(s => s.replace(/\s+/g, '')).refine(p => /^\+?\d{9,15}$/.test(p), { message: 'Invalid phone' });

const dateSchema = z.string().refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s) > new Date(), { message: 'Invalid or past date' });

const timeSchema = z.string().refine(s => /^([01]\d|2[0-3]):([0-5]\d)$/.test(s) && (() => { const [h] = s.split(':'); return h >= 8 && h < 20; })(), { message: 'Invalid time or out of allowed range' });

const nameSchema = z.string().min(2).regex(/^[A-Za-z\s'-]+$/, { message: 'Invalid name' });

const bookingSchema = z.object({
  instructorId: z.string(),
  clientName: nameSchema,
  clientPhone: phoneSchema,
  date: dateSchema,
  time: timeSchema,
  duration: z.number().min(30)
});

module.exports = { phoneSchema, dateSchema, timeSchema, nameSchema, bookingSchema };