import Anthropic from '@anthropic-ai/sdk';
import { fail, json } from '../_lib/validate.js';

const PER_SESSION = 5;
const PER_IP = 20;
const HOUR = 3600000;
const TONES = ['funny', 'warm', 'sorry', 'proud'];

const SYSTEM = `You help people write a short personal letter to a friend, which Audacity will print and post in India.
Write in the sender's own voice, first person, as if they wrote it themselves: plain, conversational Indian English with British spelling.
Use only what the sender tells you. Don't invent names, events or details they didn't mention.
Keep it under 250 words. Start with "Dear <name>," and end with a short sign-off line but no name after it.
Return only the letter text, with no title, notes or quotation marks.
If the request asks for anything threatening, harassing, hateful or sexual, reply only with: SORRY_CANT_HELP`;

// Friend-letter writing helper: three answers in, an editable first draft out.
export async function onRequestPost({ request, env }) {
  try {
    const { session, who, what, tone } = await request.json();
    if (typeof session !== 'string' || session.length < 8 || session.length > 64) return json({ error: 'Please refresh the page and try again.' }, 400);
    const fields = { who: String(who || '').trim(), what: String(what || '').trim() };
    if (!fields.who || !fields.what) return json({ error: "Tell us who it's for and what you want to say." }, 400);
    if (fields.who.length > 200 || fields.what.length > 2000) return json({ error: 'Please keep your answers a little shorter.' }, 400);
    if (!TONES.includes(tone)) return json({ error: 'Please pick a tone.' }, 400);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const since = Date.now() - HOUR;
    const usage = await env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM ai_usage WHERE session = ?1 AND created_at > ?3) AS s,
              (SELECT COUNT(*) FROM ai_usage WHERE ip = ?2 AND created_at > ?3) AS i`
    ).bind(session, ip, since).first();
    if (usage.s >= PER_SESSION || usage.i >= PER_IP) {
      return json({ error: "That's all the drafts we can do for now. Try again in an hour, or write it in your own words." }, 429);
    }
    await env.DB.prepare('INSERT INTO ai_usage (session, ip, created_at) VALUES (?1, ?2, ?3)').bind(session, ip, Date.now()).run();

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Who it's for: ${fields.who}\nWhat happened or what I want to say: ${fields.what}\nTone: ${tone}`,
        },
      ],
    });

    const text = response.stop_reason === 'refusal' ? '' : response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text || text.includes('SORRY_CANT_HELP')) {
      return json({ error: "We can't help with that one. You're welcome to write it in your own words." }, 422);
    }
    return json({ draft: text });
  } catch (err) {
    return fail(err);
  }
}
