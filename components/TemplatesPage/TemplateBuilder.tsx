'use client';

import { useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { EditorRef } from 'react-email-editor';
import { EmailTemplate, Service } from '@/types';
import TemplatePreviewModal from './TemplatePreviewModal';

const EmailEditor = dynamic(() => import('react-email-editor').then(m => m.EmailEditor), { ssr: false });

interface TemplateBuilderProps {
  services: Service[];
  template?: EmailTemplate | null;
  defaultServiceId?: string;
  onSaved: (template: EmailTemplate) => void;
  onClose: () => void;
}

const PLACEHOLDERS = [
  { tag: '{{lead_name}}', label: 'Business name' },
  { tag: '{{lead_address}}', label: 'Address' },
  { tag: '{{lead_phone}}', label: 'Phone' },
  { tag: '{{lead_email}}', label: 'Email' },
  { tag: '{{service_name}}', label: 'Service name' },
];

export default function TemplateBuilder({ services, template, defaultServiceId, onSaved, onClose }: TemplateBuilderProps) {
  const editorRef = useRef<EditorRef>(null);
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [serviceId, setServiceId] = useState(template?.service_id ?? defaultServiceId ?? services[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorReady, setEditorReady] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const onReady = useCallback(() => {
    setEditorReady(true);
    if (template?.design && editorRef.current?.editor) {
      editorRef.current.editor.loadDesign(template.design as Parameters<typeof editorRef.current.editor.loadDesign>[0]);
    }
  }, [template?.design]);

  function insertPlaceholderInSubject(tag: string) {
    setSubject(prev => prev + tag);
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !serviceId) {
      setError('Name, subject and service are required.');
      return;
    }
    if (!editorRef.current?.editor) {
      setError('Editor not ready yet.');
      return;
    }

    setSaving(true);
    setError('');

    editorRef.current.editor.exportHtml(async ({ design, html }) => {
      // Strip tags for plain-text fallback
      const plainBody = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

      try {
        let res: Response;
        if (template) {
          res = await fetch(`/api/templates/${template.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, subject, body: plainBody, html_body: html, design }),
          });
        } else {
          res = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service_id: serviceId, name, subject, body: plainBody, html_body: html, design }),
          });
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onSaved(data.template);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
        setSaving(false);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a1a]" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1e2d4a] flex-shrink-0 bg-[#0f1626]">
        <button onClick={onClose} className="text-[#8899bb] hover:text-white transition-colors text-xl leading-none">←</button>

        <input
          type="text"
          placeholder="Template name..."
          value={name}
          onChange={e => setName(e.target.value)}
          className="bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb] w-48"
        />

        {!template && (
          <select
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
            className="bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb]"
          >
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <input
            type="text"
            placeholder="Subject line..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-1.5 text-sm text-[#e8edf5] focus:outline-none focus:border-[#2563eb] min-w-0"
          />
          <div className="flex gap-1 flex-shrink-0 flex-wrap">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.tag}
                onClick={() => insertPlaceholderInSubject(p.tag)}
                title={p.tag}
                className="text-xs bg-[#1a4b8c]/30 border border-[#1a4b8c] text-[#2563eb] px-2 py-1 rounded hover:bg-[#1a4b8c]/60 transition-colors whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400 flex-shrink-0 max-w-48">{error}</p>}

        <button
          onClick={() => {
            if (!editorRef.current?.editor) return;
            editorRef.current.editor.exportHtml(({ html }) => {
              const plainBody = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
              setPreviewTemplate({
                id: template?.id ?? 'preview',
                service_id: serviceId,
                company_id: '',
                name: name || 'Preview',
                subject: subject || 'Preview',
                body: plainBody,
                html_body: html,
                design: null,
                created_at: '',
                updated_at: '',
              });
            });
          }}
          disabled={!editorReady}
          className="flex-shrink-0 px-4 py-1.5 border border-[#1e2d4a] hover:border-[#2563eb] disabled:opacity-50 text-[#8899bb] hover:text-white text-sm font-medium rounded-lg transition-colors"
        >
          Preview
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !editorReady}
          className="flex-shrink-0 px-4 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : template ? 'Save Changes' : 'Save Template'}
        </button>
      </div>

      {/* Loading state */}
      {!editorReady && (
        <div className="flex items-center justify-center flex-1 text-[#8899bb] text-sm gap-2">
          <div className="w-5 h-5 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
          Loading editor...
        </div>
      )}

      {/* Unlayer editor — must use style height, not Tailwind, for the iframe to fill correctly */}
      <div
        style={{ display: editorReady ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}
      >
        <EmailEditor
          ref={editorRef}
          onReady={onReady}
          style={{ flex: 1, minHeight: 0 }}
          options={{
            mergeTags: Object.fromEntries(
              PLACEHOLDERS.map(p => [
                p.tag.replace(/[{}]/g, ''),
                { name: p.label, value: p.tag },
              ])
            ),
            features: {
              preview: true,
            },
          }}
        />
      </div>

      {/* Preview modal — rendered on top of builder */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          service={services.find(s => s.id === serviceId)}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
