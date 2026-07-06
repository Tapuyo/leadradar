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

  const html = htmlBody ?? `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px">
${plainToHtml(body)}
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text: body,
    html,
  });

  if (error) throw new Error(error.message);
  return data;
}
