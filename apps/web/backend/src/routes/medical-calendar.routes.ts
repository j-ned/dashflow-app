import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '@db/client';
import { sharedAccess, appointments, medications, practitioners } from '@db/schema';

const medicalCalendarRoutes = new Hono();

// GET /:token — public iCal feed
medicalCalendarRoutes.get('/:token', async (c) => {
  const token = c.req.param('token');

  const [access] = await db.select().from(sharedAccess)
    .where(eq(sharedAccess.calendarToken, token))
    .limit(1);
  if (!access) return c.json({ error: 'Token invalide' }, 404);

  const userId = access.userId;

  const [userAppointments, userPractitioners, userMedications] = await Promise.all([
    db.select().from(appointments).where(eq(appointments.userId, userId)).limit(500),
    db.select().from(practitioners).where(eq(practitioners.userId, userId)).limit(500),
    db.select().from(medications).where(eq(medications.userId, userId)).limit(500),
  ]);

  const practitionerMap = new Map(userPractitioners.map((p) => [p.id, p.name]));

  // Build iCal
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DashFlow//Medical Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:DashFlow Medical',
  ];

  for (const apt of userAppointments) {
    const dateStr = apt.date.replace(/-/g, '');
    const timeStr = apt.time.replace(':', '') + '00';
    const practName = practitionerMap.get(apt.practitionerId) ?? 'Praticien';
    const summary = apt.reason ? `${practName} - ${apt.reason}` : practName;

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART:${dateStr}T${timeStr}`);
    lines.push(`SUMMARY:${escapeIcal(summary)}`);
    lines.push(`UID:apt-${apt.id}@dashflow`);
    if (apt.outcome) lines.push(`DESCRIPTION:${escapeIcal(apt.outcome)}`);
    lines.push(`STATUS:${apt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  }

  for (const med of userMedications) {
    const dailyRate = Number(med.dailyRate);
    if (dailyRate <= 0) continue;
    const daysRemaining = med.quantity / dailyRate;
    const refillDate = new Date(med.startDate);
    refillDate.setDate(refillDate.getDate() + Math.floor(daysRemaining));
    const refillDateStr = refillDate.toISOString().slice(0, 10).replace(/-/g, '');

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART;VALUE=DATE:${refillDateStr}`);
    lines.push(`SUMMARY:${escapeIcal(`Renouveler: ${med.name}`)}`);
    lines.push(`UID:med-${med.id}@dashflow`);
    lines.push(`DESCRIPTION:${escapeIcal(`${med.dosage} - ${med.quantity} restants`)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const ical = lines.join('\r\n');
  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="medical.ics"',
    },
  });
});

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export default medicalCalendarRoutes;
