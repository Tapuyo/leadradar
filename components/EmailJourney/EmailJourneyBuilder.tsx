'use client';

import { useState, useEffect, useRef } from 'react';
import { EmailTemplate, JourneyStep } from '@/types';

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function TriggerNode() {
  return (
    <div className="w-full bg-[#0a1628] border border-[#2563eb]/40 rounded-2xl p-4 flex items-center gap-3 shadow-sm shadow-[#2563eb]/10">
      <div className="w-9 h-9 rounded-xl bg-[#2563eb]/20 border border-[#2563eb]/30 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H6L8 1Z" fill="#2563eb" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#e8edf5]">Trigger</p>
        <p className="text-xs text-[#4a5a7a]">New lead enters the system</p>
      </div>
      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#2563eb]/15 text-[#2563eb] border border-[#2563eb]/20">
        Start
      </span>
    </div>
  );
}

function EndNode() {
  return (
    <div className="w-full bg-[#0f1626] border border-dashed border-[#1e2d4a] rounded-2xl p-3 flex items-center gap-3 opacity-50">
      <div className="w-9 h-9 rounded-xl bg-[#1e2d4a] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="#4a5a7a" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="2.5" fill="#4a5a7a" />
        </svg>
      </div>
      <p className="text-xs text-[#4a5a7a]">End of journey</p>
    </div>
  );
}

function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="w-px h-5 bg-[#1e2d4a]" />
      <button
        type="button"
        onClick={onAdd}
        className="w-6 h-6 rounded-full border border-[#1e2d4a] bg-[#0a0a1a] hover:border-[#2563eb]/60 hover:bg-[#1a4b8c]/20 text-[#4a5a7a] hover:text-[#2563eb] flex items-center justify-center text-sm font-light transition-all"
        title="Add step"
      >
        +
      </button>
      <div className="w-px h-5 bg-[#1e2d4a]" />
    </div>
  );
}

function AddStepMenu({
  onSelect,
  onClose,
  menuRef,
}: {
  onSelect: (type: 'send' | 'wait') => void;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, menuRef]);

  return (
    <div
      ref={menuRef as React.RefObject<HTMLDivElement>}
      className="flex items-center gap-2 py-1"
    >
      <button
        type="button"
        onClick={() => onSelect('send')}
        className="flex items-center gap-2 px-3 py-2 bg-[#0f1626] border border-[#1e2d4a] hover:border-[#2563eb]/60 hover:bg-[#1a4b8c]/20 rounded-xl text-xs text-[#8899bb] hover:text-white transition-all"
      >
        <span>✉</span> Send Email
      </button>
      <button
        type="button"
        onClick={() => onSelect('wait')}
        className="flex items-center gap-2 px-3 py-2 bg-[#0f1626] border border-[#1e2d4a] hover:border-purple-500/40 hover:bg-purple-500/10 rounded-xl text-xs text-[#8899bb] hover:text-white transition-all"
      >
        <span>⏱</span> Wait
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-white text-base transition-colors"
      >
        ×
      </button>
    </div>
  );
}

function SendEmailNode({
  step,
  index,
  total,
  templates,
  onChange,
  onRemove,
  onMove,
}: {
  step: Extract<JourneyStep, { type: 'send' }>;
  index: number;
  total: number;
  templates: EmailTemplate[];
  onChange: (patch: Partial<Extract<JourneyStep, { type: 'send' }>>) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const tpl = templates.find(t => t.id === step.templateId);

  return (
    <div className="w-full bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-4 hover:border-[#2563eb]/30 transition-colors group">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#1a4b8c]/30 border border-[#1a4b8c]/40 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">✉</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#e8edf5]">Send Email</p>
          {tpl && <p className="text-xs text-[#4a5a7a] truncate">{tpl.subject}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => onMove('up')} disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs transition-colors">▲</button>
          <button type="button" onClick={() => onMove('down')} disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs transition-colors">▼</button>
          <button type="button" onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-red-400 text-sm transition-colors">×</button>
        </div>
      </div>
      <select
        value={step.templateId}
        onChange={e => onChange({ templateId: e.target.value })}
        className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb] cursor-pointer"
      >
        <option value="">Select a template…</option>
        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {templates.length === 0 && (
        <p className="text-xs text-[#4a5a7a] mt-1.5">No templates yet — create some in the Templates tab.</p>
      )}
    </div>
  );
}

function WaitNode({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  step: Extract<JourneyStep, { type: 'wait' }>;
  index: number;
  total: number;
  onChange: (patch: Partial<Extract<JourneyStep, { type: 'wait' }>>) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  return (
    <div className="w-full bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-4 hover:border-purple-500/30 transition-colors group">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">⏱</span>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-sm font-semibold text-[#e8edf5] flex-shrink-0">Wait</p>
          <input
            type="number"
            min={1}
            max={365}
            value={step.days}
            onChange={e => onChange({ days: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-16 bg-[#162035] border border-[#1e2d4a] rounded-lg px-2 py-1 text-sm text-[#e8edf5] focus:outline-none focus:border-purple-500/60 text-center"
          />
          <p className="text-sm text-[#4a5a7a]">{step.days === 1 ? 'day' : 'days'} then continue</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" onClick={() => onMove('up')} disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs transition-colors">▲</button>
          <button type="button" onClick={() => onMove('down')} disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs transition-colors">▼</button>
          <button type="button" onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center text-[#4a5a7a] hover:text-red-400 text-sm transition-colors">×</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Builder ────────────────────────────────────────────────────────── */

interface EmailJourneyBuilderProps {
  serviceId: string;
  steps: JourneyStep[];
  onChange: (steps: JourneyStep[]) => void;
}

export default function EmailJourneyBuilder({ serviceId, steps: initialSteps, onChange }: EmailJourneyBuilderProps) {
  const [steps, setSteps] = useState<JourneyStep[]>(initialSteps);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates?service_id=${serviceId}`)
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, [serviceId]);

  // Reset when service changes
  useEffect(() => {
    setSteps(initialSteps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  function update(newSteps: JourneyStep[]) {
    setSteps(newSteps);
    onChange(newSteps);
  }

  function insertStep(at: number, step: JourneyStep) {
    const next = [...steps];
    next.splice(at, 0, step);
    update(next);
    setAddingAt(null);
  }

  function removeStep(i: number) {
    update(steps.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, patch: Partial<JourneyStep>) {
    update(steps.map((s, idx) => idx === i ? { ...s, ...patch } as JourneyStep : s));
  }

  function moveStep(i: number, dir: 'up' | 'down') {
    const next = [...steps];
    const swap = dir === 'up' ? i - 1 : i + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    update(next);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const addMenu = (at: number) => addingAt === at ? (
    <AddStepMenu
      menuRef={menuRef}
      onSelect={type => insertStep(at, type === 'send' ? { type: 'send', templateId: '' } : { type: 'wait', days: 1 })}
      onClose={() => setAddingAt(null)}
    />
  ) : (
    <Connector onAdd={() => setAddingAt(at)} />
  );

  return (
    <div className="flex flex-col items-center">
      <TriggerNode />

      {steps.map((step, i) => (
        <div key={i} className="flex flex-col items-center w-full">
          {addMenu(i)}
          {step.type === 'send' ? (
            <SendEmailNode
              step={step}
              index={i}
              total={steps.length}
              templates={templates}
              onChange={patch => updateStep(i, patch)}
              onRemove={() => removeStep(i)}
              onMove={dir => moveStep(i, dir)}
            />
          ) : (
            <WaitNode
              step={step}
              index={i}
              total={steps.length}
              onChange={patch => updateStep(i, patch)}
              onRemove={() => removeStep(i)}
              onMove={dir => moveStep(i, dir)}
            />
          )}
        </div>
      ))}

      {addMenu(steps.length)}
      <EndNode />

      {steps.length === 0 && (
        <p className="text-xs text-[#4a5a7a] mt-3 text-center">
          Click <span className="text-[#2563eb]">+</span> above to add your first step
        </p>
      )}
    </div>
  );
}
