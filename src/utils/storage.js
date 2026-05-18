const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLISHED_FILE = path.join(DATA_DIR, 'published.json');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPublished() {
  ensureDataDir();
  if (!fs.existsSync(PUBLISHED_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function savePublished(data) {
  ensureDataDir();
  fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function markAsPublished(guid, meta = {}) {
  const published = loadPublished();
  published[guid] = { publishedAt: new Date().toISOString(), ...meta };
  savePublished(published);
}

function isPublished(guid) {
  const published = loadPublished();
  return !!published[guid];
}

function loadQueue() {
  ensureDataDir();
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveQueue(items) {
  ensureDataDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function enqueue(item) {
  const queue = loadQueue();
  const exists = queue.find(q => q.guid === item.guid);
  if (!exists) {
    queue.push({ ...item, queuedAt: new Date().toISOString() });
    saveQueue(queue);
    logger.debug(`Queued item: ${item.guid}`);
  }
}

function dequeue() {
  const queue = loadQueue();
  if (queue.length === 0) return null;
  const [item, ...rest] = queue;
  saveQueue(rest);
  return item;
}

function getQueueSize() {
  return loadQueue().length;
}

function clearPublished(olderThanDays = 30) {
  const published = loadPublished();
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [guid, meta] of Object.entries(published)) {
    if (new Date(meta.publishedAt).getTime() < cutoff) {
      delete published[guid];
      removed++;
    }
  }
  savePublished(published);
  if (removed > 0) logger.info(`Cleared ${removed} old published entries`);
}

module.exports = { markAsPublished, isPublished, enqueue, dequeue, getQueueSize, clearPublished, loadQueue };
