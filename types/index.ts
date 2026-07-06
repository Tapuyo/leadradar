export interface Company {
  id: string;
  user_id: string;
  name: string;
  map_provider: 'mapbox' | 'google';
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  target_states: string[];
  target_cities: string[];
  keywords: string[];
  source_mapbox: boolean;
  source_craigslist: boolean;
  source_custom: boolean;
  custom_url: string | null;
  scan_enabled: boolean;
  scan_time: string;
  last_scanned_at: string | null;
  max_leads: number;
  max_emails_per_day: number;
  auto_send: boolean;
  email_strategy: 'single' | 'random' | 'sequence';
  email_template_id: string | null;
  email_sequence: string[];
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  service_id: string;
  company_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  source: 'google' | 'craigslist' | 'custom';
  source_url: string | null;
  keywords_matched: string[];
  score: number;
  status: 'new' | 'seen' | 'archived';
  node_position: { x: number; y: number; z: number } | null;
  scan_date: string;
  generated_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  service_id: string;
  company_id: string;
  name: string;
  subject: string;
  body: string;
  html_body: string | null;
  design: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SentEmail {
  id: string;
  company_id: string;
  lead_id: string | null;
  service_id: string | null;
  lead_name: string;
  lead_email: string | null;
  subject: string | null;
  body: string;
  sent_at: string;
}

export interface RawLead {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  source: 'google' | 'craigslist' | 'custom';
  source_url: string | null;
}
