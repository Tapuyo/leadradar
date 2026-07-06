'use client';

import { useState, useEffect } from 'react';
import { Lead, Service, EmailTemplate } from '@/types';

interface EmailGeneratorProps {
  lead: Lead;
  service: Service;
  onEmailSaved?: (leadId: string, email: string) => void;
}

function applyTemplate(body: string, lead: Lead, service: Service): string {
  return body
    .replace(/\{\{lead_name\}\}/g, lead.name)
    .replace(/\{\{lead_address\}\}/g, lead.address ?? '')
    .replace(/\{\{lead_phone\}\}/g, lead.phone ?? '')
    .replace(/\{\{lead_email\}\}/g, lead.email ?? '')
    .replace(/\{\{service_name\}\}/g, service.name);
}

function applyTemplateSubject(subject: string, lead: Lead, service: Service): string {
  return applyTemplate(subject, lead, service);
}

function extractSubject(emailBody: string, lead: Lead, service: Service): string {
  const firstLine = emailBody.split('\n').find(l => l.trim().length > 0) ?? '';
  if (firstLine.length < 80 && !firstLine.endsWith('.')) return firstLine.trim();
  return `A quick note from ${service.name} for ${lead.name}`;
}

export default function EmailGenerator({ lead, service, onEmailSaved }: EmailGeneratorProps) {
  const [email, setEmail] = useState(lead.generated_email ?? '');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [mode, setMode] = useState<'template' | 'ai'>('ai');

  // Load templates for this service
  useEffect(() => {
    fetch(`/api/templates?service_id=${service.id}`)
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); });
  }, [service.id]);

  // Sync when lead changes
  useEffect(() => {
    setEmail(lead.generated_email ?? '');
    setSubject('');
    setSent(false);
    setSendError('');
    setSelectedTemplateId('');
  }, [lead.id, lead.generated_email]);

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) { setEmail(''); setSubject(''); return; }
    const t = templates.find(t => t.id === templateId);
    if (!t) return;
    const body = applyTemplate(t.body, lead, service);
    const sub = applyTemplateSubject(t.subject, lead, service);
    setEmail(body);
    setSubject(sub);
  }

  async function saveToLead(body: string) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generated_email: body }),
    });
    if (res.ok) onEmailSaved?.(lead.id, body);
  }

  async function generate() {
    setLoading(true);
    setSent(false);
    setSendError('');
    setSelectedTemplateId('');
    setSubject('');
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, service }),
      });
      const data = await res.json();
      const body = data.email ?? '';
      setEmail(body);
      if (body) await saveToLead(body);
    } catch {
      setEmail('Failed to generate email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendEmail() {
    setSending(true);
    setSendError('');
    const finalSubject = subject || extractSubject(email, lead, service);

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.id,
        service_id: lead.service_id,
        lead_name: lead.name,
        lead_email: lead.email,
        subject: finalSubject,
        body: email,
      }),
    });

    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setSendError(data.error ?? 'Failed to send email.');
      return;
    }
    setSent(true);
  }

  const hasEmail = !!email;

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">AI Cold Email</span>
          {hasEmail && <span className="text-xs text-[#22c55e]">● saved</span>}
        </div>
        {hasEmail && (
          <button onClick={copy} className="text-xs text-[#2563eb] hover:text-blue-400 transition-colors">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        )}
      </div>

      {/* Mode toggle — only show if there are templates */}
      {templates.length > 0 && (
        <div className="flex rounded-lg overflow-hidden border border-[#1e2d4a] mb-3 text-xs">
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 py-1.5 transition-colors ${mode === 'ai' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white'}`}
          >
            ✦ Generate with Claude
          </button>
          <button
            onClick={() => setMode('template')}
            className={`flex-1 py-1.5 transition-colors ${mode === 'template' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white'}`}
          >
            ☰ Use Template
          </button>
        </div>
      )}

      {/* Template picker */}
      {mode === 'template' && templates.length > 0 && (
        <div className="mb-3">
          <select
            value={selectedTemplateId}
            onChange={e => handleTemplateSelect(e.target.value)}
            className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* AI generate button */}
      {mode === 'ai' && !hasEmail && !loading && (
        <button
          onClick={generate}
          className="w-full py-2 bg-[#1a4b8c] hover:bg-[#2563eb] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>✦</span>
          Generate Email with Claude
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2 text-[#8899bb] text-sm">
          <div className="w-4 h-4 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
          Claude is writing...
        </div>
      )}

      {/* Email preview */}
      {hasEmail && (
        <div className="relative">
          <div className="bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg p-3 text-xs text-[#e8edf5] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
            {email}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={sendEmail}
              disabled={sending || sent}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                sent
                  ? 'bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e]'
                  : 'bg-[#1a4b8c] hover:bg-[#2563eb] text-white disabled:opacity-50'
              }`}
            >
              {sending ? (
                <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Sending...</>
              ) : sent ? '✓ Email Sent' : '✉ Send Email'}
            </button>
            {mode === 'ai' && (
              <button
                onClick={generate}
                disabled={loading}
                className="text-xs text-[#8899bb] hover:text-[#2563eb] transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Regenerate
              </button>
            )}
          </div>

          {sent && <p className="mt-1.5 text-xs text-[#22c55e]">Sent and recorded in Sent Emails.</p>}
          {sendError && <p className="mt-1.5 text-xs text-red-400">{sendError}</p>}
        </div>
      )}
    </div>
  );
}
