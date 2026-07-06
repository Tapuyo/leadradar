'use client';

import { Lead } from '@/types';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  craigslist: 'Craigslist',
  custom: 'Custom',
};

const STATUS_COLORS: Record<string, string> = {
  new: '#22c55e',
  seen: '#f59e0b',
  archived: '#8899bb',
};

export default function LeadCard({ lead, isSelected, onClick }: LeadCardProps) {
  const scoreColor = lead.score >= 80 ? '#22c55e' : lead.score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div
      onClick={onClick}
      className={`mx-2 mb-1.5 p-3 rounded-xl cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#162035] border border-[#2563eb]/50 shadow-lg shadow-blue-900/20'
          : 'bg-[#0f1626] border border-[#1e2d4a] hover:border-[#2563eb]/30 hover:bg-[#162035]'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white mt-0.5"
          style={{ background: scoreColor + '33', border: `1.5px solid ${scoreColor}`, color: scoreColor }}
        >
          {lead.score}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#e8edf5] truncate">{lead.name}</p>
          {lead.address && (
            <p className="text-xs text-[#8899bb] truncate mt-0.5">{lead.address}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-xs bg-[#1e2d4a] text-[#8899bb] px-1.5 py-0.5 rounded">
              {SOURCE_LABELS[lead.source]}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: STATUS_COLORS[lead.status] + '22', color: STATUS_COLORS[lead.status] }}
            >
              {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
