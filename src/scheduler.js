const cron = require('node-cron');
const logger = require('./utils/logger');
const { fetchAllFeeds } = require('./fetcher/rssFetcher');
const { processItem, filterItems } = require('./processor/contentProcessor');
const { enqueue, dequeue, getQueueSize } = require('./utils/storage');

let publisherInstance = null;
let isRunning = false;

async function runFetchCycle(config) {
  if (isRunning) {
    logger.warn('Fetch cycle already running, skipping...');
    return;
  }

  isRunning = true;
  logger.info('=== Starting fetch cycle ===');

  try {
    const rawItems = await fetchAllFeeds(config.feeds);

    const filtered = filterItems(rawItems, {
      minContentLength: config.filter?.minContentLength ?? 50,
      blockedKeywords: config.filter?.blockedKeywords ?? [],
      requiredKeywords: config.filter?.requiredKeywords ?? [],
      maxAgeHours: config.filter?.maxAgeHours ?? 48,
    });

    logger.info(`Fetched ${rawItems.length} items, ${filtered.length} passed filters`);

    for (const item of filtered) {
      const processed = processItem(item, {
        maxLength: config.processing?.maxLength ?? 5000,
        includeSource: config.processing?.includeSource ?? true,
      });
      enqueue(processed);
    }

    logger.info(`Queue size: ${getQueueSize()}`);
  } catch (err) {
    logger.error(`Fetch cycle error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

async function runPublishCycle(config) {
  if (!publisherInstance) return;

  const batchSize = config.publishing?.batchSize ?? 3;
  const delayMs = config.publishing?.delayBetweenPostsMs ?? 30000;
  let published = 0;

  logger.info(`=== Starting publish cycle (batch: ${batchSize}) ===`);

  for (let i = 0; i < batchSize; i++) {
    const item = dequeue();
    if (!item) {
      logger.info('Queue empty, stopping publish cycle');
      break;
    }

    const result = await publisherInstance.publishArticle(item);
    if (result.success) {
      published++;
      logger.info(`[${published}/${batchSize}] Published: "${item.title}"`);
    }

    if (i < batchSize - 1) {
      logger.debug(`Waiting ${delayMs / 1000}s before next post...`);
      await sleep(delayMs);
    }
  }

  logger.info(`Publish cycle complete. Published ${published} articles.`);
}

function setPublisher(publisher) {
  publisherInstance = publisher;
}

function startScheduler(config) {
  const fetchCron = config.schedule?.fetchCron ?? '0 */2 * * *';
  const publishCron = config.schedule?.publishCron ?? '30 */2 * * *';

  logger.info(`Fetch schedule: ${fetchCron}`);
  logger.info(`Publish schedule: ${publishCron}`);

  cron.schedule(fetchCron, () => runFetchCycle(config), {
    scheduled: true,
    timezone: config.schedule?.timezone ?? 'Europe/Moscow',
  });

  cron.schedule(publishCron, () => runPublishCycle(config), {
    scheduled: true,
    timezone: config.schedule?.timezone ?? 'Europe/Moscow',
  });

  logger.info('Scheduler started');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { startScheduler, setPublisher, runFetchCycle, runPublishCycle };
