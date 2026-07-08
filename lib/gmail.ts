import { google } from 'googleapis';

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  });
}

function plainToHtml(text: string): string {
  // Strip markdown artifacts Claude sometimes outputs
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → plain
    .replace(/\*(.*?)\*/g, '$1')       // *italic* → plain
    .replace(/^#{1,6}\s+/gm, '')       // headings → plain
    .replace(/^[-*]\s+/gm, '• ');      // bullet dashes → bullet dots

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

export async function sendGmail({
  refreshToken,
  to,
  subject,
  body,
  from,
}: {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
  from: string;
}) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const date = new Date().toUTCString();
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@gmail.com>`;
  const htmlBody = plainToHtml(body);

  // Multipart MIME — plain text + HTML. Proper headers reduce spam score significantly.
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    body,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px">
${htmlBody}
</body>
</html>`,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64url');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return res.data;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
  gmailUrl: string;
}

/**
 * Fetch inbox messages that came from any of the given email addresses.
 * Requires gmail.readonly scope — throws if the token lacks it.
 */
export async function fetchGmailInboxReplies(
  refreshToken: string,
  fromEmails: string[]
): Promise<GmailMessage[]> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Search all mail (not just inbox) so replies in threads / other labels aren't missed.
  // If we know lead emails, filter by sender; otherwise fall back to recent inbox replies.
  let query: string;
  if (fromEmails.length > 0) {
    const emailPart = fromEmails.slice(0, 40).map(e => `from:${e}`).join(' OR ');
    query = `(${emailPart}) newer_than:60d`;
  } else {
    query = 'in:inbox is:reply newer_than:14d';
  }

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  // Fetch metadata for up to 20 messages in parallel
  const details = await Promise.all(
    messages.slice(0, 20).map(m =>
      gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
    )
  );

  return details.map(d => {
    const headers = d.data.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

    const fromRaw = get('From');
    const emailMatch = fromRaw.match(/<(.+?)>/);
    const nameMatch  = fromRaw.match(/^"?([^"<]+)"?\s*</);

    return {
      id:        d.data.id!,
      threadId:  d.data.threadId!,
      fromName:  nameMatch?.[1]?.trim() ?? fromRaw,
      fromEmail: emailMatch?.[1] ?? fromRaw,
      subject:   get('Subject'),
      date:      get('Date'),
      snippet:   d.data.snippet ?? '',
      isUnread:  d.data.labelIds?.includes('UNREAD') ?? false,
      gmailUrl:  `https://mail.google.com/mail/u/0/#inbox/${d.data.id}`,
    };
  });
}
