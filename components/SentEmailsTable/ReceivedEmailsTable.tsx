'use client';

import React, { useState, useEffect } from 'react';
import { Service } from '@/types';
import { GmailMessage } from '@/lib/gmail';

interface ReceivedEmailsTableProps {
  selectedService: Service | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export default function ReceivedEmailsTable({ selectedService }: ReceivedEmailsTableProps) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ msg: string; needsAuth?: boolean; needsReauth?: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = selectedService
      ? `/api/received-emails?service_id=${selectedService.id}`
      : '/api/received-emails';

    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.received) {
          setMessages(d.received);
        } else {
          setError({
            msg: d.error ?? 'Failed to load',
            needsAuth: d.needs_auth,
            needsReauth: d.needs_reauth,
          });
        }
      })
      .catch(() => setError({ msg: 'Network error' }))
      .finally(() => setLoading(false));
  }, [selectedService]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8899bb] text-sm">
        <div className="w-5 h-5 border border-[#2563eb] border-t-transparent rounded-full animate-spin mr-2" />
        Checking inbox…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-4xl opacity-30">📭</div>
        <p className="text-[#8899bb] text-sm">{error.msg}</p>
        {(error.needsAuth || error.needsReauth) && (
          <a
            href="/api/auth/gmail"
            className="px-4 py-2 bg-[#1a4b8c] hover:bg-[#2563eb] text-white text-sm rounded-lg transition-colors"
          >
            {error.needsReauth ? 'Reconnect Gmail' : 'Connect Gmail'}
          </a>
        )}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <div className="text-4xl opacity-30">📬</div>
        <p className="text-[#8899bb] text-sm">No replies yet.</p>
        <p className="text-[#4a5a7a] text-xs">
          When leads reply to your emails, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[#1e2d4a]">
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider w-4" />
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">From</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Subject</th>
            <th className="pb-2 pr-4 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Preview</th>
            <th className="pb-2 text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Received</th>
          </tr>
        </thead>
        <tbody>
          {messages.map(msg => (
            <React.Fragment key={msg.id}>
              <tr
                onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                className="border-b border-[#1e2d4a] hover:bg-[#1a4b8c]/10 cursor-pointer transition-colors"
              >
                {/* Unread dot */}
                <td className="py-3 pr-2">
                  {msg.isUnread && (
                    <span className="block w-2 h-2 rounded-full bg-[#2563eb] mx-auto" />
                  )}
                </td>
                <td className="py-3 pr-4 max-w-[180px]">
                  <p className={`truncate ${msg.isUnread ? 'text-[#e8edf5] font-semibold' : 'text-[#8899bb]'}`}>
                    {msg.fromName}
                  </p>
                  <p className="text-xs text-[#4a5a7a] truncate">{msg.fromEmail}</p>
                </td>
                <td className={`py-3 pr-4 truncate max-w-[200px] ${msg.isUnread ? 'text-[#e8edf5] font-medium' : 'text-[#8899bb]'}`}>
                  {msg.subject || '(no subject)'}
                </td>
                <td className="py-3 pr-4 text-[#4a5a7a] truncate max-w-[260px] text-xs">
                  {msg.snippet}
                </td>
                <td className="py-3 text-[#4a5a7a] whitespace-nowrap text-xs">
                  {formatDate(msg.date)}
                </td>
              </tr>

              {expandedId === msg.id && (
                <tr className="border-b border-[#1e2d4a] bg-[#0f1626]">
                  <td colSpan={5} className="px-4 py-4">
                    <p className="text-xs text-[#4a5a7a] mb-2">
                      From <span className="text-[#8899bb]">{msg.fromName}</span>{' '}
                      &lt;{msg.fromEmail}&gt;
                    </p>
                    <p className="text-xs text-[#8899bb] leading-relaxed whitespace-pre-wrap mb-3">
                      {msg.snippet}
                    </p>
                    <a
                      href={msg.gmailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-[#2563eb] hover:underline"
                    >
                      Open full email in Gmail ↗
                    </a>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
