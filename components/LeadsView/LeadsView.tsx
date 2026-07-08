'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Lead, Service, EmailTemplate } from '@/types';

interface LeadsViewProps {
  leads: Lead[];
  selectedService: Service | null;
  isScanning: boolean;
  onLeadSelect: (lead: Lead) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  mapbox: 'Mapbox',
  craigslist: 'Craigslist',
  custom: 'Custom',
};

const SOURCE_COLORS: Record<string, string> = {
  google:     '#4285F4',
  mapbox:     '#2563eb',
  craigslist: '#a855f7',
  custom:     '#0891b2',
};

const STATUS_COLORS: Record<string, string> = {
  new:      '#22c55e',
  seen:     '#f59e0b',
  archived: '#8899bb',
};

function applyVars(text: string, lead: Lead, service: Service): string {
  return text
    .replace(/\{\{lead_name\}\}/g, lead.name)
    .replace(/\{\{lead_address\}\}/g, lead.address ?? '')
    .replace(/\{\{lead_phone\}\}/g, lead.phone ?? '')
    .replace(/\{\{lead_email\}\}/g, lead.email ?? '')
    .replace(/\{\{service_name\}\}/g, service.name);
}

export default function LeadsView({ leads, selectedService, isScanning, onLeadSelect }: LeadsViewProps) {
  const [search, setSearch]             = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy]             = useState<'score' | 'name' | 'date'>('score');

  // Selection
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // Templates
  const [templates, setTemplates]               = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Bulk send state
  const [isSending, setIsSending]       = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });
  const [sendResult, setSendResult]     = useState<{ sent: number; skipped: number; failed: number } | null>(null);

  // Fetch templates when service changes
  useEffect(() => {
    if (!selectedService) return;
    fetch(`/api/templates?service_id=${selectedService.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.templates) {
          setTemplates(d.templates);
          setSelectedTemplateId(d.templates[0]?.id ?? '');
        }
      });
  }, [selectedService?.id]);

  // Clear selection when service or leads change
  useEffect(() => {
    setSelectedIds(new Set());
    setSendResult(null);
  }, [selectedService?.id, leads]);

  const filtered = useMemo(() => {
    let list = [...leads];
    if (!showArchived) list = list.filter(l => l.status !== 'archived');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      );
    }
    if (filterSource) list = list.filter(l => l.source === filterSource);
    if (filterStatus) list = list.filter(l => l.status === filterStatus);

    list.sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'name')  return a.name.localeCompare(b.name);
      return new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime();
    });

    return list;
  }, [leads, search, filterSource, filterStatus, showArchived, sortBy]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
  const someSelected        = selectedIds.size > 0;
  const leadsWithEmail      = filtered.filter(l => selectedIds.has(l.id) && l.email);

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(l => next.add(l.id));
        return next;
      });
    }
    setSendResult(null);
  }

  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSendResult(null);
  }

  const sendBulk = useCallback(async () => {
    if (!selectedService || !selectedTemplateId || leadsWithEmail.length === 0) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    setIsSending(true);
    setSendResult(null);
    setSendProgress({ done: 0, total: leadsWithEmail.length });

    let sent = 0, failed = 0;

    for (const lead of leadsWithEmail) {
      try {
        const body  = applyVars(template.body, lead, selectedService);
        const html  = template.html_body ? applyVars(template.html_body, lead, selectedService) : null;
        const subj  = applyVars(template.subject, lead, selectedService);

        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            service_id: selectedService.id,
            lead_name: lead.name,
            lead_email: lead.email,
            subject: subj,
            body,
            html_body: html,
          }),
        });
        res.ok ? sent++ : failed++;
      } catch {
        failed++;
      }
      setSendProgress(p => ({ ...p, done: p.done + 1 }));
    }

    const skipped = selectedIds.size - leadsWithEmail.length; // selected but no email
    setIsSending(false);
    setSendResult({ sent, failed, skipped });
  }, [selectedService, selectedTemplateId, templates, leadsWithEmail, selectedIds.size]);

  const inputClass  = 'bg-[#0f1626] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-[#e8edf5] placeholder-[#4a5a7a] text-xs focus:outline-none focus:border-[#2563eb] transition-colors';
  const selectClass = `${inputClass} cursor-pointer appearance-none pr-6`;

  if (!selectedService) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#4a5a7a] text-sm">Select a service to view its leads</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Toolbar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[#1e2d4a] flex flex-wrap items-center gap-2">
        {/* Select-all checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none mr-1" onClick={e => e.stopPropagation()}>
          <span
            onClick={toggleAll}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
              allFilteredSelected
                ? 'bg-[#2563eb] border-[#2563eb]'
                : someSelected
                ? 'bg-[#1a4b8c] border-[#2563eb]'
                : 'border-[#1e2d4a] bg-[#0f1626] hover:border-[#2563eb]'
            }`}
          >
            {allFilteredSelected && <span className="text-white text-[10px] leading-none">✓</span>}
            {!allFilteredSelected && someSelected && <span className="text-white text-[10px] leading-none">—</span>}
          </span>
          <span className="text-xs text-[#4a5a7a]">All</span>
        </label>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, address…"
          className={`${inputClass} w-52`}
        />
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={`${selectClass} w-32`}>
          <option value="">All sources</option>
          <option value="google">Google</option>
          <option value="craigslist">Craigslist</option>
          <option value="custom">Custom</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selectClass} w-32`}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="seen">Seen</option>
          {showArchived && <option value="archived">Archived</option>}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className={`${selectClass} w-28`}>
          <option value="score">Sort: Score</option>
          <option value="name">Sort: Name</option>
          <option value="date">Sort: Date</option>
        </select>
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showArchived
              ? 'bg-[#1e2d4a] border-[#2563eb] text-[#2563eb]'
              : 'bg-[#0f1626] border-[#1e2d4a] text-[#4a5a7a] hover:text-[#e8edf5]'
          }`}
        >
          Archived
        </button>
        <span className="ml-auto text-xs text-[#4a5a7a]">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          {leads.length !== filtered.length && ` of ${leads.length}`}
        </span>
      </div>

      {/* Bulk send bar — visible when at least one lead is selected */}
      {someSelected && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-[#2563eb]/30 bg-[#1a4b8c]/20 flex flex-wrap items-center gap-3">
          <span className="text-xs text-[#8899bb]">
            <span className="text-white font-semibold">{selectedIds.size}</span> selected
            {leadsWithEmail.length < selectedIds.size && (
              <span className="text-[#4a5a7a]"> · {selectedIds.size - leadsWithEmail.length} without email (will be skipped)</span>
            )}
          </span>

          {templates.length === 0 ? (
            <span className="text-xs text-[#4a5a7a]">No templates — create one in Settings → Templates</span>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              className="bg-[#0d1526] border border-[#1e2d4a] text-[#e8edf5] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2563eb]"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.html_body ? ' (HTML)' : ''}</option>
              ))}
            </select>
          )}

          {isSending ? (
            <div className="flex items-center gap-2 text-xs text-[#8899bb]">
              <div className="w-3.5 h-3.5 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
              Sending {sendProgress.done}/{sendProgress.total}…
            </div>
          ) : (
            <button
              onClick={sendBulk}
              disabled={leadsWithEmail.length === 0 || !selectedTemplateId || templates.length === 0}
              className="ml-auto text-xs px-4 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
            >
              ✉ Send to {leadsWithEmail.length} lead{leadsWithEmail.length !== 1 ? 's' : ''}
            </button>
          )}

          {sendResult && (
            <span className={`text-xs ml-auto ${sendResult.failed > 0 ? 'text-red-400' : 'text-[#22c55e]'}`}>
              ✓ {sendResult.sent} sent
              {sendResult.skipped > 0 && ` · ${sendResult.skipped} skipped (no email)`}
              {sendResult.failed > 0 && ` · ${sendResult.failed} failed`}
            </span>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {isScanning && leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#4a5a7a] text-sm">Discovering leads…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#4a5a7a] text-sm">
              {leads.length === 0 ? 'Run a scan to discover leads for this service' : 'No leads match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                isSelected={selectedIds.has(lead.id)}
                onSelect={() => onLeadSelect(lead)}
                onToggle={() => toggleOne(lead.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  isSelected,
  onSelect,
  onToggle,
}: {
  lead: Lead;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const scoreColor =
    lead.score >= 80 ? '#00c8e0' :
    lead.score >= 50 ? '#4ade80' : '#d4c07a';

  return (
    <div
      onClick={onSelect}
      className={`relative bg-[#0f1626] border rounded-xl p-4 cursor-pointer hover:bg-[#111c30] transition-all group ${
        isSelected ? 'border-[#2563eb]' : 'border-[#1e2d4a] hover:border-[#2563eb]/40'
      }`}
    >
      {/* Checkbox — top-right corner */}
      <span
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className={`absolute top-3 right-3 w-4 h-4 rounded border flex items-center justify-center transition-colors z-10 cursor-pointer ${
          isSelected
            ? 'bg-[#2563eb] border-[#2563eb]'
            : 'border-[#1e2d4a] bg-[#0a0a1e] hover:border-[#2563eb] group-hover:border-[#2563eb]/60'
        }`}
      >
        {isSelected && <span className="text-white text-[10px] leading-none">✓</span>}
      </span>

      {/* Top row: score + name + status */}
      <div className="flex items-start gap-3 mb-3 pr-6">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: scoreColor + '22', border: `1.5px solid ${scoreColor}`, color: scoreColor }}
        >
          {lead.score}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#e8edf5] leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {lead.name}
          </p>
          {lead.address && (
            <p className="text-xs text-[#4a5a7a] mt-0.5 truncate">{lead.address}</p>
          )}
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
          style={{
            background: STATUS_COLORS[lead.status] + '22',
            color: STATUS_COLORS[lead.status],
          }}
        >
          {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
        </span>
      </div>

      {/* Contact details */}
      <div className="space-y-1.5 mb-3">
        {lead.email && (
          <div className="flex items-center gap-2">
            <span className="text-[#4a5a7a] text-xs w-3.5 flex-shrink-0">@</span>
            <span className="text-xs text-[#8899bb] truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <span className="text-[#4a5a7a] text-xs w-3.5 flex-shrink-0">✆</span>
            <span className="text-xs text-[#8899bb]">{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Footer: source + keywords */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="text-xs px-2 py-0.5 rounded font-medium"
          style={{
            background: (SOURCE_COLORS[lead.source] ?? '#2563eb') + '22',
            color: SOURCE_COLORS[lead.source] ?? '#2563eb',
          }}
        >
          {SOURCE_LABELS[lead.source] ?? lead.source}
        </span>
        {lead.keywords_matched.slice(0, 2).map(kw => (
          <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-[#1e2d4a] text-[#4a5a7a]">
            {kw}
          </span>
        ))}
        {lead.keywords_matched.length > 2 && (
          <span className="text-xs text-[#4a5a7a]">+{lead.keywords_matched.length - 2}</span>
        )}
      </div>
    </div>
  );
}
