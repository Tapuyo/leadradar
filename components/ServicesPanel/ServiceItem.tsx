'use client';

import { Service } from '@/types';

interface ServiceItemProps {
  service: Service;
  leadCount: number;
  isSelected: boolean;
  isScanning: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onScanNow: () => void;
  onDelete: () => void;
}

const COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ServiceItem({ service, leadCount, isSelected, isScanning, onSelect, onEdit, onScanNow, onDelete }: ServiceItemProps) {
  const colorIndex = service.name.charCodeAt(0) % COLORS.length;
  const color = COLORS[colorIndex];

  return (
    <div
      onClick={onSelect}
      className={`mx-2 mb-1 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${
        isSelected ? 'bg-[#162035] border border-[#2563eb]/40' : 'hover:bg-[#162035] border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          {isScanning && (
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.6 }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#e8edf5] truncate">{service.name}</p>
          {service.last_scanned_at && (
            <p className="text-xs text-[#8899bb]">
              {new Date(service.last_scanned_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs bg-[#1e2d4a] text-[#8899bb] px-2 py-0.5 rounded-full">{leadCount}</span>
          <div className="hidden group-hover:flex gap-1">
            <button
              onClick={e => { e.stopPropagation(); onScanNow(); }}
              className="text-[#8899bb] hover:text-[#2563eb] transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-[#1e2d4a]"
              title="Scan now"
            >
              ⟳
            </button>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="text-[#8899bb] hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-[#1e2d4a]"
              title="Edit"
            >
              ✎
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="text-[#8899bb] hover:text-red-400 transition-colors text-xs px-1.5 py-0.5 rounded hover:bg-[#1e2d4a]"
              title="Delete service and all its leads"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
