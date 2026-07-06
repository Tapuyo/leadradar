import * as cheerio from 'cheerio';
import { RawLead } from '@/types';

export async function scrapeCustomSite(url: string, keywords: string[]): Promise<RawLead[]> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const $ = cheerio.load(res.data as string);
    const leads: RawLead[] = [];

    const emails = new Set<string>();
    const phones = new Set<string>();

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (email) emails.add(email);
    });

    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const phone = href.replace('tel:', '').trim();
      if (phone) phones.add(phone);
    });

    const text = $('body').text();
    const phoneRegex = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
    const phoneMatches = text.match(phoneRegex) ?? [];
    phoneMatches.forEach(p => phones.add(p.trim()));

    const lowerText = text.toLowerCase();
    const matchesKeywords = keywords.some(kw => lowerText.includes(kw.toLowerCase()));
    if (!matchesKeywords) return [];

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Unknown Business';
    const description = $('meta[name="description"]').attr('content') ??
      $('p').first().text().trim().slice(0, 500) ?? null;

    leads.push({
      name: title,
      address: null,
      latitude: null,
      longitude: null,
      phone: Array.from(phones)[0] ?? null,
      email: Array.from(emails)[0] ?? null,
      description: description || null,
      source: 'custom',
      source_url: url,
    });

    return leads;
  } catch {
    return [];
  }
}
