export function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface IcalAppointment { id: string; date: string; time: string; practitionerId: string; reason: string | null; outcome: string | null; status: string }
export interface IcalMedication { id: string; name: string; dosage: string; quantity: number; dailyRate: string; startDate: string }

export function buildIcal(
  appointments: IcalAppointment[],
  practitioners: { id: string; name: string }[],
  medications: IcalMedication[],
): string {
  const practMap = new Map(practitioners.map((p) => [p.id, p.name]));
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DashFlow//Medical Calendar//FR',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:DashFlow Medical',
  ];
  for (const apt of appointments) {
    const dateStr = apt.date.replace(/-/g, '');
    const timeStr = apt.time.replace(':', '') + '00';
    const practName = practMap.get(apt.practitionerId) ?? 'Praticien';
    const summary = apt.reason ? `${practName} - ${apt.reason}` : practName;
    lines.push('BEGIN:VEVENT', `DTSTART:${dateStr}T${timeStr}`, `SUMMARY:${escapeIcal(summary)}`, `UID:apt-${apt.id}@dashflow`);
    if (apt.outcome) lines.push(`DESCRIPTION:${escapeIcal(apt.outcome)}`);
    lines.push(`STATUS:${apt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  for (const med of medications) {
    const dailyRate = Number(med.dailyRate);
    if (dailyRate <= 0) continue;
    const daysRemaining = med.quantity / dailyRate;
    const refill = new Date(med.startDate);
    refill.setDate(refill.getDate() + Math.floor(daysRemaining));
    const refillStr = refill.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${refillStr}`, `SUMMARY:${escapeIcal(`Renouveler: ${med.name}`)}`,
      `UID:med-${med.id}@dashflow`, `DESCRIPTION:${escapeIcal(`${med.dosage} - ${med.quantity} restants`)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
