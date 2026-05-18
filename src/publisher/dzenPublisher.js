const { chromium } = require('playwright');
const logger = require('../utils/logger');
const { markAsPublished } = require('../utils/storage');

/**
 * Publishes an article to Dzen (dzen.ru) via browser automation.
 * Uses Playwright to navigate Dzen's editor interface.
 */
class DzenPublisher {
  constructor(config = {}) {
    this.email = config.email || process.env.DZEN_EMAIL;
    this.password = config.password || process.env.DZEN_PASSWORD;
    this.channelId = config.channelId || process.env.DZEN_CHANNEL_ID;
    this.headless = config.headless !== false;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
    this.sessionFile = config.sessionFile || 'data/dzen-session.json';
  }

  async init() {
    logger.info('Initializing Dzen publisher...');
    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'ru-RU',
      storageStatePath: this._sessionExists() ? this.sessionFile : undefined,
    });

    this.page = await this.context.newPage();
    logger.info('Browser initialized');
  }

  _sessionExists() {
    const fs = require('fs');
    return fs.existsSync(this.sessionFile);
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error('DZEN_EMAIL and DZEN_PASSWORD must be set');
    }

    logger.info('Logging into Dzen...');
    await this.page.goto('https://passport.yandex.ru/auth', { waitUntil: 'networkidle' });
    await this.page.fill('[name="login"]', this.email);
    await this.page.click('[type="submit"]');
    await this.page.waitForSelector('[name="passwd"]', { timeout: 10000 });
    await this.page.fill('[name="passwd"]', this.password);
    await this.page.click('[type="submit"]');
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });

    // Save session
    await this.context.storageState({ path: this.sessionFile });
    this.isLoggedIn = true;
    logger.info('Logged into Dzen successfully');
  }

  async ensureLoggedIn() {
    if (this.isLoggedIn) return;

    // Check if already logged in via session
    await this.page.goto('https://dzen.ru/profile/editor/articles', { waitUntil: 'networkidle' });
    const url = this.page.url();

    if (url.includes('passport.yandex') || url.includes('login')) {
      await this.login();
    } else {
      this.isLoggedIn = true;
      logger.info('Restored Dzen session');
    }
  }

  async publishArticle(article) {
    const { guid, title, body, tags, coverImage } = article;

    logger.info(`Publishing: "${title}"`);
    await this.ensureLoggedIn();

    try {
      // Navigate to new article editor
      await this.page.goto('https://dzen.ru/profile/editor/new-article', { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Set title
      const titleSelector = '[placeholder*="заголовок"], [data-testid="title"], .editor-title, h1[contenteditable]';
      await this.page.waitForSelector(titleSelector, { timeout: 10000 });
      await this.page.click(titleSelector);
      await this.page.fill(titleSelector, title);

      // Set cover image if available
      if (coverImage) {
        await this._setCoverImage(coverImage);
      }

      // Set article body
      const editorSelector = '[data-testid="editor"], .editor-content, [contenteditable="true"]:not([placeholder*="заголовок"])';
      await this.page.waitForSelector(editorSelector, { timeout: 10000 });
      await this.page.click(editorSelector);

      // Insert HTML content via clipboard API
      await this.page.evaluate((html) => {
        const editor = document.querySelector('[data-testid="editor"], .editor-content, [contenteditable="true"]:not([placeholder*="заголовок"])');
        if (editor) {
          editor.focus();
          document.execCommand('insertHTML', false, html);
        }
      }, body);

      await this.page.waitForTimeout(1000);

      // Add tags if supported
      if (tags && tags.length > 0) {
        await this._addTags(tags);
      }

      // Publish
      await this._clickPublish();

      await markAsPublished(guid, { title, publishedVia: 'dzen' });
      logger.info(`Published successfully: "${title}"`);
      return { success: true, title };
    } catch (err) {
      logger.error(`Failed to publish "${title}": ${err.message}`);
      return { success: false, title, error: err.message };
    }
  }

  async _setCoverImage(imageUrl) {
    try {
      const uploadBtn = await this.page.$('[data-testid="cover-upload"], .cover-upload, [aria-label*="обложк"]');
      if (!uploadBtn) return;

      // Try URL-based image insertion
      await this.page.evaluate((url) => {
        const input = document.querySelector('input[type="url"][placeholder*="ссылк"], input[type="url"][placeholder*="URL"]');
        if (input) {
          input.value = url;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, imageUrl);
    } catch (err) {
      logger.debug(`Could not set cover image: ${err.message}`);
    }
  }

  async _addTags(tags) {
    try {
      const tagInput = await this.page.$('[placeholder*="тег"], [data-testid="tags-input"]');
      if (!tagInput) return;

      for (const tag of tags.slice(0, 5)) {
        await tagInput.type(tag);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(300);
      }
    } catch (err) {
      logger.debug(`Could not add tags: ${err.message}`);
    }
  }

  async _clickPublish() {
    const publishSelectors = [
      '[data-testid="publish-button"]',
      'button:has-text("Опубликовать")',
      'button:has-text("Publish")',
      '.publish-btn',
    ];

    for (const sel of publishSelectors) {
      try {
        await this.page.waitForSelector(sel, { timeout: 3000 });
        await this.page.click(sel);
        await this.page.waitForTimeout(2000);
        return;
      } catch {
        continue;
      }
    }
    throw new Error('Could not find publish button');
  }

  async close() {
    if (this.context) await this.context.storageState({ path: this.sessionFile }).catch(() => {});
    if (this.browser) await this.browser.close();
    logger.info('Browser closed');
  }
}

/**
 * API-based publisher (for channels with API access).
 * Dzen does not have a public API; this is a stub for future use
 * or for channels with private API access.
 */
class DzenApiPublisher {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.DZEN_API_KEY;
    this.channelId = config.channelId || process.env.DZEN_CHANNEL_ID;
  }

  async publishArticle(article) {
    throw new Error('Dzen API is not publicly available. Use DzenPublisher (browser) instead.');
  }
}

module.exports = { DzenPublisher, DzenApiPublisher };
