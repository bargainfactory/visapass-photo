/**
 * Transactional email — sign-in links. SERVER-ONLY.
 *
 * Uses Resend's REST API directly (no SDK dependency). Configure:
 *   RESEND_API_KEY   re_…
 *   EMAIL_FROM       "VisaPass Photo <hello@visapassphoto.com>"  (verified domain)
 *
 * When unconfigured, `sendLoginEmail` returns `{ sent: false }` so the caller
 * can fall back to a dev-mode behaviour (surface the link directly) instead of
 * failing the whole sign-in flow locally.
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendLoginEmail(input: {
  to: string;
  url: string;
  brand: string;
  subject: string;
  /** Short intro line, e.g. "Click the button to sign in and see your orders." */
  intro: string;
  /** Button label. */
  cta: string;
  /** Footer note, e.g. "This link expires in 15 minutes. If you didn't request it, ignore this email." */
  footnote: string;
}): Promise<{ sent: boolean }> {
  if (!emailConfigured()) return { sent: false };

  const url = escapeHtml(input.url);
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0a0f1c;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e5e7eb">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px">
      <tr><td style="font-size:18px;font-weight:600;padding-bottom:16px">${escapeHtml(input.brand)}</td></tr>
      <tr><td style="font-size:15px;line-height:1.5;color:#cbd5e1;padding-bottom:24px">${escapeHtml(input.intro)}</td></tr>
      <tr><td align="center" style="padding-bottom:24px">
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">${escapeHtml(input.cta)}</a>
      </td></tr>
      <tr><td style="font-size:12px;line-height:1.5;color:#94a3b8">${escapeHtml(input.footnote)}</td></tr>
      <tr><td style="font-size:11px;line-height:1.5;color:#64748b;padding-top:16px;word-break:break-all">${url}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = `${input.brand}\n\n${input.intro}\n\n${input.url}\n\n${input.footnote}\n`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`);
  }
  return { sent: true };
}
