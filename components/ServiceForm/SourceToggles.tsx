'use client';

interface SourceTogglesProps {
  sourceMapbox: boolean;
  sourceCraigslist: boolean;
  sourceCustom: boolean;
  customUrl: string;
  onChange: (vals: { source_mapbox?: boolean; source_craigslist?: boolean; source_custom?: boolean; custom_url?: string }) => void;
}

function Toggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-[#2563eb]' : 'bg-[#1e2d4a]'}`}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ left: checked ? '18px' : '2px' }}
        />
      </div>
      <span className="text-sm text-[#e8edf5]">{label}</span>
    </label>
  );
}

export default function SourceToggles({ sourceMapbox, sourceCraigslist, sourceCustom, customUrl, onChange }: SourceTogglesProps) {
  return (
    <div>
      <label className="block text-sm text-[#8899bb] mb-2">Lead Sources</label>
      <div className="space-y-2.5">
        <Toggle label="Google Maps (business directories)" checked={sourceMapbox} onToggle={() => onChange({ source_mapbox: !sourceMapbox })} />
        <Toggle label="Craigslist (service listings)" checked={sourceCraigslist} onToggle={() => onChange({ source_craigslist: !sourceCraigslist })} />
        <Toggle label="Custom website" checked={sourceCustom} onToggle={() => onChange({ source_custom: !sourceCustom })} />
        {sourceCustom && (
          <input
            type="url"
            value={customUrl}
            onChange={e => onChange({ custom_url: e.target.value })}
            className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm mt-1"
            placeholder="https://example.com/businesses"
          />
        )}
      </div>
    </div>
  );
}
