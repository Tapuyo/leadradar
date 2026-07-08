'use client';

import { useState, useEffect, useMemo } from 'react';
import { Service, Lead, SentEmail } from '@/types';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ReportsPageProps {
  services: Service[];
  selectedService: Service | null;
}

const STATUS_COLORS: Record<string, string> = {
  new:      '#2563eb',
  seen:     '#f59e0b',
  archived: '#6b7280',
};

const SOURCE_COLORS: Record<string, string> = {
  google:     '#22c55e',
  craigslist: '#f97316',
  custom:     '#8b5cf6',
};

const SCORE_COLOR = '#2563eb';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#1e2d4a]/70 bg-[#0d1526]/60 px-5 py-4">
      <p className="text-xs text-[#4a5a7a] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#e8edf5] font-space-grotesk">{value}</p>
      {sub && <p className="text-xs text-[#8899bb] mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e2d4a]/70 bg-[#0d1526]/60 p-5">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: '#0d1526', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 },
  labelStyle:   { color: '#8899bb' },
  itemStyle:    { color: '#e8edf5' },
};

// Group ISO date strings by day → { "Jul 1": count }
function groupByDay(dates: string[]): { date: string; count: number }[] {
  const map: Record<string, number> = {};
  for (const d of dates) {
    const key = new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Returns "YYYY-MM-DD" for a Date offset by `days` from today
function isoOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage({ services, selectedService: initialService }: ReportsPageProps) {
  const [pickedServiceId, setPickedServiceId] = useState<string>(initialService?.id ?? services[0]?.id ?? '');
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading]       = useState(false);
  const [dateFrom, setDateFrom]     = useState(isoOffset(-30));   // default: last 30 days
  const [dateTo, setDateTo]         = useState(isoOffset(0));

  // Keep picker in sync when parent changes the service
  useEffect(() => {
    if (initialService) setPickedServiceId(initialService.id);
  }, [initialService?.id]);

  const service = services.find(s => s.id === pickedServiceId) ?? null;

  useEffect(() => {
    if (!pickedServiceId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/leads?service_id=${pickedServiceId}`).then(r => r.json()),
      fetch(`/api/sent-emails?service_id=${pickedServiceId}`).then(r => r.json()),
    ]).then(([ld, se]) => {
      setLeads(ld.leads ?? []);
      setSentEmails(se.sent_emails ?? []);
    }).finally(() => setLoading(false));
  }, [pickedServiceId]);

  // ── Apply date filter ────────────────────────────────────────────────────

  const filteredLeads = useMemo(() =>
    leads.filter(l => {
      // Use first 10 chars ("YYYY-MM-DD") for locale-safe string comparison
      const day = (l.scan_date ?? l.created_at).slice(0, 10);
      return day >= dateFrom && day <= dateTo;
    }),
  [leads, dateFrom, dateTo]);

  const filteredEmails = useMemo(() =>
    sentEmails.filter(e => {
      const day = e.sent_at.slice(0, 10);
      return day >= dateFrom && day <= dateTo;
    }),
  [sentEmails, dateFrom, dateTo]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total      = filteredLeads.length;
    const withEmail  = filteredLeads.filter(l => l.email).length;
    const withPhone  = filteredLeads.filter(l => l.phone).length;
    const avgScore   = total ? Math.round(filteredLeads.reduce((s, l) => s + l.score, 0) / total) : 0;
    const highValue  = filteredLeads.filter(l => l.score >= 80).length;
    return { total, withEmail, withPhone, avgScore, highValue, emailsSent: filteredEmails.length };
  }, [filteredLeads, filteredEmails]);

  const statusData = useMemo(() => {
    const counts = { new: 0, seen: 0, archived: 0 };
    for (const l of filteredLeads) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of filteredLeads) counts[l.source] = (counts[l.source] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const scoreBands = useMemo(() => {
    const bands = [
      { range: '0–19',  min: 0,  max: 20,  count: 0 },
      { range: '20–39', min: 20, max: 40,  count: 0 },
      { range: '40–59', min: 40, max: 60,  count: 0 },
      { range: '60–79', min: 60, max: 80,  count: 0 },
      { range: '80–100',min: 80, max: 101, count: 0 },
    ];
    for (const l of filteredLeads) {
      const b = bands.find(b => l.score >= b.min && l.score < b.max);
      if (b) b.count++;
    }
    return bands.map(b => ({ range: b.range, count: b.count }));
  }, [filteredLeads]);

  const leadsOverTime = useMemo(() =>
    groupByDay(filteredLeads.map(l => l.scan_date ?? l.created_at)),
  [filteredLeads]);

  const emailsOverTime = useMemo(() =>
    groupByDay(filteredEmails.map(e => e.sent_at)),
  [filteredEmails]);

  const topKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of filteredLeads) {
      for (const kw of l.keywords_matched ?? []) {
        counts[kw] = (counts[kw] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
  }, [filteredLeads]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (services.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8899bb] text-sm">
        No services yet — create one to see reports.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">

        {/* Header — service picker + date range */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold font-space-grotesk text-[#e8edf5] mr-2">Analytics Report</h2>

          <select
            value={pickedServiceId}
            onChange={e => setPickedServiceId(e.target.value)}
            className="bg-[#0d1526] border border-[#1e2d4a] text-[#e8edf5] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2563eb]"
          >
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Quick presets */}
            {[
              { label: '7d',  days: 7 },
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
            ].map(p => (
              <button
                key={p.label}
                onClick={() => { setDateFrom(isoOffset(-p.days)); setDateTo(isoOffset(0)); }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#1e2d4a] text-[#8899bb] hover:text-white hover:border-[#2563eb] transition-colors"
              >
                {p.label}
              </button>
            ))}

            <span className="text-xs text-[#4a5a7a]">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-[#0d1526] border border-[#1e2d4a] text-[#e8edf5] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2563eb] [color-scheme:dark]"
            />
            <span className="text-xs text-[#4a5a7a]">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={isoOffset(0)}
              onChange={e => setDateTo(e.target.value)}
              className="bg-[#0d1526] border border-[#1e2d4a] text-[#e8edf5] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#2563eb] [color-scheme:dark]"
            />
          </div>

          {service?.last_scanned_at && (
            <span className="text-xs text-[#4a5a7a] w-full -mt-1">
              Last scan: {new Date(service.last_scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[#8899bb] text-sm py-12 justify-center">
            <div className="w-4 h-4 border border-[#2563eb] border-t-transparent rounded-full animate-spin" />
            Loading analytics…
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total Leads"    value={kpis.total} />
              <StatCard label="Emails Sent"    value={kpis.emailsSent} />
              <StatCard label="Avg Score"      value={kpis.avgScore} sub="out of 100" />
              <StatCard label="High Value"     value={kpis.highValue} sub="score ≥ 80" />
              <StatCard label="With Email"     value={kpis.withEmail} sub={kpis.total ? `${Math.round(kpis.withEmail / kpis.total * 100)}%` : '—'} />
              <StatCard label="With Phone"     value={kpis.withPhone} sub={kpis.total ? `${Math.round(kpis.withPhone / kpis.total * 100)}%` : '—'} />
            </div>

            {/* Row — Status + Source donuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <ChartCard title="Leads by Status">
                {statusData.every(d => d.value === 0) ? (
                  <p className="text-xs text-[#4a5a7a] py-8 text-center">No leads yet.</p>
                ) : (
                  <ResponsiveContainer key={`status-${dateFrom}-${dateTo}`} width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {statusData.map(entry => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#2563eb'} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend formatter={(v) => <span style={{ color: '#8899bb', fontSize: 12, textTransform: 'capitalize' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Leads by Source">
                {sourceData.every(d => d.value === 0) ? (
                  <p className="text-xs text-[#4a5a7a] py-8 text-center">No leads yet.</p>
                ) : (
                  <ResponsiveContainer key={`source-${dateFrom}-${dateTo}`} width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {sourceData.map(entry => (
                          <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] ?? '#2563eb'} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend formatter={(v) => <span style={{ color: '#8899bb', fontSize: 12, textTransform: 'capitalize' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

            </div>

            {/* Row — Score distribution */}
            <ChartCard title="Score Distribution">
              {filteredLeads.length === 0 ? (
                <p className="text-xs text-[#4a5a7a] py-8 text-center">No leads in this period.</p>
              ) : (
                <ResponsiveContainer key={`score-${dateFrom}-${dateTo}`} width="100%" height={200}>
                  <BarChart data={scoreBands} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                    <XAxis dataKey="range" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill={SCORE_COLOR} radius={[4, 4, 0, 0]} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Row — Leads over time */}
            <ChartCard title="Leads Discovered Over Time">
              {leadsOverTime.length === 0 ? (
                <p className="text-xs text-[#4a5a7a] py-8 text-center">No scan data yet.</p>
              ) : (
                <ResponsiveContainer key={`leads-time-${dateFrom}-${dateTo}`} width="100%" height={200}>
                  <AreaChart data={leadsOverTime}>
                    <defs>
                      <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fill="url(#leadGrad)" name="Leads" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Row — Emails sent over time */}
            <ChartCard title="Emails Sent Over Time">
              {emailsOverTime.length === 0 ? (
                <p className="text-xs text-[#4a5a7a] py-8 text-center">No emails sent yet.</p>
              ) : (
                <ResponsiveContainer key={`emails-time-${dateFrom}-${dateTo}`} width="100%" height={200}>
                  <BarChart data={emailsOverTime} barSize={20}>
                    <defs>
                      <linearGradient id="emailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor="#22c55e" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="url(#emailGrad)" radius={[4, 4, 0, 0]} name="Emails" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Row — Top keywords */}
            {topKeywords.length > 0 && (
              <ChartCard title="Top Matched Keywords">
                <ResponsiveContainer width="100%" height={Math.max(200, topKeywords.length * 36)}>
                  <BarChart data={topKeywords} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#8899bb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="keyword" width={120} tick={{ fill: '#e8edf5', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Matches" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

          </>
        )}
      </div>
    </div>
  );
}
