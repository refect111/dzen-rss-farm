# Dzen RSS Farm

Automated RSS aggregator that fetches news from multiple RSS feeds, filters and processes the content, then publishes articles to [Dzen (Яндекс Дзен)](https://dzen.ru) on a schedule.

## Features

- Fetches multiple RSS feeds simultaneously
- Filters content by age, keywords, and minimum length
- Processes and cleans HTML content for Dzen
- Publishes via browser automation (Playwright) or generates a new RSS feed
- Deduplication — never republishes the same article
- Cron-based scheduling with configurable timezone
- Persistent queue and publish history

## Project Structure

```
dzen-rss-farm/
├── index.js                  # Entry point
├── src/
│   ├── fetcher/
│   │   └── rssFetcher.js     # RSS feed parser
│   ├── processor/
│   │   └── contentProcessor.js  # Content cleaning & filtering
│   ├── publisher/
│   │   ├── dzenPublisher.js  # Publishes to Dzen via browser
│   │   └── rssPublisher.js   # Outputs a new RSS feed file
│   ├── scheduler.js          # Cron scheduler / orchestrator
│   └── utils/
│       ├── logger.js         # Winston logger
│       └── storage.js        # Published history & queue
├── config/
│   └── feeds.example.json    # Feed configuration template
├── data/                     # Runtime data (queue, history, session)
├── logs/                     # Log files
└── public/                   # Generated RSS output (if using rss publisher)
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Configure feeds

```bash
cp config/feeds.example.json config/feeds.json
```

Edit `config/feeds.json` to add your RSS feeds and adjust filter settings.

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Dzen credentials:

```env
DZEN_EMAIL=your-yandex@yandex.ru
DZEN_PASSWORD=your-password
PUBLISHER_TYPE=dzen   # or "rss" to just generate a feed file
```

## Usage

| Command | Description |
|---------|-------------|
| `npm start` | Start daemon with cron scheduler |
| `npm run fetch` | One-shot: fetch feeds and fill queue |
| `npm run publish` | One-shot: publish queued items |
| `npm run run` | One-shot: fetch + publish |

### Publisher modes

**`dzen`** (default) — Uses Playwright to open Chrome and post articles to your Dzen channel via the web editor. Requires valid `DZEN_EMAIL` and `DZEN_PASSWORD`.

**`rss`** — Writes a combined RSS XML file to `./public/feed.xml`. Useful for re-broadcasting content without Dzen credentials.

## Configuration Reference (`config/feeds.json`)

```json
{
  "feeds": [
    {
      "url": "https://lenta.ru/rss/news",
      "name": "Лента.ру",
      "category": "новости",
      "enabled": true
    }
  ],
  "filter": {
    "minContentLength": 100,
    "maxAgeHours": 24,
    "blockedKeywords": ["реклама", "sponsored"],
    "requiredKeywords": []
  },
  "processing": {
    "maxLength": 5000,
    "includeSource": true
  },
  "publishing": {
    "batchSize": 3,
    "delayBetweenPostsMs": 60000,
    "publisher": "dzen"
  },
  "schedule": {
    "fetchCron": "0 */3 * * *",
    "publishCron": "30 */3 * * *",
    "timezone": "Europe/Moscow",
    "runOnStart": true
  }
}
```

### Schedule examples (cron)

| Cron | Meaning |
|------|---------|
| `0 */3 * * *` | Every 3 hours |
| `0 8,14,20 * * *` | At 08:00, 14:00, 20:00 |
| `*/30 * * * *` | Every 30 minutes |

## Notes

- Dzen does not have a public API; posting relies on browser automation and may break if Dzen's UI changes.
- First run will open a Chromium browser and log you in; subsequent runs reuse the saved session (`data/dzen-session.json`).
- Set `HEADLESS=false` to watch the browser during debugging.
