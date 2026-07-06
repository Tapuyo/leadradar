'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { EmailTemplate, Service } from '@/types';
import TemplatePreviewModal from './TemplatePreviewModal';

const TemplateBuilder = dynamic(() => import('./TemplateBuilder'), { ssr: false });

interface TemplatesPageProps {
  services: Service[];
  selectedService: Service | null;
}

const PLACEHOLDERS = [
  { tag: '{{lead_name}}', label: 'Business name' },
  { tag: '{{lead_address}}', label: 'Address' },
  { tag: '{{lead_phone}}', label: 'Phone' },
  { tag: '{{lead_email}}', label: 'Email' },
  { tag: '{{service_name}}', label: 'Service name' },
];

const BLANK = { name: '', subject: '', body: '', service_id: '' };

export default function TemplatesPage({ services, selectedService }: TemplatesPageProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterServiceId, setFilterServiceId] = useState(selectedService?.id ?? '');
  const [showForm, setShowForm] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ ...BLANK, service_id: selectedService?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bodyRef, setBodyRef] = useState<HTMLTextAreaElement | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const url = filterServiceId
      ? `/api/templates?service_id=${filterServiceId}`
      : '/api/templates';
    const res = await fetch(url);
    const data = await res.json();
    if (data.templates) setTemplates(data.templates);
    setLoading(false);
  }, [filterServiceId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Sync filter when selected service changes from sidebar
  useEffect(() => {
    setFilterServiceId(selectedService?.id ?? '');
  }, [selectedService?.id]);

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK, service_id: filterServiceId || (services[0]?.id ?? '') });
    setError('');
    setShowForm(true);
  }

  function openEdit(t: EmailTemplate) {
    setEditing(t);
    setForm({ name: t.name, subject: t.subject, body: t.body, service_id: t.service_id });
    setError('');
    setShowForm(true);
  }

  function openBuilder(t?: EmailTemplate) {
    setEditing(t ?? null);
    setShowBuilder(true);
    setShowForm(false);
  }

  function handleBuilderSaved(saved: EmailTemplate) {
    setTemplates(prev => {
      const exists = prev.find(t => t.id === saved.id);
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [...prev, saved];
    });
    setShowBuilder(false);
    setEditing(null);
  }

  function insertPlaceholder(tag: string) {
    if (!bodyRef) {
      setForm(f => ({ ...f, body: f.body + tag }));
      return;
    }
    const start = bodyRef.selectionStart ?? form.body.length;
    const end = bodyRef.selectionEnd ?? form.body.length;
    const newBody = form.body.slice(0, start) + tag + form.body.slice(end);
    setForm(f => ({ ...f, body: newBody }));
    setTimeout(() => {
      bodyRef.focus();
      bodyRef.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim() || !form.service_id) {
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
          body: JSON.stringify({ name: form.name, subject: form.subject, body: form.body }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates(prev => prev.map(t => t.id === editing.id ? data.template : t));
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setTemplates(prev => [...prev, data.template]);
      }
      setShowForm(false);
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

  const serviceMap = new Map(services.map(s => [s.id, s.name]));

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Template list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d4a] flex-shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#8899bb] uppercase tracking-wider">Email Templates</h2>
            <select
              value={filterServiceId}
              onChange={e => setFilterServiceId(e.target.value)}
              className="bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-xs text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All services</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-[#1e2d4a] hover:border-[#2563eb] text-[#8899bb] hover:text-white rounded-lg transition-colors"
            >
              + Text Template
            </button>
            <button
              onClick={() => openBuilder()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] text-white rounded-lg transition-colors"
            >
              ✦ Visual Builder
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#8899bb] text-sm gap-2">
              <div className="w-4 h-4 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <div className="text-4xl opacity-20">✉</div>
              <p className="text-[#8899bb] text-sm">No templates yet.</p>
              <button onClick={openCreate} className="text-xs text-[#2563eb] hover:underline">
                Create your first template →
              </button>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
              {templates.map(t => (
                <div
                  key={t.id}
                  className="bg-[#0f1626] border border-[#1e2d4a] rounded-xl p-4 flex flex-col gap-2 hover:border-[#2563eb]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#e8edf5] truncate">{t.name}</p>
                        {t.html_body && (
                          <span className="text-xs bg-[#2563eb]/20 border border-[#2563eb]/40 text-[#2563eb] px-1.5 py-0.5 rounded flex-shrink-0">
                            Visual
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#4a5a7a] bg-[#1e2d4a] px-2 py-0.5 rounded-full">
                        {serviceMap.get(t.service_id) ?? 'Unknown service'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => setPreviewing(t)}
                        className="text-xs text-[#8899bb] hover:text-[#22c55e] transition-colors"
                      >
                        Preview
                      </button>
                      {t.html_body ? (
                        <button
                          onClick={() => openBuilder(t)}
                          className="text-xs text-[#8899bb] hover:text-[#2563eb] transition-colors"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => openEdit(t)}
                          className="text-xs text-[#8899bb] hover:text-[#2563eb] transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-[#8899bb] hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#8899bb]">
                    <span className="text-[#4a5a7a]">Subject: </span>{t.subject}
                  </p>
                  <p className="text-xs text-[#4a5a7a] line-clamp-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {t.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Template form panel (slide in from right) */}
      {showForm && (
        <div className="w-[420px] flex-shrink-0 border-l border-[#1e2d4a] bg-[#0f1626] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d4a]">
            <h3 className="text-sm font-semibold text-[#e8edf5]">
              {editing ? 'Edit Template' : 'New Template'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-[#8899bb] hover:text-white text-xl">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Service selector — only when creating */}
            {!editing && (
              <div>
                <label className="block text-xs text-[#8899bb] mb-1.5">Service *</label>
                <select
                  value={form.service_id}
                  onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
                  className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
                >
                  <option value="">Select a service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#8899bb] mb-1.5">Template Name *</label>
              <input
                type="text"
                placeholder="e.g. Friendly intro, Follow-up"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8899bb] mb-1.5">Subject Line *</label>
              <input
                type="text"
                placeholder="e.g. Quick note for {{lead_name}}"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-[#8899bb]">Email Body *</label>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.tag}
                    type="button"
                    onClick={() => insertPlaceholder(p.tag)}
                    className="text-xs bg-[#1a4b8c]/30 border border-[#1a4b8c] text-[#2563eb] px-2 py-0.5 rounded-full hover:bg-[#1a4b8c]/60 transition-colors"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
              <textarea
                ref={el => setBodyRef(el)}
                placeholder={`Hi {{lead_name}},\n\nI'm reaching out from {{service_name}}...`}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={12}
                className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb] resize-none font-mono leading-relaxed"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          <div className="p-5 border-t border-[#1e2d4a]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewing && (
        <TemplatePreviewModal
          template={previewing}
          service={services.find(s => s.id === previewing.service_id)}
          onClose={() => setPreviewing(null)}
        />
      )}

      {/* Visual builder — fullscreen overlay */}
      {showBuilder && (
        <TemplateBuilder
          services={services}
          template={editing}
          defaultServiceId={filterServiceId || services[0]?.id}
          onSaved={handleBuilderSaved}
          onClose={() => { setShowBuilder(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
