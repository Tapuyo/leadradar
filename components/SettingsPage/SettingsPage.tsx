'use client';

import { useState, useEffect } from 'react';
import { Company, Service } from '@/types';
import { createClient } from '@/lib/supabase/client';
import KeywordManager from '@/components/ServiceForm/KeywordManager';
import StateSelector from '@/components/ServiceForm/StateSelector';
import SourceToggles from '@/components/ServiceForm/SourceToggles';
import EmailStrategySettings from '@/components/ServiceForm/EmailStrategySettings';
import TemplateManager from '@/components/ServiceForm/TemplateManager';

type SettingsTab = 'account' | 'company' | 'connections' | 'service' | 'email' | 'templates';

interface SettingsPageProps {
  company: Company;
  selectedService: Service | null;
  onCompanySave: (updated: Company) => void;
  onServiceSaved: (service: Service) => void;
}

/* ─── Account Section ─────────────────────────────────────────────────────── */

function AccountSection() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [invited, setInvited] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwStatus({ msg: 'Passwords do not match', ok: false });
      return;
    }
    if (newPassword.length < 8) {
      setPwStatus({ msg: 'Password must be at least 8 characters', ok: false });
      return;
    }
    setSavingPw(true);
    setPwStatus(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPwStatus({ msg: 'Current password is incorrect', ok: false });
      setSavingPw(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwStatus({ msg: error.message, ok: false });
    } else {
      setPwStatus({ msg: 'Password updated successfully', ok: true });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPw(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteStatus(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Invite failed');
      setInviteStatus({ msg: `Invitation sent to ${inviteEmail}`, ok: true });
      setInvited(prev => [...prev, inviteEmail]);
      setInviteEmail('');
    } catch (err) {
      setInviteStatus({ msg: err instanceof Error ? err.message : 'Failed to send invite', ok: false });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[#e8edf5] mb-4">Your Account</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1a4b8c] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-[#e8edf5]">{email}</p>
            <p className="text-xs text-[#4a5a7a]">Signed in</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[#e8edf5] mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
            />
          </div>
          {pwStatus && (
            <p className={`text-sm px-4 py-2.5 rounded-lg border ${
              pwStatus.ok
                ? 'text-green-400 bg-green-400/10 border-green-400/20'
                : 'text-red-400 bg-red-400/10 border-red-400/20'
            }`}>{pwStatus.msg}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingPw}
              className="px-5 py-2 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[#e8edf5] mb-1">Invite Staff</h3>
        <p className="text-xs text-[#4a5a7a] mb-4">They will receive an email with a link to set up their account.</p>
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              required
              placeholder="colleague@company.com"
              className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] placeholder-[#4a5a7a] focus:outline-none focus:border-[#2563eb] text-sm"
            />
          </div>
          {inviteStatus && (
            <p className={`text-sm px-4 py-2.5 rounded-lg border ${
              inviteStatus.ok
                ? 'text-green-400 bg-green-400/10 border-green-400/20'
                : 'text-red-400 bg-red-400/10 border-red-400/20'
            }`}>{inviteStatus.msg}</p>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={inviting}
              className="px-5 py-2 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
        {invited.length > 0 && (
          <ul className="mt-4 space-y-2">
            {invited.map(e => (
              <li key={e} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#162035] border border-[#1e2d4a]">
                <div className="w-7 h-7 rounded-full bg-[#1a4b8c]/60 flex items-center justify-center text-xs text-[#8899bb] font-medium flex-shrink-0">
                  {e.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-[#e8edf5]">{e}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">Pending</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Company Section ─────────────────────────────────────────────────────── */

function CompanySection({ company, onCompanySave }: { company: Company; onCompanySave: (c: Company) => void }) {
  const [companyName, setCompanyName] = useState(company.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

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
      onCompanySave(data.company);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
      <h3 className="text-sm font-semibold text-[#e8edf5] mb-4">Company Details</h3>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs text-[#8899bb] mb-1.5">Company Name</label>
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
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Connections Section ─────────────────────────────────────────────────── */

type ConnectionStatus = 'connected' | 'coming_soon' | 'available';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: ConnectionStatus;
  connectHref?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send outreach emails and read replies directly from your inbox.',
    icon: '✉',
    category: 'Email',
    status: 'available',
    connectHref: '/api/auth/gmail',
  },
  {
    id: 'ghl',
    name: 'GoHighLevel',
    description: 'When a lead replies to your email, they are automatically pushed into your GHL contact list.',
    icon: '⚡',
    category: 'CRM',
    status: 'available',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Sync leads and deals to HubSpot CRM in real time.',
    icon: '🟠',
    category: 'CRM',
    status: 'coming_soon',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Create leads and contacts in Salesforce from every scan.',
    icon: '☁',
    category: 'CRM',
    status: 'coming_soon',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Add deals and persons to Pipedrive automatically after each scan.',
    icon: '🎯',
    category: 'CRM',
    status: 'coming_soon',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Stream leads into an Airtable base for custom reporting and views.',
    icon: '🗂',
    category: 'Spreadsheet',
    status: 'coming_soon',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Export leads to a Google Sheet automatically after every scan.',
    icon: '📊',
    category: 'Spreadsheet',
    status: 'coming_soon',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Send lead data to a Notion database for team collaboration.',
    icon: '◻',
    category: 'Workspace',
    status: 'coming_soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get Slack notifications when high-score leads are found or emails are replied to.',
    icon: '#',
    category: 'Notifications',
    status: 'coming_soon',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect LeadRadar to 6,000+ apps via Zapier webhooks.',
    icon: '⚡',
    category: 'Automation',
    status: 'coming_soon',
  },
  {
    id: 'make',
    name: 'Make',
    description: 'Build advanced automation scenarios with Make (formerly Integromat).',
    icon: '🔄',
    category: 'Automation',
    status: 'coming_soon',
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'POST lead data to any custom endpoint when a scan completes.',
    icon: '🔗',
    category: 'Automation',
    status: 'coming_soon',
  },
];

const CATEGORY_ORDER = ['Email', 'CRM', 'Spreadsheet', 'Workspace', 'Notifications', 'Automation'];

function GhlConnectPanel() {
  const [apiKey, setApiKey] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/ghl')
      .then(r => r.json())
      .then(d => {
        setConnected(!!d.connected);
        setHint(d.api_key_hint ?? null);
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/integrations/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, test: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to connect');
      setConnected(true);
      setHint(`••••••••${apiKey.slice(-4)}`);
      setStatus({ msg: 'GoHighLevel connected successfully!', ok: true });
      setShowForm(false);
      setApiKey('');
    } catch (err) {
      setStatus({ msg: err instanceof Error ? err.message : 'Connection failed', ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch('/api/integrations/ghl', { method: 'DELETE' });
      setConnected(false);
      setHint(null);
      setStatus(null);
      setShowForm(false);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-3">
      {status && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${
          status.ok
            ? 'text-green-400 bg-green-400/10 border-green-400/20'
            : 'text-red-400 bg-red-400/10 border-red-400/20'
        }`}>{status.msg}</p>
      )}

      {connected && !showForm && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#162035] border border-[#1e2d4a]">
          <span className="text-xs text-[#8899bb] font-mono flex-1">{hint}</span>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs text-[#4a5a7a] hover:text-[#8899bb] transition-colors"
          >
            Change key
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      )}

      {(!connected || showForm) && (
        <form onSubmit={handleSave} className="space-y-2">
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">
              GHL Location API Key
              <a
                href="https://help.gohighlevel.com/support/solutions/articles/48001060739"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[#2563eb] hover:underline"
              >
                Where to find it ↗
              </a>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              required
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="w-full bg-[#0a0a1a] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] placeholder-[#4a5a7a] focus:outline-none focus:border-[#2563eb] text-sm font-mono"
            />
          </div>
          <div className="flex gap-2 justify-end">
            {showForm && (
              <button
                type="button"
                onClick={() => { setShowForm(false); setStatus(null); }}
                className="px-4 py-1.5 text-xs text-[#8899bb] hover:text-[#e8edf5] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              className="px-4 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {saving ? 'Connecting…' : 'Save & Test Connection'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ConnectionsSection() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [ghlConnected, setGhlConnected] = useState<boolean | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/received-emails')
      .then(r => r.json())
      .then(d => setGmailConnected(!d.needs_auth && !d.needs_reauth))
      .catch(() => setGmailConnected(false));

    fetch('/api/integrations/ghl')
      .then(r => r.json())
      .then(d => setGhlConnected(!!d.connected))
      .catch(() => setGhlConnected(false));
  }, []);

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: INTEGRATIONS.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  function getStatus(integration: Integration): ConnectionStatus {
    if (integration.id === 'gmail' && gmailConnected === true) return 'connected';
    if (integration.id === 'ghl' && ghlConnected === true) return 'connected';
    return integration.status;
  }

  return (
    <div className="space-y-8">
      {grouped.map(({ category, items }) => (
        <div key={category}>
          <p className="text-xs font-semibold text-[#4a5a7a] uppercase tracking-wider mb-3">{category}</p>
          <div className="space-y-2">
            {items.map(integration => {
              const status = getStatus(integration);
              const isExpanded = expandedId === integration.id;
              return (
                <div key={integration.id} className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#162035] border border-[#1e2d4a] flex items-center justify-center text-lg flex-shrink-0">
                      {integration.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e8edf5]">{integration.name}</p>
                      <p className="text-xs text-[#4a5a7a] mt-0.5 leading-relaxed">{integration.description}</p>
                    </div>

                    {status === 'connected' && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">Connected</span>
                        {integration.id === 'ghl' && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                            className="text-xs text-[#4a5a7a] hover:text-[#8899bb] transition-colors"
                          >
                            Manage
                          </button>
                        )}
                        {integration.connectHref && integration.id !== 'ghl' && (
                          <a href={integration.connectHref} className="text-xs text-[#4a5a7a] hover:text-[#8899bb] transition-colors">
                            Reconnect
                          </a>
                        )}
                      </div>
                    )}

                    {status === 'available' && (
                      integration.id === 'ghl' ? (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                          className="flex-shrink-0 px-4 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Connect
                        </button>
                      ) : (
                        <a
                          href={integration.connectHref}
                          className="flex-shrink-0 px-4 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Connect
                        </a>
                      )
                    )}

                    {status === 'coming_soon' && (
                      <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-[#1e2d4a] text-[#4a5a7a] font-medium">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  {/* Expandable panel for GHL */}
                  {integration.id === 'ghl' && isExpanded && (
                    <div className="px-5 pb-5 border-t border-[#1e2d4a] pt-4">
                      <GhlConnectPanel />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── No-service placeholder ──────────────────────────────────────────────── */

function NoServiceSelected() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#0f1626] border border-[#1e2d4a] flex items-center justify-center mb-4 text-2xl">⚡</div>
      <p className="text-sm font-medium text-[#8899bb]">No service selected</p>
      <p className="text-xs text-[#4a5a7a] mt-1">Pick a service from the left panel first.</p>
    </div>
  );
}

/* ─── Service Settings Section ────────────────────────────────────────────── */

function ServiceSettingsSection({ service, onServiceSaved }: { service: Service; onServiceSaved: (s: Service) => void }) {
  const [form, setForm] = useState({
    name: service.name,
    description: service.description ?? '',
    target_states: service.target_states ?? [],
    target_cities: service.target_cities ?? [],
    keywords: service.keywords ?? [],
    source_mapbox: service.source_mapbox,
    source_craigslist: service.source_craigslist,
    source_custom: service.source_custom,
    custom_url: service.custom_url ?? '',
    scan_enabled: service.scan_enabled,
    scan_time: service.scan_time ?? '08:00',
    max_leads: service.max_leads,
    max_emails_per_day: service.max_emails_per_day,
    auto_send: service.auto_send,
  });
  const [cityInput, setCityInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Reset when service changes
  useEffect(() => {
    setForm({
      name: service.name,
      description: service.description ?? '',
      target_states: service.target_states ?? [],
      target_cities: service.target_cities ?? [],
      keywords: service.keywords ?? [],
      source_mapbox: service.source_mapbox,
      source_craigslist: service.source_craigslist,
      source_custom: service.source_custom,
      custom_url: service.custom_url ?? '',
      scan_enabled: service.scan_enabled,
      scan_time: service.scan_time ?? '08:00',
      max_leads: service.max_leads,
      max_emails_per_day: service.max_emails_per_day,
      auto_send: service.auto_send,
    });
  }, [service.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function addCity() {
    const city = cityInput.trim();
    if (city && !form.target_cities.includes(city)) {
      setForm(f => ({ ...f, target_cities: [...f.target_cities, city] }));
    }
    setCityInput('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onServiceSaved(data.service);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs text-[#8899bb] mb-1.5">Service Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-[#8899bb] mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-[#162035] border border-[#1e2d4a] rounded-lg px-4 py-2.5 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm resize-none"
            placeholder="Brief description of this service…"
          />
        </div>

        <StateSelector
          selected={form.target_states}
          onChange={states => setForm(f => ({ ...f, target_states: states }))}
        />

        <div>
          <label className="block text-xs text-[#8899bb] mb-1.5">Target Cities</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())}
              className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
              placeholder="Type city and press Enter"
            />
            <button
              type="button"
              onClick={addCity}
              className="bg-[#162035] border border-[#1e2d4a] hover:border-[#2563eb] text-[#8899bb] hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Add
            </button>
          </div>
          {form.target_cities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {form.target_cities.map(city => (
                <span key={city} className="flex items-center gap-1 bg-[#1e2d4a] text-[#e8edf5] text-xs px-2.5 py-1 rounded-full">
                  {city}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, target_cities: f.target_cities.filter(c => c !== city) }))}
                    className="text-[#8899bb] hover:text-white"
                  >×</button>
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
      </div>

      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Scan Schedule</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.scan_enabled}
              onChange={e => setForm(f => ({ ...f, scan_enabled: e.target.checked }))}
              className="sr-only"
            />
            <div className={`w-9 h-5 rounded-full transition-colors ${form.scan_enabled ? 'bg-[#2563eb]' : 'bg-[#1e2d4a]'}`}>
              <div
                className="w-3.5 h-3.5 rounded-full bg-white transition-transform"
                style={{ marginTop: '3px', marginLeft: form.scan_enabled ? '18px' : '3px' }}
              />
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
      </div>

      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6 space-y-4">
        <p className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider">Limits & Automation</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8899bb] mb-1.5">Max Leads</label>
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
            <label className="block text-xs text-[#8899bb] mb-1.5">Max Emails / Day</label>
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
            <div
              className="w-3.5 h-3.5 rounded-full bg-white transition-transform"
              style={{ marginTop: '3px', marginLeft: form.auto_send ? '18px' : '3px' }}
            />
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

/* ─── Email Strategy Section ──────────────────────────────────────────────── */

function EmailStrategySection({ service, onServiceSaved }: { service: Service; onServiceSaved: (s: Service) => void }) {
  const [strategy, setStrategy] = useState(service.email_strategy ?? 'single');
  const [templateId, setTemplateId] = useState(service.email_template_id ?? null);
  const [sequence, setSequence] = useState(service.email_sequence ?? []);
  const [emailJourney, setEmailJourney] = useState(service.email_journey ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStrategy(service.email_strategy ?? 'single');
    setTemplateId(service.email_template_id ?? null);
    setSequence(service.email_sequence ?? []);
    setEmailJourney(service.email_journey ?? []);
  }, [service.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_strategy: strategy,
          email_template_id: templateId,
          email_sequence: sequence,
          email_journey: emailJourney,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      onServiceSaved(data.service);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
        <EmailStrategySettings
          serviceId={service.id}
          strategy={strategy}
          templateId={templateId}
          sequence={sequence}
          emailJourney={emailJourney}
          onChange={updates => {
            setStrategy(updates.email_strategy);
            setTemplateId(updates.email_template_id);
            setSequence(updates.email_sequence);
            setEmailJourney(updates.email_journey);
          }}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2.5">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Strategy'}
        </button>
      </div>
    </form>
  );
}

/* ─── Templates Section ───────────────────────────────────────────────────── */

function TemplatesSection({ service }: { service: Service }) {
  return (
    <div className="bg-[#0f1626] border border-[#1e2d4a] rounded-2xl p-6">
      <TemplateManager serviceId={service.id} />
    </div>
  );
}

/* ─── Main SettingsPage ───────────────────────────────────────────────────── */

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string; serviceRequired?: boolean }[] = [
  { id: 'account',     label: 'Account',      icon: '👤' },
  { id: 'company',     label: 'Company',       icon: '🏢' },
  { id: 'connections', label: 'Connections',   icon: '🔌' },
  { id: 'service',     label: 'Service',       icon: '🔧', serviceRequired: true },
  { id: 'email',       label: 'Email Strategy',icon: '✉',  serviceRequired: true },
  { id: 'templates',   label: 'Templates',     icon: '📄', serviceRequired: true },
];

export default function SettingsPage({ company, selectedService, onCompanySave, onServiceSaved }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsTab>('account');

  // When a service is selected while the user is already on a service tab
  // (viewing NoServiceSelected), just let the content appear. If they're on a
  // general tab, auto-jump to Service so something useful is immediately visible.
  useEffect(() => {
    if (selectedService) {
      const isOnServiceTab = (activeSection === 'service' || activeSection === 'email' || activeSection === 'templates');
      if (!isOnServiceTab) {
        setActiveSection('service');
      }
    }
  }, [selectedService?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeItem = NAV_ITEMS.find(i => i.id === activeSection)!;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar nav */}
      <nav className="w-48 flex-shrink-0 border-r border-[#1e2d4a]/60 py-6 px-3 space-y-4">
        {/* General group */}
        <div>
          <p className="text-xs font-semibold text-[#4a5a7a] uppercase tracking-wider px-3 mb-2">General</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter(i => !i.serviceRequired).map(item => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeSection === item.id
                      ? 'bg-[#1a4b8c]/30 text-white'
                      : 'text-[#4a5a7a] hover:text-[#8899bb] hover:bg-[#0f1626]'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Service group */}
        <div>
          <p className="text-xs font-semibold text-[#4a5a7a] uppercase tracking-wider px-3 mb-2">
            {selectedService ? selectedService.name : 'Service'}
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter(i => i.serviceRequired).map(item => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeSection === item.id
                      ? 'bg-[#1a4b8c]/30 text-white'
                      : 'text-[#4a5a7a] hover:text-[#8899bb] hover:bg-[#0f1626]'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <h2 className="text-lg font-semibold font-space-grotesk text-[#e8edf5] mb-6">
            {activeItem.label}
            {activeItem.serviceRequired && selectedService && (
              <span className="ml-2 text-sm font-normal text-[#4a5a7a]">— {selectedService.name}</span>
            )}
          </h2>

          {activeSection === 'account' && <AccountSection />}

          {activeSection === 'company' && (
            <CompanySection company={company} onCompanySave={onCompanySave} />
          )}

          {activeSection === 'connections' && <ConnectionsSection />}

          {activeSection === 'service' && (
            selectedService
              ? <ServiceSettingsSection service={selectedService} onServiceSaved={onServiceSaved} />
              : <NoServiceSelected />
          )}

          {activeSection === 'email' && (
            selectedService
              ? <EmailStrategySection service={selectedService} onServiceSaved={onServiceSaved} />
              : <NoServiceSelected />
          )}

          {activeSection === 'templates' && (
            selectedService
              ? <TemplatesSection service={selectedService} />
              : <NoServiceSelected />
          )}
        </div>
      </div>
    </div>
  );
}
