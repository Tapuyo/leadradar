'use client';

import { useState, useEffect } from 'react';
import { SentEmail, Service } from '@/types';

interface SentEmailsTableProps {
  selectedService: Service | null;
}

export default function SentEmailsTable({ selectedService }: SentEmailsTableProps) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = selectedService
      ? `/api/sent-emails?service_id=${selectedService.id}`
      : '/api/sent-emails';

    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.sent_emails) setEmails(d.sent_emails); })
      .finally(() => setLoading(false));
  }, [selectedService]);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8899bb] text-sm">
        <div className="w-5 h-5 border border-[#2563eb] border-t-transparent rounded-full animate-spin mr-2" />
        Loading sent emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <div className="text-4xl opacity-30">✉</div>
        <p className="text-[#8899bb] text-sm">No emails sent yet.</p>
        <p className="text-[#4a5a7a] text-xs">Generate an email from a lead and click "Send Email" to record it here.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[#1e2d4a]">
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Lead</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Email Address</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Subject</th>
            <th className="pb-2 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Sent At</th>
          </tr>
        </thead>
        <tbody>
          {emails.map(e => (
            <>
              <tr
                key={e.id}
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                className="border-b border-[#1e2d4a] hover:bg-[#1a4b8c]/10 cursor-pointer transition-colors"
              >
                <td className="py-3 pr-4 text-[#e8edf5] font-medium truncate max-w-[160px]">{e.lead_name}</td>
                <td className="py-3 pr-4 max-w-[180px]">
                  {e.lead_email ? (
                    <a
                      href={`mailto:${e.lead_email}`}
                      onClick={ev => ev.stopPropagation()}
                      className="text-[#2563eb] hover:underline truncate block"
                    >
                      {e.lead_email}
                    </a>
                  ) : (
                    <span className="text-[#4a5a7a]">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-[#8899bb] truncate max-w-[220px]">{e.subject ?? '—'}</td>
                <td className="py-3 text-[#4a5a7a] whitespace-nowrap text-xs">{formatDate(e.sent_at)}</td>
              </tr>
              {expandedId === e.id && (
                <tr key={`${e.id}-body`} className="border-b border-[#1e2d4a] bg-[#0f1626]">
                  <td colSpan={4} className="px-4 py-3">
                    <pre className="text-xs text-[#e8edf5] whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {e.body}
                    </pre>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
