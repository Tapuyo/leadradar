import Anthropic from '@anthropic-ai/sdk';
import { Lead, Service } from '@/types';

export async function generateEmailBody(
  lead: Lead,
  service: Service,
  senderEmail: string
): Promise<string> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Write a short, genuine cold outreach email from "${service.name}" to the business "${lead.name}"${lead.address ? ` at ${lead.address}` : ''}.

Our services: ${service.description ?? service.name}.

Rules you MUST follow:
- Write in plain conversational English. No markdown, no bullet points, no bold text, no asterisks.
- Maximum 120 words in the body.
- Do NOT invent any names, phone numbers, websites, or email addresses.
- Sign off only with the company name: "${service.name}"${senderEmail ? ` and the email: ${senderEmail}` : ''}.
- No emojis.
- Sound like a real person writing a genuine email, not a sales template.
- One clear call to action: ask for a short reply or a quick call.

Output only the email body and sign-off. Do not include a subject line.`,
    }],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

export function buildSubject(lead: Lead, service: Service): string {
  return `A quick note from ${service.name} for ${lead.name}`;
}
