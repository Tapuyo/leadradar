const GHL_BASE = 'https://rest.gohighlevel.com/v1';

export interface GhlContact {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags?: string[];
  source?: string;
}

export interface GhlContactResult {
  contact: { id: string; email: string; firstName: string; lastName: string };
}

/**
 * Parse a display name into first/last. Falls back gracefully.
 */
function parseName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Create or update a contact in GoHighLevel (v1 Location API).
 * apiKey must be a Location-level API key from GHL Settings → Integrations.
 */
export async function upsertGhlContact(
  apiKey: string,
  contact: GhlContact
): Promise<GhlContactResult> {
  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contact),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Test a GHL API key by fetching the location info.
 */
export async function testGhlConnection(apiKey: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(`${GHL_BASE}/locations/`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, name: data?.location?.name ?? 'Connected' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export { parseName };
