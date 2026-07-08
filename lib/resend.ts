import { Resend } from 'resend';

export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function plainToHtml(text: string): string {
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ');

  return clean
    .split('\n')
    .map(line => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return escaped.trim() === '' ? '<br>' : `<p style="margin:0 0 10px 0">${escaped}</p>`;
    })
    .join('\n');
}

/**
 * Unlayer templates embed images as base64 data URIs which can be 100KB+ each.
 * Gmail clips emails >102KB, showing the clipped tail as raw text.
 * Strip base64 src attributes before sending so the email stays small.
 * The image element is kept so layout is preserved (most clients show alt text).
 */
function stripBase64Images(html: string): string {
  // Replace src="data:..." with src="" to remove the payload but keep the tag
  return html.replace(/\ssrc="data:[^"]*"/gi, ' src=""');
}

export async function sendEmail({
  to,
  subject,
  body,
  from,
  htmlBody,
}: {
  to: string;
  subject: string;
  body: string;
  from: string;
  htmlBody?: string | null;
}) {
  const resend = createResendClient();

  let html: string;
  if (htmlBody) {
    // Strip embedded base64 images to keep the email under Gmail's 102 KB clip limit.
    html = stripBase64Images(htmlBody);
  } else {
    html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px">
${plainToHtml(body)}
</body>
</html>`;
  }

  const payload: Parameters<Resend['emails']['send']>[0] = {
    from,
    to,
    subject,
    html,
  };

  // Only add plain-text fallback for AI-generated emails (no htmlBody).
  // For HTML templates the text field is omitted — the stripped HTML above is enough.
  if (!htmlBody) {
    payload.text = body;
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) throw new Error(error.message);
  return data;
}
