'use client';

import { useState, useEffect } from 'react';
import { EmailTemplate } from '@/types';

interface EmailStrategySettingsProps {
  serviceId: string;
  strategy: 'single' | 'random' | 'sequence';
  templateId: string | null;
  sequence: string[];
  onChange: (updates: {
    email_strategy: 'single' | 'random' | 'sequence';
    email_template_id: string | null;
    email_sequence: string[];
  }) => void;
}

const MAX_SEQUENCE_DAYS = 7;

const STRATEGY_INFO = {
  single: 'Same template is used for every email sent to leads.',
  random: 'A random template from your selected pool is chosen each time.',
  sequence: 'Templates are sent in order — Day 1, Day 2... up to 7 days. Leads cycle through the sequence.',
};

export default function EmailStrategySettings({
  serviceId,
  strategy,
  templateId,
  sequence,
  onChange,
}: EmailStrategySettingsProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/templates?service_id=${serviceId}`)
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .finally(() => setLoading(false));
  }, [serviceId]);

  function setStrategy(s: 'single' | 'random' | 'sequence') {
    onChange({ email_strategy: s, email_template_id: templateId, email_sequence: sequence });
  }

  function setSingleTemplate(id: string) {
    onChange({ email_strategy: strategy, email_template_id: id || null, email_sequence: sequence });
  }

  function togglePoolTemplate(id: string) {
    const next = sequence.includes(id)
      ? sequence.filter(t => t !== id)
      : [...sequence, id];
    onChange({ email_strategy: strategy, email_template_id: templateId, email_sequence: next });
  }

  function setSequenceDay(dayIndex: number, templateId: string) {
    const next = [...sequence];
    // Extend array if needed
    while (next.length <= dayIndex) next.push('');
    next[dayIndex] = templateId;
    onChange({ email_strategy: strategy, email_template_id: null, email_sequence: next });
  }

  function moveDay(index: number, direction: 'up' | 'down') {
    const next = [...sequence];
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange({ email_strategy: strategy, email_template_id: null, email_sequence: next });
  }

  function addDay() {
    if (sequence.length >= MAX_SEQUENCE_DAYS) return;
    onChange({ email_strategy: strategy, email_template_id: null, email_sequence: [...sequence, ''] });
  }

  function removeDay(index: number) {
    onChange({ email_strategy: strategy, email_template_id: null, email_sequence: sequence.filter((_, i) => i !== index) });
  }

  if (loading) return <p className="text-xs text-[#4a5a7a] py-2">Loading templates...</p>;

  if (templates.length === 0) {
    return (
      <div className="text-center py-6 border border-dashed border-[#1e2d4a] rounded-xl">
        <p className="text-sm text-[#8899bb]">No templates yet for this service.</p>
        <p className="text-xs text-[#4a5a7a] mt-1">Go to the Templates tab to create some first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strategy picker */}
      <div className="grid grid-cols-3 gap-2">
        {(['single', 'random', 'sequence'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStrategy(s)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              strategy === s
                ? 'border-[#2563eb] bg-[#1a4b8c]/20 text-white'
                : 'border-[#1e2d4a] text-[#8899bb] hover:border-[#2563eb]/40 hover:text-white'
            }`}
          >
            <p className="text-sm font-medium capitalize">{s === 'sequence' ? '7-Day Sequence' : s === 'single' ? 'Single' : 'Random'}</p>
            <p className="text-xs text-[#4a5a7a] mt-0.5 leading-snug">
              {s === 'single' ? 'One template' : s === 'random' ? 'Random pool' : 'Drip campaign'}
            </p>
          </button>
        ))}
      </div>

      <p className="text-xs text-[#4a5a7a]">{STRATEGY_INFO[strategy]}</p>

      {/* Single */}
      {strategy === 'single' && (
        <div>
          <label className="block text-xs text-[#8899bb] mb-1.5">Template to use</label>
          <select
            value={templateId ?? ''}
            onChange={e => setSingleTemplate(e.target.value)}
            className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
          >
            <option value="">Select a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Random pool */}
      {strategy === 'random' && (
        <div>
          <label className="block text-xs text-[#8899bb] mb-2">Templates in pool ({sequence.length} selected)</label>
          <div className="space-y-2">
            {templates.map(t => {
              const checked = sequence.includes(t.id);
              return (
                <label key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checked ? 'border-[#2563eb] bg-[#1a4b8c]/10' : 'border-[#1e2d4a] hover:border-[#2563eb]/40'
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePoolTemplate(t.id)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    checked ? 'bg-[#2563eb] border-[#2563eb]' : 'border-[#1e2d4a]'
                  }`}>
                    {checked && <span className="text-white text-xs leading-none">✓</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#e8edf5] truncate">{t.name}</p>
                    <p className="text-xs text-[#4a5a7a] truncate">{t.subject}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 7-Day sequence */}
      {strategy === 'sequence' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-[#8899bb]">Email sequence ({sequence.length}/{MAX_SEQUENCE_DAYS} days)</label>
            {sequence.length < MAX_SEQUENCE_DAYS && (
              <button
                type="button"
                onClick={addDay}
                className="text-xs text-[#2563eb] hover:text-blue-400 transition-colors"
              >
                + Add Day
              </button>
            )}
          </div>
          <div className="space-y-2">
            {sequence.length === 0 && (
              <button
                type="button"
                onClick={addDay}
                className="w-full py-3 border border-dashed border-[#1e2d4a] rounded-lg text-xs text-[#4a5a7a] hover:border-[#2563eb]/40 hover:text-[#8899bb] transition-colors"
              >
                + Add Day 1
              </button>
            )}
            {sequence.map((tid, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Day badge */}
                <div className="w-14 text-center flex-shrink-0">
                  <span className="text-xs font-semibold text-[#2563eb] bg-[#1a4b8c]/20 px-2 py-1 rounded-full">
                    Day {i + 1}
                  </span>
                </div>

                {/* Template picker */}
                <select
                  value={tid}
                  onChange={e => setSequenceDay(i, e.target.value)}
                  className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb] min-w-0"
                >
                  <option value="">Skip this day</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {/* Move up/down */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveDay(i, 'up')}
                    disabled={i === 0}
                    className="text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs leading-none px-1"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDay(i, 'down')}
                    disabled={i === sequence.length - 1}
                    className="text-[#4a5a7a] hover:text-white disabled:opacity-20 text-xs leading-none px-1"
                  >
                    ▼
                  </button>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeDay(i)}
                  className="text-[#4a5a7a] hover:text-red-400 transition-colors text-sm flex-shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {sequence.length > 0 && (
            <p className="text-xs text-[#4a5a7a] mt-2">
              After Day {sequence.length}, the sequence repeats from Day 1.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
