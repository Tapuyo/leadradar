import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sendEmail } from '@/lib/resend';
import { generateEmailBody, buildSubject } from '@/lib/generateEmail';
import { Lead, Service } from '@/types';

// Called daily by Vercel cron — sends emails to leads not yet emailed
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  );

  const from = process.env.GMAIL_SENDER!;
  const testRecipient = process.env.GMAIL_TEST_RECIPIENT ?? null;

  // Only process services with auto_send enabled
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('auto_send', true);

  // Pre-load all templates for services that need them
  const { data: allTemplates } = await supabase
    .from('email_templates')
    .select('*')
    .in('service_id', (services ?? []).map((s: { id: string }) => s.id));

  type TemplateRow = { id: string; service_id: string; subject: string; body: string; html_body: string | null };
  const templatesById = new Map<string, TemplateRow>(
    (allTemplates ?? []).map((t: TemplateRow) => [t.id, t])
  );
  const templatesByService = new Map<string, TemplateRow[]>();
  for (const t of (allTemplates ?? []) as TemplateRow[]) {
    const arr = templatesByService.get(t.service_id) ?? [];
    arr.push(t);
    templatesByService.set(t.service_id, arr);
  }

  function pickTemplate(service: Service, leadSentCount: number): TemplateRow | null {
    const strategy = service.email_strategy ?? 'single';

    if (strategy === 'single') {
      if (service.email_template_id) return templatesById.get(service.email_template_id) ?? null;
      // fallback: first template for this service
      return templatesByService.get(service.id)?.[0] ?? null;
    }

    if (strategy === 'random') {
      const pool = (service.email_sequence ?? [])
        .map(id => templatesById.get(id))
        .filter(Boolean) as TemplateRow[];
      if (pool.length === 0) return templatesByService.get(service.id)?.[0] ?? null;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    if (strategy === 'sequence') {
      const seq = service.email_sequence ?? [];
      if (seq.length === 0) return templatesByService.get(service.id)?.[0] ?? null;
      const dayIndex = leadSentCount % seq.length;
      const tid = seq[dayIndex];
      return tid ? (templatesById.get(tid) ?? null) : null;
    }

    return null;
  }

  if (!services || services.length === 0) {
    return Response.json({ ok: true, sent: 0, message: 'No services with auto-send enabled' });
  }

  // Get sent_emails to track which leads have already been emailed and how many times
  const { data: sentRows } = await supabase
    .from('sent_emails')
    .select('lead_id')
    .not('lead_id', 'is', null);

  const alreadySentLeadIds = new Set((sentRows ?? []).map((r: { lead_id: string }) => r.lead_id));

  // For sequence strategy: count how many times each lead has been emailed
  const sentCountByLead = new Map<string, number>();
  for (const r of (sentRows ?? []) as { lead_id: string }[]) {
    sentCountByLead.set(r.lead_id, (sentCountByLead.get(r.lead_id) ?? 0) + 1);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const errors: string[] = [];
  const report: { service: string; sent: number; skipped: number }[] = [];

  for (const service of services as Service[]) {
    const limit = service.max_emails_per_day ?? 10;

    // Get leads for this service not yet emailed, respecting max_emails_per_day
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('service_id', service.id)
      .neq('status', 'archived')
      .order('score', { ascending: false })
      .limit(limit * 3); // fetch more than needed so we can filter already-sent

    if (!leads || leads.length === 0) {
      report.push({ service: service.name, sent: 0, skipped: 0 });
      continue;
    }

    // For sequence strategy, re-send to leads (tracking day index via sent count)
    // For single/random, skip leads already emailed
    const isSequence = (service.email_strategy ?? 'single') === 'sequence';
    const pendingLeads = (leads as Lead[])
      .filter(l => isSequence || !alreadySentLeadIds.has(l.id))
      .slice(0, limit);

    let serviceSent = 0;
    let serviceSkipped = 0;

    for (const lead of pendingLeads) {
      // Skip if no email and no test recipient
      if (!lead.email && !testRecipient) {
        serviceSkipped++;
        continue;
      }

      try {
        let body: string;
        let subject: string;
        let htmlBody: string | null = null;

        const leadSentCount = sentCountByLead.get(lead.id) ?? 0;
        const pickedTemplate = pickTemplate(service, leadSentCount);

        if (pickedTemplate) {
          const fill = (s: string) => s
            .replace(/\{\{lead_name\}\}/g, lead.name)
            .replace(/\{\{lead_address\}\}/g, lead.address ?? '')
            .replace(/\{\{lead_phone\}\}/g, lead.phone ?? '')
            .replace(/\{\{lead_email\}\}/g, lead.email ?? '')
            .replace(/\{\{service_name\}\}/g, service.name);
          body = fill(pickedTemplate.body);
          subject = fill(pickedTemplate.subject);
          htmlBody = pickedTemplate.html_body ? fill(pickedTemplate.html_body) : null;
        } else if (lead.generated_email) {
          body = lead.generated_email;
          subject = buildSubject(lead, service);
        } else {
          body = await generateEmailBody(lead, service, from);
          subject = buildSubject(lead, service);
          // Save so Claude isn't called again next time
          await supabase.from('leads').update({ generated_email: body }).eq('id', lead.id);
        }

        const to = testRecipient ?? lead.email!;

        await sendEmail({ from, to, subject, body, htmlBody });

        // Get company id for the record
        const { data: company } = await supabase
          .from('companies')
          .select('id')
          .eq('id', service.company_id)
          .single();

        if (company) {
          await supabase.from('sent_emails').insert({
            company_id: company.id,
            lead_id: lead.id,
            service_id: service.id,
            lead_name: lead.name,
            lead_email: to,
            subject,
            body,
          });
        }

        alreadySentLeadIds.add(lead.id);
        sentCountByLead.set(lead.id, (sentCountByLead.get(lead.id) ?? 0) + 1);
        serviceSent++;
        totalSent++;

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        totalFailed++;
        errors.push(`${lead.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    report.push({ service: service.name, sent: serviceSent, skipped: serviceSkipped });
  }

  return Response.json({ ok: true, totalSent, totalFailed, report, errors });
}
