import { Resend } from 'resend';

// TODO pre-launch: verify chickets.com in Resend dashboard, then change to hello@chickets.com
const FROM_ADDRESS = 'onboarding@resend.dev';

export async function sendAlertConfirmation({
  to,
  name,
  eventTitle,
  targetPrice,
  quantity,
}: {
  to: string;
  name: string;
  eventTitle: string;
  targetPrice: number;
  quantity: number;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `🐣 We're watching the nest — ${eventTitle}`,
    html: `<p>Hi ${name},</p>
<p>We'll email you as soon as we find tickets to <strong>${eventTitle}</strong> at <strong>$${Math.ceil(targetPrice)}</strong> or below for <strong>${quantity} ticket${quantity !== 1 ? 's' : ''}</strong>.</p>
<p>We check prices regularly and will notify you the moment a deal appears.</p>
<p>— The Chickets Team</p>`,
  });
}

export interface PriceMatch {
  eventTitle: string;
  eventDate: string | null;
  venue: string | null;
  platform: string;
  price: number;
  url: string;
}

function fmtPrice(n: number): string {
  return `$${Math.ceil(n)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export async function sendPriceAlert(
  to: string,
  targetPrice: number,
  matches: PriceMatch[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('RESEND_API_KEY not configured');
  }

  const resend = new Resend(apiKey);
  const n = matches.length;
  const subject = `🐣 We found a seat in your price range!`;

  const rows = matches
    .sort((a, b) => a.price - b.price)
    .map(
      (m) => `
      <tr>
        <td style="padding:14px 16px;border-bottom:1px solid #2A2A48;vertical-align:top">
          <div style="font-weight:700;color:#fff;font-size:14px">${m.eventTitle}</div>
          <div style="color:#8E8CA0;font-size:12px;margin-top:3px">${fmtDate(m.eventDate)}${m.venue ? ` · ${m.venue}` : ''}</div>
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #2A2A48;color:#A9A7BF;font-size:13px;vertical-align:top;white-space:nowrap">
          ${m.platform}
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #2A2A48;vertical-align:top;white-space:nowrap">
          <span style="font-weight:800;color:#FFD93D;font-size:17px">${fmtPrice(m.price)}</span>
          <div style="color:#8E8CA0;font-size:11px;margin-top:1px">all-in</div>
        </td>
        <td style="padding:14px 16px;border-bottom:1px solid #2A2A48;vertical-align:top;text-align:right">
          <a href="${m.url}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap">Get Tickets →</a>
        </td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F1C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:40px auto;background:#1A1A2E;border-radius:16px;overflow:hidden;border:2px solid #2A2A48">

    <!-- Header -->
    <div style="background:#FFD93D;padding:28px 32px">
      <p style="margin:0;color:#1A1A2E;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Chickets · Price Alert</p>
      <h1 style="margin:8px 0 0;color:#1A1A2E;font-size:22px;font-weight:800">
        🐣 ${n} show${n !== 1 ? 's' : ''} hit your target of ${fmtPrice(targetPrice)}
      </h1>
    </div>

    <!-- Table -->
    <div style="padding:0 0 8px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#12122A">
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B6480;text-transform:uppercase;letter-spacing:.06em">Show</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B6480;text-transform:uppercase;letter-spacing:.06em">Platform</th>
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B6480;text-transform:uppercase;letter-spacing:.06em">Price</th>
            <th style="padding:10px 16px"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Footer note -->
    <div style="padding:16px 32px 28px;border-top:1px solid #2A2A48">
      <p style="margin:0;color:#4A4860;font-size:12px">
        Prices change fast — grab your seats before they're gone. This alert has been deactivated after sending.
      </p>
    </div>

  </div>
</body>
</html>`;

  await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
}
