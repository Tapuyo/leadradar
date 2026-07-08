'use client';

import { useState, useEffect } from 'react';
import { Lead, Service, EmailTemplate } from '@/types';

interface EmailGeneratorProps {
  lead: Lead;
  service: Service;
  onEmailSaved?: (leadId: string, email: string) => void;
}

function applyVars(text: string, lead: Lead, service: Service): string {
  return text
    .replace(/\{\{lead_name\}\}/g, lead.name)
    .replace(/\{\{lead_address\}\}/g, lead.address ?? '')
    .replace(/\{\{lead_phone\}\}/g, lead.phone ?? '')
    .replace(/\{\{lead_email\}\}/g, lead.email ?? '')
    .replace(/\{\{service_name\}\}/g, service.name);
}

function defaultSubject(lead: Lead, service: Service): string {
  return `A quick note from ${service.name} for ${lead.name}`;
}

export default function EmailGenerator({ lead, service, onEmailSaved }: EmailGeneratorProps) {
  const [mode, setMode] = useState<'ai' | 'template'>('ai');

  // AI mode state
  const [aiBody, setAiBody] = useState(lead.generated_email ?? '');
  const [aiSubject, setAiSubject] = useState('');
  const [generating, setGenerating] = useState(false);

  // Template mode state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [tplSubject, setTplSubject] = useState('');

  // Shared send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    setLoadingTemplates(true);
    fetch(`/api/templates?service_id=${service.id}`)
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .finally(() => setLoadingTemplates(false));
  }, [service.id]);

  // Reset when lead changes
  useEffect(() => {
    setAiBody(lead.generated_email ?? '');
    setAiSubject('');
    setSelectedTemplate(null);
    setTplSubject('');
    setSent(false);
    setSendError('');
  }, [lead.id, lead.generated_email]);

  function switchMode(m: 'ai' | 'template') {
    setMode(m);
    setSent(false);
    setSendError('');
  }

  // ── AI generate ────────────────────────────────────────────────────────────
  async function generate() {
    setGenerating(true);
    setSent(false);
    setSendError('');
    setAiSubject('');
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, service }),
      });
      const data = await res.json();
      const body = data.email ?? '';
      setAiBody(body);
      if (body) {
        await fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generated_email: body }),
        }).then(r => r.ok && onEmailSaved?.(lead.id, body));
      }
    } catch {
      setAiBody('Failed to generate email. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ── Template select ────────────────────────────────────────────────────────
  function selectTemplate(t: EmailTemplate) {
    if (selectedTemplate?.id === t.id) {
      setSelectedTemplate(null);
      setTplSubject('');
    } else {
      setSelectedTemplate(t);
      setTplSubject(applyVars(t.subject, lead, service));
      setSent(false);
      setSendError('');
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  async function sendEmail() {
    setSending(true);
    setSendError('');

    let body: string;
    let html_body: string | null = null;
    let subject: string;

    if (mode === 'template' && selectedTemplate) {
      // Use the real HTML body — replace placeholders in both plain + HTML
      body = applyVars(selectedTemplate.body, lead, service);
      html_body = selectedTemplate.html_body
        ? applyVars(selectedTemplate.html_body, lead, service)
        : null;
      subject = tplSubject.trim() || defaultSubject(lead, service);
    } else {
      body = aiBody;
      subject = aiSubject.trim() || defaultSubject(lead, service);
    }

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.id,
        service_id: lead.service_id,
        lead_name: lead.name,
        lead_email: lead.email,
        subject,
        body,
        html_body,
      }),
    });

    const data = await res.json();
    setSending(false);
    if (!res.ok) { setSendError(data.error ?? 'Failed to send email.'); return; }
    setSent(true);
  }

  async function copyAi() {
    await navigator.clipboard.writeText(aiBody);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  const canSendAi    = mode === 'ai' && !!aiBody.trim();
  const canSendTpl   = mode === 'template' && !!selectedTemplate;
  const canSend      = canSendAi || canSendTpl;

  return (
    <div className="mt-4 border-t border-[#1e2d4a] pt-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Cold Email</span>
        {canSendAi && (
          <button onClick={copyAi} className="text-xs text-[#2563eb] hover:text-blue-400 transition-colors">
            {copying ? '✓ Copied!' : 'Copy'}
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-[#1e2d4a] mb-4 text-xs">
        <button
          onClick={() => switchMode('ai')}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === 'ai' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white hover:bg-[#1e2d4a]'
          }`}
        >
          ✦ AI Generate
        </button>
        <button
          onClick={() => switchMode('template')}
          className={`flex-1 py-2 font-medium transition-colors ${
            mode === 'template' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white hover:bg-[#1e2d4a]'
          }`}
        >
          ☰ Use Template
        </button>
      </div>

      {/* ── AI mode ──────────────────────────────────────────────────────── */}
      {mode === 'ai' && (
        <>
          {!aiBody && !generating && (
            <button
              onClick={generate}
              className="w-full py-2.5 bg-[#1a4b8c] hover:bg-[#2563eb] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mb-3"
            >
              <span>✦</span> Generate with Claude
            </button>
          )}

          {generating && (
            <div className="flex items-center gap-2 py-2 text-[#8899bb] text-sm mb-3">
              <div className="w-4 h-4 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
              Claude is writing…
            </div>
          )}

          {aiBody && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[#4a5a7a] mb-1">Subject</label>
                <input
                  type="text"
                  value={aiSubject}
                  onChange={e => setAiSubject(e.target.value)}
                  placeholder={defaultSubject(lead, service)}
                  className="w-full bg-[#0a0a1e] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] placeholder-[#4a5a7a] focus:outline-none focus:border-[#2563eb] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-[#4a5a7a] mb-1">Body</label>
                <textarea
                  value={aiBody}
                  onChange={e => setAiBody(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0a0a1e] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-xs text-[#e8edf5] leading-relaxed font-mono focus:outline-none focus:border-[#2563eb] transition-colors resize-none"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Template mode ─────────────────────────────────────────────────── */}
      {mode === 'template' && (
        <>
          {loadingTemplates ? (
            <p className="text-xs text-[#4a5a7a] py-2">Loading templates…</p>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-5 text-center bg-[#0a0a1e]/50 rounded-xl border border-dashed border-[#1e2d4a]">
              <p className="text-sm text-[#8899bb]">No templates yet</p>
              <p className="text-xs text-[#4a5a7a]">
                Create templates in <span className="text-[#2563eb]">Settings → Templates</span>
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 mb-3">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selectedTemplate?.id === t.id
                      ? 'border-[#2563eb] bg-[#1a4b8c]/20 text-[#e8edf5]'
                      : 'border-[#1e2d4a] hover:border-[#2563eb]/50 text-[#8899bb] hover:text-[#e8edf5]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium flex-1">{t.name}</span>
                    {t.html_body && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e2d4a] text-[#4a5a7a]">HTML</span>
                    )}
                    {selectedTemplate?.id === t.id && (
                      <span className="text-xs text-[#2563eb]">✓</span>
                    )}
                  </div>
                  {t.subject && (
                    <p className="text-xs text-[#4a5a7a] truncate mt-0.5">Subject: {t.subject}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Subject field — shown once a template is selected */}
          {selectedTemplate && (
            <div className="mb-3">
              <label className="block text-xs text-[#4a5a7a] mb-1">Subject</label>
              <input
                type="text"
                value={tplSubject}
                onChange={e => setTplSubject(e.target.value)}
                placeholder={defaultSubject(lead, service)}
                className="w-full bg-[#0a0a1e] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] placeholder-[#4a5a7a] focus:outline-none focus:border-[#2563eb] transition-colors"
              />
              {/* HTML template preview notice */}
              {selectedTemplate.html_body && (
                <p className="text-xs text-[#4a5a7a] mt-1.5">
                  This template uses your HTML design — it will render correctly in the recipient's inbox.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Send bar (shown when ready to send) ──────────────────────────── */}
      {canSend && (
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={sendEmail}
              disabled={!lead.email || sending || sent}
              title={!lead.email ? 'No email address for this lead' : ''}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                sent
                  ? 'bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e]'
                  : !lead.email
                  ? 'bg-[#1e2d4a] text-[#4a5a7a] cursor-not-allowed'
                  : 'bg-[#1a4b8c] hover:bg-[#2563eb] text-white disabled:opacity-50'
              }`}
            >
              {sending ? (
                <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Sending…</>
              ) : sent ? '✓ Sent' : '✉ Send Email'}
            </button>

            {mode === 'ai' && aiBody && (
              <button
                onClick={generate}
                disabled={generating}
                className="px-3 py-2 text-xs text-[#8899bb] hover:text-white border border-[#1e2d4a] hover:border-[#2563eb] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                ↻ Regenerate
              </button>
            )}
          </div>

          {!lead.email && (
            <p className="text-xs text-[#4a5a7a]">No email address on record — copy and send manually.</p>
          )}
          {sent && <p className="text-xs text-[#22c55e]">✓ Sent and recorded in Sent Emails.</p>}
          {sendError && <p className="text-xs text-red-400">{sendError}</p>}
        </div>
      )}
    </div>
  );
}
