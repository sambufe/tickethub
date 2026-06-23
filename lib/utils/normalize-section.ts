// Word-boundary GA variants: GA, General Admission, Gen Admission, Standing
const GA_WORD_RE = /\b(ga|general\s+admission|gen\.?\s+admission|standing)\b/i;
// G.A. can't use \b after a trailing dot, so match it as a full token
const GA_DOT_RE = /(?:^|[\s,/])g\.a\.(?:[\s,/]|$)/i;

export function normalizeSection(raw: string): string {
  const stripped = raw.replace(/^\s*reserved\s*/i, '').trim();
  const s = stripped || raw.trim();
  return GA_WORD_RE.test(s) || GA_DOT_RE.test(s) ? 'General Admission' : s;
}
