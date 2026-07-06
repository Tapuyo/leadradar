'use client';

import { useState } from 'react';
import { Company, Service } from '@/types';

interface SettingsPageProps {
  company: Company;
  services: Service[];
  onCompanySave: (updated: Company) => void;
  onEditService: (service: Service, tab?: 'settings' | 'email' | 'templates') => void;
  onAddService: () => void;
}

export default function SettingsPage({ company, services, onCompanySave, onEditService, onAddService }: SettingsPageProps) {
  const [companyName, setCompanyName] = useState(company.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onCompanySave(data.company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const strategyLabel = { single: 'Single Template', random: 'Random Pool', sequence: '7-Day Sequence' };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Company */}
        <section>
          <h2 className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-4">Company</h2>
          <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8899bb] mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  required
                  className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
                />
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#162035] border border-[#1e2d4a]">
                <span className="text-lg">🌐</span>
                <div>
                  <p className="text-sm font-medium text-[#e8edf5]">Google Maps</p>
                  <p className="text-xs text-[#8899bb]">Places API — business discovery provider</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Active</span>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Services */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Services</h2>
            <button
              onClick={onAddService}
              className="text-xs text-[#2563eb] hover:text-blue-400 transition-colors"
            >
              + Add Service
            </button>
          </div>

          {services.length === 0 ? (
            <div className="bg-[#0f1626] border border-dashed border-[#1e2d4a] rounded-2xl p-8 text-center">
              <p className="text-sm text-[#8899bb]">No services yet.</p>
              <button onClick={onAddService} className="mt-2 text-xs text-[#2563eb] hover:underline">
                Create your first service →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map(s => (
                <div
                  key={s.id}
                  className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-5 hover:border-[#2563eb]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#e8edf5]">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-[#4a5a7a] mt-0.5 truncate">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onEditService(s, 'settings')}
                        className="text-xs text-[#8899bb] hover:text-white border border-[#1e2d4a] hover:border-[#2563eb] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Settings
                      </button>
                      <button
                        onClick={() => onEditService(s, 'email')}
                        className="text-xs text-[#8899bb] hover:text-white border border-[#1e2d4a] hover:border-[#2563eb] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Email Strategy
                      </button>
                      <button
                        onClick={() => onEditService(s, 'templates')}
                        className="text-xs text-[#8899bb] hover:text-white border border-[#1e2d4a] hover:border-[#2563eb] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Templates
                      </button>
                    </div>
                  </div>

                  {/* Quick stats row */}
                  <div className="mt-4 flex items-center gap-5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.auto_send ? 'bg-[#22c55e]' : 'bg-[#4a5a7a]'}`} />
                      <span className="text-xs text-[#8899bb]">
                        Auto-send {s.auto_send ? 'on' : 'off'}
                      </span>
                    </div>
                    <div className="text-xs text-[#4a5a7a]">
                      Max <span className="text-[#8899bb]">{s.max_emails_per_day}</span> emails/day
                    </div>
                    <div className="text-xs text-[#4a5a7a]">
                      Max <span className="text-[#8899bb]">{s.max_leads}</span> leads
                    </div>
                    <div className="text-xs text-[#4a5a7a]">
                      Strategy: <span className="text-[#8899bb]">{strategyLabel[s.email_strategy] ?? 'Single Template'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.scan_enabled ? 'bg-[#2563eb]' : 'bg-[#4a5a7a]'}`} />
                      <span className="text-xs text-[#8899bb]">
                        Auto-scan {s.scan_enabled ? `at ${s.scan_time}` : 'off'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
