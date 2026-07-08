import { NextRequest } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fetchGmailInboxReplies } from '@/lib/gmail';
import { upsertGhlContact, parseName } from '@/lib/ghl';

/**
 * Cron: runs every hour, finds companies with:
 *  1. A GHL integration configured
 *  2. Gmail OAuth token
 * Then for each new reply from known leads, pushes a contact to GHL.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all companies that have a GHL integration configured
  const { data: integrations } = await admin
    .from('integrations')
    .select('company_id, config')
    .eq('provider', 'ghl');

  if (!integrations || integrations.length === 0) {
    return Response.json({ ok: true, pushed: 0, message: 'No GHL integrations configured' });
  }

  let totalPushed = 0;
  const errors: string[] = [];

  for (const integration of integrations) {
    const { company_id, config } = integration;
    const apiKey: string = config?.api_key;
    if (!apiKey) continue;

    try {
      // Get Gmail refresh token for this company's user
      const { data: company } = await admin
        .from('companies')
        .select('user_id')
        .eq('id', company_id)
        .single();
      if (!company) continue;

      const { data: tokenRow } = await admin
        .from('oauth_tokens')
        .select('refresh_token')
        .eq('user_id', company.user_id)
        .single();
      if (!tokenRow?.refresh_token) continue;

      // Get lead emails this company has contacted
      const { data: sentRows } = await admin
        .from('sent_emails')
        .select('lead_email')
        .eq('company_id', company_id)
        .not('lead_email', 'is', null);

      const leadEmails = [
        ...new Set((sentRows ?? []).map((r: { lead_email: string }) => r.lead_email).filter(Boolean)),
      ] as string[];
      if (leadEmails.length === 0) continue;

      // Fetch inbox replies from leads
      const replies = await fetchGmailInboxReplies(tokenRow.refresh_token, leadEmails);
      if (replies.length === 0) continue;

      // Get already-pushed message IDs for this company
      const { data: pushed } = await admin
        .from('ghl_pushes')
        .select('gmail_message_id')
        .eq('company_id', company_id);

      const alreadyPushed = new Set((pushed ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id));

      // Push new replies to GHL
      for (const reply of replies) {
        if (alreadyPushed.has(reply.id)) continue;

        try {
          const { firstName, lastName } = parseName(reply.fromName || reply.fromEmail);
          const result = await upsertGhlContact(apiKey, {
            email: reply.fromEmail,
            firstName,
            lastName,
            tags: ['LeadRadar', 'Email Reply'],
            source: 'LeadRadar',
          });

          await admin.from('ghl_pushes').insert({
            company_id,
            gmail_message_id: reply.id,
            ghl_contact_id: result.contact?.id ?? null,
          });

          totalPushed++;
        } catch (err) {
          errors.push(`${reply.fromEmail}: ${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    } catch (err) {
      errors.push(`Company ${company_id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return Response.json({ ok: true, totalPushed, errors });
}
