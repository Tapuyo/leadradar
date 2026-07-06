import { createServerClient } from '@supabase/ssr';
import { Service, Lead } from '@/types';
import { searchBusinessesGoogle } from './scrapers/googlePlaces';
import { geocodeAddress } from './scrapers/mapboxGeocode';
import { scrapecraigslist } from './scrapers/craigslist';
import { scrapeCustomSite } from './scrapers/customSite';
import { normalizeRawLead } from './normalizer';
import { deduplicateLeads } from './deduplication';
import { scoreLead, getMatchedKeywords } from './scoring';
import { enrichLeadsWithEmails } from './scrapers/emailScraper';

export type ScanLogger = (message: string, level?: 'info' | 'success' | 'warn' | 'error') => void;

function makeSupabaseServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  );
}

export async function scanService(
  service: Service,
  supabaseClient?: ReturnType<typeof makeSupabaseServiceClient>,
  log: ScanLogger = () => {}
): Promise<Lead[]> {
  const supabase = supabaseClient ?? makeSupabaseServiceClient();
  const scraperPromises: Promise<Awaited<ReturnType<typeof searchBusinessesGoogle>>>[] = [];

  // Validate before starting
  const hasKeywords = service.keywords.length > 0;
  const hasCities = service.target_cities.length > 0;
  const hasStates = service.target_states.length > 0;

  if (!hasKeywords) {
    log('No keywords configured — edit this service and add at least one keyword.', 'error');
    return [];
  }

  if (service.source_mapbox) {
    if (!hasStates) {
      log('Google Maps: skipped — no target states configured.', 'warn');
    } else {
      // Build location pairs: city+state when cities set, state-only when not
      const locations: { city: string; state: string; label: string }[] = hasCities
        ? service.target_states.flatMap(state =>
            service.target_cities.map(city => ({ city, state, label: `${city}, ${state}` }))
          )
        : service.target_states.map(state => ({ city: state, state: '', label: state }));

      if (!hasCities) {
        log('Google Maps: no cities set — searching by state only.', 'warn');
      }

      for (const { city, state, label } of locations) {
        for (const keyword of service.keywords) {
          log(`Searching Google Maps for "${keyword}" in ${label}...`);
          scraperPromises.push(
            searchBusinessesGoogle(keyword, city, state)
              .then(results => {
                log(`  → ${results.length} result${results.length !== 1 ? 's' : ''} found`, 'success');
                return results;
              })
              .catch(err => {
                log(`  → Google Maps search failed: ${err.message}`, 'error');
                return [];
              })
          );
        }
      }
    }
  }

  if (service.source_craigslist) {
    if (!hasCities) {
      log('Craigslist: skipped — requires cities (no state-wide search available).', 'warn');
    } else {
      for (const city of service.target_cities) {
        for (const keyword of service.keywords) {
          log(`Scraping Craigslist for "${keyword}" in ${city}...`);
          scraperPromises.push(
            scrapecraigslist(keyword, city)
              .then(results => {
                log(`  → ${results.length} listing${results.length !== 1 ? 's' : ''} found`, 'success');
                return results;
              })
              .catch(err => {
                log(`  → Craigslist scrape failed: ${err.message}`, 'error');
                return [];
              })
          );
        }
      }
    }
  }

  if (service.source_custom && service.custom_url) {
    log(`Scraping custom site: ${service.custom_url}...`);
    scraperPromises.push(
      scrapeCustomSite(service.custom_url, service.keywords)
        .then(results => {
          log(`  → ${results.length} result${results.length !== 1 ? 's' : ''} found`, 'success');
          return results;
        })
        .catch(err => {
          log(`  → Custom scrape failed: ${err.message}`, 'error');
          return [];
        })
    );
  }

  if (scraperPromises.length === 0) {
    log('Nothing to scan — check that at least one source is enabled with cities and states configured.', 'warn');
    return [];
  }

  const results = await Promise.all(scraperPromises);
  const allRaw = results.flat().map(normalizeRawLead);
  log(`Total raw results: ${allRaw.length}`);

  // Geocode leads without coordinates
  const needsGeocode = allRaw.filter(l => (l.latitude == null || l.longitude == null) && l.address);
  if (needsGeocode.length > 0) {
    log(`Geocoding ${needsGeocode.length} lead${needsGeocode.length !== 1 ? 's' : ''} without coordinates...`);
  }

  const geocodePromises = allRaw.map(async (lead) => {
    if ((lead.latitude == null || lead.longitude == null) && lead.address) {
      const geo = await geocodeAddress(lead.address).catch(() => null);
      if (geo) return { ...lead, latitude: geo.latitude, longitude: geo.longitude, address: geo.full_address };
    }
    return lead;
  });
  const geocoded = await Promise.all(geocodePromises);

  // Scrape business websites to find emails (Google Places doesn't provide them directly)
  const needsEmailScrape = geocoded.filter(l => !l.email && l.source_url);
  if (needsEmailScrape.length > 0) {
    log(`Scraping ${needsEmailScrape.length} website${needsEmailScrape.length !== 1 ? 's' : ''} for email addresses...`);
    let lastLogged = 0;
    await enrichLeadsWithEmails(geocoded, 8, (done, total) => {
      if (done - lastLogged >= 10 || done === total) {
        log(`  → ${done}/${total} websites checked`, 'info');
        lastLogged = done;
      }
    });
    const found = geocoded.filter(l => !!l.email).length;
    log(`  → ${found} email${found !== 1 ? 's' : ''} found`, 'success');
  }

  // Keep only leads that have an email
  const withEmail = geocoded.filter(l => !!l.email);
  log(`Leads with email: ${withEmail.length}`);

  if (withEmail.length === 0) {
    log('No leads with email addresses found.', 'warn');
    return [];
  }

  log(`Deduplicating against existing leads...`);
  const deduped = await deduplicateLeads(withEmail, service.id, supabase);
  const dupeCount = withEmail.length - deduped.length;
  if (dupeCount > 0) log(`  → ${dupeCount} duplicate${dupeCount !== 1 ? 's' : ''} removed`, 'warn');

  if (deduped.length === 0) {
    log('No new leads to insert.', 'warn');
    return [];
  }

  // Score first, then take top N based on service.max_leads
  const maxLeads = service.max_leads ?? 100;
  const scored = deduped
    .map(lead => ({ lead, score: scoreLead(lead, service.keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLeads);

  if (deduped.length > maxLeads) {
    log(`  → Keeping top ${maxLeads} of ${deduped.length} new leads by score`, 'warn');
  }

  log(`Scoring and inserting ${scored.length} new lead${scored.length !== 1 ? 's' : ''}...`);
  const total = scored.length;
  const toInsert = scored.map(({ lead, score }, i) => {
    const angle = (2 * Math.PI * i) / total;
    const r = 3;
    return {
      ...lead,
      service_id: service.id,
      company_id: service.company_id,
      keywords_matched: getMatchedKeywords(lead, service.keywords),
      score,
      node_position: {
        x: r * Math.cos(angle),
        y: r * Math.sin(angle),
        z: (Math.random() - 0.5) * 2,
      },
      scan_date: new Date().toISOString().split('T')[0],
    };
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('leads').insert(batch);
    if (error) throw new Error(error.message);
  }

  await supabase
    .from('services')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', service.id);

  log(`Scan complete — ${toInsert.length} new lead${toInsert.length !== 1 ? 's' : ''} added.`, 'success');
  return toInsert as unknown as Lead[];
}
