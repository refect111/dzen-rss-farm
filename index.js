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
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Ошибка: переменная TELEGRAM_BOT_TOKEN не задана. Создайте файл .env');
  process.exit(1);
}

const openai          = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TELEGRAM_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API    = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ─── Аккаунты ────────────────────────────────────────────────────────────────

const BRANDS = ['ПУШХИМ', 'DEZINSECTO'];

// ─── Товары на Wildberries ────────────────────────────────────────────────────

const PRODUCTS = {
  'ПУШХИМ': [
    { pest: 'тараканы',        type: 'спрей',      wb: '555796693'  },
    { pest: 'тараканы',        type: 'спрей',      wb: '555805649'  },
    { pest: 'тараканы',        type: 'спрей',      wb: '983510569'  },
    { pest: 'тараканы',        type: 'спрей',      wb: '983514206'  },
    { pest: 'тараканы',        type: 'порошок',    wb: '500339635'  },
    { pest: 'тараканы',        type: 'порошок',    wb: '983532953'  },
    { pest: 'тараканы',        type: 'гель',       wb: '599507609'  },
    { pest: 'тараканы',        type: 'гель',       wb: '950043447'  },
    { pest: 'тараканы',        type: 'мелок',      wb: '962751830'  },
    { pest: 'тараканы',        type: 'мелок',      wb: '962754102'  },
    { pest: 'тараканы',        type: 'приманка',   wb: '962527937'  },
    { pest: 'тараканы',        type: 'приманка',   wb: '962535219'  },
    { pest: 'тараканы',        type: 'концентрат', wb: '599510564'  },
    { pest: 'клопы',           type: 'спрей',      wb: '555796696'  },
    { pest: 'клопы',           type: 'спрей',      wb: '555805652'  },
    { pest: 'клопы',           type: 'спрей',      wb: '803743103'  },
    { pest: 'клопы',           type: 'спрей',      wb: '976712027'  },
    { pest: 'клопы',           type: 'порошок',    wb: '496545911'  },
    { pest: 'клопы',           type: 'концентрат', wb: '599510561'  },
    { pest: 'блохи',           type: 'спрей',      wb: '555796692'  },
    { pest: 'блохи',           type: 'спрей',      wb: '555805648'  },
    { pest: 'блохи',           type: 'спрей',      wb: '788331601'  },
    { pest: 'блохи',           type: 'спрей',      wb: '806613262'  },
    { pest: 'блохи',           type: 'порошок',    wb: '500338997'  },
    { pest: 'блохи',           type: 'концентрат', wb: '599510567'  },
    { pest: 'блохи',           type: 'для животных', wb: '250680571' },
    { pest: 'блохи',           type: 'для животных', wb: '949351319' },
    { pest: 'муравьи',         type: 'спрей',      wb: '555796695'  },
    { pest: 'муравьи',         type: 'спрей',      wb: '555805651'  },
    { pest: 'муравьи',         type: 'гель',       wb: '807344690'  },
    { pest: 'муравьи',         type: 'гель',       wb: '861420040'  },
    { pest: 'муравьи',         type: 'гранулы',    wb: '955397682'  },
    { pest: 'муравьи',         type: 'ловушка',    wb: '955436552'  },
    { pest: 'муравьи',         type: 'ловушка',    wb: '955439216'  },
    { pest: 'муравьи',         type: 'дуст',       wb: '834079791'  },
    { pest: 'муравьи',         type: 'концентрат', wb: '790965105'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '221041206'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '221041207'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '255441462'  },
    { pest: 'мухи',            type: 'концентрат', wb: '863483891'  },
    { pest: 'мухи',            type: 'приманка',   wb: '956999452'  },
    { pest: 'мухи',            type: 'приманка',   wb: '983573588'  },
    { pest: 'комары и клещи',  type: 'концентрат', wb: '864443821'  },
    { pest: 'комары и клещи',  type: 'концентрат', wb: '955444063'  },
    { pest: 'комары и клещи',  type: 'концентрат', wb: '1013632116' },
    { pest: 'комары и клещи',  type: 'концентрат', wb: '1028897365' },
  ],
  'DEZINSECTO': [
    { pest: 'тараканы',        type: 'спрей',      wb: '962757302'  },
    { pest: 'тараканы',        type: 'спрей',      wb: '962760860'  },
    { pest: 'тараканы',        type: 'порошок',    wb: '962772752'  },
    { pest: 'тараканы',        type: 'гель',       wb: '962778492'  },
    { pest: 'тараканы',        type: 'концентрат', wb: '962786989'  },
    { pest: 'клопы',           type: 'спрей',      wb: '953351254'  },
    { pest: 'клопы',           type: 'спрей',      wb: '953359231'  },
    { pest: 'клопы',           type: 'порошок',    wb: '953368758'  },
    { pest: 'клопы',           type: 'концентрат', wb: '961733608'  },
    { pest: 'блохи',           type: 'спрей',      wb: '949394170'  },
    { pest: 'блохи',           type: 'спрей',      wb: '949398394'  },
    { pest: 'блохи',           type: 'порошок',    wb: '949406899'  },
    { pest: 'блохи',           type: 'концентрат', wb: '949423807'  },
    { pest: 'муравьи',         type: 'спрей',      wb: '952575694'  },
    { pest: 'муравьи',         type: 'спрей',      wb: '952588787'  },
    { pest: 'муравьи',         type: 'гель',       wb: '952575696'  },
    { pest: 'муравьи',         type: 'гранулы',    wb: '955402834'  },
    { pest: 'муравьи',         type: 'концентрат', wb: '952588788'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '964164399'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '964648567'  },
    { pest: 'куры/пероед',     type: 'дуст',       wb: '964648568'  },
    { pest: 'домашние животные', type: 'порошок',  wb: '972054079'  },
  ],
};

function getProductsText(brand) {
  const list = PRODUCTS[brand] || [];
  // Группируем по pest
  const byPest = list.reduce((acc, p) => {
    (acc[p.pest] = acc[p.pest] || []).push(`${p.type} (арт. ${p.wb})`);
    return acc;
  }, {});
  const lines = Object.entries(byPest)
    .map(([pest, items]) => `  - от ${pest}: ${items.join(', ')}`)
    .join('\n');
  return `ТОВАРЫ ${brand} НА WILDBERRIES:\n${lines}`;
}

const ACCOUNTS = [
  {
    id:              'pushhim',
    name:            'Антонина Петровна',
    telegramChannel: '@sekrety_baby_toni',
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
      `Ты — Антонина Петровна, 62 года. Современная бабушка которая освоила маркетплейсы и не даёт себя в обиду. Полгода живёшь в старом фонде (тараканы и блохи из подвала, старые соседи), полгода на даче (куры, рассада, мухи, пероед у курочек). Пишешь для Яндекс Дзен — как заботливая соседка делится находкой. Живо, тепло, с юмором и самоиронией.

ПРАВИЛА ТЕКСТА (строго соблюдай):
— 70% текста — конкретные советы, лайфхаки, пошаговые инструкции
— 30% текста — личная история как вступление и связки между советами
— Бренд ${brand} упомяни РОВНО ОДИН РАЗ, вскользь и естественно, как будто случайно вспомнила ("кстати, я брала ${brand} на Озоне", "попалось мне на глаза средство ${brand}"). НЕ делай бренд главной темой. НЕ хвали напрямую.
— В КОНЦЕ статьи естественно упомяни 1-2 подходящих по теме товара с артикулом WB. Формат: "...заказала на Wildberries (артикул 555796693)..." или "...нашла на WB, артикул 500338997...". НЕ делай отдельный раздел "Товары" — вплети упоминание в текст.
— Заголовок НЕ повторяй в теле статьи
— Пиши ОБЫЧНЫМ ТЕКСТОМ — никаких HTML тегов, никаких звёздочек для жирного
— Подзаголовки — обычный текст с эмодзи в начале строки (например: 🏠 Что я делала сначала)
— Заголовок — крик души, вопрос или восклицание. До 80 символов.
— Длина 700-900 слов. Язык — русский.

${getProductsText(brand)}`,
  },
  {
    id:              'dezinsecto',
    name:            'Илья',
    telegramChannel: '@economniy_hoz',
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
      `Ты — Илья, 32 года. Молодой глава семьи, ипотечник, есть собака и маленький ребёнок. Пишешь для Дзен в формате честного разбора — без воды, с самоиронией и конкретикой.

ПРАВИЛА ТЕКСТА (строго соблюдай):
— 70% текста — конкретные советы, лайфхаки, что работает и почему
— 30% текста — личная ситуация как вступление и живые связки
— Бренд ${brand} упомяни РОВНО ОДИН РАЗ, как будто вспомнил попутно ("взял ${brand} на маркетплейсе", "жена нашла ${brand}, попробовали"). НЕ рекламируй, не давай оценок типа "отличное средство"
— В КОНЦЕ статьи естественно упомяни 1-2 подходящих по теме товара с артикулом WB. Формат: "...взял на Wildberries (артикул 962757302)..." или "...заказал на WB, артикул 949394170...". НЕ делай отдельный раздел "Товары" — вплети упоминание в текст.
— Заголовок НЕ повторяй в теле статьи
— Пиши ОБЫЧНЫМ ТЕКСТОМ — никаких HTML тегов, никаких звёздочек для жирного
— Подзаголовки — обычный текст с эмодзи в начале строки (например: 🔍 Как я понял в чём проблема)
— Заголовок — разговорный, как пишут другу в мессенджер. До 80 символов.
— Длина 700-900 слов. Язык — русский.

${getProductsText(brand)}`,
  },
  {
    id:              'expert',
    name:            'Про Хозяйство',
    telegramChannel: '@pro_hoz',
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
      `Ты — опытный хозяин-практик 45-55 лет. Загородный дом с курятником, баней, погребом. Пишешь для Дзен как сосед-практик, который уже набил шишки и объясняет что реально работает.

ПРАВИЛА ТЕКСТА (строго соблюдай):
— 70% текста — конкретные советы, пошаговые инструкции, лайфхаки, признаки и ошибки
— 30% текста — личный опыт и наблюдения как иллюстрации к советам
— Бренд ${brand} упомяни РОВНО ОДИН РАЗ, как инструмент в ряду других ("из химии я беру ${brand}", "можно взять ${brand}, продаётся везде"). Никакой рекламы и восторгов.
— В КОНЦЕ статьи естественно упомяни 1-2 подходящих по теме товара с артикулом WB. Формат: "...беру на Wildberries (артикул 952588787)..." или "...нашёл на WB, артикул 964164399...". НЕ делай отдельный раздел "Товары" — вплети упоминание в текст.
— Заголовок НЕ повторяй в теле статьи
— Пиши ОБЫЧНЫМ ТЕКСТОМ — никаких HTML тегов, никаких звёздочек для жирного
— Подзаголовки — обычный текст с эмодзи в начале строки (например: ⚠️ Почему народные методы не работают)
— Заголовок — конкретный экспертный совет или разоблачение мифа. До 80 символов.
— Длина 800-1000 слов. Язык — русский.

${getProductsText(brand)}`,
  },
];

// ─── Хранилище статей ─────────────────────────────────────────────────────────

let store = {};

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

// ─── Вспомогательные функции ──────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


// Разбивка длинного текста на чанки (лимит Telegram — 4096 символов)
function splitText(text, maxLen = 4096) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      const lastBreak = text.lastIndexOf('\n\n', end);
      if (lastBreak > start + maxLen / 2) end = lastBreak;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(c => c.length > 0);
}

// ─── DALL-E генерация изображения ─────────────────────────────────────────────

async function generateDalleImage(dallePrompt) {
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:   'gpt-image-1',
        prompt:  dallePrompt,
        n:       1,
        size:    '1536x1024',
        quality: 'medium',
      }),
    });
  } catch (err) {
    throw new Error(`DALL-E сетевая ошибка: ${err.message}`);
  }

  const text = await res.text();
  console.log(`    [DEBUG] OpenAI статус: ${res.status}, длина ответа: ${text.length} символов`);
  console.log(`    [DEBUG] Первые 500 символов: ${text.slice(0, 500)}`);
  let json;
  try { json = JSON.parse(text); }
  catch(e) { throw new Error(`Ошибка парсинга ответа OpenAI: ${text.slice(0, 200)}`); }

  if (!res.ok) {
    const detail = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`DALL-E API error [${res.status}]: ${detail}`);
  }

  // gpt-image-1 возвращает base64, а не URL
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 вернул пустой ответ');

  // Конвертируем в data URL для дальнейшей передачи
  return `data:image/png;base64,${b64}`;
}

// ─── Telegram API ─────────────────────────────────────────────────────────────

async function tgRequest(method, body) {
  let res;
  try {
    res = await fetch(`${TELEGRAM_API}/${method}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Telegram ${method} сетевая ошибка: ${err.message}`);
  }

  const json = await res.json();
  if (!json.ok) {
    const errorCode = json.error_code ?? res.status;
    throw new Error(`Telegram ${method} [${errorCode}]: ${json.description}`);
  }
  return json;
}

// Проверяет буфер: размер и магические байты PNG/JPEG
function validateImageBuffer(buffer) {
  if (buffer.byteLength < 10240) {
    return { ok: false, reason: `слишком маленький файл: ${buffer.byteLength} байт (нужно > 10 KB)` };
  }
  const b = new Uint8Array(buffer.slice(0, 4));
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  const isJpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  if (!isPng && !isJpg) {
    const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(' ');
    return { ok: false, reason: `не PNG и не JPEG (первые байты: ${hex})` };
  }
  return { ok: true };
}

// Скачивает (или декодирует base64) картинку, валидирует и возвращает ArrayBuffer
async function downloadAndValidateImage(url) {
  let buffer;

  if (url.startsWith('data:')) {
    // base64 data URL — декодируем напрямую, без сетевого запроса
    const base64 = url.split(',')[1];
    if (!base64) throw new Error('Пустой base64 в data URL');
    const nodeBuf = Buffer.from(base64, 'base64');
    buffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
    console.log(`    Декодировано из base64: ${Math.round(buffer.byteLength / 1024)} KB`);
  } else {
    // Обычный URL — скачиваем
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new Error(`сеть: ${err.message}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} при скачивании`);
    buffer = await res.arrayBuffer();
    console.log(`    Скачано: ${Math.round(buffer.byteLength / 1024)} KB`);
  }

  const check = validateImageBuffer(buffer);
  if (!check.ok) throw new Error(check.reason);

  return buffer;
}

async function sendTelegramPhotoBuffer(channelId, imageBuffer) {
  const form = new FormData();
  form.append('chat_id', channelId);
  form.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');

  let res;
  try {
    res = await fetch(`${TELEGRAM_API}/sendPhoto`, { method: 'POST', body: form });
  } catch (err) {
    throw new Error(`Telegram sendPhoto сетевая ошибка: ${err.message}`);
  }

  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram sendPhoto [${json.error_code ?? res.status}]: ${json.description}`);
  }
  return json;
}

async function sendTelegramMessage(channelId, text, parseMode = 'HTML') {
  const chunks = splitText(text, 4096);
  for (const chunk of chunks) {
    await tgRequest('sendMessage', { chat_id: channelId, text: chunk, parse_mode: parseMode });
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 800));
  }
}

async function postToTelegram(channelId, imageBuffer, title, body, hashtags) {
  // 1. Фото (buffer уже проверен)
  await sendTelegramPhotoBuffer(channelId, imageBuffer);
  await new Promise(r => setTimeout(r, 600));

  // 2. Текст: жирный заголовок + статья + хэштеги
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fullText  = `<b>${safeTitle}</b>\n\n${body}\n\n${hashtags}`;
  await sendTelegramMessage(channelId, fullText);
}

// ─── Редактура статьи (второй проход) ────────────────────────────────────────

async function editArticle(body) {
  const resp = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages: [
      {
        role:    'system',
        content: 'Ты редактор. Проверь эту статью и исправь:\n1. Убери все HTML теги если есть\n2. Исправь логические ошибки и нелогичные переходы\n3. Убери повторяющиеся заголовки\n4. Если бренд упоминается больше 2 раз — сократи до 1-2 упоминаний\n5. Убедись что текст читается естественно, без агрессивной рекламы\n6. Исправь грамматические ошибки\nВерни только исправленный текст без пояснений.',
      },
      { role: 'user', content: body },
    ],
    max_tokens:  2800,
    temperature: 0.3,
  });
  return resp.choices[0].message.content.trim();
}

// ─── Генерация статьи ─────────────────────────────────────────────────────────

async function generateArticle(account) {
  const topic = pickRandom(account.topics);
  const brand = pickRandom(BRANDS);

  const system = account.buildSystem(brand);

  const user = `Напиши статью на тему: «${topic}».

Строго соблюдай формат — четыре блока подряд:

ЗАГОЛОВОК: [заголовок согласно инструкции, до 80 символов]

[Текст статьи. Обычный текст без HTML тегов, без звёздочек. Подзаголовки — эмодзи + текст на отдельной строке. Пустая строка между абзацами.

ОБЯЗАТЕЛЬНО: в тексте статьи должен быть упомянут бренд ${brand} РОВНО ОДИН РАЗ естественно и вскользь. В конце статьи ОБЯЗАТЕЛЬНО упомяни 1-2 конкретных товара с артикулом WB в формате: "...на Wildberries (артикул XXXXXXXXX)..." — это критически важно, без артикула статья считается неполной.]

КАРТИНКА: [описание для DALL-E на английском: реалистичная бытовая или садовая сцена по теме статьи, светлые тона, без людей, без текста и надписей на изображении, фотореалистичный стиль, 1-2 предложения]

ХЭШТЕГИ: [6-8 тематических хэштегов для Telegram через пробел, формат #слово или #два_слова, ОБЯЗАТЕЛЬНО включи #${brand.toLowerCase()} как один из хэштегов]`;

  const resp = await openai.chat.completions.create({
    model:       'gpt-4o-mini',
    messages:    [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens:  2800,
    temperature: 0.85,
  });

  const raw = resp.choices[0].message.content.trim();

  const titleMatch    = raw.match(/^ЗАГОЛОВОК:\s*(.+)/m);
  const pictureMatch  = raw.match(/^КАРТИНКА:\s*(.+)/m);
  const hashtagsMatch = raw.match(/^ХЭШТЕГИ:\s*(.+)/m);

  const title      = titleMatch    ? titleMatch[1].trim()    : topic;
  const dallePrompt = pictureMatch  ? pictureMatch[1].trim()  : `Realistic domestic scene related to "${topic}", bright natural lighting, clean interior, no text, no labels, photorealistic.`;
  const hashtags   = hashtagsMatch ? hashtagsMatch[1].trim() : `#вредители #дом #дача #${brand.toLowerCase()}`;

  // Извлекаем тело статьи: между ЗАГОЛОВОК и КАРТИНКА
  const body = raw
    .replace(/^ЗАГОЛОВОК:\s*.+\n?/m, '')
    .replace(/\nКАРТИНКА:[\s\S]*/m, '')
    .trim();

  return { title, body, topic, brand, dallePrompt, hashtags };
}

// ─── Цикл генерации для всех аккаунтов ───────────────────────────────────────

async function generateAll() {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ▶ Начало генерации статей...`);

  let published = 0;
  let skipped   = 0;

  for (const account of ACCOUNTS) {
    try {
      // ── Этап 1: генерация статьи ──────────────────────────────────────────
      console.log(`\n  [${account.name}] → Генерирую статью...`);
      const { title, body: rawBody, topic, brand, dallePrompt, hashtags } = await generateArticle(account);
      console.log(`  [${account.name}] ✓ Статья: "${title}" (бренд: ${brand})`);

      // ── Этап 2: редактура ─────────────────────────────────────────────────
      let body = rawBody;
      try {
        console.log(`  [${account.name}] → Редактирую статью...`);
        body = await editArticle(rawBody);
        console.log(`  [${account.name}] ✓ Редактура завершена`);
      } catch (err) {
        console.error(`  [${account.name}] ✗ Ошибка редактуры, используем оригинал: ${err.message}`);
      }

      // ── Этап 3: генерация картинки DALL-E ────────────────────────────────
      let imageUrl = null;
      try {
        console.log(`  [${account.name}] → DALL-E: "${dallePrompt.slice(0, 90)}…"`);
        imageUrl = await generateDalleImage(dallePrompt);
        console.log(`  [${account.name}] ✓ URL картинки получен`);
      } catch (err) {
        console.error(`  [${account.name}] ✗ DALL-E ошибка: ${err.message}`);
      }

      // ── Этап 4: скачивание и проверка картинки ───────────────────────────
      let imageBuffer = null;
      if (imageUrl) {
        try {
          console.log(`  [${account.name}] → Проверяю картинку...`);
          imageBuffer = await downloadAndValidateImage(imageUrl, account.name);
          console.log(`  [${account.name}] ✓ Картинка прошла проверку`);
        } catch (err) {
          console.error(`  [${account.name}] ✗ ОШИБКА: картинка не прошла проверку`);
          console.error(`    Причина: ${err.message}`);
          console.error(`    Пост пропущен — публикация без картинки не выполняется`);
          skipped++;
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }
      } else {
        console.error(`  [${account.name}] ✗ ОШИБКА: картинка не сгенерирована, пост пропущен`);
        skipped++;
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }

      // ── Этап 5: публикация в Telegram ────────────────────────────────────
      if (account.telegramChannel) {
        try {
          console.log(`  [${account.name}] → Публикую в Telegram ${account.telegramChannel}...`);
          await postToTelegram(account.telegramChannel, imageBuffer, title, body, hashtags);
          console.log(`  [${account.name}] ✓ Опубликовано с картинкой`);
        } catch (err) {
          console.error(`  [${account.name}] ✗ Telegram ошибка: ${err.message}`);
          skipped++;
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }
      }

      // ── Сохраняем в RSS ───────────────────────────────────────────────────
      const article = {
        guid:    `${account.id}-${Date.now()}`,
        title,
        body,
        topic,
        brand,
        pubDate: new Date().toISOString(),
      };
      store[account.id].unshift(article);
      if (store[account.id].length > 60) store[account.id].length = 60;

      published++;
      await new Promise(r => setTimeout(r, 4000));

    } catch (err) {
      console.error(`  [${account.name}] ✗ Критическая ошибка: ${err.message}`);
      skipped++;
    }
  }

  saveStore();

  const total = ACCOUNTS.length;
  console.log(`\n${'─'.repeat(48)}`);
  console.log(`✅ Опубликовано с картинкой: ${published} из ${total}`);
  console.log(`❌ Пропущено из-за ошибки:   ${skipped} из ${total}`);
  console.log(`${'─'.repeat(48)}`);
  console.log(`[${new Date().toISOString()}] ✔ Генерация завершена.\n`);
}

// ─── RSS-сборщик ──────────────────────────────────────────────────────────────

function buildFeed(account, baseUrl) {
  const feed = new RSS({
    title:             account.feedTitle,
    description:       account.feedDescription,
    feed_url:          `${baseUrl}/rss/${account.id}`,
    site_url:          baseUrl,
    language:          'ru',
    pubDate:           new Date(),
    ttl:               60,
    custom_namespaces: { yandex: 'http://news.yandex.ru' },
  });

  (store[account.id] || []).forEach(art => {
    // Конвертируем plain text в HTML для RSS
    const htmlBody = (art.body || art.html || '')
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

    feed.item({
      title:       art.title,
      description: htmlBody,
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
    const list = store[a.id] || [];
    const last = list[0];
    return `
      <tr>
        <td><b>${a.name}</b></td>
        <td>${list.length}</td>
        <td>${last ? last.title : '—'}</td>
        <td>${last ? new Date(last.pubDate).toLocaleString('ru-RU') : '—'}</td>
        <td><a href="/rss/${a.id}" target="_blank">/rss/${a.id}</a></td>
        <td>${a.telegramChannel}</td>
      </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Dzen RSS Farm</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 1000px; margin: 40px auto; padding: 0 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
  h1 { color: #333; }
  .status { color: #28a745; font-weight: bold; }
</style>
</head><body>
<h1>🌾 Dzen RSS Farm</h1>
<p class="status">● Сервер работает</p>
<p>Генерация: <b>каждый день в 09:00 МСК</b> | OpenAI GPT-4o-mini + DALL-E 3 + Telegram</p>
<table>
  <tr><th>Аккаунт</th><th>Статей</th><th>Последняя статья</th><th>Дата</th><th>RSS</th><th>Telegram</th></tr>
  ${rows}
</table>
<br>
<form method="post" action="/generate">
  <button type="submit" style="padding:8px 20px;cursor:pointer;background:#007bff;color:#fff;border:none;border-radius:4px;">
    ▶ Сгенерировать и опубликовать сейчас
  </button>
</form>
<p style="color:#888;font-size:13px">RSS-URL для Яндекс Дзен: <code>${baseUrl}/rss/{id}</code></p>
</body></html>`);
});

// Ручной запуск генерации
app.post('/generate', (req, res) => {
  generateAll().catch(console.error);
  res.redirect('/');
});

// ─── Старт ────────────────────────────────────────────────────────────────────

loadStore();

// Расписание: каждый день в 09:00 МСК
cron.schedule('0 9 * * *', () => {
  generateAll().catch(console.error);
}, { timezone: 'Europe/Moscow' });

if (process.argv.includes('--generate-now')) {
  generateAll().catch(console.error);
}

app.listen(PORT, () => {
  console.log('════════════════════════════════════════════════');
  console.log('  Dzen RSS Farm запущен');
  console.log(`  http://localhost:${PORT}`);
  console.log('  Каналы:');
  ACCOUNTS.forEach(a => console.log(`    ${a.name}: RSS /rss/${a.id} → Telegram ${a.telegramChannel}`));
  console.log('  Расписание: каждый день в 09:00 МСК');
  console.log('════════════════════════════════════════════════');
});
