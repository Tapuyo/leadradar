import * as cheerio from 'cheerio';

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Pages to try in order when looking for a contact email
const CONTACT_PATHS = ['', '/contact', '/contact-us', '/about'];

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      maxRedirects: 3,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    return null;
  }
}

function extractEmail(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. mailto: links are most reliable
  let found: string | null = null;
  $('a[href^="mailto:"]').each((_, el) => {
    if (found) return;
    const href = $(el).attr('href') ?? '';
    const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
    if (email && !email.includes('example') && !email.includes('domain')) found = email;
  });
  if (found) return found;

  // 2. Regex scan of visible text
  const text = $('body').text();
  const matches = text.match(EMAIL_RE) ?? [];
  for (const m of matches) {
    const e = m.toLowerCase();
    if (!e.includes('example') && !e.includes('domain') && !e.includes('.png') && !e.includes('.jpg')) {
      return e;
    }
  }

  return null;
}

/** Scrape a business website for a contact email. Tries root + /contact pages. */
export async function scrapeEmailFromWebsite(siteUrl: string): Promise<string | null> {
  const base = siteUrl.replace(/\/$/, '');
  for (const path of CONTACT_PATHS) {
    const url = base + path;
    const html = await fetchHtml(url);
    if (!html) continue;
    const email = extractEmail(html);
    if (email) return email;
  }
  return null;
}

/**
 * For a batch of leads (with source_url but no email), scrape websites
 * concurrently (max `concurrency` at a time) and fill in emails.
 */
export async function enrichLeadsWithEmails<T extends { email: string | null; source_url: string | null }>(
  leads: T[],
  concurrency = 8,
  onProgress?: (done: number, total: number) => void,
): Promise<T[]> {
  const needsEmail = leads.filter(l => !l.email && l.source_url);
  let done = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < needsEmail.length; i += concurrency) {
    const chunk = needsEmail.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async lead => {
        const email = await scrapeEmailFromWebsite(lead.source_url!);
        if (email) (lead as { email: string | null }).email = email;
        done++;
        onProgress?.(done, needsEmail.length);
      })
    );
  }

  return leads;
}
