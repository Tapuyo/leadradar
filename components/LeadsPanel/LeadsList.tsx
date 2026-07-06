'use client';

import { useState, useMemo } from 'react';
import { Lead, Service } from '@/types';
import LeadCard from './LeadCard';
import LeadFilters from './LeadFilters';

interface LeadsListProps {
  leads: Lead[];
  selectedService: Service | null;
  selectedLeadId: string | null;
  isScanning: boolean;
  onLeadSelect: (lead: Lead) => void;
}

export default function LeadsList({ leads, selectedService, selectedLeadId, isScanning, onLeadSelect }: LeadsListProps) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    return leads.filter(lead => {
      if (!showArchived && lead.status === 'archived') return false;
      if (search && !lead.name.toLowerCase().includes(search.toLowerCase()) &&
          !lead.address?.toLowerCase().includes(search.toLowerCase())) return false;
      if (source && lead.source !== source) return false;
      if (status && lead.status !== status) return false;
      return true;
    });
  }, [leads, search, source, status, showArchived]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-[#1e2d4a]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#8899bb] uppercase tracking-wider">Leads</h3>
          {isScanning && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-xs text-[#22c55e]">Scanning...</span>
            </div>
          )}
          {!isScanning && selectedService && (
            <span className="text-xs text-[#8899bb]">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {selectedService && (
        <LeadFilters
          search={search}
          source={source}
          status={status}
          showArchived={showArchived}
          onSearch={setSearch}
          onSource={setSource}
          onStatus={setStatus}
          onToggleArchived={() => setShowArchived(v => !v)}
        />
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {!selectedService ? (
          <div className="flex items-center justify-center h-full px-4">
            <p className="text-[#8899bb] text-sm text-center">Select a service from the left panel</p>
          </div>
        ) : isScanning && leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <div className="w-8 h-8 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8899bb] text-sm text-center">Discovering leads...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <p className="text-[#8899bb] text-sm text-center">
              {leads.length === 0
                ? 'Run a scan to discover leads for this service →'
                : 'No leads match your filters'}
            </p>
          </div>
        ) : (
          filtered.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isSelected={selectedLeadId === lead.id}
              onClick={() => onLeadSelect(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
}
