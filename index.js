'use strict';

console.log('PORT от Railway:', process.env.PORT);

require('dotenv').config();

const express = require('express');
const cron    = require('node-cron');
const OpenAI  = require('openai');
const RSS     = require('rss');
const fs      = require('fs');
const path    = require('path');

// ─── Конфигурация ────────────────────────────────────────────────────────────

const PORT      = process.env.PORT;
const DATA_FILE = path.join(__dirname, 'articles.json');

if (!process.env.OPENAI_API_KEY) {
  console.error('Ошибка: переменная OPENAI_API_KEY не задана. Создайте файл .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Аккаунты ────────────────────────────────────────────────────────────────

const ACCOUNTS = [
  {
    id:          'pushhim',
    name:        'ПУШХИМ',
    persona:     'опытная домашняя хозяйка, которая много лет борется с домашними вредителями и рекомендует средства марки ПУШХИМ',
    brand:       'ПУШХИМ',
    topics: [
      'как избавиться от тараканов в квартире навсегда',
      'клопы в матрасе: как обнаружить и уничтожить',
      'муравьи в доме: откуда берутся и как вывести',
      'блохи в квартире от кошки или собаки: что делать',
      'тараканы на кухне: эффективные методы борьбы',
      'как клопы попадают в квартиру и как от них избавиться',
      'муравьи в ванной комнате: причины и решение',
      'блохи у домашних животных и как защитить дом',
    ],
    feedTitle:       'ПУШХИМ — Борьба с вредителями в доме',
    feedDescription: 'Советы опытной хозяйки по борьбе с тараканами, клопами, муравьями и блохами. Проверенные средства марки ПУШХИМ.',
  },
  {
    id:          'dezinsecto',
    name:        'DEZINSECTO',
    persona:     'заядлый дачник с 15-летним опытом, который знает всё о вредителях сада и птичника, рекомендует средства DEZINSECTO',
    brand:       'DEZINSECTO',
    topics: [
      'блохи у кур в курятнике: лечение и профилактика',
      'клещи в саду: как защитить себя и растения',
      'муравьи на огороде: вред и способы борьбы',
      'насекомые-вредители в курятнике: полный обзор',
      'как обработать курятник от паразитов весной',
      'клещи у кур: признаки заражения и лечение',
      'муравьи в теплице: эффективные методы борьбы',
      'блохи и вши у домашней птицы: что делать',
    ],
    feedTitle:       'DEZINSECTO — Защита сада и птиц',
    feedDescription: 'Советы дачника по борьбе с клещами, блохами, муравьями в саду и курятнике. Средства DEZINSECTO.',
  },
  {
    id:          'expert',
    name:        'Эксперт-санитар',
    persona:     'независимый санитарный эксперт с 20-летним опытом дезинсекции, объективно сравнивающий разные средства',
    brand:       null,
    topics: [
      'ПУШХИМ vs DEZINSECTO: сравнение составов и эффективности',
      'обзор всей линейки средств ПУШХИМ 2024',
      'обзор всей линейки средств DEZINSECTO 2024',
      'рейтинг лучших средств от тараканов: ПУШХИМ и DEZINSECTO',
      'какое средство лучше от клопов: сравнение ПУШХИМ и DEZINSECTO',
      'ПУШХИМ для дома или DEZINSECTO для дачи: что выбрать',
      'профессиональные методы дезинсекции: разбираем составы',
      'безопасность средств ПУШХИМ и DEZINSECTO для детей и животных',
    ],
    feedTitle:       'Эксперт-санитар — Обзоры и сравнения',
    feedDescription: 'Независимые профессиональные обзоры и сравнения средств ПУШХИМ и DEZINSECTO от санитарного эксперта.',
  },
];

// ─── Хранилище статей ─────────────────────────────────────────────────────────

let store = {}; // { accountId: [ { guid, title, html, pubDate } ] }

function loadStore() {
  if (fs.existsSync(DATA_FILE)) {
    try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { store = {}; }
  }
  ACCOUNTS.forEach(a => { if (!store[a.id]) store[a.id] = []; });
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

// ─── Генерация статьи ─────────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generateArticle(account) {
  const topic = pickRandom(account.topics);

  const system = [
    `Ты — ${account.persona}.`,
    `Пишешь статьи для Яндекс Дзен на русском языке.`,
    `Стиль: живой, разговорный, с личным опытом и конкретными советами.`,
    account.brand
      ? `Органично упоминай и рекомендуй средства марки ${account.brand}.`
      : `Объективно сравнивай средства марок ПУШХИМ и DEZINSECTO, приводи конкретные данные.`,
    `Объём статьи: 900–1200 слов.`,
  ].join(' ');

  const user = [
    `Напиши статью на тему: «${topic}».`,
    ``,
    `Формат ответа:`,
    `ЗАГОЛОВОК: [привлекательный заголовок до 80 символов]`,
    ``,
    `[Полный текст статьи в HTML: используй теги <h2>, <p>, <ul>, <li>, <strong>.]`,
    ``,
    `Начни текст сразу после строки ЗАГОЛОВОК: — не повторяй заголовок в теле.`,
  ].join('\n');

  const resp = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens:  2500,
    temperature: 0.82,
  });

  const raw = resp.choices[0].message.content.trim();
  const titleMatch = raw.match(/^ЗАГОЛОВОК:\s*(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : topic;
  const html  = raw.replace(/^ЗАГОЛОВОК:\s*.+\n?/m, '').trim();

  return { title, html, topic };
}

// ─── Цикл генерации для всех аккаунтов ───────────────────────────────────────

async function generateAll() {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ▶ Начало генерации статей...`);

  for (const account of ACCOUNTS) {
    try {
      console.log(`  → Генерирую для "${account.name}"...`);
      const { title, html, topic } = await generateArticle(account);

      const article = {
        guid:    `${account.id}-${Date.now()}`,
        title,
        html,
        topic,
        pubDate: new Date().toISOString(),
      };

      store[account.id].unshift(article);
      if (store[account.id].length > 60) store[account.id].length = 60;

      console.log(`  ✓ "${title}"`);

      // Пауза между запросами к API
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error(`  ✗ Ошибка для "${account.name}": ${err.message}`);
    }
  }

  saveStore();
  console.log(`[${new Date().toISOString()}] ✔ Генерация завершена.\n`);
}

// ─── RSS-сборщик ──────────────────────────────────────────────────────────────

function buildFeed(account, baseUrl) {
  const feed = new RSS({
    title:           account.feedTitle,
    description:     account.feedDescription,
    feed_url:        `${baseUrl}/rss/${account.id}`,
    site_url:        baseUrl,
    language:        'ru',
    pubDate:         new Date(),
    ttl:             60,
    custom_namespaces: { yandex: 'http://news.yandex.ru' },
  });

  (store[account.id] || []).forEach(art => {
    feed.item({
      title:       art.title,
      description: art.html,
      url:         `${baseUrl}/article/${art.guid}`,
      guid:        art.guid,
      date:        new Date(art.pubDate),
      categories:  [art.topic],
    });
  });

  return feed.xml({ indent: true });
}

// ─── Express-сервер ───────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// RSS-фиды
ACCOUNTS.forEach(account => {
  app.get(`/rss/${account.id}`, (req, res) => {
    const proto   = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${proto}://${req.headers.host}`;
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(buildFeed(account, baseUrl));
  });
});

// Страница статуса
app.get('/', (req, res) => {
  const proto   = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${proto}://${req.headers.host}`;

  const rows = ACCOUNTS.map(a => {
    const list  = store[a.id] || [];
    const last  = list[0];
    return `
      <tr>
        <td><b>${a.name}</b></td>
        <td>${list.length}</td>
        <td>${last ? last.title : '—'}</td>
        <td>${last ? new Date(last.pubDate).toLocaleString('ru-RU') : '—'}</td>
        <td><a href="/rss/${a.id}" target="_blank">/rss/${a.id}</a></td>
      </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Dzen RSS Farm</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  h1 { color: #333; }
  .status { color: #28a745; font-weight: bold; }
</style>
</head><body>
<h1>🌾 Dzen RSS Farm</h1>
<p class="status">● Сервер работает</p>
<p>Генерация статей: <b>каждый день в 09:00 (МСК)</b></p>
<table>
  <tr><th>Аккаунт</th><th>Статей</th><th>Последняя статья</th><th>Дата</th><th>RSS-лента</th></tr>
  ${rows}
</table>
<br>
<form method="post" action="/generate">
  <button type="submit" style="padding:8px 20px;cursor:pointer;">
    ▶ Сгенерировать статьи сейчас
  </button>
</form>
<p style="color:#888;font-size:13px">
  RSS-URL для Яндекс Дзен: <code>${baseUrl}/rss/{id}</code>
</p>
</body></html>`);
});

// Ручной запуск генерации (POST /generate)
app.post('/generate', (req, res) => {
  generateAll().catch(console.error);
  res.redirect('/');
});

// ─── Старт ────────────────────────────────────────────────────────────────────

loadStore();

// Расписание: каждый день в 09:00 по Москве
cron.schedule('0 9 * * *', () => {
  generateAll().catch(console.error);
}, { timezone: 'Europe/Moscow' });

// Немедленная генерация при запуске с флагом
if (process.argv.includes('--generate-now')) {
  generateAll().catch(console.error);
}

app.listen(PORT, () => {
  console.log('════════════════════════════════════════');
  console.log('  Dzen RSS Farm запущен');
  console.log(`  http://localhost:${PORT}`);
  console.log('  RSS-ленты:');
  ACCOUNTS.forEach(a => console.log(`    ${a.name}: http://localhost:${PORT}/rss/${a.id}`));
  console.log('  Расписание: каждый день в 09:00 МСК');
  console.log('════════════════════════════════════════');
});
