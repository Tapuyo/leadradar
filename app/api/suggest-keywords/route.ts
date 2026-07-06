import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, description } = await req.json();
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });

  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are a B2B lead generation expert. A business offers the following service:

Service name: ${name}
${description ? `Description: ${description}` : ''}

Your task: Identify the types of businesses, establishments, and places that would be ideal customers for this service. Generate search keywords that can be used to find these potential customers on Google Maps, Mapbox, and business directories.

Rules:
- Think about who NEEDS this service (e.g., a plumber → apartment complexes, property managers, hotels, restaurants, construction companies)
- Include both the customer TYPE and specific establishment names where relevant
- Mix broad terms (e.g., "property management") with specific ones (e.g., "apartment complex")
- 12–18 keywords total
- Return ONLY a JSON array of lowercase strings, no explanation, no markdown fences

Example output for "electrician":
["apartment complex","property management","commercial building","office park","restaurant","hotel","retail store","warehouse","school","hospital","construction company","real estate developer","shopping mall","industrial facility"]`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]';

  let keywords: string[] = [];
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
    keywords = JSON.parse(cleaned);
    if (!Array.isArray(keywords)) keywords = [];
    keywords = keywords.filter((k): k is string => typeof k === 'string').map(k => k.toLowerCase().trim());
  } catch {
    return Response.json({ error: 'AI returned invalid JSON' }, { status: 500 });
  }

  return Response.json({ keywords });
}
