import { Resend } from 'resend';
import { TicketListing } from '@/lib/ticket-sources/types';

const FROM_ADDRESS = 'onboarding@resend.dev';

function fmtCeil(n: number): string {
  return `$${Math.ceil(n)}`;
}

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
    subject: `You're on the list — ${eventTitle}`,
    html: `<p>Hi ${name},</p>
<p>We'll email you as soon as we find tickets to <strong>${eventTitle}</strong> at <strong>$${Math.ceil(targetPrice)}</strong> or below for <strong>${quantity} ticket${quantity !== 1 ? 's' : ''}</strong>.</p>
<p>We check prices regularly and will notify you the moment a deal appears.</p>
<p>— The TicketHub Team</p>`,
  });
}

export async function sendPriceAlert({
  to,
  name,
  eventTitle,
  targetPrice,
  quantity,
  matches,
}: {
  to: string;
  name: string;
  eventTitle: string;
  targetPrice: number;
  quantity: number;
  matches: (TicketListing & { url: string })[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('RESEND_API_KEY not configured');
  }

  const resend = new Resend(apiKey);

  const rows = matches
    .sort((a, b) => a.all_in_price - b.all_in_price)
    .map(
      (m) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b">${m.platform}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${m.section || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569">${m.row || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#16a34a">${fmtCeil(m.all_in_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
          <a href="${m.url}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600">Get Tickets →</a>
        </td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e293b;padding:28px 32px">
      <p style="margin:0;color:#818cf8;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase">TicketHub Price Alert</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700">Tickets are at your price! 🎟</h1>
    </div>

    <div style="padding:28px 32px">
      <p style="margin:0 0 6px;color:#475569;font-size:15px">Hi ${name},</p>
      <p style="margin:0 0 20px;color:#1e293b;font-size:15px">
        We found <strong>${matches.length} listing${matches.length !== 1 ? 's' : ''}</strong> for
        <strong>${eventTitle}</strong> at or below your target of <strong>${fmtCeil(targetPrice)}</strong>
        for <strong>${quantity} ticket${quantity !== 1 ? 's' : ''}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0">Platform</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0">Section</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0">Row</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e2e8f0">All-In</th>
            <th style="padding:10px 12px;border-bottom:1px solid #e2e8f0"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin:24px 0 0;padding:16px;background:#f0fdf4;border-radius:8px;color:#166534;font-size:13px;border:1px solid #bbf7d0">
        Prices change fast — grab your tickets before they're gone!
      </p>
    </div>

    <div style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
      <p style="margin:0;color:#94a3b8;font-size:12px">
        This alert has been deactivated. Reply to this email if you'd like to reactivate it.
      </p>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `🎟 Tickets for ${eventTitle} are at your price!`,
    html,
  });
}
