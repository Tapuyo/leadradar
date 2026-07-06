'use client';

import { useState } from 'react';
import { EmailTemplate, Service } from '@/types';

interface TemplatePreviewModalProps {
  template: EmailTemplate;
  service: Service | undefined;
  onClose: () => void;
}

const SAMPLE_LEAD = {
  name: 'Sunrise Cafe',
  address: '123 Main St, Phoenix, AZ',
  phone: '(602) 555-0192',
  email: 'hello@sunrisecafe.com',
};

function applyPlaceholders(text: string, serviceName: string): string {
  return text
    .replace(/\{\{lead_name\}\}/g, SAMPLE_LEAD.name)
    .replace(/\{\{lead_address\}\}/g, SAMPLE_LEAD.address)
    .replace(/\{\{lead_phone\}\}/g, SAMPLE_LEAD.phone)
    .replace(/\{\{lead_email\}\}/g, SAMPLE_LEAD.email)
    .replace(/\{\{service_name\}\}/g, serviceName);
}

function plainToHtml(text: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:600px;margin:0 auto;padding:24px">
${text.split('\n').map(line =>
    line.trim() === '' ? '<br>' : `<p style="margin:0 0 10px 0">${line}</p>`
  ).join('\n')}
</body>
</html>`;
}

export default function TemplatePreviewModal({ template, service, onClose }: TemplatePreviewModalProps) {
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  const serviceName = service?.name ?? 'Our Service';
  const subject = applyPlaceholders(template.subject, serviceName);
  const htmlContent = template.html_body
    ? applyPlaceholders(template.html_body, serviceName)
    : plainToHtml(applyPlaceholders(template.body, serviceName));

  async function sendTest() {
    if (!testEmail.trim()) { setSendError('Enter a test email address.'); return; }
    setSending(true);
    setSendError('');

    // Build a sample lead payload
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_name: SAMPLE_LEAD.name,
        lead_email: testEmail.trim(),
        subject,
        body: applyPlaceholders(template.body, serviceName),
        html_body: htmlContent,
        test_send: true,
      }),
    });

    const data = await res.json();
    setSending(false);
    if (!res.ok) { setSendError(data.error ?? 'Failed to send.'); return; }
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full bg-[#0f1626] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d4a] flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#e8edf5] truncate">{template.name}</p>
            <p className="text-xs text-[#4a5a7a] truncate">Subject: {subject}</p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Device toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#1e2d4a] text-xs">
              <button
                onClick={() => setDevice('desktop')}
                className={`px-3 py-1.5 transition-colors ${device === 'desktop' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white'}`}
              >
                Desktop
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`px-3 py-1.5 transition-colors ${device === 'mobile' ? 'bg-[#1a4b8c] text-white' : 'text-[#8899bb] hover:text-white'}`}
              >
                Mobile
              </button>
            </div>

            <button onClick={onClose} className="text-[#8899bb] hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden flex bg-[#1a1a2e] min-h-0">
          <div className="flex-1 overflow-auto flex items-start justify-center p-6">
            <div
              className="bg-white shadow-2xl transition-all duration-300 rounded overflow-hidden"
              style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: 680, minHeight: 400 }}
            >
              <iframe
                srcDoc={htmlContent}
                title="Email preview"
                className="w-full border-0"
                style={{ height: 600, display: 'block' }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>

        {/* Send test footer */}
        <div className="flex-shrink-0 border-t border-[#1e2d4a] px-5 py-3 flex items-center gap-3 bg-[#0f1626]">
          <p className="text-xs text-[#8899bb] flex-shrink-0">Send test to:</p>
          <input
            type="email"
            placeholder="your@email.com"
            value={testEmail}
            onChange={e => { setTestEmail(e.target.value); setSendError(''); setSent(false); }}
            className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
          />
          <button
            onClick={sendTest}
            disabled={sending || sent}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-shrink-0 ${
              sent
                ? 'bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e]'
                : 'bg-[#1a4b8c] hover:bg-[#2563eb] text-white disabled:opacity-50'
            }`}
          >
            {sending ? 'Sending...' : sent ? '✓ Sent!' : '✉ Send Test'}
          </button>
          {sendError && <p className="text-xs text-red-400 flex-shrink-0">{sendError}</p>}
          <p className="text-xs text-[#4a5a7a] flex-shrink-0">Placeholders filled with sample data</p>
        </div>
      </div>
    </div>
  );
}
