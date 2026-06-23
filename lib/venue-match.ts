/** Normalize a string to a comparable slug: lowercase, alphanumeric only. */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Returns true if the href slug contains the venue name (fuzzy) and the event date.
 * Date is matched in M-D-YYYY (VS/Gametime) and M-D-YY (TickPick) formats.
 */
export function matchesVenueAndDate(href: string, venue: string, eventDate: string): boolean {
  const venueSlug = slugify(venue);
  if (venueSlug.length < 3) return false;

  // Venue check: normalize the full href and check if venue slug is a substring
  if (!slugify(href).includes(venueSlug)) return false;

  // Date check: try multiple date slug formats that platforms embed in their URLs
  if (!eventDate) return true;
  const [year, mm, dd] = eventDate.split('-');
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  const hrefLower = href.toLowerCase();

  return (
    hrefLower.includes(`${m}-${d}-${year}`) ||         // "8-13-2026" (VS, Gametime)
    hrefLower.includes(`${m}-${d}-${year.slice(2)}`) || // "8-13-26"   (TickPick)
    hrefLower.includes(`${mm}-${dd}-${year}`) ||        // "08-13-2026" (padded)
    hrefLower.includes(`${year}-${mm}-${dd}`)           // "2026-08-13" (SeatGeek)
  );
}

/** Convert a platform URL into a human-readable label for the candidate picker. */
export function urlToLabel(url: string): string {
  try {
    const path = new URL(url).pathname;
    const slug = path
      .replace(/\/production\/\d+\/?$/, '')   // strip VS production ID
      .replace(/\/\d+\/?$/, '')               // strip TP event ID
      .replace(/^\/buy-/, '/')                // strip TP "buy-" prefix
      .replace(/--[^/]*$/, '')                // strip VS category suffix ("--concerts-...")
      .replace(/^\//, '');
    const readable = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    return (readable || url).slice(0, 72);
  } catch {
    return url.slice(0, 72);
  }
}
