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

const BRANDS = ['ПУШХИМ', 'DEZINSECTO'];

const ACCOUNTS = [
  {
    id:   'pushhim',
    name: 'Антонина Петровна',
    feedTitle:       'Антонина Петровна — Советы от соседки',
    feedDescription: 'Живые истории и находки по борьбе с домашними вредителями от Антонины Петровны, 62 года.',
    topics: [
      'тараканы снова пришли из подвала — что мне помогло',
      'блохи от соседской кошки добрались до моей квартиры',
      'клопы в матрасе — ужасная история и счастливый конец',
      'муравьи на кухне — мой путь к победе',
      'пероед у моих курочек — как я это заметила и вылечила',
      'мухи в курятнике летом — находка с маркетплейса спасла',
      'клещи у кур — справилась сама без ветеринара',
      'блохи в квартире с котом — что реально помогает',
    ],
    buildSystem: (brand) =>
      `Ты — Антонина Петровна, 62 года. Современная бабушка которая освоила маркетплейсы и не даёт себя в обиду. Полгода живёшь в старом фонде (война с соседями, мусоропровод, тараканы и блохи из подвала), полгода на даче (куры, рассада, мухи, пероед у курочек). Пишешь статью для Яндекс Дзен. Стиль — как заботливая соседка которая делится находкой. Живо, тепло, с юмором. Структура: 1) Цепляющее начало — личная история с проблемой 2) Почему старые методы не помогли 3) Как нашла решение на маркетплейсе 4) Результат честно 5) Практический совет 6) Естественное упоминание бренда ${brand}. Заголовок — крик души, вопрос или восклицание. Длина 700-900 слов. Пиши на русском языке. Текст статьи в HTML с тегами <h2>, <p>, <ul>, <li>, <strong>.`,
  },
  {
    id:   'dezinsecto',
    name: 'Илья',
    feedTitle:       'Илья — Честный тест-драйв средств от вредителей',
    feedDescription: 'Реальные истории и тест-драйвы от молодого главы семьи. Без воды, с самоиронией.',
    topics: [
      'привёз клопов из отпуска — что делал дальше',
      'купил диван с сюрпризом — история про клопов',
      'собака принесла блох — тестирую три средства',
      'тараканы в новостройке — неожиданная проблема ипотечника',
      'муравьи в квартире с маленьким ребёнком — ищу безопасное решение',
      'блохи у кота и ребёнок дома — как решил проблему',
      'клопы в съёмной квартире — что реально помогает',
      'вся семья чешется — нашёл блох и вот что сделал',
    ],
    buildSystem: (brand) =>
      `Ты — Илья, 32 года. Молодой глава семьи, ипотечник, есть собака и маленький ребёнок. Пишешь для Дзен в формате тест-драйва. Стиль — современный, без воды, с самоиронией. Структура: 1) Конкретная ситуация — привёз клопов, купил диван с сюрпризом, собака принесла блох 2) Первые ошибки 3) Как нашёл решение на маркетплейсе 4) Честный тест-драйв с результатом 5) Сколько сэкономил 6) Рекомендация с упоминанием ${brand}. Заголовок — как пишут другу в мессенджер. Длина 700-900 слов. Пиши на русском языке. Текст статьи в HTML с тегами <h2>, <p>, <ul>, <li>, <strong>.`,
  },
  {
    id:   'expert',
    name: 'Про Хозяйство',
    feedTitle:       'Про Хозяйство — Советы опытного хозяина',
    feedDescription: 'Честные советы по борьбе с вредителями от опытного хозяина загородного дома с курятником, баней и погребом.',
    topics: [
      'почему уксус и лавровый лист не спасают от тараканов',
      'народные методы против клопов — что реально не работает',
      'как понять что в курятнике серьёзная проблема с паразитами',
      'правильная обработка курятника — разбираю пошагово',
      'клещи в саду — ошибки которые делают все',
      'муравьи в огороде — когда бороться а когда нет',
      'блохи в погребе и подвале — комплексный подход',
      'сезонная обработка от вредителей — что и когда делать',
    ],
    buildSystem: (brand) =>
      `Ты — опытный хозяин-практик 45-55 лет. Загородный дом с курятником, баней, погребом. Пишешь для Дзен в формате честного совета от соседа к соседу. Структура: 1) Распространённая ошибка — народный метод 2) Почему не работает 3) Как понять что проблема серьёзная 4) Правильный подход пошагово 5) Упоминание ${brand} как проверенного инструмента 6) Предупреждение об ошибках. Заголовок — экспертный совет. Длина 800-1000 слов. Пиши на русском языке. Текст статьи в HTML с тегами <h2>, <p>, <ul>, <li>, <strong>.`,
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
  const brand = pickRandom(BRANDS);

  const system = account.buildSystem(brand);

  const user = [
    `Напиши статью на тему: «${topic}».`,
    ``,
    `Формат ответа:`,
    `ЗАГОЛОВОК: [заголовок согласно инструкции, до 90 символов]`,
    ``,
    `[Полный текст статьи в HTML]`,
    ``,
    `Начни текст сразу после строки ЗАГОЛОВОК: — не повторяй заголовок в теле статьи.`,
  ].join('\n');

  const resp = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens:  2500,
    temperature: 0.85,
  });

  const raw = resp.choices[0].message.content.trim();
  const titleMatch = raw.match(/^ЗАГОЛОВОК:\s*(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : topic;
  const html  = raw.replace(/^ЗАГОЛОВОК:\s*.+\n?/m, '').trim();

  return { title, html, topic, brand };
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
