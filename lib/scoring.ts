import { RawLead } from '@/types';

export function scoreLead(lead: RawLead, keywords: string[]): number {
  const text = `${lead.name} ${lead.description ?? ''}`.toLowerCase();
  const matched = keywords.filter(kw => text.includes(kw.toLowerCase()));
  const kwScore = (matched.length / Math.max(keywords.length, 1)) * 50;
  const contactScore = lead.phone && lead.email ? 20 : lead.phone || lead.email ? 10 : 0;
  const sourceScore = lead.source === 'google' ? 15 : lead.source === 'craigslist' ? 10 : 7;
  const descScore = Math.min((lead.description?.length ?? 0) / 200, 1) * 15;
  return Math.round(kwScore + contactScore + sourceScore + descScore);
}

export function getMatchedKeywords(lead: RawLead, keywords: string[]): string[] {
  const text = `${lead.name} ${lead.description ?? ''}`.toLowerCase();
  return keywords.filter(kw => text.includes(kw.toLowerCase()));
}
