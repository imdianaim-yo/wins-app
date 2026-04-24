// parser.js — Sends brain dump to Claude API and returns structured accomplishments + learnings.
// Claude Haiku is used: it's fast, cheap (~$0.001 per entry), and great at classification.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a work journal assistant. The user will share a free-form brain dump of what happened at work today.

Extract two categories:
- accomplishments: things they completed, shipped, moved forward, presented, decided, helped with, or achieved
- learnings: things they discovered, realized, learned, or gained insight about

Rules:
- Each item should be a single concise sentence (max 20 words)
- Extract only what's explicitly mentioned — don't invent or embellish
- If something is both an accomplishment and a learning, put it in the most fitting category
- If the brain dump is empty or unclear, return empty arrays

Respond ONLY with valid JSON in this exact shape:
{
  "accomplishments": ["...", "..."],
  "learnings": ["...", "..."]
}`;

function getApiKey() {
  return localStorage.getItem('wins_api_key') || '';
}

function setApiKey(key) {
  localStorage.setItem('wins_api_key', key.trim());
}

async function parseDump(rawText) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');
  if (!rawText.trim()) throw new Error('EMPTY');

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // Note: direct browser-to-Anthropic calls require CORS — Anthropic allows this for their API.
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawText.trim() }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(content);
    return {
      accomplishments: Array.isArray(parsed.accomplishments) ? parsed.accomplishments : [],
      learnings: Array.isArray(parsed.learnings) ? parsed.learnings : [],
    };
  } catch {
    throw new Error('PARSE_FAILED');
  }
}
