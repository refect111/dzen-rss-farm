const cheerio = require('cheerio');
const logger = require('../utils/logger');

/**
 * Transforms raw RSS item into a Dzen-ready article format.
 */
function processItem(item, options = {}) {
  const { maxLength = 5000, includeSource = true, rewriteTitle = false } = options;

  let title = cleanTitle(item.title);
  let body = buildBody(item, { maxLength, includeSource });

  return {
    ...item,
    title,
    body,
    tags: buildTags(item),
    coverImage: item.imageUrl || null,
    processedAt: new Date().toISOString(),
  };
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 200);
}

function buildBody(item, { maxLength, includeSource }) {
  let content = item.content || item.summary || '';

  // Strip HTML to get plain text, then rebuild clean HTML
  const $ = cheerio.load(content);

  // Remove scripts, styles, inline ads
  $('script, style, iframe, [class*="ad"], [id*="ad"]').remove();

  // Fix relative image URLs
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('//')) {
      $(el).attr('src', 'https:' + src);
    }
  });

  let cleanHtml = $('body').html() || '';

  // If content is too short, use summary
  if (stripHtml(cleanHtml).length < 100 && item.summary) {
    cleanHtml = `<p>${escapeHtml(item.summary)}</p>`;
  }

  // Truncate if too long
  if (stripHtml(cleanHtml).length > maxLength) {
    cleanHtml = truncateHtml(cleanHtml, maxLength);
    cleanHtml += `<p>...</p>`;
  }

  // Append source link
  if (includeSource && item.link) {
    cleanHtml += `\n<p><em>Источник: <a href="${item.link}" rel="nofollow">${item.feedName || 'Источник'}</a></em></p>`;
  }

  return cleanHtml;
}

function buildTags(item) {
  const tags = new Set();

  if (item.feedCategory) tags.add(item.feedCategory);

  for (const cat of (item.categories || [])) {
    if (typeof cat === 'string' && cat.length < 50) {
      tags.add(cat.toLowerCase().trim());
    }
  }

  return [...tags].slice(0, 5);
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateHtml(html, maxChars) {
  const $ = cheerio.load(html);
  let charCount = 0;
  let truncated = false;

  function traverse(node) {
    if (truncated) return;
    if (node.type === 'text') {
      const remaining = maxChars - charCount;
      if (node.data.length > remaining) {
        node.data = node.data.slice(0, remaining) + '...';
        truncated = true;
      } else {
        charCount += node.data.length;
      }
    } else if (node.children) {
      for (const child of [...node.children]) {
        traverse(child);
        if (truncated) break;
      }
    }
  }

  traverse($.root()[0]);
  return $('body').html() || '';
}

function filterItems(items, config = {}) {
  const {
    minContentLength = 50,
    blockedKeywords = [],
    requiredKeywords = [],
    maxAgeHours = 48,
  } = config;

  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  return items.filter(item => {
    // Age filter
    const pubDate = new Date(item.pubDate).getTime();
    if (pubDate < cutoff) {
      logger.debug(`Filtered (too old): ${item.guid}`);
      return false;
    }

    const text = (item.title + ' ' + stripHtml(item.content || item.summary || '')).toLowerCase();

    // Blocked keywords
    for (const kw of blockedKeywords) {
      if (text.includes(kw.toLowerCase())) {
        logger.debug(`Filtered (blocked keyword "${kw}"): ${item.guid}`);
        return false;
      }
    }

    // Required keywords
    if (requiredKeywords.length > 0) {
      const hasRequired = requiredKeywords.some(kw => text.includes(kw.toLowerCase()));
      if (!hasRequired) {
        logger.debug(`Filtered (missing required keyword): ${item.guid}`);
        return false;
      }
    }

    // Min content length
    const contentLength = stripHtml(item.content || item.summary || '').length;
    if (contentLength < minContentLength) {
      logger.debug(`Filtered (too short, ${contentLength} chars): ${item.guid}`);
      return false;
    }

    return true;
  });
}

module.exports = { processItem, filterItems };
