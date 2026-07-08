import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { sendEmail } from '@/lib/resend';
import { generateEmailBody, buildSubject } from '@/lib/generateEmail';
import { Lead, Service, JourneyStep } from '@/types';

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

  if (!services || services.length === 0) {
    return Response.json({ ok: true, sent: 0, message: 'No services with auto-send enabled' });
  }

  // Pre-load all templates for these services
  const { data: allTemplates } = await supabase
    .from('email_templates')
    .select('*')
    .in('service_id', services.map((s: { id: string }) => s.id));

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

  // Load sent_emails — ordered oldest-first so sentCountByLead accumulates correctly
  // and lastSentAtByLead captures the most-recent send
  const { data: sentRows } = await supabase
    .from('sent_emails')
    .select('lead_id, sent_at')
    .not('lead_id', 'is', null)
    .order('sent_at', { ascending: true });

  type SentRow = { lead_id: string; sent_at: string };

  const sentCountByLead = new Map<string, number>();
  const lastSentAtByLead = new Map<string, Date>();

  for (const r of (sentRows ?? []) as SentRow[]) {
    sentCountByLead.set(r.lead_id, (sentCountByLead.get(r.lead_id) ?? 0) + 1);
    // Overwrite each time — last write wins because rows are ascending by sent_at
    lastSentAtByLead.set(r.lead_id, new Date(r.sent_at));
  }

  const alreadySentLeadIds = new Set(sentCountByLead.keys());

  /* ─── Strategy helpers ─────────────────────────────────────────────── */

  function daysSince(leadId: string): number {
    const last = lastSentAtByLead.get(leadId);
    if (!last) return Infinity;
    return (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  }

  /**
   * Walk the journey steps for a lead given how many sends they've already received.
   * Returns { template, blocked } where:
   *   blocked = true  → a wait step hasn't elapsed yet, skip this lead
   *   template = null + blocked = false → journey is complete, skip this lead
   *   template = TemplateRow → send this template next
   */
  function resolveJourneyStep(
    steps: JourneyStep[],
    leadId: string,
    sendsDoneTotal: number
  ): { template: TemplateRow | null; blocked: boolean } {
    const elapsed = daysSince(leadId);
    let sendsDone = 0;

    for (const step of steps) {
      if (step.type === 'wait') {
        // This wait applies to the gap after `sendsDone` sends have been completed
        if (sendsDone === sendsDoneTotal) {
          if (elapsed < step.days) {
            return { template: null, blocked: true }; // still inside wait window
          }
          // Wait has elapsed — continue to find the next send step
        }
      } else {
        // send step
        if (sendsDone === sendsDoneTotal) {
          // This is the next step to execute
          const template = step.templateId ? (templatesById.get(step.templateId) ?? null) : null;
          return { template, blocked: false };
        }
        sendsDone++;
      }
    }

    // All steps exhausted — journey complete for this lead
    return { template: null, blocked: false };
  }

  function pickTemplate(
    service: Service,
    leadId: string,
    leadSentCount: number
  ): { template: TemplateRow | null; blocked: boolean } {
    const strategy = service.email_strategy ?? 'single';

    if (strategy === 'single') {
      const t = service.email_template_id
        ? (templatesById.get(service.email_template_id) ?? null)
        : (templatesByService.get(service.id)?.[0] ?? null);
      return { template: t, blocked: false };
    }

    if (strategy === 'random') {
      const pool = (service.email_sequence ?? [])
        .map(id => templatesById.get(id))
        .filter(Boolean) as TemplateRow[];
      const src = pool.length > 0 ? pool : (templatesByService.get(service.id) ?? []);
      const t = src.length > 0 ? src[Math.floor(Math.random() * src.length)] : null;
      return { template: t, blocked: false };
    }

    if (strategy === 'sequence') {
      const seq = service.email_sequence ?? [];
      if (seq.length === 0) return { template: templatesByService.get(service.id)?.[0] ?? null, blocked: false };
      const tid = seq[leadSentCount % seq.length];
      return { template: tid ? (templatesById.get(tid) ?? null) : null, blocked: false };
    }

    if (strategy === 'journey') {
      const steps: JourneyStep[] = service.email_journey ?? [];
      return resolveJourneyStep(steps, leadId, leadSentCount);
    }

    return { template: null, blocked: false };
  }

  /* ─── Per-service processing ───────────────────────────────────────── */

  let totalSent = 0;
  let totalFailed = 0;
  const errors: string[] = [];
  const report: { service: string; sent: number; skipped: number }[] = [];

  for (const service of services as Service[]) {
    const strategy = service.email_strategy ?? 'single';
    const limit = service.max_emails_per_day ?? 10;
    const isMultiStep = strategy === 'sequence' || strategy === 'journey';

    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('service_id', service.id)
      .neq('status', 'archived')
      .order('score', { ascending: false })
      .limit(limit * 3);

    if (!leads || leads.length === 0) {
      report.push({ service: service.name, sent: 0, skipped: 0 });
      continue;
    }

    // Filter leads eligible for sending this run
    const pendingLeads = (leads as Lead[]).filter(l => {
      // single/random: one email ever
      if (!isMultiStep && alreadySentLeadIds.has(l.id)) return false;

      // journey: skip if inside a wait window or journey complete
      if (strategy === 'journey') {
        const sentCount = sentCountByLead.get(l.id) ?? 0;
        const { blocked, template } = resolveJourneyStep(service.email_journey ?? [], l.id, sentCount);
        if (blocked) return false;       // still waiting
        if (template === null) return false; // journey done
      }

      return true;
    }).slice(0, limit);

    let serviceSent = 0;
    let serviceSkipped = 0;

    for (const lead of pendingLeads) {
      if (!lead.email && !testRecipient) { serviceSkipped++; continue; }

      try {
        const leadSentCount = sentCountByLead.get(lead.id) ?? 0;
        const { template: pickedTemplate, blocked } = pickTemplate(service, lead.id, leadSentCount);

        // Shouldn't happen after filtering, but guard anyway
        if (blocked) { serviceSkipped++; continue; }

        let body: string;
        let subject: string;
        let htmlBody: string | null = null;

        if (pickedTemplate) {
          const fill = (s: string) => s
            .replace(/\{\{lead_name\}\}/g,    lead.name)
            .replace(/\{\{lead_address\}\}/g, lead.address ?? '')
            .replace(/\{\{lead_phone\}\}/g,   lead.phone ?? '')
            .replace(/\{\{lead_email\}\}/g,   lead.email ?? '')
            .replace(/\{\{service_name\}\}/g, service.name);
          body    = fill(pickedTemplate.body);
          subject = fill(pickedTemplate.subject);
          htmlBody = pickedTemplate.html_body ? fill(pickedTemplate.html_body) : null;
        } else if (lead.generated_email) {
          body    = lead.generated_email;
          subject = buildSubject(lead, service);
        } else {
          body    = await generateEmailBody(lead, service, from);
          subject = buildSubject(lead, service);
          await supabase.from('leads').update({ generated_email: body }).eq('id', lead.id);
        }

        const to = testRecipient ?? lead.email!;
        await sendEmail({ from, to, subject, body, htmlBody });

        const { data: company } = await supabase
          .from('companies').select('id').eq('id', service.company_id).single();

        if (company) {
          await supabase.from('sent_emails').insert({
            company_id:  company.id,
            lead_id:     lead.id,
            service_id:  service.id,
            lead_name:   lead.name,
            lead_email:  to,
            subject,
            body,
          });
        }

        // Update in-memory tracking so later leads in same run see fresh counts
        const newCount = (sentCountByLead.get(lead.id) ?? 0) + 1;
        sentCountByLead.set(lead.id, newCount);
        lastSentAtByLead.set(lead.id, new Date());
        alreadySentLeadIds.add(lead.id);

        serviceSent++;
        totalSent++;

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
