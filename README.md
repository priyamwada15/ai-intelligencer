# The AI Intelligencer — Deploy Guide

## Project structure
```
ai-intelligencer/
├── api/
│   ├── cron.js        ← Runs at midnight UTC, fetches + caches daily news
│   └── news.js        ← Serves news to the widget (KV cache → live fallback)
├── public/
│   └── index.html     ← The widget
├── package.json
├── vercel.json        ← Cron schedule config
└── README.md
```

## How it works
- Every day at midnight UTC, Vercel runs the cron job → fetches AI news → stores in Vercel KV
- Every visitor reads from KV (instant, free, no API call)
- If KV is empty (e.g. first deploy before cron runs), it fetches live and populates the cache
- Results expire after 30 days automatically

## Deploy steps

### 1. Push to GitHub
Create a new repo, push this folder.

### 2. Import to Vercel
- Go to vercel.com → New Project → import your repo
- Framework: Other
- Root directory: leave blank

### 3. Add Vercel KV
- In your Vercel project dashboard → Storage → Create KV Database
- Connect it to your project (this auto-adds KV_* env vars)

### 4. Add environment variables
In Vercel dashboard → Settings → Environment Variables, add:
- `ANTHROPIC_API_KEY` = your key from console.anthropic.com

CRON_SECRET is set automatically by Vercel.

### 5. Deploy
Vercel will deploy on every push to main.
After first deploy, trigger the cron manually once:
- Go to your project → Cron Jobs tab → click Run Now

## Embed in Framer
```html
<iframe 
  src="https://your-project.vercel.app" 
  width="620" 
  height="560" 
  style="border:none;"
  loading="lazy">
</iframe>
```
