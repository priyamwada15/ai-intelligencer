import { kv } from '@vercel/kv';

// Helper to build the date reference string for the prompt
function getTimeRef(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today - target) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff <= 7) return `${diff} days ago`;
  return `on ${target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

export default async function handler(req, res) {
  // Vercel automatically sets CRON_SECRET — verify the request is from Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const kvKey = `news:${dateKey}`;

  // Don't re-fetch if we already have today's news
  const existing = await kv.get(kvKey);
  if (existing) {
    return res.status(200).json({ message: 'Already cached', date: dateKey });
  }

  const timeRef = getTimeRef(today);
  const prompt = `You are a terse AI news editor. Provide exactly 6 notable AI news items from ${timeRef} (${dateKey}).
Return a JSON array of 6 objects with keys:
- "headline": punchy newspaper headline, max 10 words
- "category": one of MODELS / RESEARCH / INDUSTRY / POLICY / PRODUCTS / SCIENCE
- "dateline": city of origin or GLOBAL
- "summary": 2-3 tight factual sentences with specific details/numbers where known.
- "source": publication or organization name
ONLY the JSON array. No markdown, no explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    let raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const articles = JSON.parse(match[0]);

    // Store in KV — expire after 30 days to keep storage tidy
    await kv.set(kvKey, JSON.stringify(articles), { ex: 60 * 60 * 24 * 30 });

    return res.status(200).json({ message: 'Fetched and cached', date: dateKey, count: articles.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch news', detail: err.message });
  }
}
