const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { markAsPublished } = require('../utils/storage');

/**
 * Generates an RSS feed from processed items.
 * Useful for re-broadcasting aggregated content as a new RSS feed.
 */
class RssPublisher {
  constructor(config = {}) {
    this.outputDir = config.outputDir || path.join(process.cwd(), 'public');
    this.feedTitle = config.feedTitle || 'Dzen RSS Farm';
    this.feedLink = config.feedLink || 'https://example.com';
    this.feedDescription = config.feedDescription || 'Aggregated RSS feed';
    this.maxItems = config.maxItems || 50;
    this.outputFile = config.outputFile || 'feed.xml';
  }

  async publishArticle(article) {
    const { guid, title, body, link, pubDate, author, feedName } = article;

    logger.info(`Adding to RSS feed: "${title}"`);

    const feedPath = path.join(this.outputDir, this.outputFile);
    let items = this._loadItems(feedPath);

    // Prepend new item
    items.unshift({
      guid,
      title,
      link: link || this.feedLink,
      description: body,
      pubDate: pubDate || new Date().toISOString(),
      author: author || feedName,
    });

    // Trim to max
    items = items.slice(0, this.maxItems);

    // Write feed
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const xml = this._buildXml(items);
    fs.writeFileSync(feedPath, xml, 'utf8');

    markAsPublished(guid, { title, publishedVia: 'rss', feedFile: this.outputFile });
    logger.info(`RSS feed updated: ${feedPath} (${items.length} items)`);
    return { success: true, title };
  }

  _loadItems(feedPath) {
    if (!fs.existsSync(feedPath)) return [];
    try {
      const xml = fs.readFileSync(feedPath, 'utf8');
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      return matches.map(m => ({ _raw: m[0] }));
    } catch {
      return [];
    }
  }

  _buildXml(items) {
    const now = new Date().toUTCString();
    const itemsXml = items.map(item => {
      if (item._raw) return item._raw;
      return `  <item>
    <title><![CDATA[${item.title}]]></title>
    <link>${item.link}</link>
    <guid isPermaLink="false">${item.guid}</guid>
    <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    <author>${item.author || ''}</author>
    <description><![CDATA[${item.description}]]></description>
  </item>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${this.feedTitle}</title>
    <link>${this.feedLink}</link>
    <description>${this.feedDescription}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${this.feedLink}/${this.outputFile}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;
  }
}

module.exports = { RssPublisher };
