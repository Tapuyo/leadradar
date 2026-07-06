import { NextRequest } from 'next/server';
import { createOAuth2Client } from '@/lib/gmail';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  const refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;background:#0a0a1a;color:#e8edf5">
        <h2 style="color:#ef4444">No refresh token received.</h2>
        <p>Go back and try again — make sure you selected the right Google account.</p>
        <a href="/dashboard" style="color:#2563eb">Back to Dashboard</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Save refresh token to oauth_tokens table
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from('oauth_tokens')
    .upsert(
      {
        user_id: session.user.id,
        provider: 'gmail',
        refresh_token: refreshToken,
        email: process.env.GMAIL_SENDER,
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:40px;background:#0a0a1a;color:#e8edf5">
        <h2 style="color:#ef4444">Failed to save token.</h2>
        <p>${error.message}</p>
        <a href="/dashboard" style="color:#2563eb">Back to Dashboard</a>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  return new Response(
    `<html><body style="font-family:sans-serif;padding:40px;background:#0a0a1a;color:#e8edf5;text-align:center">
      <div style="margin-top:80px">
        <div style="font-size:48px;margin-bottom:16px">✓</div>
        <h2 style="color:#22c55e;margin-bottom:8px">Gmail connected!</h2>
        <p style="color:#8899bb">LeadRadar can now send emails from ${process.env.GMAIL_SENDER}</p>
        <a href="/dashboard" style="display:inline-block;margin-top:24px;padding:10px 24px;background:#2563eb;color:white;border-radius:8px;text-decoration:none">Back to Dashboard</a>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
