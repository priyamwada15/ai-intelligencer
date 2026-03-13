export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Missing date' });

  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - target) / 86400000);
  const timeRef = diff === 0 ? 'today' : diff === 1 ? 'yesterday' : diff <= 7 ? `${diff} days ago`
    : `on ${target.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const prompt = `You are a terse AI news editor. Provide exactly 6 notable AI news items from ${timeRef} (${date}).
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

    if (!response.ok) {
      return res.status(500).json({ error: 'Anthropic API error', detail: data.error?.message || response.status });
    }

    if (!data.content || !Array.isArray(data.content)) {
      return res.status(500).json({ error: 'Unexpected response', detail: JSON.stringify(data).slice(0, 300) });
    }

    let raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ error: 'No JSON array in response', raw: raw.slice(0, 300) });

    const articles = JSON.parse(match[0]);
    return res.status(200).json({ articles, source: 'live' });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch news', detail: err.message });
  }
}
