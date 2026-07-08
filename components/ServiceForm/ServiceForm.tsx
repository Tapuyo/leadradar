'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Service, JourneyStep } from '@/types';
import KeywordManager from './KeywordManager';
import StateSelector from './StateSelector';
import SourceToggles from './SourceToggles';
import TemplateManager from './TemplateManager';
import EmailStrategySettings from './EmailStrategySettings';

interface ServiceFormProps {
  service?: Service | null;
  onClose: () => void;
  onSave: (service: Service) => void;
  onScanNow?: (serviceId: string) => void;
  initialTab?: 'settings' | 'email' | 'templates';
}

const DEFAULT_FORM = {
  name: '',
  description: '',
  target_states: [] as string[],
  target_cities: [] as string[],
  keywords: [] as string[],
  source_mapbox: true,
  source_craigslist: true,
  source_custom: false,
  custom_url: '',
  scan_enabled: true,
  scan_time: '08:00',
  max_leads: 100,
  max_emails_per_day: 10,
  auto_send: false,
  email_strategy: 'single' as 'single' | 'random' | 'sequence' | 'journey',
  email_template_id: null as string | null,
  email_sequence: [] as string[],
  email_journey: [] as JourneyStep[],
};

export default function ServiceForm({ service, onClose, onSave, onScanNow, initialTab }: ServiceFormProps) {
  const [form, setForm] = useState({
    name: service?.name ?? DEFAULT_FORM.name,
    description: service?.description ?? DEFAULT_FORM.description,
    target_states: service?.target_states ?? DEFAULT_FORM.target_states,
    target_cities: service?.target_cities ?? DEFAULT_FORM.target_cities,
    keywords: service?.keywords ?? DEFAULT_FORM.keywords,
    source_mapbox: service?.source_mapbox ?? DEFAULT_FORM.source_mapbox,
    source_craigslist: service?.source_craigslist ?? DEFAULT_FORM.source_craigslist,
    source_custom: service?.source_custom ?? DEFAULT_FORM.source_custom,
    custom_url: service?.custom_url ?? DEFAULT_FORM.custom_url,
    scan_enabled: service?.scan_enabled ?? DEFAULT_FORM.scan_enabled,
    scan_time: service?.scan_time ?? DEFAULT_FORM.scan_time,
    max_leads: service?.max_leads ?? DEFAULT_FORM.max_leads,
    max_emails_per_day: service?.max_emails_per_day ?? DEFAULT_FORM.max_emails_per_day,
    auto_send: service?.auto_send ?? DEFAULT_FORM.auto_send,
    email_strategy: service?.email_strategy ?? DEFAULT_FORM.email_strategy,
    email_template_id: service?.email_template_id ?? DEFAULT_FORM.email_template_id,
    email_sequence: service?.email_sequence ?? DEFAULT_FORM.email_sequence,
    email_journey: service?.email_journey ?? DEFAULT_FORM.email_journey,
  });
  const [cityInput, setCityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'templates' | 'email'>(initialTab ?? 'settings');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const method = service ? 'PATCH' : 'POST';
      const url = service ? `/api/services/${service.id}` : '/api/services';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onSave(data.service);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function addCity() {
    const city = cityInput.trim();
    if (city && !form.target_cities.includes(city)) {
      setForm(f => ({ ...f, target_cities: [...f.target_cities, city] }));
    }
    setCityInput('');
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
            <h2 className="text-lg font-semibold font-space-grotesk text-[#e8edf5]">
              {service ? 'Edit Service' : 'Add Service'}
            </h2>
            <button onClick={onClose} className="text-[#8899bb] hover:text-white transition-colors text-xl">×</button>
          </div>

          {/* Tab bar — only show extra tabs when editing an existing service */}
          {service && (
            <div className="flex border-b border-[#1e2d4a]">
              {(['settings', 'email', 'templates'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 text-sm font-medium capitalize transition-colors relative ${
                    activeTab === tab ? 'text-white' : 'text-[#4a5a7a] hover:text-[#8899bb]'
                  }`}
                >
                  {tab === 'email' ? 'Email Strategy' : tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSave} className="p-6 space-y-5">
            {/* Templates tab content */}
            {service && activeTab === 'templates' && (
              <TemplateManager serviceId={service.id} />
            )}

            {/* Email Strategy tab content */}
            {service && activeTab === 'email' && (
              <div className="space-y-4">
                <EmailStrategySettings
                  serviceId={service.id}
                  strategy={form.email_strategy}
                  templateId={form.email_template_id}
                  sequence={form.email_sequence}
                  emailJourney={form.email_journey}
                  onChange={updates => setForm(f => ({
                    ...f,
                    email_strategy: updates.email_strategy,
                    email_template_id: updates.email_template_id,
                    email_sequence: updates.email_sequence,
                    email_journey: updates.email_journey,
                  }))}
                />
                {error && (
                  <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {saving ? 'Saving...' : 'Save Email Strategy'}
                </button>
              </div>
            )}

            {/* Settings tab content — hidden (not unmounted) when on other tabs */}
            <div className={activeTab === 'settings' ? 'space-y-5' : 'hidden'}>
            <div>
              <label className="block text-sm text-[#8899bb] mb-1.5">Service Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
                placeholder="e.g. Commercial Cleaning"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8899bb] mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm resize-none"
                placeholder="Brief description of this service..."
              />
            </div>

            <StateSelector
              selected={form.target_states}
              onChange={states => setForm(f => ({ ...f, target_states: states }))}
            />

            <div>
              <label className="block text-sm text-[#8899bb] mb-1.5">Target Cities</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={cityInput}
                  onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())}
                  className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
                  placeholder="Type city and press Enter"
                />
                <button type="button" onClick={addCity} className="bg-[#162035] border border-[#1e2d4a] hover:border-[#2563eb] text-[#8899bb] hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
                  Add
                </button>
              </div>
              {form.target_cities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.target_cities.map(city => (
                    <span key={city} className="flex items-center gap-1 bg-[#1e2d4a] text-[#e8edf5] text-xs px-2.5 py-1 rounded-full">
                      {city}
                      <button type="button" onClick={() => setForm(f => ({ ...f, target_cities: f.target_cities.filter(c => c !== city) }))} className="text-[#8899bb] hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <KeywordManager
              keywords={form.keywords}
              onChange={kws => setForm(f => ({ ...f, keywords: kws }))}
              serviceName={form.name}
              serviceDescription={form.description}
            />

            <SourceToggles
              sourceMapbox={form.source_mapbox}
              sourceCraigslist={form.source_craigslist}
              sourceCustom={form.source_custom}
              customUrl={form.custom_url}
              onChange={vals => setForm(f => ({ ...f, ...vals }))}
            />

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.scan_enabled}
                  onChange={e => setForm(f => ({ ...f, scan_enabled: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${form.scan_enabled ? 'bg-[#2563eb]' : 'bg-[#1e2d4a]'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white mt-0.75 transition-transform ${form.scan_enabled ? 'translate-x-4.5' : 'translate-x-0.75'}`} style={{ marginTop: '3px', marginLeft: form.scan_enabled ? '18px' : '3px' }} />
                </div>
                <span className="text-sm text-[#e8edf5]">Auto-scan enabled</span>
              </label>
              {form.scan_enabled && (
                <input
                  type="time"
                  value={form.scan_time}
                  onChange={e => setForm(f => ({ ...f, scan_time: e.target.value }))}
                  className="bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-[#e8edf5] text-sm focus:outline-none focus:border-[#2563eb]"
                />
              )}
            </div>

            {/* Limits & Auto-send */}
            <div className="border border-[#1e2d4a] rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Limits & Automation</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#8899bb] mb-1.5">Max Leads</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={form.max_leads}
                    onChange={e => setForm(f => ({ ...f, max_leads: parseInt(e.target.value) || 100 }))}
                    className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
                  />
                  <p className="text-xs text-[#4a5a7a] mt-1">Max leads stored per scan</p>
                </div>
                <div>
                  <label className="block text-sm text-[#8899bb] mb-1.5">Max Emails / Day</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={form.max_emails_per_day}
                    onChange={e => setForm(f => ({ ...f, max_emails_per_day: parseInt(e.target.value) || 10 }))}
                    className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
                  />
                  <p className="text-xs text-[#4a5a7a] mt-1">Emails sent by daily cron</p>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_send}
                  onChange={e => setForm(f => ({ ...f, auto_send: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${form.auto_send ? 'bg-[#2563eb]' : 'bg-[#1e2d4a]'}`}>
                  <div className="w-3.5 h-3.5 rounded-full bg-white transition-transform" style={{ marginTop: '3px', marginLeft: form.auto_send ? '18px' : '3px' }} />
                </div>
                <div>
                  <p className="text-sm text-[#e8edf5]">Auto-send emails</p>
                  <p className="text-xs text-[#4a5a7a]">Daily cron sends emails to new leads automatically</p>
                </div>
              </label>
            </div>


            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {saving ? 'Saving...' : service ? 'Save Changes' : 'Create Service'}
              </button>
              {service && onScanNow && (
                <button
                  type="button"
                  onClick={() => { onScanNow(service.id); onClose(); }}
                  className="px-4 bg-[#162035] hover:bg-[#1e2d4a] border border-[#1e2d4a] text-[#e8edf5] font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  Scan Now
                </button>
              )}
            </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
