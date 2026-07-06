import * as cheerio from 'cheerio';
import { RawLead } from '@/types';

const CITY_SUBDOMAINS: Record<string, string> = {
  'new york': 'newyork',
  'los angeles': 'losangeles',
  'chicago': 'chicago',
  'houston': 'houston',
  'phoenix': 'phoenix',
  'philadelphia': 'philadelphia',
  'san antonio': 'sanantonio',
  'san diego': 'sandiego',
  'dallas': 'dallas',
  'san jose': 'sanjose',
  'austin': 'austin',
  'jacksonville': 'jacksonville',
  'fort worth': 'fortworth',
  'columbus': 'columbus',
  'charlotte': 'charlotte',
  'indianapolis': 'indianapolis',
  'san francisco': 'sfbay',
  'seattle': 'seattle',
  'denver': 'denver',
  'nashville': 'nashville',
  'portland': 'portland',
  'las vegas': 'lasvegas',
  'memphis': 'memphis',
  'louisville': 'louisville',
  'baltimore': 'baltimore',
  'milwaukee': 'milwaukee',
  'albuquerque': 'albuquerque',
  'tucson': 'tucson',
  'fresno': 'fresno',
  'sacramento': 'sacramento',
  'atlanta': 'atlanta',
  'miami': 'miami',
  'minneapolis': 'minneapolis',
  'tampa': 'tampa',
  'orlando': 'orlando',
  'pittsburgh': 'pittsburgh',
  'cleveland': 'cleveland',
  'cincinnati': 'cincinnati',
  'detroit': 'detroit',
  'boston': 'boston',
};

export async function scrapecraigslist(
  keyword: string,
  city: string,
): Promise<RawLead[]> {
  const subdomain = CITY_SUBDOMAINS[city.toLowerCase()] ?? city.toLowerCase().replace(/\s+/g, '');
  const url = `https://${subdomain}.craigslist.org/search/bss?query=${encodeURIComponent(keyword)}`;

  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 3,
    });

    if (typeof res.data !== 'string') return [];

    const $ = cheerio.load(res.data);
    const leads: RawLead[] = [];

    // Craigslist server-rendered search result selectors
    $('li.cl-search-result, li.result-row').each((_, el) => {
      // Support both old and new Craigslist HTML structures
      const titleEl  = $(el).find('.titlestring, .result-title');
      const linkEl   = $(el).find('a.cl-app-anchor, a.result-title');
      const locEl    = $(el).find('.meta .maptag, .result-hood');
      const dateEl   = $(el).find('time');

      const name = titleEl.first().text().trim();
      if (!name) return;

      const href = linkEl.first().attr('href') ?? null;
      const sourceUrl = href
        ? (href.startsWith('http') ? href : `https://${subdomain}.craigslist.org${href}`)
        : null;

      leads.push({
        name,
        address: locEl.first().text().trim().replace(/[()]/g, '').trim() || null,
        latitude:    null,
        longitude:   null,
        phone:       null,
        email:       null,
        description: dateEl.length
          ? `Posted: ${dateEl.first().attr('datetime') ?? dateEl.first().text().trim()}`
          : null,
        source:      'craigslist',
        source_url:  sourceUrl,
      });
    });

    return leads;
  } catch {
    return [];
  }
}
