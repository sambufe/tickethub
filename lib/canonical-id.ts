/**
 * Generate a canonical event ID in the format:
 *   yyyymmdd_venueslug_starttime
 *
 * venueslug: venue name lowercased, all non-alphanumerics removed
 * starttime: 24-hour HH:MM with colon removed (e.g. 8pm → "2000")
 *
 * Example: "Santa Barbara Bowl" + "2026-08-13T20:00:00" → "20260813_santabarbarabowl_2000"
 */
export function generateCanonicalId(venue: string, eventDate: string): string {
  const venueslug = venue.toLowerCase().replace(/[^a-z0-9]/g, '');

  const [datePart, timePart] = eventDate.split('T');
  const dateStr = datePart.replace(/-/g, ''); // "20260813"

  let time = '0000';
  if (timePart) {
    const [h, m] = timePart.split(':');
    time = `${h.padStart(2, '0')}${(m ?? '00').slice(0, 2)}`;
  }

  return `${dateStr}_${venueslug}_${time}`;
}
