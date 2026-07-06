'use client';

import { useEffect, useRef } from 'react';

export interface LogEntry {
  id: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
  ts: number;
}

interface ScanLogProps {
  logs: LogEntry[];
  isScanning: boolean;
}

const LEVEL_STYLES: Record<LogEntry['level'], string> = {
  info:    'text-[#8899bb]',
  success: 'text-[#22c55e]',
  warn:    'text-[#f59e0b]',
  error:   'text-[#ef4444]',
};

const LEVEL_PREFIX: Record<LogEntry['level'], string> = {
  info:    '·',
  success: '✓',
  warn:    '!',
  error:   '✗',
};

export default function ScanLog({ logs, isScanning }: ScanLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#1e2d4a] flex items-center gap-2">
        {isScanning && <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />}
        <span className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">
          {isScanning ? 'Scanning…' : 'Scan Log'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5">
        {logs.length === 0 && isScanning && (
          <p className="text-[#8899bb]">Starting scan…</p>
        )}
        {logs.map((entry) => (
          <div key={entry.id} className={`flex gap-1.5 leading-relaxed ${LEVEL_STYLES[entry.level]}`}>
            <span className="flex-shrink-0 w-3 text-center">{LEVEL_PREFIX[entry.level]}</span>
            <span className="break-all">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
