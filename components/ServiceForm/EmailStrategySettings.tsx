'use client';

import { useState, useEffect } from 'react';
import { EmailTemplate, JourneyStep } from '@/types';
import EmailJourneyBuilder from '@/components/EmailJourney/EmailJourneyBuilder';

interface EmailStrategySettingsProps {
  serviceId: string;
  strategy: 'single' | 'random' | 'sequence' | 'journey';
  templateId: string | null;
  sequence: string[];
  emailJourney: JourneyStep[];
  onChange: (updates: {
    email_strategy: 'single' | 'random' | 'sequence' | 'journey';
    email_template_id: string | null;
    email_sequence: string[];
    email_journey: JourneyStep[];
  }) => void;
}

const STRATEGIES = [
  { id: 'single'  as const, label: 'Single',  icon: '✉',  description: 'Same template sent to every lead' },
  { id: 'random'  as const, label: 'Random',  icon: '🎲', description: 'Random template from a pool' },
  { id: 'journey' as const, label: 'Journey', icon: '⚡', description: 'Visual drip flow with send & wait steps' },
];

export default function EmailStrategySettings({
  serviceId,
  strategy,
  templateId,
  sequence,
  emailJourney,
  onChange,
}: EmailStrategySettingsProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates?service_id=${serviceId}`)
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .finally(() => setLoading(false));
  }, [serviceId]);

  // Treat legacy 'sequence' as 'journey' in the UI
  const activeStrategy = strategy === 'sequence' ? 'journey' : strategy;

  function emit(patch: Partial<Parameters<typeof onChange>[0]>) {
    onChange({
      email_strategy: activeStrategy,
      email_template_id: templateId,
      email_sequence: sequence,
      email_journey: emailJourney,
      ...patch,
    });
  }

  function setSingleTemplate(id: string) {
    emit({ email_strategy: 'single', email_template_id: id || null });
  }

  function togglePoolTemplate(id: string) {
    const next = sequence.includes(id) ? sequence.filter(t => t !== id) : [...sequence, id];
    emit({ email_strategy: 'random', email_sequence: next });
  }

  const noTemplates = (
    <div className="py-6 border border-dashed border-[#1e2d4a] rounded-xl text-center">
      <p className="text-sm text-[#8899bb]">No templates yet.</p>
      <p className="text-xs text-[#4a5a7a] mt-1">Go to the Templates tab to create some.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Strategy picker */}
      <div>
        <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-3">Strategy</p>
        <div className="grid grid-cols-3 gap-2">
          {STRATEGIES.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => emit({ email_strategy: s.id })}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                activeStrategy === s.id
                  ? 'border-[#2563eb] bg-[#1a4b8c]/20 shadow-sm shadow-[#2563eb]/10'
                  : 'border-[#1e2d4a] hover:border-[#2563eb]/40 hover:bg-[#0f1626]'
              }`}
            >
              <span className="text-xl block mb-2">{s.icon}</span>
              <p className={`text-sm font-semibold ${activeStrategy === s.id ? 'text-white' : 'text-[#8899bb]'}`}>
                {s.label}
              </p>
              <p className="text-xs text-[#4a5a7a] mt-0.5 leading-snug">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Single ─────────────────────────────────────────────────────── */}
      {activeStrategy === 'single' && (
        <div>
          <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-3">Template</p>
          {loading ? <p className="text-xs text-[#4a5a7a]">Loading…</p>
            : templates.length === 0 ? noTemplates
            : (
              <select
                value={templateId ?? ''}
                onChange={e => setSingleTemplate(e.target.value)}
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2.5 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
              >
                <option value="">Select a template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
        </div>
      )}

      {/* ── Random ─────────────────────────────────────────────────────── */}
      {activeStrategy === 'random' && (
        <div>
          <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-3">
            Template Pool <span className="normal-case font-normal text-[#4a5a7a]">({sequence.length} selected)</span>
          </p>
          {loading ? <p className="text-xs text-[#4a5a7a]">Loading…</p>
            : templates.length === 0 ? noTemplates
            : (
              <div className="space-y-2">
                {templates.map(t => {
                  const checked = sequence.includes(t.id);
                  return (
                    <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      checked ? 'border-[#2563eb] bg-[#1a4b8c]/10' : 'border-[#1e2d4a] hover:border-[#2563eb]/40'
                    }`}>
                      <input type="checkbox" checked={checked} onChange={() => togglePoolTemplate(t.id)} className="sr-only" />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
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
            )}
        </div>
      )}

      {/* ── Journey ────────────────────────────────────────────────────── */}
      {activeStrategy === 'journey' && (
        <div>
          <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-3">Flow</p>
          <EmailJourneyBuilder
            serviceId={serviceId}
            steps={emailJourney}
            onChange={steps => emit({ email_strategy: 'journey', email_journey: steps })}
          />
        </div>
      )}
    </div>
  );
}
