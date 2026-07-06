'use client';

import { useState, useEffect } from 'react';
import { EmailTemplate } from '@/types';

interface TemplateManagerProps {
  serviceId: string;
}

const PLACEHOLDERS = [
  { tag: '{{lead_name}}', label: 'Business name' },
  { tag: '{{lead_address}}', label: 'Address' },
  { tag: '{{lead_phone}}', label: 'Phone' },
  { tag: '{{lead_email}}', label: 'Email' },
  { tag: '{{service_name}}', label: 'Your service' },
];

const BLANK = { name: '', subject: '', body: '' };

export default function TemplateManager({ serviceId }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/templates?service_id=${serviceId}`)
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .finally(() => setLoading(false));
  }, [serviceId]);

  function startCreate() {
    setForm(BLANK);
    setEditing(null);
    setCreating(true);
    setError('');
  }

  function startEdit(t: EmailTemplate) {
    setForm({ name: t.name, subject: t.subject, body: t.body });
    setEditing(t);
    setCreating(true);
    setError('');
  }

  function insertPlaceholder(tag: string) {
    setForm(f => ({ ...f, body: f.body + tag }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const res = await fetch(`/api/templates/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates(prev => prev.map(t => t.id === editing.id ? data.template : t));
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service_id: serviceId, ...form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates(prev => [...prev, data.template]);
      }
      setCreating(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <p className="text-xs text-[#4a5a7a]">Loading templates...</p>;

  if (creating) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">
            {editing ? 'Edit Template' : 'New Template'}
          </p>
          <button onClick={() => setCreating(false)} className="text-xs text-[#4a5a7a] hover:text-white">Cancel</button>
        </div>

        <input
          type="text"
          placeholder="Template name (e.g. Friendly intro)"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] text-sm focus:outline-none focus:border-[#2563eb]"
        />
        <input
          type="text"
          placeholder="Subject line"
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          className="w-full bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] text-sm focus:outline-none focus:border-[#2563eb]"
        />

        {/* Placeholder chips */}
        <div>
          <p className="text-xs text-[#4a5a7a] mb-1.5">Insert placeholder:</p>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.tag}
                type="button"
                onClick={() => insertPlaceholder(p.tag)}
                className="text-xs bg-[#1a4b8c]/30 border border-[#1a4b8c] text-[#2563eb] px-2 py-0.5 rounded-full hover:bg-[#1a4b8c]/60 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Email body... use placeholders like {{lead_name}}"
          value={form.body}
          onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          rows={7}
          className="w-full bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] text-sm focus:outline-none focus:border-[#2563eb] resize-none font-mono"
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">
          Email Templates ({templates.length})
        </p>
        <button
          type="button"
          onClick={startCreate}
          className="text-xs text-[#2563eb] hover:text-blue-400 transition-colors"
        >
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-[#1e2d4a] rounded-lg">
          <p className="text-xs text-[#4a5a7a]">No templates yet.</p>
          <button type="button" onClick={startCreate} className="text-xs text-[#2563eb] hover:underline mt-1">
            Create your first template
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg">
              <div className="min-w-0">
                <p className="text-sm text-[#e8edf5] font-medium truncate">{t.name}</p>
                <p className="text-xs text-[#4a5a7a] truncate">{t.subject}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <button type="button" onClick={() => startEdit(t)} className="text-xs text-[#8899bb] hover:text-[#2563eb] transition-colors">Edit</button>
                <button type="button" onClick={() => handleDelete(t.id)} className="text-xs text-[#8899bb] hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
