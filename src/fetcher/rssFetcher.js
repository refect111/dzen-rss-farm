const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { isPublished } = require('../utils/storage');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; DzenRSSFarm/1.0; +https://dzen.ru)',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

async function fetchFeed(feedConfig) {
  const { url, name, category } = feedConfig;
  logger.info(`Fetching feed: ${name} (${url})`);

  try {
    const feed = await parser.parseURL(url);
    const newItems = [];

    for (const item of feed.items || []) {
      const guid = item.guid || item.link || item.id;
      if (!guid) continue;
      if (isPublished(guid)) continue;

      const processed = {
        guid,
        title: item.title?.trim() || '',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: item.contentSnippet || item.summary || '',
        content: item.contentEncoded || item.content || item.summary || '',
        imageUrl: extractImage(item),
        categories: item.categories || [],
        feedName: name,
        feedCategory: category || 'general',
        author: item.creator || item.author || name,
      };

      newItems.push(processed);
    }

    logger.info(`Feed ${name}: found ${newItems.length} new items`);
    return newItems;
  } catch (err) {
    logger.error(`Failed to fetch feed ${name}: ${err.message}`);
    return [];
  }
}

function extractImage(item) {
  if (item.mediaContent?.['$']?.url) return item.mediaContent['$'].url;
  if (item.mediaThumbnail?.['$']?.url) return item.mediaThumbnail['$'].url;
  if (item.enclosure?.url) return item.enclosure.url;

  const content = item.contentEncoded || item.content || '';
  if (content) {
    const $ = cheerio.load(content);
    const img = $('img').first().attr('src');
    if (img) return img;
  }

  return null;
}

async function fetchFullContent(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const $ = cheerio.load(response.data);

    // Remove nav, header, footer, ads, scripts
    $('script, style, nav, header, footer, .advertisement, .ads, .sidebar, #sidebar').remove();

    // Try to find main article content
    const selectors = [
      'article',
      '[class*="article-body"]',
      '[class*="post-body"]',
      '[class*="entry-content"]',
      '.content',
      'main',
    ];

    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 200) {
        return el.html() || '';
      }
    }

    return $('body').html() || '';
  } catch (err) {
    logger.debug(`Could not fetch full content for ${url}: ${err.message}`);
    return null;
  }
}

async function fetchAllFeeds(feedConfigs) {
  const results = [];
  for (const config of feedConfigs) {
    const items = await fetchFeed(config);
    results.push(...items);
    // Polite delay between feeds
    await sleep(500);
  }
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fetchFeed, fetchAllFeeds, fetchFullContent };
