'use client';

import { useState } from 'react';
import { Lead, Service } from '@/types';
import EmailGenerator from './EmailGenerator';

interface LeadDetailProps {
  lead: Lead;
  service: Service | null;
  onClose: () => void;
  onStatusChange: (leadId: string, status: Lead['status']) => void;
  onEmailSaved?: (leadId: string, email: string) => void;
}

const SCORE_COLOR = (score: number) =>
  score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

export default function LeadDetail({ lead, service, onClose, onStatusChange, onEmailSaved }: LeadDetailProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function updateStatus(status: Lead['status']) {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onStatusChange(lead.id, status);
    } finally {
      setUpdatingStatus(false);
    }
  }

  const scoreColor = SCORE_COLOR(lead.score);

  return (
    <div className="h-full flex flex-col px-8 pb-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: scoreColor + '22', border: `2px solid ${scoreColor}`, color: scoreColor }}
          >
            {lead.score}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#e8edf5] truncate font-space-grotesk">{lead.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs bg-[#1e2d4a] text-[#8899bb] px-2 py-0.5 rounded">{lead.source}</span>
              <span className="text-xs text-[#8899bb]">{lead.scan_date}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-[#8899bb] hover:text-white text-xl flex-shrink-0">×</button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-sm">
        {lead.address && (
          <div className="col-span-2">
            <span className="text-[#8899bb] text-xs">Address</span>
            <p className="text-[#e8edf5]">{lead.address}</p>
          </div>
        )}
        {lead.phone && (
          <div>
            <span className="text-[#8899bb] text-xs">Phone</span>
            <p><a href={`tel:${lead.phone}`} className="text-[#2563eb] hover:underline">{lead.phone}</a></p>
          </div>
        )}
        {lead.email && (
          <div>
            <span className="text-[#8899bb] text-xs">Email</span>
            <p className="truncate"><a href={`mailto:${lead.email}`} className="text-[#2563eb] hover:underline">{lead.email}</a></p>
          </div>
        )}
      </div>

      {lead.description && (
        <p className="text-sm text-[#8899bb] mb-3 leading-relaxed">{lead.description}</p>
      )}

      {lead.keywords_matched.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lead.keywords_matched.map(kw => (
            <span key={kw} className="text-xs bg-[#1a4b8c]/30 border border-[#1a4b8c] text-[#2563eb] px-2 py-0.5 rounded-full">{kw}</span>
          ))}
        </div>
      )}

      {/* Status actions */}
      <div className="flex gap-2 mb-3">
        {lead.status !== 'seen' && (
          <button
            onClick={() => updateStatus('seen')}
            disabled={updatingStatus}
            className="flex-1 py-1.5 text-xs border border-[#1e2d4a] hover:border-[#f59e0b] text-[#8899bb] hover:text-[#f59e0b] rounded-lg transition-colors disabled:opacity-50"
          >
            Mark Seen
          </button>
        )}
        {lead.status !== 'archived' && (
          <button
            onClick={() => updateStatus('archived')}
            disabled={updatingStatus}
            className="flex-1 py-1.5 text-xs border border-[#1e2d4a] hover:border-red-400 text-[#8899bb] hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
          >
            Archive
          </button>
        )}
        {lead.status !== 'new' && (
          <button
            onClick={() => updateStatus('new')}
            disabled={updatingStatus}
            className="flex-1 py-1.5 text-xs border border-[#1e2d4a] hover:border-[#22c55e] text-[#8899bb] hover:text-[#22c55e] rounded-lg transition-colors disabled:opacity-50"
          >
            Mark New
          </button>
        )}
        {lead.source_url && (
          <a
            href={lead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-1.5 text-xs border border-[#1e2d4a] hover:border-[#2563eb] text-[#8899bb] hover:text-[#2563eb] rounded-lg transition-colors text-center"
          >
            View Source ↗
          </a>
        )}
      </div>

      {service && <EmailGenerator lead={lead} service={service} onEmailSaved={onEmailSaved} />}
    </div>
  );
}
