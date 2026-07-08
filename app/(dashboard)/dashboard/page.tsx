'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Service, Lead, Company } from '@/types';
import ServicesList from '@/components/ServicesPanel/ServicesList';
import LeadsList from '@/components/LeadsPanel/LeadsList';
import LeadsView from '@/components/LeadsView/LeadsView';
import BottomSheet from '@/components/BottomSheet/BottomSheet';
import ServiceForm from '@/components/ServiceForm/ServiceForm';
import ScanLog, { LogEntry } from '@/components/ScanLog';
import SentEmailsTable from '@/components/SentEmailsTable/SentEmailsTable';
import ReceivedEmailsTable from '@/components/SentEmailsTable/ReceivedEmailsTable';
import TemplatesPage from '@/components/TemplatesPage/TemplatesPage';
import SettingsPage from '@/components/SettingsPage/SettingsPage';
import ReportsPage from '@/components/ReportsPage/ReportsPage';
import { createClient } from '@/lib/supabase/client';
import UniverseBackground from '@/components/UniverseBackground/UniverseBackground';

const MindMapCanvas = dynamic(() => import('@/components/MindMap/MindMapCanvas'), { ssr: false });

export default function DashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'leads' | 'sent' | 'reports' | 'templates' | 'settings'>('home');
  const [sentInnerTab, setSentInnerTab] = useState<'sent' | 'received'>('sent');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceFormInitialTab, setServiceFormInitialTab] = useState<'settings' | 'email' | 'templates'>('settings');
  const [company, setCompany] = useState<Company | null>(null);

  // Load company
  useEffect(() => {
    fetch('/api/company')
      .then(r => r.json())
      .then(d => { if (d.company) setCompany(d.company); });
  }, []);

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.services) setServices(data.services);
  }

  const fetchLeads = useCallback(async (service: Service) => {
    const res = await fetch(`/api/leads?service_id=${service.id}`);
    const data = await res.json();
    if (data.leads) setLeads(data.leads);
  }, []);

  useEffect(() => {
    if (selectedService) fetchLeads(selectedService);
    else setLeads([]);
  }, [selectedService, fetchLeads]);

  function handleServiceSelect(service: Service) {
    setSelectedService(service);
    setSelectedLead(null);
    setIsBottomSheetOpen(false);
  }

  function handleLeadSelect(lead: Lead) {
    setSelectedLead(lead);
    setIsBottomSheetOpen(true);
    if (lead.status === 'new') {
      fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seen' }),
      }).then(() => {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'seen' } : l));
      });
    }
  }

  function handleLeadSelectById(leadId: string) {
    const lead = leads.find(l => l.id === leadId);
    if (lead) handleLeadSelect(lead);
  }

  function handleStatusChange(leadId: string, status: Lead['status']) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, status } : null);
    }
  }

  function handleEmailSaved(leadId: string, email: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, generated_email: email } : l));
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, generated_email: email } : null);
    }
  }

  async function handleScanNow(serviceId: string) {
    setIsScanning(true);
    setScanLogs([]);
    setShowLogs(true);

    const addLog = (message: string, level: LogEntry['level'] = 'info') => {
      setScanLogs(prev => [...prev, { id: crypto.randomUUID(), message, level, ts: Date.now() }]);
    };

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'log') {
              addLog(event.message, event.level ?? 'info');
            } else if (event.type === 'complete') {
              if (selectedService?.id === serviceId) {
                fetchLeads(selectedService);
              }
            } else if (event.type === 'error') {
              addLog(event.message, 'error');
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      addLog(msg, 'error');
    } finally {
      setIsScanning(false);
      fetchServices();
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!window.confirm('Delete this service and all its leads? This cannot be undone.')) return;
    const res = await fetch(`/api/services/${serviceId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setServices(prev => prev.filter(s => s.id !== serviceId));
    if (selectedService?.id === serviceId) {
      setSelectedService(null);
      setLeads([]);
      setSelectedLead(null);
      setIsBottomSheetOpen(false);
    }
  }

  function handleServiceSaved(service: Service) {
    if (editingService) {
      setServices(prev => prev.map(s => s.id === service.id ? service : s));
      if (selectedService?.id === service.id) setSelectedService(service);
    } else {
      setServices(prev => [...prev, service]);
      setSelectedService(service);
    }
    setEditingService(null);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  const serviceLeads = selectedService ? leads.filter(l => l.service_id === selectedService.id) : [];

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <UniverseBackground />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d4a]/60 flex-shrink-0 bg-[#0a0a1e]/70 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-space-grotesk tracking-tight text-white">
            Lead<span className="text-[#2563eb]">Radar</span>
          </h1>
          {company && (
            <span className="text-sm text-[#8899bb] border-l border-[#1e2d4a] pl-3">{company.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedService && (
            <button
              onClick={() => handleScanNow(selectedService.id)}
              disabled={isScanning}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[#1a4b8c] hover:bg-[#2563eb] disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isScanning ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Scanning
                </>
              ) : (
                <>⟳ Scan Now</>
              )}
            </button>
          )}
          {scanLogs.length > 0 && (
            <button
              onClick={() => setShowLogs(v => !v)}
              className={`text-sm px-3 py-1.5 border rounded-lg transition-colors ${
                showLogs
                  ? 'border-[#2563eb] text-[#2563eb] bg-[#1a4b8c]/10'
                  : 'border-[#1e2d4a] text-[#8899bb] hover:text-white'
              }`}
            >
              {isScanning ? '📡 Logs' : '📋 Logs'}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-[#8899bb] hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-5 border-b border-[#1e2d4a]/60 bg-[#0a0a1e]/60 backdrop-blur-md relative z-10">
        {(['home', 'leads', 'sent', 'reports', 'templates', 'settings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'text-white'
                : 'text-[#4a5a7a] hover:text-[#8899bb]'
            }`}
          >
            {tab === 'sent' ? 'Emails' : tab === 'reports' ? '↗ Reports' : tab === 'templates' ? 'Templates' : tab === 'settings' ? '⚙ Settings' : tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-t-full" />
            )}
            {tab === 'leads' && leads.length > 0 && (
              <span className="ml-1.5 text-xs bg-[#1e2d4a] text-[#8899bb] px-1.5 py-0.5 rounded-full">
                {leads.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left panel — Services (always visible) */}
        <aside className="w-60 flex-shrink-0 border-r border-[#1e2d4a]/60 bg-[#0a0a1e]/70 backdrop-blur-md overflow-hidden">
          <ServicesList
            services={services}
            leads={leads}
            selectedService={selectedService}
            isScanning={isScanning}
            onSelect={handleServiceSelect}
            onAdd={() => { setEditingService(null); setShowServiceForm(true); }}
            onEdit={(s) => { setEditingService(s); setServiceFormInitialTab('settings'); setShowServiceForm(true); }}
            onScanNow={handleScanNow}
            onDelete={handleDeleteService}
          />
        </aside>

        {activeTab === 'home' ? (
          <>
            {/* Center — 3D Mind Map + optional log overlay */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
              <div className="flex-1 relative overflow-hidden">
                <MindMapCanvas
                  service={selectedService}
                  leads={serviceLeads}
                  selectedLeadId={selectedLead?.id ?? null}
                  onLeadSelect={handleLeadSelectById}
                />
              </div>

              {/* Scan log panel */}
              {showLogs && scanLogs.length > 0 && (
                <div className="h-48 border-t border-[#1e2d4a]/60 bg-[#0a0a1e]/80 backdrop-blur-md flex-shrink-0">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2d4a]">
                    <div className="flex items-center gap-2">
                      {isScanning && <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />}
                      <span className="text-xs font-semibold text-[#8899bb] uppercase tracking-wider font-mono">
                        {isScanning ? 'Scanning…' : `Scan complete — ${scanLogs.filter(l => l.level === 'success').length} success`}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowLogs(false)}
                      className="text-[#8899bb] hover:text-white text-sm transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  <ScanLog logs={scanLogs} isScanning={isScanning} />
                </div>
              )}
            </main>

            {/* Right panel — Leads sidebar */}
            <aside className="w-80 flex-shrink-0 border-l border-[#1e2d4a]/60 bg-[#0a0a1e]/70 backdrop-blur-md overflow-hidden">
              <LeadsList
                leads={leads}
                selectedService={selectedService}
                selectedLeadId={selectedLead?.id ?? null}
                isScanning={isScanning}
                onLeadSelect={handleLeadSelect}
              />
            </aside>
          </>
        ) : activeTab === 'leads' ? (
          /* Leads tab — full-width grid */
          <div className="flex-1 overflow-hidden bg-[#0a0a1e]/60 backdrop-blur-md">
            <LeadsView
              leads={serviceLeads}
              selectedService={selectedService}
              isScanning={isScanning}
              onLeadSelect={handleLeadSelect}
            />
          </div>
        ) : activeTab === 'sent' ? (
          /* Sent / Received Emails tab */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a1e]/60 backdrop-blur-md">
            <div className="px-5 py-3 border-b border-[#1e2d4a]/60 flex-shrink-0 flex items-center gap-4">
              <div className="flex gap-1">
                <button
                  onClick={() => setSentInnerTab('sent')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    sentInnerTab === 'sent'
                      ? 'bg-[#1a4b8c] text-white'
                      : 'text-[#8899bb] hover:text-[#e8edf5]'
                  }`}
                >
                  Sent
                </button>
                <button
                  onClick={() => setSentInnerTab('received')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    sentInnerTab === 'received'
                      ? 'bg-[#1a4b8c] text-white'
                      : 'text-[#8899bb] hover:text-[#e8edf5]'
                  }`}
                >
                  Received
                </button>
              </div>
              {selectedService && (
                <span className="text-xs text-[#4a5a7a]">— {selectedService.name}</span>
              )}
            </div>
            {sentInnerTab === 'sent' ? (
              <SentEmailsTable selectedService={selectedService} />
            ) : (
              <ReceivedEmailsTable selectedService={selectedService} />
            )}
          </div>
        ) : activeTab === 'reports' ? (
          /* Reports tab */
          <div className="flex-1 flex overflow-hidden bg-[#0a0a1e]/60 backdrop-blur-md">
            <ReportsPage services={services} selectedService={selectedService} />
          </div>
        ) : activeTab === 'templates' ? (
          /* Templates tab */
          <div className="flex-1 flex overflow-hidden bg-[#0a0a1e]/60 backdrop-blur-md">
            <TemplatesPage services={services} selectedService={selectedService} />
          </div>
        ) : (
          /* Settings tab */
          <div className="flex-1 flex overflow-hidden bg-[#0a0a1e]/60 backdrop-blur-md">
            <SettingsPage
              company={company ?? { id: '', user_id: '', name: '', map_provider: 'google', created_at: '', updated_at: '' }}
              selectedService={selectedService}
              onCompanySave={updated => setCompany(updated)}
              onServiceSaved={service => {
                setServices(prev => prev.map(s => s.id === service.id ? service : s));
                if (selectedService?.id === service.id) setSelectedService(service);
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={isBottomSheetOpen}
        lead={selectedLead}
        service={selectedService}
        onClose={() => setIsBottomSheetOpen(false)}
        onStatusChange={handleStatusChange}
        onEmailSaved={handleEmailSaved}
      />

      {/* Service Form Modal */}
      {showServiceForm && (
        <ServiceForm
          service={editingService}
          initialTab={serviceFormInitialTab}
          onClose={() => { setShowServiceForm(false); setEditingService(null); setServiceFormInitialTab('settings'); }}
          onSave={handleServiceSaved}
          onScanNow={handleScanNow}
        />
      )}

    </div>
  );
}
