'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Company } from '@/types';

interface SettingsModalProps {
  company: Company;
  onClose: () => void;
  onSave: (updated: Company) => void;
}

export default function SettingsModal({ company, onClose, onSave }: SettingsModalProps) {
  const [companyName, setCompanyName] = useState(company.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
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
      onSave(data.company);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl w-full max-w-md"
        >
          <div className="flex items-center justify-between p-6 border-b border-[#1e2d4a]">
            <h2 className="text-lg font-semibold font-space-grotesk text-[#e8edf5]">Settings</h2>
            <button onClick={onClose} className="text-[#8899bb] hover:text-white text-xl transition-colors">×</button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
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
                <p className="text-xs text-[#8899bb]">Places API (New) — business discovery provider</p>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Active</span>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
