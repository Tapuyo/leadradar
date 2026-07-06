'use client';

interface LeadFiltersProps {
  search: string;
  source: string;
  status: string;
  showArchived: boolean;
  onSearch: (v: string) => void;
  onSource: (v: string) => void;
  onStatus: (v: string) => void;
  onToggleArchived: () => void;
}

export default function LeadFilters({
  search, source, status, showArchived,
  onSearch, onSource, onStatus, onToggleArchived
}: LeadFiltersProps) {
  const selectClass = 'bg-[#162035] border border-[#1e2d4a] rounded-lg px-2 py-1.5 text-[#e8edf5] text-xs focus:outline-none focus:border-[#2563eb] appearance-none cursor-pointer';

  return (
    <div className="px-3 py-2.5 border-b border-[#1e2d4a] space-y-2">
      <input
        type="text"
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search leads..."
        className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-[#e8edf5] placeholder-[#8899bb] text-xs focus:outline-none focus:border-[#2563eb]"
      />
      <div className="flex gap-1.5">
        <select value={source} onChange={e => onSource(e.target.value)} className={selectClass}>
          <option value="">All sources</option>
          <option value="mapbox">Mapbox</option>
          <option value="craigslist">Craigslist</option>
          <option value="custom">Custom</option>
        </select>
        <select value={status} onChange={e => onStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="seen">Seen</option>
          {showArchived && <option value="archived">Archived</option>}
        </select>
        <button
          onClick={onToggleArchived}
          className={`text-xs px-2 py-1.5 rounded-lg border transition-colors ${
            showArchived
              ? 'bg-[#1e2d4a] border-[#2563eb] text-[#2563eb]'
              : 'bg-[#162035] border-[#1e2d4a] text-[#8899bb] hover:text-white'
          }`}
        >
          Archived
        </button>
      </div>
    </div>
  );
}
