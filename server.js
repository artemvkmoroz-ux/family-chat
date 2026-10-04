'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AURORA v11.0 — Server
   Web Push + Достижения + Системные звонки
   ═══════════════════════════════════════════════════════════ */

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { createClient } = require('@libsql/client');

let webPush = null;
try {
  webPush = require('web-push');
} catch (e) {
  console.log('⚠️ web-push не установлен — уведомления отключены');
}

// ═══════════════════════════════════════════════════════════
// 🔑 VAPID — ВПИШИ СВОИ КЛЮЧИ!
// ═══════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = 'BMu6qt-loY93evVb-zuYH-XxkRrehRk84b7zUNWp28hWlPTCEFpVoMeJcLmR1ZamPWzE-mLIPSsDEQR4DqnvSpI';   // ← ЗАМЕНИ на свой Public Key
const VAPID_PRIVATE_KEY = 'aAi_Fmyca0t8HquBgwqoIBczmqfdLdv_4IvkY3DV6zw';   // ← ЗАМЕНИ на свой Private Key
const VAPID_SUBJECT = 'artemvkmoroz@gmail.com'; // ← ЗАМЕНИ на свой email

// ═══════════════════════════════════════════════════════════
// ⚙️ КОНФИГ
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  PORT: process.env.PORT || 3000,
  ADMIN_USERNAME: 'moroz',
  SESSION_TTL: 30 * 24 * 60 * 60 * 1000,
  CACHE_TTL: 30_000,
  RATE_WINDOW: 60_000,
  MAX_TEXT: 4000,
  MAX_IMAGE: 3_000_000,
  MAX_VOICE: 4_000_000,
  MAX_VIDEO: 15_000_000,
  MAX_STICKER: 4_000_000,
  MAX_GIFTS_PER_DAY: 20,
  MAX_USERNAME_LEN: 20,
  MIN_USERNAME_LEN: 3,
  MIN_PASSWORD_LEN: 8,
  MAX_DISPLAY_NAME: 40,
  MAX_BIO: 200,
  MAX_MESSAGE_BURST: 30,
  MESSAGE_WINDOW: 10_000,
};

const GIFTS_CATALOG = {
  cake:      { emoji: '🎂', name: 'Тортик',        price: 15,     url: 'https://nft.fragment.com/gift/homemadecake-1.medium.jpg' },
  rose:      { emoji: '🌹', name: 'Роза',          price: 20,    url: 'https://nft.fragment.com/gift/eternalrose-11118.medium.jpg' },
  heart:     { emoji: '❤️', name: 'Сердечко',      price: 10,    url: 'https://nft.fragment.com/gift/heartlocket-1.medium.jpg' },
  star:      { emoji: '⭐', name: 'Звёздочка',     price: 15,    url: 'https://nft.fragment.com/gift/hangingstar-1.medium.jpg' },
  pizza:     { emoji: '🍕', name: 'Пицца',         price: 20,    url: 'https://nft.fragment.com/gift/pizza-1.medium.jpg' },
  balloon:   { emoji: '🎈', name: 'Шарик',         price: 40,    url: 'https://nft.fragment.com/gift/bigyear-1.medium.jpg' },
  icecream:  { emoji: '🍦', name: 'Мороженое',     price: 25,    url: 'https://nft.fragment.com/gift/icecream-1.medium.jpg' },
  bear:      { emoji: '🧸', name: 'Мишка',         price: 50,    url: 'https://nft.fragment.com/gift/toybear-14456.medium.jpg' },
  flower:    { emoji: '💐', name: 'Букет',         price: 60,    url: 'https://nft.fragment.com/gift/lushbouquet-1.medium.jpg' },
  pepa:      { emoji: '🐸', name: 'Лягушонок Пепе', price: 2000,   url: 'https://nft.fragment.com/gift/plushpepe-834.medium.jpg' },
  cat:       { emoji: '🐱', name: 'Котик',         price: 100,    url: 'https://nft.fragment.com/gift/scaredcat-1.medium.jpg' },
};

const ACHIEVEMENTS_CATALOG = {
  first_message:    { emoji: '💬', name: 'Первое слово',       desc: 'Отправь первое сообщение',       target: 1,     stat: 'messages_sent' },
  msg_10:           { emoji: '📝', name: 'Разговорчивый',      desc: 'Отправь 10 сообщений',           target: 10,    stat: 'messages_sent' },
  msg_100:          { emoji: '💯', name: 'Болтун',             desc: 'Отправь 100 сообщений',          target: 100,   stat: 'messages_sent' },
  msg_1000:         { emoji: '📢', name: 'Голос поколения',    desc: 'Отправь 1000 сообщений',         target: 1000,  stat: 'messages_sent' },
  msg_10000:        { emoji: '👑', name: 'Король общения',     desc: 'Отправь 10000 сообщений',        target: 10000, stat: 'messages_sent' },
  first_call:       { emoji: '📞', name: 'Первый звонок',      desc: 'Соверши первый звонок',          target: 1,     stat: 'calls_made' },
  call_10:          { emoji: '☎️', name: 'Звонкий голос',      desc: 'Соверши 10 звонков',             target: 10,    stat: 'calls_made' },
  call_100:         { emoji: '📱', name: 'Телефонист',         desc: 'Соверши 100 звонков',            target: 100,   stat: 'calls_made' },
  call_500:         { emoji: '🎧', name: 'Оператор связи',     desc: 'Соверши 500 звонков',            target: 500,   stat: 'calls_made' },
  call_received:    { emoji: '📲', name: 'Всегда на связи',    desc: 'Прими первый входящий',          target: 1,     stat: 'calls_received' },
  first_friend:     { emoji: '👋', name: 'Не один',            desc: 'Добавь первого друга',           target: 1,     stat: 'friends_added' },
  friends_5:        { emoji: '👥', name: 'Компания',           desc: 'Добавь 5 друзей',                target: 5,     stat: 'friends_added' },
  friends_20:       { emoji: '🎉', name: 'Тусовщик',           desc: 'Добавь 20 друзей',               target: 20,    stat: 'friends_added' },
  friends_50:       { emoji: '🌐', name: 'Социальный',         desc: 'Добавь 50 друзей',               target: 50,    stat: 'friends_added' },
  gift_sent:        { emoji: '🎁', name: 'Щедрая душа',        desc: 'Подари первый подарок',          target: 1,     stat: 'gifts_sent' },
  gift_10:          { emoji: '💝', name: 'Даритель',           desc: 'Подари 10 подарков',             target: 10,    stat: 'gifts_sent' },
  gift_100:         { emoji: '💎', name: 'Меценат',            desc: 'Подари 100 подарков',            target: 100,   stat: 'gifts_sent' },
  gift_received:    { emoji: '❤️', name: 'Любимчик',           desc: 'Получи первый подарок',          target: 1,     stat: 'gifts_received' },
  gift_received_10: { emoji: '🌟', name: 'Звезда',             desc: 'Получи 10 подарков',             target: 10,    stat: 'gifts_received' },
  first_story:      { emoji: '📸', name: 'Первый кадр',        desc: 'Опубликуй первую историю',       target: 1,     stat: 'stories_posted' },
  story_10:         { emoji: '🎬', name: 'Режиссёр',           desc: 'Опубликуй 10 историй',           target: 10,    stat: 'stories_posted' },
  story_50:         { emoji: '🎥', name: 'Хроникёр',           desc: 'Опубликуй 50 историй',           target: 50,    stat: 'stories_posted' },
  first_group:      { emoji: '👨‍👩‍👧', name: 'Организатор',    desc: 'Создай первую группу',           target: 1,     stat: 'groups_created' },
  first_channel:    { emoji: '📢', name: 'Вещатель',           desc: 'Создай первый канал',            target: 1,     stat: 'channels_created' },
  days_7:           { emoji: '🔥', name: 'Неделя подряд',      desc: 'Заходи 7 дней подряд',           target: 7,     stat: 'days_active' },
  days_30:          { emoji: '💫', name: 'Месяц с Aurora',     desc: 'Заходи 30 дней подряд',          target: 30,    stat: 'days_active' },
  days_365:         { emoji: '🏆', name: 'Год верности',       desc: 'Заходи 365 дней подряд',         target: 365,   stat: 'days_active' },
  first_voice:      { emoji: '🎤', name: 'Голос',              desc: 'Отправь первое голосовое',       target: 1,     stat: 'voice_sent' },
  voice_100:        { emoji: '🎙', name: 'Подкастер',          desc: 'Отправь 100 голосовых',          target: 100,   stat: 'voice_sent' },
  first_circle:     { emoji: '🎥', name: 'Кружок',             desc: 'Отправь первый кружок',          target: 1,     stat: 'circles_sent' },
  circle_50:        { emoji: '🎞', name: 'Кинооператор',       desc: 'Отправь 50 кружков',             target: 50,    stat: 'circles_sent' },
  first_photo:      { emoji: '📷', name: 'Фотограф',           desc: 'Отправь первое фото',            target: 1,     stat: 'photos_sent' },
  photo_100:        { emoji: '🖼', name: 'Галерея',            desc: 'Отправь 100 фото',               target: 100,   stat: 'photos_sent' },
  first_reaction:   { emoji: '👍', name: 'Реакция',            desc: 'Поставь первую реакцию',         target: 1,     stat: 'reactions_given' },
  reactions_100:    { emoji: '😍', name: 'Эмоциональный',      desc: 'Поставь 100 реакций',            target: 100,   stat: 'reactions_given' },
  first_sticker:    { emoji: '🐱', name: 'Стикер',             desc: 'Отправь первый стикер',          target: 1,     stat: 'stickers_sent' },
  stickers_100:     { emoji: '🎨', name: 'Стикероман',         desc: 'Отправь 100 стикеров',           target: 100,   stat: 'stickers_sent' },
};

// ═══════════════════════════════════════════════════════════
// 🚀 ПРИЛОЖЕНИЕ
// ═══════════════════════════════════════════════════════════

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e7,
  pingTimeout: 25000,
  pingInterval: 20000,
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname)));

const STORIES_DIR = path.join(__dirname, 'stories');
const STICKERS_DIR = path.join(__dirname, 'stickers');
for (const dir of [STORIES_DIR, STICKERS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
app.use('/stories', express.static(STORIES_DIR));
app.use('/stickers', express.static(STICKERS_DIR));

// ═══════════════════════════════════════════════════════════
// 📦 БАЗА ДАННЫХ
// ═══════════════════════════════════════════════════════════

console.log('🚀 Aurora v11.0: старт...');
console.log('🔌 TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? '✓ задан' : '✗ НЕ ЗАДАН');
console.log('🔑 TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? '✓ задан' : '✗ НЕ ЗАДАН');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── VAPID ───
if (webPush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('🔔 Web Push: VAPID настроен ✓');
  } catch (e) {
    console.error('🔔 Web Push: ошибка VAPID:', e.message);
  }
} else {
  console.log('🔔 Web Push: НЕ НАСТРОЕН');
}

// ═══════════════════════════════════════════════════════════
// 🗄️ ИНИЦИАЛИЗАЦИЯ СХЕМЫ
// ═══════════════════════════════════════════════════════════

async function initDB() {
  console.log('📦 Инициализация базы...');
  const start = Date.now();

  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    avatar TEXT,
    verified INTEGER DEFAULT 0,
    bio TEXT,
    first_name TEXT,
    last_name TEXT,
    birthday TEXT,
    emoji_status TEXT,
    last_seen_visibility TEXT DEFAULT 'everyone',
    phone TEXT,
    registered_at INTEGER NOT NULL
  )`);
  await db.execute(`ALTER TABLE users ADD COLUMN bio TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN first_name TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN last_name TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN birthday TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN emoji_status TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN last_seen_visibility TEXT DEFAULT 'everyone'`).catch(() => {});

  await db.execute(`CREATE TABLE IF NOT EXISTS user_settings (
    username TEXT PRIMARY KEY,
    theme TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'ru',
    font_size TEXT DEFAULT 'medium',
    accent_color TEXT DEFAULT '#a855f7',
    animations INTEGER DEFAULT 1,
    sound INTEGER DEFAULT 1,
    vibration INTEGER DEFAULT 1,
    notif_private INTEGER DEFAULT 1,
    notif_groups INTEGER DEFAULT 1,
    auto_delete TEXT DEFAULT 'off',
    passcode TEXT,
    profile_color TEXT DEFAULT '#a855f7',
    chat_wallpaper TEXT DEFAULT '',
    premium INTEGER DEFAULT 1,
    stars INTEGER DEFAULT 0,
    last_seen_visibility TEXT DEFAULT 'everyone'
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    device TEXT,
    ip TEXT,
    last_active INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(username, last_active DESC)`).catch(() => {});

  await db.execute(`CREATE TABLE IF NOT EXISTS contacts (
    owner TEXT NOT NULL,
    contact TEXT NOT NULL,
    display_name TEXT,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (owner, contact)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    text TEXT,
    image TEXT,
    voice TEXT,
    voice_duration INTEGER,
    video_circle TEXT,
    video_duration INTEGER,
    reactions TEXT DEFAULT '{}',
    reply_to INTEGER,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    read_at INTEGER,
    sticker TEXT,
    time INTEGER NOT NULL,
    system INTEGER DEFAULT 0,
    system_type TEXT
  )`);
  await db.execute(`ALTER TABLE messages ADD COLUMN system INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN system_type TEXT`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(from_user, to_user, time)`).catch(() => {});

  await db.execute(`CREATE TABLE IF NOT EXISTS groups_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator TEXT NOT NULL,
    avatar TEXT,
    description TEXT,
    pinned_message_id INTEGER,
    created_at INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, username)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    from_user TEXT NOT NULL,
    text TEXT,
    image TEXT,
    voice TEXT,
    voice_duration INTEGER,
    video_circle TEXT,
    video_duration INTEGER,
    reactions TEXT DEFAULT '{}',
    reply_to INTEGER,
    edited INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    sticker TEXT,
    time INTEGER NOT NULL,
    system INTEGER DEFAULT 0,
    system_type TEXT
  )`);
  await db.execute(`ALTER TABLE group_messages ADD COLUMN system INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN system_type TEXT`).catch(() => {});

  await db.execute(`CREATE TABLE IF NOT EXISTS chat_settings (
    owner TEXT NOT NULL,
    chat_key TEXT NOT NULL,
    archived INTEGER DEFAULT 0,
    muted INTEGER DEFAULT 0,
    PRIMARY KEY (owner, chat_key)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS blocks (
    blocker TEXT NOT NULL,
    blocked TEXT NOT NULL,
    time INTEGER NOT NULL,
    PRIMARY KEY (blocker, blocked)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    image TEXT NOT NULL,
    caption TEXT,
    time INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS story_views (
    story_id INTEGER NOT NULL,
    viewer TEXT NOT NULL,
    time INTEGER NOT NULL,
    PRIMARY KEY (story_id, viewer)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS stickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    emoji TEXT,
    time INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS gift_codes (
    code TEXT PRIMARY KEY,
    created_by TEXT NOT NULL,
    used_by TEXT,
    used_at INTEGER,
    time INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar TEXT,
    creator TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_members (
    channel_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (channel_id, username)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    from_user TEXT NOT NULL,
    text TEXT,
    image TEXT,
    voice TEXT,
    voice_duration INTEGER,
    reactions TEXT DEFAULT '{}',
    deleted INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    time INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    from_user TEXT NOT NULL,
    text TEXT,
    image TEXT,
    voice TEXT,
    voice_duration INTEGER,
    deleted INTEGER DEFAULT 0,
    time INTEGER NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_invites (
    code TEXT PRIMARY KEY,
    channel_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS stars_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    from_user TEXT,
    time INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_key TEXT NOT NULL,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    price INTEGER NOT NULL,
    time INTEGER NOT NULL,
    sold INTEGER DEFAULT 0,
    sold_at INTEGER,
    sold_price INTEGER
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS achievements (
    username TEXT NOT NULL,
    achievement_key TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (username, achievement_key)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS user_stats (
    username TEXT PRIMARY KEY,
    messages_sent INTEGER DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    calls_received INTEGER DEFAULT 0,
    calls_missed INTEGER DEFAULT 0,
    calls_duration INTEGER DEFAULT 0,
    gifts_sent INTEGER DEFAULT 0,
    gifts_received INTEGER DEFAULT 0,
    stories_posted INTEGER DEFAULT 0,
    groups_created INTEGER DEFAULT 0,
    channels_created INTEGER DEFAULT 0,
    friends_added INTEGER DEFAULT 0,
    days_active INTEGER DEFAULT 0,
    last_active_day TEXT,
    stickers_sent INTEGER DEFAULT 0,
    voice_sent INTEGER DEFAULT 0,
    circles_sent INTEGER DEFAULT 0,
    photos_sent INTEGER DEFAULT 0,
    reactions_given INTEGER DEFAULT 0,
    edited_messages INTEGER DEFAULT 0,
    deleted_messages INTEGER DEFAULT 0
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used INTEGER
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(username)`).catch(() => {});

  console.log(`✅ Схема БД готова за ${Date.now() - start}мс`);
}

// ═══════════════════════════════════════════════════════════
// 🧰 ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════

function now() { return Date.now(); }

async function getUser(username) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  return r.rows[0] || null;
}

async function getContactInfo(username) {
  const r = await db.execute({
    sql: 'SELECT username, avatar, verified, bio, first_name, last_name, emoji_status, last_seen_visibility FROM users WHERE username = ?',
    args: [username]
  });
  return r.rows[0] || null;
}

async function getMessageById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
async function getGroupMessageById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM group_messages WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

function safeParseReactions(raw) {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return (o && typeof o === 'object') ? o : {};
  } catch (e) { return {}; }
}

function validImage(s) { return typeof s === 'string' && s.startsWith('data:image/') && s.length <= CONFIG.MAX_IMAGE; }
function validVoice(s) { return typeof s === 'string' && s.startsWith('data:audio/') && s.length <= CONFIG.MAX_VOICE; }
function validVideo(s) { return typeof s === 'string' && s.startsWith('data:video/') && s.length <= CONFIG.MAX_VIDEO; }
function validStickerData(s) {
  if (typeof s !== 'string' || s.length > CONFIG.MAX_STICKER) return false;
  return s.startsWith('data:image/') || s.startsWith('data:video/') || /^https?:\/\//i.test(s);
}

function generateSessionId() { return crypto.randomBytes(32).toString('hex'); }

// ═══════════════════════════════════════════════════════════
// 🚦 RATE LIMIT + КЭШ
// ═══════════════════════════════════════════════════════════

const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const t = now();
  let b = rateBuckets.get(key);
  if (!b || t > b.resetAt) { b = { count: 0, resetAt: t + windowMs }; rateBuckets.set(key, b); }
  b.count++;
  return b.count <= max;
}
setInterval(() => {
  const t = now();
  for (const [k, b] of rateBuckets) if (t > b.resetAt) rateBuckets.delete(k);
}, 10 * 60 * 1000);

const settingsCache = new Map();
function cacheGet(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (now() > entry.expires) { map.delete(key); return null; }
  return entry.value;
}
function cacheSet(map, key, value) { map.set(key, { value, expires: now() + CONFIG.CACHE_TTL }); }
function cacheInvalidate(map, key) { map.delete(key); }

// ═══════════════════════════════════════════════════════════
// 👥 ONLINE
// ═══════════════════════════════════════════════════════════

const onlineUsers = {};
function findSocketsByUsername(username) {
  const result = [];
  for (const [sid, u] of Object.entries(onlineUsers)) if (u === username) result.push(sid);
  return result;
}
function isOnline(username) {
  for (const u of Object.values(onlineUsers)) if (u === username) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════
// 📞 СИСТЕМНЫЕ СООБЩЕНИЯ (звонки)
// ═══════════════════════════════════════════════════════════

async function createCallSystemMessage(fromUser, toUser, type, duration) {
  try {
    const t = now();
    let text = '';
    if (type === 'missed') text = '📞 Пропущенный звонок';
    else if (type === 'outgoing') text = '📞 Исходящий звонок';
    else if (type === 'incoming') text = '📞 Входящий звонок';
    else if (type === 'ended') {
      const m = Math.floor((duration || 0) / 60);
      const s = (duration || 0) % 60;
      text = '📞 Звонок · ' + m + ':' + (s < 10 ? '0' : '') + s;
    }

    const result = await db.execute({
      sql: `INSERT INTO messages 
            (from_user, to_user, text, reactions, reply_to, edited, deleted, sticker, time, system, system_type) 
            VALUES (?, ?, ?, '{}', NULL, 0, 0, NULL, ?, 1, ?)`,
      args: [fromUser, toUser, text, t, type]
    });
    const msgId = Number(result.lastInsertRowid);

    const payload = {
      id: msgId, from: fromUser, to: toUser, text,
      reactions: {}, replyData: null, time: t,
      system: true, systemType: type, duration: duration || 0
    };

    findSocketsByUsername(toUser).forEach(sid => io.to(sid).emit('private message', { ...payload, self: false }));
    findSocketsByUsername(fromUser).forEach(sid => io.to(sid).emit('private message', { ...payload, self: true }));

    return msgId;
  } catch (e) {
    console.error('createCallSystemMessage:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 🔔 WEB PUSH
// ═══════════════════════════════════════════════════════════

async function savePushSubscription(username, subscription) {
  try {
    if (!subscription || !subscription.endpoint) return;
    const keys = subscription.keys || {};
    await db.execute({
      sql: `INSERT OR REPLACE INTO push_subscriptions 
            (username, endpoint, p256dh, auth, created_at, last_used) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [username, subscription.endpoint, keys.p256dh || '', keys.auth || '', now(), now()]
    });
  } catch (e) { console.error('savePushSubscription:', e); }
}

async function removePushSubscription(endpoint) {
  try {
    await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
  } catch (e) { console.error('removePushSubscription:', e); }
}

async function sendPushToUser(username, payload) {
  if (!webPush || !VAPID_PUBLIC_KEY) return;
  try {
    const r = await db.execute({ sql: 'SELECT * FROM push_subscriptions WHERE username = ?', args: [username] });
    if (r.rows.length === 0) return;

    const payloadStr = JSON.stringify(payload);

    for (const sub of r.rows) {
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      try {
        await webPush.sendNotification(subscription, payloadStr, { TTL: 60 * 60, urgency: 'normal' });
        db.execute({
          sql: 'UPDATE push_subscriptions SET last_used = ? WHERE endpoint = ?',
          args: [now(), sub.endpoint]
        }).catch(() => {});
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removePushSubscription(sub.endpoint);
        } else {
          console.error('sendPushToUser error:', err.message);
        }
      }
    }
  } catch (e) { console.error('sendPushToUser:', e); }
}
// ═══════════════════════════════════════════════════════════
// 💾 SETTINGS / SESSIONS / CONTACTS
// ═══════════════════════════════════════════════════════════

async function getSettings(username) {
  const cached = cacheGet(settingsCache, username);
  if (cached) return cached;
  await db.execute({ sql: 'INSERT OR IGNORE INTO user_settings (username) VALUES (?)', args: [username] });
  const r = await db.execute({ sql: 'SELECT * FROM user_settings WHERE username = ?', args: [username] });
  const result = r.rows[0] || {};
  cacheSet(settingsCache, username, result);
  return result;
}

async function createSession(username, device, ip) {
  const id = generateSessionId();
  const t = now();
  const expiresAt = t + CONFIG.SESSION_TTL;
  await db.execute({
    sql: 'INSERT INTO sessions (id, username, device, ip, last_active, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, username, (device || 'Web').slice(0, 80), (ip || '').slice(0, 60), t, t, expiresAt]
  });
  return id;
}

async function getSessionById(sessionId) {
  if (!sessionId) return null;
  const r = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessionId] });
  const row = r.rows[0];
  if (!row) return null;
  if (row.expires_at && now() > row.expires_at) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] });
    return null;
  }
  return row;
}

async function updateSession(sessionId) {
  if (!sessionId) return false;
  const s = await getSessionById(sessionId);
  if (!s) return false;
  await db.execute({ sql: 'UPDATE sessions SET last_active = ? WHERE id = ?', args: [now(), sessionId] });
  return true;
}

async function getUserSessions(username) {
  await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < ?', args: [now()] });
  const r = await db.execute({
    sql: 'SELECT id, device, ip, last_active, created_at, expires_at FROM sessions WHERE username = ? ORDER BY last_active DESC',
    args: [username]
  });
  return r.rows;
}

async function cleanupExpiredSessions() {
  try {
    await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < ?', args: [now()] });
  } catch (e) { console.error('cleanupExpiredSessions:', e); }
}

async function getContactsOf(username) {
  const r = await db.execute({
    sql: 'SELECT contact, display_name FROM contacts WHERE owner = ? ORDER BY added_at ASC',
    args: [username]
  });
  return r.rows.map(row => ({ contact: row.contact, display_name: row.display_name }));
}

// ═══════════════════════════════════════════════════════════
// 💬 MESSAGES / BLOCKS
// ═══════════════════════════════════════════════════════════

async function getHistory(me, withUser) {
  const r = await db.execute({
    sql: `SELECT * FROM messages 
          WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) 
          ORDER BY time ASC LIMIT 300`,
    args: [me, withUser, withUser, me]
  });
  return r.rows;
}

async function getGroupHistory(groupId) {
  const r = await db.execute({
    sql: 'SELECT * FROM group_messages WHERE group_id = ? ORDER BY time ASC LIMIT 300',
    args: [groupId]
  });
  return r.rows;
}

async function enrichHistoryWithReplies(rows, isGroup) {
  const replyIds = rows.filter(m => m.reply_to).map(m => m.reply_to);
  const repliesMap = {};
  if (replyIds.length > 0) {
    const ph = replyIds.map(() => '?').join(',');
    const table = isGroup ? 'group_messages' : 'messages';
    const rr = await db.execute({
      sql: `SELECT id, from_user, text, image, voice, deleted FROM ${table} WHERE id IN (${ph})`,
      args: replyIds
    });
    rr.rows.forEach(r => { repliesMap[r.id] = r; });
  }
  return rows.map(m => {
    let replyData = null;
    if (m.reply_to && repliesMap[m.reply_to]) {
      const r = repliesMap[m.reply_to];
      replyData = {
        id: r.id, from: r.from_user, text: r.text,
        image: !!r.image, voice: !!r.voice, deleted: !!r.deleted
      };
    }
    return { ...m, reactions: safeParseReactions(m.reactions), replyData };
  });
}

async function isBlocked(blocker, blocked) {
  const r = await db.execute({
    sql: 'SELECT 1 FROM blocks WHERE blocker = ? AND blocked = ?',
    args: [blocker, blocked]
  });
  return r.rows.length > 0;
}

async function isBlockedEither(a, b) {
  if (await isBlocked(a, b)) return true;
  if (await isBlocked(b, a)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════
// ⭐ STARS / 🎁 GIFTS
// ═══════════════════════════════════════════════════════════

async function getStars(username) {
  if (username === CONFIG.ADMIN_USERNAME) return 999999;
  const r = await db.execute({ sql: 'SELECT stars FROM user_settings WHERE username = ?', args: [username] });
  return Number(r.rows[0]?.stars || 0);
}

async function addStars(username, amount, reason, fromUser) {
  if (username === CONFIG.ADMIN_USERNAME) return;
  const s = await getSettings(username);
  const newStars = Math.max(0, Number(s.stars || 0) + amount);
  await db.execute({ sql: 'UPDATE user_settings SET stars = ? WHERE username = ?', args: [newStars, username] });
  cacheInvalidate(settingsCache, username);
  await db.execute({
    sql: 'INSERT INTO stars_transactions (username, amount, reason, from_user, time) VALUES (?, ?, ?, ?, ?)',
    args: [username, amount, reason, fromUser || null, now()]
  });
}

async function getGiftsOfUser(username) {
  const r = await db.execute({
    sql: 'SELECT * FROM gifts WHERE to_user = ? AND sold = 0 ORDER BY time DESC',
    args: [username]
  });
  return r.rows;
}

async function countGiftsToday(fromUser) {
  const since = now() - 24 * 60 * 60 * 1000;
  const r = await db.execute({
    sql: 'SELECT COUNT(*) as c FROM gifts WHERE from_user = ? AND time > ?',
    args: [fromUser, since]
  });
  return Number(r.rows[0]?.c || 0);
}

// ═══════════════════════════════════════════════════════════
// 🏆 ДОСТИЖЕНИЯ
// ═══════════════════════════════════════════════════════════

async function getUserStats(username) {
  let r = await db.execute({ sql: 'SELECT * FROM user_stats WHERE username = ?', args: [username] });
  if (r.rows.length === 0) {
    await db.execute({ sql: 'INSERT INTO user_stats (username) VALUES (?)', args: [username] });
    r = await db.execute({ sql: 'SELECT * FROM user_stats WHERE username = ?', args: [username] });
  }
  return r.rows[0] || {};
}

async function incrementStat(username, statName, amount) {
  amount = amount || 1;
  const allowed = [
    'messages_sent', 'calls_made', 'calls_received', 'calls_missed', 'calls_duration',
    'gifts_sent', 'gifts_received', 'stories_posted', 'groups_created',
    'channels_created', 'friends_added', 'stickers_sent', 'voice_sent',
    'circles_sent', 'photos_sent', 'reactions_given', 'edited_messages', 'deleted_messages'
  ];
  if (allowed.indexOf(statName) === -1) return;
  try {
    await db.execute({ sql: 'INSERT OR IGNORE INTO user_stats (username) VALUES (?)', args: [username] });
    await db.execute({
      sql: `UPDATE user_stats SET ${statName} = COALESCE(${statName}, 0) + ? WHERE username = ?`,
      args: [amount, username]
    });
    await checkAchievements(username, statName);
  } catch (e) {
    console.error('incrementStat error:', e);
  }
}

async function checkAchievements(username, statName) {
  try {
    const stats = await getUserStats(username);
    const currentValue = Number(stats[statName] || 0);

    for (const [key, ach] of Object.entries(ACHIEVEMENTS_CATALOG)) {
      if (ach.stat !== statName) continue;
      if (currentValue < ach.target) continue;

      const existing = await db.execute({
        sql: 'SELECT 1 FROM achievements WHERE username = ? AND achievement_key = ?',
        args: [username, key]
      });
      if (existing.rows.length > 0) continue;

      await db.execute({
        sql: 'INSERT INTO achievements (username, achievement_key, unlocked_at) VALUES (?, ?, ?)',
        args: [username, key, now()]
      });

      findSocketsByUsername(username).forEach(sid => {
        io.to(sid).emit('achievement unlocked', {
          key, emoji: ach.emoji, name: ach.name, desc: ach.desc
        });
      });

      await addStars(username, 5, 'achievement:' + key, null);
    }
  } catch (e) {
    console.error('checkAchievements error:', e);
  }
}

async function getUserAchievements(username) {
  const r = await db.execute({
    sql: 'SELECT achievement_key, unlocked_at FROM achievements WHERE username = ?',
    args: [username]
  });
  const unlocked = {};
  r.rows.forEach(row => { unlocked[row.achievement_key] = row.unlocked_at; });
  const stats = await getUserStats(username);
  return { unlocked, stats };
}

async function updateDayStreak(username) {
  try {
    const stats = await getUserStats(username);
    const today = new Date().toISOString().slice(0, 10);
    if (stats.last_active_day === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let newStreak = 1;
    if (stats.last_active_day === yesterday) {
      newStreak = Number(stats.days_active || 0) + 1;
    }
    await db.execute({
      sql: 'UPDATE user_stats SET days_active = ?, last_active_day = ? WHERE username = ?',
      args: [newStreak, today, username]
    });
    await checkAchievements(username, 'days_active');
  } catch (e) { console.error('updateDayStreak:', e); }
}

// ═══════════════════════════════════════════════════════════
// 👥 ГРУППЫ / 📢 КАНАЛЫ
// ═══════════════════════════════════════════════════════════

async function getGroupById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM groups_table WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
async function getGroupMembers(groupId) {
  const r = await db.execute({
    sql: 'SELECT username FROM group_members WHERE group_id = ? ORDER BY joined_at ASC',
    args: [groupId]
  });
  return r.rows.map(row => row.username);
}
async function getUserGroups(username) {
  const r = await db.execute({
    sql: `SELECT g.* FROM groups_table g 
          INNER JOIN group_members gm ON g.id = gm.group_id 
          WHERE gm.username = ? ORDER BY g.created_at ASC`,
    args: [username]
  });
  return r.rows;
}
async function isGroupMember(groupId, username) {
  const r = await db.execute({
    sql: 'SELECT 1 FROM group_members WHERE group_id = ? AND username = ?',
    args: [groupId, username]
  });
  return r.rows.length > 0;
}
async function countUserCreatedGroups(username) {
  const r = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM groups_table WHERE creator = ?', args: [username] });
  return Number(r.rows[0]?.cnt || 0);
}

async function getChannelById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM channels WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
async function getChannelBySlug(slug) {
  const r = await db.execute({ sql: 'SELECT * FROM channels WHERE slug = ?', args: [slug] });
  return r.rows[0] || null;
}
async function getChannelMembers(channelId) {
  const r = await db.execute({
    sql: 'SELECT username FROM channel_members WHERE channel_id = ? ORDER BY joined_at ASC',
    args: [channelId]
  });
  return r.rows.map(x => x.username);
}
async function isChannelMember(channelId, username) {
  const r = await db.execute({
    sql: 'SELECT 1 FROM channel_members WHERE channel_id = ? AND username = ?',
    args: [channelId, username]
  });
  return r.rows.length > 0;
}
async function countUserCreatedChannels(username) {
  const r = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM channels WHERE creator = ?', args: [username] });
  return Number(r.rows[0]?.cnt || 0);
}
async function getUserChannels(username) {
  const r = await db.execute({
    sql: `SELECT c.* FROM channels c 
          INNER JOIN channel_members cm ON c.id = cm.channel_id 
          WHERE cm.username = ? ORDER BY c.created_at ASC`,
    args: [username]
  });
  return r.rows;
}

async function getChatSettings(owner, chatKey) {
  const r = await db.execute({
    sql: 'SELECT * FROM chat_settings WHERE owner = ? AND chat_key = ?',
    args: [owner, chatKey]
  });
  return r.rows[0] || { archived: 0, muted: 0 };
}
async function setChatSetting(owner, chatKey, field, value) {
  const FIELD_MAP = { archived: 'archived', muted: 'muted' };
  const col = FIELD_MAP[field];
  if (!col) throw new Error('Invalid field');
  await db.execute({
    sql: 'INSERT OR IGNORE INTO chat_settings (owner, chat_key, archived, muted) VALUES (?, ?, 0, 0)',
    args: [owner, chatKey]
  });
  await db.execute({
    sql: `UPDATE chat_settings SET ${col} = ? WHERE owner = ? AND chat_key = ?`,
    args: [value, owner, chatKey]
  });
}

// ═══════════════════════════════════════════════════════════
// 📸 STORIES / 🖼 STICKERS
// ═══════════════════════════════════════════════════════════

async function getActiveStories(viewer) {
  const t = now();
  const contactsR = await db.execute({ sql: 'SELECT contact FROM contacts WHERE owner = ?', args: [viewer] });
  const allowedUsers = contactsR.rows.map(r => r.contact);
  allowedUsers.push(viewer);

  const ph = allowedUsers.map(() => '?').join(',');
  const r = await db.execute({
    sql: `SELECT s.*, u.avatar, u.verified, u.first_name, u.last_name 
          FROM stories s 
          LEFT JOIN users u ON u.username = s.username 
          WHERE s.username IN (${ph}) AND s.expires_at > ? 
          ORDER BY s.time ASC`,
    args: [...allowedUsers, t]
  });

  const storyIds = r.rows.map(s => s.id);
  const viewedSet = new Set();
  if (storyIds.length > 0) {
    const sph = storyIds.map(() => '?').join(',');
    const vr = await db.execute({
      sql: `SELECT story_id FROM story_views WHERE viewer = ? AND story_id IN (${sph})`,
      args: [viewer, ...storyIds]
    });
    vr.rows.forEach(x => viewedSet.add(x.story_id));
  }

  const byUser = {};
  for (const row of r.rows) {
    if (!byUser[row.username]) {
      byUser[row.username] = {
        username: row.username, avatar: row.avatar, verified: !!row.verified,
        firstName: row.first_name, lastName: row.last_name, stories: []
      };
    }
    byUser[row.username].stories.push({
      id: row.id, image: row.image, caption: row.caption,
      time: row.time, expires_at: row.expires_at, viewed: viewedSet.has(row.id)
    });
  }

  return Object.values(byUser).sort((a, b) => {
    const aU = a.stories.some(s => !s.viewed);
    const bU = b.stories.some(s => !s.viewed);
    if (aU !== bU) return aU ? -1 : 1;
    return b.stories[b.stories.length - 1].time - a.stories[a.stories.length - 1].time;
  });
}

async function deleteStory(storyId, username) {
  const r = await db.execute({ sql: 'SELECT * FROM stories WHERE id = ?', args: [storyId] });
  const story = r.rows[0];
  if (!story) return { ok: false, error: 'История не найдена' };
  if (story.username !== username) return { ok: false, error: 'Не твоя история' };
  if (story.image && story.image.startsWith('/stories/')) {
    const fpath = path.join(STORIES_DIR, story.image.replace('/stories/', ''));
    try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
  }
  await db.execute({ sql: 'DELETE FROM stories WHERE id = ?', args: [storyId] });
  await db.execute({ sql: 'DELETE FROM story_views WHERE story_id = ?', args: [storyId] });
  return { ok: true };
}

async function getUserStickers(username) {
  const r = await db.execute({ sql: 'SELECT * FROM stickers WHERE username = ? ORDER BY time DESC', args: [username] });
  return r.rows;
}
async function addSticker(username, url, type, emoji) {
  const r = await db.execute({
    sql: 'INSERT INTO stickers (username, url, type, emoji, time) VALUES (?, ?, ?, ?, ?)',
    args: [username, url, type || 'image', emoji || null, now()]
  });
  return Number(r.lastInsertRowid);
}
async function deleteSticker(id, username) {
  const r = await db.execute({
    sql: 'SELECT url FROM stickers WHERE id = ? AND username = ?',
    args: [id, username]
  });
  if (r.rows[0]) {
    const url = r.rows[0].url;
    if (url && url.startsWith('/stickers/')) {
      const fpath = path.join(STICKERS_DIR, url.replace('/stickers/', ''));
      try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
    }
  }
  await db.execute({ sql: 'DELETE FROM stickers WHERE id = ? AND username = ?', args: [id, username] });
}

// ═══════════════════════════════════════════════════════════
// 🧹 CLEANUP
// ═══════════════════════════════════════════════════════════

async function cleanupExpiredStories() {
  try {
    const t = now();
    const r = await db.execute({ sql: 'SELECT id, image FROM stories WHERE expires_at < ?', args: [t] });
    for (const row of r.rows) {
      if (row.image && row.image.startsWith('/stories/')) {
        const fpath = path.join(STORIES_DIR, row.image.replace('/stories/', ''));
        try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
      }
    }
    await db.execute({ sql: 'DELETE FROM stories WHERE expires_at < ?', args: [t] });
    await db.execute({ sql: 'DELETE FROM story_views WHERE story_id NOT IN (SELECT id FROM stories)' }).catch(() => {});
  } catch (e) { console.error('cleanupExpiredStories:', e); }
}

async function cleanupExpiredInvites() {
  try {
    await db.execute({ sql: 'DELETE FROM channel_invites WHERE expires_at < ?', args: [now()] });
  } catch (e) {}
}

async function cleanupOldMessages() {
  try {
    const r = await db.execute("SELECT username, auto_delete FROM user_settings WHERE auto_delete != 'off'");
    const t = now();
    const DAY = 24 * 60 * 60 * 1000;
    for (const row of r.rows) {
      const ttl = row.auto_delete === '24h' ? DAY : row.auto_delete === '7d' ? 7 * DAY : row.auto_delete === '30d' ? 30 * DAY : 0;
      if (ttl === 0) continue;
      const cutoff = t - ttl;
      await db.execute({
        sql: `UPDATE messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, 
              video_circle = NULL, sticker = NULL 
              WHERE from_user = ? AND to_user != ? AND time < ? AND deleted = 0`,
        args: [row.username, row.username, cutoff]
      });
      await db.execute({
        sql: `UPDATE group_messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, 
              video_circle = NULL, sticker = NULL 
              WHERE from_user = ? AND time < ? AND deleted = 0`,
        args: [row.username, cutoff]
      });
    }
    await cleanupExpiredStories();
    await cleanupExpiredInvites();
    await cleanupExpiredSessions();
  } catch (e) { console.error('cleanupOldMessages:', e); }
}

// ═══════════════════════════════════════════════════════════
// 📡 ОТПРАВКА СПИСКОВ
// ═══════════════════════════════════════════════════════════

async function sendContactsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;

  const contactRows = await getContactsOf(username);
  if (contactRows.length === 0) {
    sockets.forEach(sid => io.to(sid).emit('contacts', []));
    return;
  }

  const names = contactRows.map(r => r.contact);
  const ph = names.map(() => '?').join(',');

  const usersR = await db.execute({
    sql: `SELECT username, avatar, verified, first_name, last_name, emoji_status, last_seen_visibility 
          FROM users WHERE username IN (${ph})`,
    args: names
  });
  const usersMap = {};
  usersR.rows.forEach(u => { usersMap[u.username] = u; });

  const settingsR = await db.execute({
    sql: `SELECT chat_key, archived, muted FROM chat_settings 
          WHERE owner = ? AND chat_key IN (${ph})`,
    args: [username, ...names]
  });
  const settingsMap = {};
  settingsR.rows.forEach(s => { settingsMap[s.chat_key] = s; });

  const blocksR = await db.execute({
    sql: `SELECT blocked FROM blocks WHERE blocker = ? AND blocked IN (${ph})`,
    args: [username, ...names]
  });
  const blockedSet = new Set(blocksR.rows.map(r => r.blocked));

  const list = contactRows.map(row => {
    const info = usersMap[row.contact];
    const settings = settingsMap[row.contact] || { archived: 0, muted: 0 };
    let lastSeenVisible = true;
    if (info && info.last_seen_visibility === 'nobody') lastSeenVisible = false;
    return {
      name: row.contact,
      displayName: row.display_name || row.contact,
      avatar: info ? info.avatar : null,
      verified: info ? !!info.verified : false,
      firstName: info ? info.first_name : null,
      lastName: info ? info.last_name : null,
      emojiStatus: info ? info.emoji_status : null,
      online: lastSeenVisible ? isOnline(row.contact) : false,
      archived: !!settings.archived,
      muted: !!settings.muted,
      blocked: blockedSet.has(row.contact)
    };
  });

  sockets.forEach(sid => io.to(sid).emit('contacts', list));
}

async function sendGroupsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;

  const groups = await getUserGroups(username);
  const createdCount = await countUserCreatedGroups(username);

  if (groups.length === 0) {
    sockets.forEach(sid => io.to(sid).emit('groups', [], { canCreate: createdCount < 1, createdCount }));
    return;
  }

  const groupIds = groups.map(g => g.id);
  const gph = groupIds.map(() => '?').join(',');

  const membersR = await db.execute({
    sql: `SELECT group_id, username FROM group_members WHERE group_id IN (${gph}) ORDER BY joined_at ASC`,
    args: groupIds
  });
  const membersMap = {};
  membersR.rows.forEach(r => {
    if (!membersMap[r.group_id]) membersMap[r.group_id] = [];
    membersMap[r.group_id].push(r.username);
  });

  const chatKeys = groupIds.map(id => 'g:' + id);
  const kph = chatKeys.map(() => '?').join(',');
  const settingsR = await db.execute({
    sql: `SELECT chat_key, archived, muted FROM chat_settings WHERE owner = ? AND chat_key IN (${kph})`,
    args: [username, ...chatKeys]
  });
  const settingsMap = {};
  settingsR.rows.forEach(s => { settingsMap[s.chat_key] = s; });

  const list = groups.map(g => {
    const members = membersMap[g.id] || [];
    const settings = settingsMap['g:' + g.id] || { archived: 0, muted: 0 };
    return {
      id: g.id, name: g.name, avatar: g.avatar, creator: g.creator,
      description: g.description, pinnedMessageId: g.pinned_message_id,
      members, memberCount: members.length,
      archived: !!settings.archived, muted: !!settings.muted
    };
  });

  sockets.forEach(sid => io.to(sid).emit('groups', list, { canCreate: createdCount < 1, createdCount }));
}

async function sendChannelsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;

  const channels = await getUserChannels(username);
  const createdCount = await countUserCreatedChannels(username);

  if (channels.length === 0) {
    sockets.forEach(sid => io.to(sid).emit('channels', [], { canCreate: createdCount < 1, createdCount }));
    return;
  }

  const ids = channels.map(c => c.id);
  const ph = ids.map(() => '?').join(',');

  const membersR = await db.execute({
    sql: `SELECT channel_id, username FROM channel_members WHERE channel_id IN (${ph}) ORDER BY joined_at ASC`,
    args: ids
  });
  const membersMap = {};
  membersR.rows.forEach(r => {
    if (!membersMap[r.channel_id]) membersMap[r.channel_id] = [];
    membersMap[r.channel_id].push(r.username);
  });

  const list = channels.map(c => {
    const members = membersMap[c.id] || [];
    return {
      id: c.id, slug: c.slug, name: c.name, description: c.description,
      avatar: c.avatar, creator: c.creator, verified: !!c.verified,
      members, memberCount: members.length
    };
  });

  sockets.forEach(sid => io.to(sid).emit('channels', list, { canCreate: createdCount < 1, createdCount }));
}

// ═══════════════════════════════════════════════════════════
// 🔔 УВЕДОМЛЕНИЯ
// ═══════════════════════════════════════════════════════════

async function refreshForFriends(username) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) sendContactsTo(row.owner).catch(() => {});
}

async function notifyAllFriends(username, event, payload) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit(event, payload));
}

async function notifyGroupMembers(groupId, event, payload) {
  const members = await getGroupMembers(groupId);
  for (const u of members) findSocketsByUsername(u).forEach(sid => io.to(sid).emit(event, payload));
}

async function notifyChannelMembers(channelId, event, payload) {
  const members = await getChannelMembers(channelId);
  for (const u of members) findSocketsByUsername(u).forEach(sid => io.to(sid).emit(event, payload));
}
// ═══════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ═══════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log('🔗 Подключился:', socket.id);

  // ─── ПРОВЕРКА НИКА ───
  socket.on('check username', async ({ username }, cb) => {
    try {
      if (!rateLimit('check:' + socket.handshake.address, 60, CONFIG.RATE_WINDOW)) {
        return cb && cb({ ok: false, available: false, error: 'Слишком часто' });
      }
      username = String(username || '').trim().toLowerCase();
      if (!username) return cb && cb({ ok: true, available: false, reason: 'empty' });
      if (username.length < CONFIG.MIN_USERNAME_LEN) return cb && cb({ ok: true, available: false, reason: 'short' });
      if (username.length > CONFIG.MAX_USERNAME_LEN) return cb && cb({ ok: true, available: false, reason: 'long' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: true, available: false, reason: 'chars' });
      const exists = await getUser(username);
      cb && cb({ ok: true, available: !exists, reason: exists ? 'taken' : 'ok' });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false, available: false, error: 'Ошибка сервера' });
    }
  });

  // ─── РЕГИСТРАЦИЯ ───
  socket.on('register', async ({ username, password, displayName }, cb) => {
    try {
      if (!rateLimit('reg:' + socket.handshake.address, 5, CONFIG.RATE_WINDOW)) {
        return cb && cb({ ok: false, error: 'Слишком много попыток. Подожди минуту.' });
      }
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      displayName = String(displayName || '').trim().slice(0, CONFIG.MAX_DISPLAY_NAME);

      if (!username || !password) return cb && cb({ ok: false, error: 'Заполни все поля' });
      if (username.length < CONFIG.MIN_USERNAME_LEN) return cb && cb({ ok: false, error: 'Ник минимум ' + CONFIG.MIN_USERNAME_LEN + ' символа' });
      if (username.length > CONFIG.MAX_USERNAME_LEN) return cb && cb({ ok: false, error: 'Ник максимум ' + CONFIG.MAX_USERNAME_LEN + ' символов' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: false, error: 'Только латиница, цифры и _' });
      if (password.length < CONFIG.MIN_PASSWORD_LEN) return cb && cb({ ok: false, error: 'Пароль минимум ' + CONFIG.MIN_PASSWORD_LEN + ' символов' });
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return cb && cb({ ok: false, error: 'Пароль должен содержать буквы и цифры' });
      }
      if (await getUser(username)) return cb && cb({ ok: false, error: 'Такой ник уже занят' });

      const hash = bcrypt.hashSync(password, 10);
      const t = now();

      await db.execute({
        sql: `INSERT INTO users (username, password, avatar, verified, bio, first_name, last_name, birthday, emoji_status, last_seen_visibility, phone, registered_at) 
              VALUES (?, ?, NULL, 0, NULL, ?, NULL, NULL, NULL, 'everyone', NULL, ?)`,
        args: [username, hash, displayName || null, t]
      });

      await getSettings(username);
      await addStars(username, 10, 'welcome', null);

      const sessionId = await createSession(username, socket.handshake.headers['user-agent'], socket.handshake.address);

      onlineUsers[socket.id] = username;
      socket.username = username;
      socket.sessionId = sessionId;

      const user = await getUser(username);
      const stars = await getStars(username);

      cb && cb({
        ok: true, bonus: 10, sessionId, username,
        avatar: user.avatar, verified: false, bio: user.bio,
        firstName: user.first_name, stars
      });

      getSettings(username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(username).catch(() => {});
      sendGroupsTo(username).catch(() => {});
      sendChannelsTo(username).catch(() => {});
    } catch (e) {
      console.error('register:', e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ─── ВХОД ПО ТОКЕНУ ───
  socket.on('login with session', async ({ sessionId }, cb) => {
    try {
      if (!rateLimit('autologin:' + socket.handshake.address, 30, CONFIG.RATE_WINDOW)) {
        return cb && cb({ ok: false, error: 'Слишком часто' });
      }
      if (!sessionId) return cb && cb({ ok: false, error: 'Нет сессии' });

      const session = await getSessionById(sessionId);
      if (!session) return cb && cb({ ok: false, error: 'Сессия истекла' });

      const user = await getUser(session.username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });

      onlineUsers[socket.id] = session.username;
      socket.username = session.username;
      socket.sessionId = sessionId;
      await updateSession(sessionId);
      await updateDayStreak(session.username);

      const stars = await getStars(session.username);

      cb && cb({
        ok: true, avatar: user.avatar, username: session.username,
        verified: !!user.verified, bio: user.bio,
        firstName: user.first_name, lastName: user.last_name,
        birthday: user.birthday, emojiStatus: user.emoji_status,
        sessionId, stars
      });

      getSettings(session.username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(session.username).catch(() => {});
      sendGroupsTo(session.username).catch(() => {});
      sendChannelsTo(session.username).catch(() => {});
      refreshForFriends(session.username).catch(() => {});
    } catch (e) {
      console.error('login with session:', e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ─── ВХОД ПО ПАРОЛЮ ───
  socket.on('login', async ({ username, password, device, sessionId }, cb) => {
    try {
      if (!rateLimit('login:' + socket.handshake.address, 10, CONFIG.RATE_WINDOW)) {
        return cb && cb({ ok: false, error: 'Слишком много попыток. Подожди минуту.' });
      }
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');

      const user = await getUser(username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (!bcrypt.compareSync(password, user.password)) {
        return cb && cb({ ok: false, error: 'Неверный пароль' });
      }

      let sessId = null;
      if (sessionId) {
        const existing = await getSessionById(sessionId);
        if (existing && existing.username === username) {
          sessId = sessionId;
          await updateSession(sessId);
        }
      }
      if (!sessId) sessId = await createSession(username, device, socket.handshake.address);

      onlineUsers[socket.id] = username;
      socket.username = username;
      socket.sessionId = sessId;
      await updateDayStreak(username);

      const stars = await getStars(username);

      cb && cb({
        ok: true, avatar: user.avatar, username,
        verified: !!user.verified, bio: user.bio,
        firstName: user.first_name, lastName: user.last_name,
        birthday: user.birthday, emojiStatus: user.emoji_status,
        sessionId: sessId, stars
      });

      getSettings(username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(username).catch(() => {});
      sendGroupsTo(username).catch(() => {});
      sendChannelsTo(username).catch(() => {});
      refreshForFriends(username).catch(() => {});
    } catch (e) {
      console.error('login:', e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ─── АВАТАР ───
  socket.on('set avatar', async ({ avatar }) => {
    if (!socket.username || !avatar || !validImage(avatar)) return;
    await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE username = ?', args: [avatar, socket.username] });
    refreshForFriends(socket.username).catch(() => {});
    notifyAllFriends(socket.username, 'friend updated', { username: socket.username, avatar }).catch(() => {});
  });

  // ─── ПРОФИЛЬ ───
  socket.on('update profile', async ({ firstName, lastName, bio, birthday, emojiStatus }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      firstName = firstName !== undefined ? String(firstName).slice(0, 40) : undefined;
      lastName = lastName !== undefined ? String(lastName).slice(0, 40) : undefined;
      bio = bio !== undefined ? String(bio).slice(0, CONFIG.MAX_BIO) : undefined;
      birthday = birthday !== undefined ? String(birthday).slice(0, 20) : undefined;
      emojiStatus = emojiStatus !== undefined ? String(emojiStatus).slice(0, 10) : undefined;

      const updates = [];
      const args = [];
      if (firstName !== undefined) { updates.push('first_name = ?'); args.push(firstName || null); }
      if (lastName !== undefined) { updates.push('last_name = ?'); args.push(lastName || null); }
      if (bio !== undefined) { updates.push('bio = ?'); args.push(bio || null); }
      if (birthday !== undefined) { updates.push('birthday = ?'); args.push(birthday || null); }
      if (emojiStatus !== undefined) { updates.push('emoji_status = ?'); args.push(emojiStatus || null); }

      if (updates.length === 0) return cb && cb({ ok: true });
      args.push(socket.username);
      await db.execute({ sql: 'UPDATE users SET ' + updates.join(', ') + ' WHERE username = ?', args });

      refreshForFriends(socket.username).catch(() => {});
      notifyAllFriends(socket.username, 'friend updated', { username: socket.username }).catch(() => {});

      const user = await getUser(socket.username);
      socket.emit('me updated', {
        firstName: user.first_name, lastName: user.last_name, bio: user.bio,
        birthday: user.birthday, emojiStatus: user.emoji_status,
        avatar: user.avatar, verified: !!user.verified
      });
      cb && cb({ ok: true });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false });
    }
  });

  // ─── НАСТРОЙКИ ───
  socket.on('get settings', async () => {
    if (socket.username) socket.emit('settings', await getSettings(socket.username));
  });

  socket.on('update settings', async ({ key, value }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const allowed = [
        'theme', 'language', 'font_size', 'accent_color', 'animations',
        'sound', 'vibration', 'notif_private', 'notif_groups',
        'auto_delete', 'profile_color', 'chat_wallpaper', 'premium'
      ];
      if (!allowed.includes(key)) return cb && cb({ ok: false });
      await db.execute({ sql: 'UPDATE user_settings SET ' + key + ' = ? WHERE username = ?', args: [value, socket.username] });
      cacheInvalidate(settingsCache, socket.username);
      socket.emit('settings', await getSettings(socket.username));
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('set last seen visibility', async ({ value }, cb) => {
    if (!socket.username || ['everyone', 'contacts', 'nobody'].indexOf(value) === -1) return cb && cb({ ok: false });
    await db.execute({ sql: 'UPDATE users SET last_seen_visibility = ? WHERE username = ?', args: [value, socket.username] });
    cb && cb({ ok: true });
  });

  // ─── ПАРОЛЬ-КОД ───
  socket.on('set passcode', async ({ passcode }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (passcode && passcode.length < 4) return cb && cb({ ok: false, error: 'Минимум 4 символа' });
      const hash = passcode ? bcrypt.hashSync(passcode, 10) : null;
      await db.execute({ sql: 'UPDATE user_settings SET passcode = ? WHERE username = ?', args: [hash, socket.username] });
      cacheInvalidate(settingsCache, socket.username);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('check passcode', async ({ passcode }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const s = await getSettings(socket.username);
      if (!s.passcode) return cb && cb({ ok: true });
      cb && cb({ ok: bcrypt.compareSync(passcode, s.passcode) });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('has passcode', async (cb) => {
    if (!socket.username) return cb && cb(false);
    const s = await getSettings(socket.username);
    cb && cb(!!s.passcode);
  });

  // ─── КОНТАКТЫ ───
  socket.on('add contact', async ({ username, displayName }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      username = String(username || '').trim().toLowerCase();
      displayName = String(displayName || '').trim();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      if (!displayName) return cb && cb({ ok: false, error: 'Введи имя' });
      if (username === socket.username) return cb && cb({ ok: false, error: 'Это твой ник' });
      if (!(await getUser(username))) return cb && cb({ ok: false, error: 'Такого пользователя нет' });

      await db.execute({
        sql: 'INSERT OR REPLACE INTO contacts (owner, contact, display_name, added_at) VALUES (?, ?, ?, ?)',
        args: [socket.username, username, displayName, now()]
      });
      await incrementStat(socket.username, 'friends_added');
      sendContactsTo(socket.username).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('remove contact', async ({ username }, cb) => {
    if (!socket.username) return;
    await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? AND contact = ?', args: [socket.username, username] });
    sendContactsTo(socket.username).catch(() => {});
    cb && cb({ ok: true });
  });

  socket.on('get profile', async ({ username }, cb) => {
    if (!socket.username) return cb && cb(null);
    const info = await getContactInfo(username);
    if (!info) return cb && cb(null);
    const blockedByMe = await isBlocked(socket.username, username);
    const blockedMe = await isBlocked(username, socket.username);
    const lastSeenVisible = info.last_seen_visibility !== 'nobody';
    const gifts = await getGiftsOfUser(username);
    cb && cb({
      username: info.username, avatar: info.avatar, verified: !!info.verified,
      bio: info.bio, firstName: info.first_name, lastName: info.last_name,
      emojiStatus: info.emoji_status,
      online: lastSeenVisible && isOnline(username),
      blockedByMe, blockedMe, gifts
    });
  });

  socket.on('get public profile', async ({ username }, cb) => {
    if (!socket.username) return cb && cb(null);
    const info = await getContactInfo(username);
    if (!info) return cb && cb(null);
    const gifts = await getGiftsOfUser(username);
    cb && cb({
      username: info.username, avatar: info.avatar, verified: !!info.verified,
      bio: info.bio, firstName: info.first_name, lastName: info.last_name,
      emojiStatus: info.emoji_status, gifts
    });
  });

  // ─── БЛОКИРОВКИ ───
  socket.on('block user', async ({ username }, cb) => {
    try {
      if (!socket.username || username === socket.username) return cb && cb({ ok: false });
      await db.execute({
        sql: 'INSERT OR REPLACE INTO blocks (blocker, blocked, time) VALUES (?, ?, ?)',
        args: [socket.username, username, now()]
      });
      sendContactsTo(socket.username).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('unblock user', async ({ username }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    await db.execute({ sql: 'DELETE FROM blocks WHERE blocker = ? AND blocked = ?', args: [socket.username, username] });
    sendContactsTo(socket.username).catch(() => {});
    cb && cb({ ok: true });
  });

  socket.on('get blocked', async (cb) => {
    if (!socket.username) return cb && cb([]);
    const r = await db.execute({ sql: 'SELECT blocked FROM blocks WHERE blocker = ?', args: [socket.username] });
    cb && cb(r.rows.map(row => row.blocked));
  });

  // ─── СЕССИИ ───
  socket.on('get sessions', async (cb) => {
    if (!socket.username) return cb && cb([]);
    cb && cb(await getUserSessions(socket.username));
  });

  socket.on('terminate session', async ({ sessionId }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    Object.entries(onlineUsers).forEach(([sid]) => {
      if (sid !== socket.id) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.username === socket.username && s.sessionId === sessionId) {
          s.emit('session terminated');
          s.disconnect(true);
        }
      }
    });
    await db.execute({ sql: 'DELETE FROM sessions WHERE id = ? AND username = ?', args: [sessionId, socket.username] });
    cb && cb({ ok: true });
  });

  socket.on('delete all other sessions', async (cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    Object.entries(onlineUsers).forEach(([sid]) => {
      if (sid !== socket.id) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.username === socket.username) {
          s.emit('session terminated');
          s.disconnect(true);
        }
      }
    });
    await db.execute({ sql: 'DELETE FROM sessions WHERE username = ? AND id != ?', args: [socket.username, socket.sessionId || ''] });
    cb && cb({ ok: true });
  });

  // ─── УДАЛЕНИЕ АККАУНТА ───
  socket.on('delete account', async ({ password }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const user = await getUser(socket.username);
      if (!user || !bcrypt.compareSync(password, user.password)) {
        return cb && cb({ ok: false, error: 'Неверный пароль' });
      }
      const me = socket.username;

      await db.execute({ sql: 'DELETE FROM messages WHERE from_user = ? OR to_user = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM group_messages WHERE from_user = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM group_members WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM groups_table WHERE creator = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? OR contact = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM chat_settings WHERE owner = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM blocks WHERE blocker = ? OR blocked = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM sessions WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM achievements WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM user_stats WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE username = ?', args: [me] });

      const myStories = await db.execute({ sql: 'SELECT id, image FROM stories WHERE username = ?', args: [me] });
      for (const s of myStories.rows) {
        if (s.image && s.image.startsWith('/stories/')) {
          const fpath = path.join(STORIES_DIR, s.image.replace('/stories/', ''));
          try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
        }
      }
      await db.execute({ sql: 'DELETE FROM stories WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM story_views WHERE viewer = ?', args: [me] });

      const myStickers = await db.execute({ sql: 'SELECT url FROM stickers WHERE username = ?', args: [me] });
      for (const s of myStickers.rows) {
        if (s.url && s.url.startsWith('/stickers/')) {
          const fpath = path.join(STICKERS_DIR, s.url.replace('/stickers/', ''));
          try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
        }
      }
      await db.execute({ sql: 'DELETE FROM stickers WHERE username = ?', args: [me] });

      const myChannels = await db.execute({ sql: 'SELECT id FROM channels WHERE creator = ?', args: [me] });
      for (const c of myChannels.rows) {
        await db.execute({ sql: 'DELETE FROM channel_posts WHERE channel_id = ?', args: [c.id] });
        await db.execute({ sql: 'DELETE FROM channel_members WHERE channel_id = ?', args: [c.id] });
        await db.execute({ sql: 'DELETE FROM channel_invites WHERE channel_id = ?', args: [c.id] });
      }
      await db.execute({ sql: 'DELETE FROM channels WHERE creator = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM channel_members WHERE username = ?', args: [me] });

      await db.execute({ sql: 'DELETE FROM user_settings WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [me] });

      socket.emit('account deleted');
      socket.disconnect(true);
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ─── АРХИВ / MUTE ───
  socket.on('toggle archive', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.archived ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'archived', newVal);
    sendContactsTo(socket.username).catch(() => {});
    sendGroupsTo(socket.username).catch(() => {});
    cb && cb({ ok: true, archived: !!newVal });
  });

  socket.on('toggle mute', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.muted ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'muted', newVal);
    sendContactsTo(socket.username).catch(() => {});
    sendGroupsTo(socket.username).catch(() => {});
    cb && cb({ ok: true, muted: !!newVal });
  });

  // ─── ДОСТИЖЕНИЯ ───
  socket.on('get achievements', async (cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, achievements: [], stats: {} });
      const { unlocked, stats } = await getUserAchievements(socket.username);
      const list = Object.entries(ACHIEVEMENTS_CATALOG).map(([key, ach]) => ({
        key, emoji: ach.emoji, name: ach.name, desc: ach.desc,
        target: ach.target, stat: ach.stat,
        current: Number(stats[ach.stat] || 0),
        unlocked: !!unlocked[key],
        unlockedAt: unlocked[key] || null
      }));
      cb && cb({ ok: true, achievements: list, stats });
    } catch (e) {
      console.error('get achievements:', e);
      cb && cb({ ok: false, achievements: [], stats: {} });
    }
  });

  // ─── PUSH ───
  socket.on('push subscribe', async ({ subscription }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!subscription || !subscription.endpoint) return cb && cb({ ok: false });
      await savePushSubscription(socket.username, subscription);
      cb && cb({ ok: true });
    } catch (e) {
      console.error('push subscribe:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('push unsubscribe', async ({ endpoint }, cb) => {
    try {
      if (!socket.username || !endpoint) return cb && cb({ ok: false });
      await removePushSubscription(endpoint);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('get vapid key', (cb) => {
    cb && cb({ key: VAPID_PUBLIC_KEY });
  });
    // ═══════════════════════════════════════════════════════════
  // 💬 ЛИЧНЫЕ СООБЩЕНИЯ
  // ═══════════════════════════════════════════════════════════

  socket.on('load history', async ({ withUser }) => {
    if (!socket.username) return;
    try {
      const rows = await getHistory(socket.username, withUser);
      const messages = await enrichHistoryWithReplies(rows, false);
      socket.emit('history', { withUser, messages });
    } catch (e) {
      console.error('load history:', e);
    }
  });

  socket.on('load saved history', async () => {
    if (!socket.username) return;
    try {
      const me = socket.username;
      const r = await db.execute({
        sql: 'SELECT * FROM messages WHERE from_user = ? AND to_user = ? ORDER BY time ASC LIMIT 300',
        args: [me, me]
      });
      const messages = r.rows.map(m => ({
        ...m,
        reactions: safeParseReactions(m.reactions),
        replyData: null
      }));
      socket.emit('saved history', { messages });
    } catch (e) {
      console.error('load saved history:', e);
    }
  });

  socket.on('save to saved', async ({ originalMessageId, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const origMsg = isGroup
        ? await getGroupMessageById(originalMessageId)
        : await getMessageById(originalMessageId);
      if (!origMsg) return cb && cb({ ok: false, error: 'Сообщение не найдено' });

      const me = socket.username;
      const t = now();

      const result = await db.execute({
        sql: `INSERT INTO messages 
              (from_user, to_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', NULL, 0, 0, ?, ?)`,
        args: [
          me, me,
          origMsg.text || null,
          origMsg.image || null,
          origMsg.voice || null,
          origMsg.voice_duration || null,
          origMsg.video_circle || null,
          origMsg.video_duration || null,
          origMsg.sticker || null,
          t
        ]
      });
      const msgId = Number(result.lastInsertRowid);
      const newMsg = await getMessageById(msgId);

      if (newMsg) {
        socket.emit('private message', {
          id: newMsg.id, from: me, to: me,
          text: newMsg.text, image: newMsg.image, sticker: newMsg.sticker,
          voice: newMsg.voice, voiceDuration: newMsg.voice_duration,
          videoCircle: newMsg.video_circle, videoDuration: newMsg.video_duration,
          reactions: {}, time: newMsg.time, self: true, saved: true
        });
      }
      cb && cb({ ok: true });
    } catch (e) {
      console.error('save to saved:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('private message', async ({ to, text, image, voice, voiceDuration, videoCircle, videoDuration, replyTo, sticker }) => {
    if (!socket.username) return;

    if (!rateLimit('pm:' + socket.username, CONFIG.MAX_MESSAGE_BURST, CONFIG.MESSAGE_WINDOW)) {
      return socket.emit('message blocked', { reason: 'Слишком часто. Подожди немного.' });
    }
    if (text && text.length > CONFIG.MAX_TEXT) {
      return socket.emit('message blocked', { reason: 'Слишком длинное сообщение' });
    }
    if (image && !validImage(image)) {
      return socket.emit('message blocked', { reason: 'Недопустимое изображение' });
    }
    if (voice && !validVoice(voice)) {
      return socket.emit('message blocked', { reason: 'Недопустимое голосовое' });
    }
    if (videoCircle && !validVideo(videoCircle)) {
      return socket.emit('message blocked', { reason: 'Недопустимый кружок' });
    }
    if (!text && !image && !voice && !videoCircle && !sticker) return;

    if (await isBlockedEither(socket.username, to)) {
      return socket.emit('message blocked', { reason: 'Пользователь заблокирован' });
    }

    try {
      const from = socket.username;
      const t = now();

      const result = await db.execute({
        sql: `INSERT INTO messages 
              (from_user, to_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?, ?)`,
        args: [
          from, to,
          text || null, image || null,
          voice || null, voiceDuration || null,
          videoCircle || null, videoDuration || null,
          replyTo || null, sticker || null, t
        ]
      });
      const msgId = Number(result.lastInsertRowid);

      let replyData = null;
      if (replyTo) {
        const r = await getMessageById(replyTo);
        if (r) {
          replyData = {
            id: r.id, from: r.from_user, text: r.text,
            image: !!r.image, voice: !!r.voice, deleted: !!r.deleted
          };
        }
      }

      const payload = {
        id: msgId, from, to,
        text, image, sticker,
        voice, voiceDuration, videoCircle, videoDuration,
        reactions: {}, replyData, time: t, read: false
      };

      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
      socket.emit('private message', { ...payload, self: true });

      // Статистика
      await incrementStat(from, 'messages_sent');
      if (image) await incrementStat(from, 'photos_sent');
      if (voice) await incrementStat(from, 'voice_sent');
      if (videoCircle) await incrementStat(from, 'circles_sent');
      if (sticker) await incrementStat(from, 'stickers_sent');

      // 🔔 PUSH-УВЕДОМЛЕНИЕ
      try {
        const senderInfo = await getUser(from);
        const senderName = (senderInfo && senderInfo.first_name) || from;
        let preview = text || 'Новое сообщение';
        if (sticker) preview = '🐱 Стикер';
        else if (image) preview = '📷 Фото';
        else if (voice) preview = '🎤 Голосовое';
        else if (videoCircle) preview = '🎥 Кружок';

        sendPushToUser(to, {
          title: senderName,
          body: preview,
          icon: '/icon-192.png',
          tag: 'chat-' + from,
          data: { url: '/' }
        }).catch(() => {});
      } catch (e) {}
    } catch (e) {
      console.error('private message:', e);
    }
  });

  socket.on('edit message', async ({ messageId, text, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!text || text.length > CONFIG.MAX_TEXT) return cb && cb({ ok: false });

      if (isGroup) {
        const msg = await getGroupMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE group_messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        notifyGroupMembers(msg.group_id, 'message edited', { messageId, text, isGroup: true }).catch(() => {});
      } else {
        const msg = await getMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        const payload = { messageId, text, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message edited', payload));
        socket.emit('message edited', payload);
      }
      await incrementStat(socket.username, 'edited_messages');
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('delete message', async ({ messageId, forAll, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (isGroup) {
        const msg = await getGroupMessageById(messageId);
        if (!msg) return cb && cb({ ok: false });
        const group = await getGroupById(msg.group_id);
        if (msg.from_user !== socket.username && group && group.creator !== socket.username) return cb && cb({ ok: false });
        await db.execute({
          sql: `UPDATE group_messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, 
                video_circle = NULL, sticker = NULL WHERE id = ?`,
          args: [messageId]
        });
        notifyGroupMembers(msg.group_id, 'message deleted', { messageId, isGroup: true }).catch(() => {});
      } else {
        const msg = await getMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({
          sql: `UPDATE messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, 
                video_circle = NULL, sticker = NULL WHERE id = ?`,
          args: [messageId]
        });
        const payload = { messageId, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message deleted', payload));
        socket.emit('message deleted', payload);
      }
      await incrementStat(socket.username, 'deleted_messages');
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('mark read', async ({ withUser }) => {
    if (!socket.username) return;
    await db.execute({
      sql: 'UPDATE messages SET read_at = ? WHERE from_user = ? AND to_user = ? AND read_at IS NULL',
      args: [now(), withUser, socket.username]
    });
    findSocketsByUsername(withUser).forEach(sid => io.to(sid).emit('messages read', { by: socket.username }));
  });

  socket.on('typing', ({ to, isTyping }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('typing', { from: socket.username, isTyping }));
  });

  socket.on('react', async ({ messageId, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const msg = await getMessageById(messageId);
      if (!msg) return cb && cb({ ok: false });

      const me = socket.username;
      if (msg.from_user !== me && msg.to_user !== me) return cb && cb({ ok: false });

      let reactions = safeParseReactions(msg.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const idx = reactions[emoji].indexOf(me);
      if (idx === -1) {
        reactions[emoji].push(me);
        await incrementStat(me, 'reactions_given');
      } else {
        reactions[emoji].splice(idx, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }

      await db.execute({
        sql: 'UPDATE messages SET reactions = ? WHERE id = ?',
        args: [JSON.stringify(reactions), messageId]
      });

      const payload = { messageId, reactions, from: msg.from_user, to: msg.to_user };
      const targets = new Set([msg.from_user, msg.to_user]);
      targets.forEach(u => findSocketsByUsername(u).forEach(sid => io.to(sid).emit('reaction updated', payload)));

      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 👥 ГРУППЫ
  // ═══════════════════════════════════════════════════════════

  socket.on('create group', async ({ name, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const createdCount = await countUserCreatedGroups(socket.username);
      if (createdCount >= 1) return cb && cb({ ok: false, error: 'Ты уже создал группу. Максимум — одна.' });

      name = String(name || '').trim().slice(0, 60);
      if (!name) return cb && cb({ ok: false, error: 'Введи название' });

      members = Array.isArray(members) ? members : [];
      const t = now();

      const r = await db.execute({
        sql: 'INSERT INTO groups_table (name, creator, avatar, created_at) VALUES (?, ?, NULL, ?)',
        args: [name, socket.username, t]
      });
      const groupId = Number(r.lastInsertRowid);

      await db.execute({
        sql: 'INSERT INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
        args: [groupId, socket.username, t]
      });

      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu || mu === socket.username) continue;
        if (!(await getUser(mu))) continue;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, now()]
        });
      }

      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) sendGroupsTo(u).catch(() => {});
      await incrementStat(socket.username, 'groups_created');
      cb && cb({ ok: true, groupId });
    } catch (e) {
      console.error('create group:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('add group members', async ({ groupId, members }, cb) => {
    try {
      if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
      members = Array.isArray(members) ? members : [];
      const added = [];
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu) continue;
        if (await isGroupMember(groupId, mu)) continue;
        if (!(await getUser(mu))) continue;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, now()]
        });
        added.push(mu);
      }
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) sendGroupsTo(u).catch(() => {});
      notifyGroupMembers(groupId, 'group updated', { groupId }).catch(() => {});
      cb && cb({ ok: true, added });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('leave group', async ({ groupId }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    await db.execute({ sql: 'DELETE FROM group_members WHERE group_id = ? AND username = ?', args: [groupId, socket.username] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) sendGroupsTo(u).catch(() => {});
    sendGroupsTo(socket.username).catch(() => {});
    notifyGroupMembers(groupId, 'group updated', { groupId }).catch(() => {});
    cb && cb({ ok: true });
  });

  socket.on('delete group', async ({ groupId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const group = await getGroupById(groupId);
      if (!group || group.creator !== socket.username) return cb && cb({ ok: false });
      const members = await getGroupMembers(groupId);
      await db.execute({ sql: 'DELETE FROM group_messages WHERE group_id = ?', args: [groupId] });
      await db.execute({ sql: 'DELETE FROM group_members WHERE group_id = ?', args: [groupId] });
      await db.execute({ sql: 'DELETE FROM groups_table WHERE id = ?', args: [groupId] });
      for (const u of members) {
        sendGroupsTo(u).catch(() => {});
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('group deleted', { groupId }));
      }
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('update group', async ({ groupId, name, description }, cb) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    if (name) await db.execute({ sql: 'UPDATE groups_table SET name = ? WHERE id = ?', args: [String(name).slice(0, 60), groupId] });
    if (typeof description === 'string') await db.execute({ sql: 'UPDATE groups_table SET description = ? WHERE id = ?', args: [description.slice(0, 200), groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) sendGroupsTo(u).catch(() => {});
    cb && cb({ ok: true });
  });

  socket.on('pin message', async ({ groupId, messageId }, cb) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    await db.execute({ sql: 'UPDATE groups_table SET pinned_message_id = ? WHERE id = ?', args: [messageId, groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) sendGroupsTo(u).catch(() => {});
    notifyGroupMembers(groupId, 'group updated', { groupId }).catch(() => {});
    cb && cb({ ok: true });
  });

  socket.on('load group history', async ({ groupId }) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return;
    try {
      const rows = await getGroupHistory(groupId);
      const messages = await enrichHistoryWithReplies(rows, true);
      socket.emit('group history', { groupId, messages });
    } catch (e) { console.error('load group history:', e); }
  });

  socket.on('group message', async ({ groupId, text, image, voice, voiceDuration, videoCircle, videoDuration, replyTo, sticker }) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return;

    if (!rateLimit('gm:' + socket.username, CONFIG.MAX_MESSAGE_BURST, CONFIG.MESSAGE_WINDOW)) {
      return socket.emit('message blocked', { reason: 'Слишком часто.' });
    }
    if (text && text.length > CONFIG.MAX_TEXT) return socket.emit('message blocked', { reason: 'Слишком длинное' });
    if (image && !validImage(image)) return socket.emit('message blocked', { reason: 'Недопустимое изображение' });
    if (voice && !validVoice(voice)) return socket.emit('message blocked', { reason: 'Недопустимое голосовое' });
    if (videoCircle && !validVideo(videoCircle)) return socket.emit('message blocked', { reason: 'Недопустимый кружок' });
    if (!text && !image && !voice && !videoCircle && !sticker) return;

    try {
      const from = socket.username;
      const t = now();

      const result = await db.execute({
        sql: `INSERT INTO group_messages 
              (group_id, from_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?, ?)`,
        args: [
          groupId, from,
          text || null, image || null,
          voice || null, voiceDuration || null,
          videoCircle || null, videoDuration || null,
          replyTo || null, sticker || null, t
        ]
      });
      const msgId = Number(result.lastInsertRowid);

      let replyData = null;
      if (replyTo) {
        const r = await getGroupMessageById(replyTo);
        if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
      }

      const payload = {
        id: msgId, groupId, from,
        text, image, sticker,
        voice, voiceDuration, videoCircle, videoDuration,
        reactions: {}, replyData, time: t, self: false
      };

      notifyGroupMembers(groupId, 'group message', payload).catch(() => {});
      socket.emit('group message', { ...payload, self: true });

      // Статистика
      await incrementStat(from, 'messages_sent');
      if (image) await incrementStat(from, 'photos_sent');
      if (voice) await incrementStat(from, 'voice_sent');
      if (videoCircle) await incrementStat(from, 'circles_sent');
      if (sticker) await incrementStat(from, 'stickers_sent');

      // 🔔 PUSH группе
      try {
        const groupInfo = await getGroupById(groupId);
        const senderInfo = await getUser(from);
        const senderName = (senderInfo && senderInfo.first_name) || from;
        const members = await getGroupMembers(groupId);
        let preview = text || 'Новое сообщение';
        if (sticker) preview = '🐱 Стикер';
        else if (image) preview = '📷 Фото';

        for (const member of members) {
          if (member === from) continue;
          sendPushToUser(member, {
            title: (groupInfo && groupInfo.name) || 'Группа',
            body: senderName + ': ' + preview,
            icon: '/icon-192.png',
            tag: 'group-' + groupId,
            data: { url: '/' }
          }).catch(() => {});
        }
      } catch (e) {}
    } catch (e) { console.error('group message:', e); }
  });

  socket.on('group typing', ({ groupId, isTyping }) => {
    if (!socket.username) return;
    getGroupMembers(groupId).then(members => {
      members.forEach(u => {
        if (u === socket.username) return;
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('group typing', { groupId, from: socket.username, isTyping }));
      });
    }).catch(() => {});
  });

  socket.on('group react', async ({ groupId, messageId, emoji }, cb) => {
    try {
      if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
      const r = await db.execute({ sql: 'SELECT * FROM group_messages WHERE id = ? AND group_id = ?', args: [messageId, groupId] });
      const msg = r.rows[0];
      if (!msg) return cb && cb({ ok: false });

      let reactions = safeParseReactions(msg.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const me = socket.username;
      const idx = reactions[emoji].indexOf(me);
      if (idx === -1) {
        reactions[emoji].push(me);
        await incrementStat(me, 'reactions_given');
      } else {
        reactions[emoji].splice(idx, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }

      await db.execute({ sql: 'UPDATE group_messages SET reactions = ? WHERE id = ?', args: [JSON.stringify(reactions), messageId] });
      notifyGroupMembers(groupId, 'group reaction updated', { groupId, messageId, reactions }).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 🔍 ПОИСК
  // ═══════════════════════════════════════════════════════════

  socket.on('search messages', async ({ query, withUser, groupId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, results: [] });
      query = String(query || '').trim();
      if (!query || query.length < 2) return cb && cb({ ok: true, results: [] });

      let rows = [];
      if (groupId) {
        const r = await db.execute({
          sql: `SELECT * FROM group_messages WHERE group_id = ? AND deleted = 0 AND text LIKE ? ORDER BY time DESC LIMIT 50`,
          args: [groupId, '%' + query + '%']
        });
        rows = r.rows;
      } else if (withUser) {
        const r = await db.execute({
          sql: `SELECT * FROM messages WHERE deleted = 0 AND text LIKE ? 
                AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)) 
                ORDER BY time DESC LIMIT 50`,
          args: ['%' + query + '%', socket.username, withUser, withUser, socket.username]
        });
        rows = r.rows;
      }
      cb && cb({ ok: true, results: rows });
    } catch (e) { cb && cb({ ok: false, results: [] }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 📢 КАНАЛЫ
  // ═══════════════════════════════════════════════════════════

  socket.on('create channel', async ({ slug, name, description }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const createdCount = await countUserCreatedChannels(socket.username);
      if (createdCount >= 1) return cb && cb({ ok: false, error: 'Ты уже создал канал. Максимум — один.' });

      slug = String(slug || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
      if (!slug || slug.length < 3) return cb && cb({ ok: false, error: 'ID канала минимум 3 символа' });
      if (await getChannelBySlug(slug)) return cb && cb({ ok: false, error: 'Такой ID уже занят' });

      name = String(name || '').trim().slice(0, 60);
      if (!name) return cb && cb({ ok: false, error: 'Введи название' });

      description = description ? String(description).slice(0, 200) : null;
      const t = now();

      const r = await db.execute({
        sql: 'INSERT INTO channels (slug, name, description, creator, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [slug, name, description, socket.username, t]
      });
      const channelId = Number(r.lastInsertRowid);

      await db.execute({
        sql: 'INSERT INTO channel_members (channel_id, username, joined_at) VALUES (?, ?, ?)',
        args: [channelId, socket.username, t]
      });

      sendChannelsTo(socket.username).catch(() => {});
      await incrementStat(socket.username, 'channels_created');
      cb && cb({ ok: true, channelId, slug });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('delete channel', async ({ channelId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch || ch.creator !== socket.username) return cb && cb({ ok: false });
      const members = await getChannelMembers(channelId);
      await db.execute({ sql: 'DELETE FROM channel_posts WHERE channel_id = ?', args: [channelId] });
      await db.execute({ sql: 'DELETE FROM channel_members WHERE channel_id = ?', args: [channelId] });
      await db.execute({ sql: 'DELETE FROM channel_invites WHERE channel_id = ?', args: [channelId] });
      await db.execute({ sql: 'DELETE FROM channels WHERE id = ?', args: [channelId] });
      for (const u of members) {
        sendChannelsTo(u).catch(() => {});
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('channel deleted', { channelId }));
      }
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('update channel', async ({ channelId, name, description }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch || ch.creator !== socket.username) return cb && cb({ ok: false });
      if (name) await db.execute({ sql: 'UPDATE channels SET name = ? WHERE id = ?', args: [String(name).slice(0, 60), channelId] });
      if (typeof description === 'string') await db.execute({ sql: 'UPDATE channels SET description = ? WHERE id = ?', args: [description.slice(0, 200), channelId] });
      const members = await getChannelMembers(channelId);
      for (const u of members) sendChannelsTo(u).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('subscribe channel', async ({ channelId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch) return cb && cb({ ok: false, error: 'Канал не найден' });
      if (await isChannelMember(channelId, socket.username)) return cb && cb({ ok: true, already: true });
      await db.execute({
        sql: 'INSERT INTO channel_members (channel_id, username, joined_at) VALUES (?, ?, ?)',
        args: [channelId, socket.username, now()]
      });
      sendChannelsTo(socket.username).catch(() => {});
      const members = await getChannelMembers(channelId);
      for (const u of members) sendChannelsTo(u).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('unsubscribe channel', async ({ channelId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch) return cb && cb({ ok: false });
      if (ch.creator === socket.username) return cb && cb({ ok: false, error: 'Создатель не может отписаться' });
      await db.execute({ sql: 'DELETE FROM channel_members WHERE channel_id = ? AND username = ?', args: [channelId, socket.username] });
      sendChannelsTo(socket.username).catch(() => {});
      const members = await getChannelMembers(channelId);
      for (const u of members) sendChannelsTo(u).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('load channel posts', async ({ channelId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, posts: [] });
      if (!await isChannelMember(channelId, socket.username)) return cb && cb({ ok: false, error: 'Не подписан' });
      const r = await db.execute({
        sql: 'SELECT * FROM channel_posts WHERE channel_id = ? AND deleted = 0 ORDER BY time DESC LIMIT 100',
        args: [channelId]
      });
      const posts = [];
      for (const p of r.rows) {
        const cCount = await db.execute({
          sql: 'SELECT COUNT(*) as c FROM channel_comments WHERE post_id = ? AND deleted = 0',
          args: [p.id]
        });
        posts.push({ ...p, reactions: safeParseReactions(p.reactions), commentCount: Number(cCount.rows[0]?.c || 0) });
      }
      cb && cb({ ok: true, posts });
    } catch (e) { cb && cb({ ok: false, posts: [] }); }
  });

  socket.on('create channel post', async ({ channelId, text, image, voice, voiceDuration }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch || ch.creator !== socket.username) return cb && cb({ ok: false, error: 'Только админ' });
      if (!text && !image && !voice) return cb && cb({ ok: false, error: 'Пустой пост' });
      const t = now();
      const result = await db.execute({
        sql: `INSERT INTO channel_posts (channel_id, from_user, text, image, voice, voice_duration, reactions, deleted, views, time) 
              VALUES (?, ?, ?, ?, ?, ?, '{}', 0, 0, ?)`,
        args: [channelId, socket.username, text || null, image || null, voice || null, voiceDuration || null, t]
      });
      const postId = Number(result.lastInsertRowid);
      const payload = {
        id: postId, channelId, from_user: socket.username,
        text, image, voice, voice_duration: voiceDuration,
        reactions: {}, views: 0, commentCount: 0, time: t
      };
      await notifyChannelMembers(channelId, 'channel post new', payload);
      cb && cb({ ok: true, id: postId });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('delete channel post', async ({ postId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const r = await db.execute({ sql: 'SELECT * FROM channel_posts WHERE id = ?', args: [postId] });
      const post = r.rows[0];
      if (!post) return cb && cb({ ok: false });
      const ch = await getChannelById(post.channel_id);
      if (!ch || ch.creator !== socket.username) return cb && cb({ ok: false });
      await db.execute({ sql: 'UPDATE channel_posts SET deleted = 1, text = NULL, image = NULL, voice = NULL WHERE id = ?', args: [postId] });
      await notifyChannelMembers(post.channel_id, 'channel post deleted', { postId });
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('view channel post', async ({ postId }) => {
    try {
      if (!socket.username) return;
      await db.execute({ sql: 'UPDATE channel_posts SET views = views + 1 WHERE id = ?', args: [postId] });
    } catch (e) {}
  });

  socket.on('load channel comments', async ({ postId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, comments: [] });
      const r = await db.execute({
        sql: 'SELECT * FROM channel_comments WHERE post_id = ? AND deleted = 0 ORDER BY time ASC LIMIT 200',
        args: [postId]
      });
      cb && cb({ ok: true, comments: r.rows });
    } catch (e) { cb && cb({ ok: false, comments: [] }); }
  });

  socket.on('create channel comment', async ({ postId, text, image, voice, voiceDuration }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const r = await db.execute({ sql: 'SELECT * FROM channel_posts WHERE id = ?', args: [postId] });
      const post = r.rows[0];
      if (!post) return cb && cb({ ok: false });
      if (!await isChannelMember(post.channel_id, socket.username)) return cb && cb({ ok: false, error: 'Только подписчики' });
      if (!text && !image && !voice) return cb && cb({ ok: false, error: 'Пусто' });
      const t = now();
      const result = await db.execute({
        sql: `INSERT INTO channel_comments (post_id, from_user, text, image, voice, voice_duration, deleted, time) 
              VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [postId, socket.username, text || null, image || null, voice || null, voiceDuration || null, t]
      });
      const commentId = Number(result.lastInsertRowid);
      const payload = {
        id: commentId, postId, channelId: post.channel_id, from_user: socket.username,
        text, image, voice, voice_duration: voiceDuration, time: t
      };
      await notifyChannelMembers(post.channel_id, 'channel comment new', payload);
      cb && cb({ ok: true, id: commentId });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('react channel post', async ({ postId, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const r = await db.execute({ sql: 'SELECT * FROM channel_posts WHERE id = ?', args: [postId] });
      const post = r.rows[0];
      if (!post) return cb && cb({ ok: false });
      if (!await isChannelMember(post.channel_id, socket.username)) return cb && cb({ ok: false });
      let reactions = safeParseReactions(post.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const me = socket.username;
      const idx = reactions[emoji].indexOf(me);
      if (idx === -1) reactions[emoji].push(me);
      else { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
      await db.execute({ sql: 'UPDATE channel_posts SET reactions = ? WHERE id = ?', args: [JSON.stringify(reactions), postId] });
      await notifyChannelMembers(post.channel_id, 'channel post reaction', { postId, reactions });
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('create channel invite', async ({ channelId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const ch = await getChannelById(channelId);
      if (!ch || ch.creator !== socket.username) return cb && cb({ ok: false });
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const expires = now() + 24 * 60 * 60 * 1000;
      await db.execute({
        sql: 'INSERT INTO channel_invites (code, channel_id, expires_at, created_by) VALUES (?, ?, ?, ?)',
        args: [code, channelId, expires, socket.username]
      });
      cb && cb({ ok: true, code, expires });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('resolve channel invite', async ({ code }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      code = String(code || '').trim().toUpperCase();
      const r = await db.execute({ sql: 'SELECT * FROM channel_invites WHERE code = ?', args: [code] });
      const inv = r.rows[0];
      if (!inv) return cb && cb({ ok: false, error: 'Ссылка не найдена' });
      if (now() > inv.expires_at) {
        await db.execute({ sql: 'DELETE FROM channel_invites WHERE code = ?', args: [code] });
        return cb && cb({ ok: false, error: 'Ссылка истекла' });
      }
      const ch = await getChannelById(inv.channel_id);
      if (!ch) return cb && cb({ ok: false });
      cb && cb({ ok: true, channel: { id: ch.id, slug: ch.slug, name: ch.name, avatar: ch.avatar, verified: !!ch.verified, description: ch.description } });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('find channel by slug', async ({ slug }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      slug = String(slug || '').trim().toLowerCase().replace(/^@/, '');
      const ch = await getChannelBySlug(slug);
      if (!ch) return cb && cb({ ok: false, error: 'Канал не найден' });
      const members = await getChannelMembers(ch.id);
      cb && cb({ ok: true, channel: { id: ch.id, slug: ch.slug, name: ch.name, avatar: ch.avatar, verified: !!ch.verified, description: ch.description, memberCount: members.length } });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // ✓ ГАЛОЧКИ (АДМИН)
  // ═══════════════════════════════════════════════════════════

  socket.on('verify', async ({ username }, cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) return cb && cb({ ok: false, error: 'Только ' + CONFIG.ADMIN_USERNAME });
      username = String(username || '').trim().toLowerCase();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      const target = await getUser(username);
      if (!target) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (target.verified) return cb && cb({ ok: false, error: 'У него уже есть галочка' });
      await db.execute({ sql: 'UPDATE users SET verified = 1 WHERE username = ?', args: [username] });
      refreshForFriends(username).catch(() => {});
      notifyAllFriends(username, 'friend updated', { username, verified: true }).catch(() => {});
      if (username === socket.username) socket.emit('me updated', { verified: true, username });
      cb && cb({ ok: true, username });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('unverify', async ({ username }, cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) return cb && cb({ ok: false });
      username = String(username || '').trim().toLowerCase();
      await db.execute({ sql: 'UPDATE users SET verified = 0 WHERE username = ?', args: [username] });
      refreshForFriends(username).catch(() => {});
      notifyAllFriends(username, 'friend updated', { username, verified: false }).catch(() => {});
      if (username === socket.username) socket.emit('me updated', { verified: false, username });
      cb && cb({ ok: true, username });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('verify channel', async ({ slug }, cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) return cb && cb({ ok: false, error: 'Только ' + CONFIG.ADMIN_USERNAME });
      slug = String(slug || '').trim().toLowerCase().replace(/^@/, '');
      if (!slug) return cb && cb({ ok: false, error: 'Введи ID канала' });
      const ch = await getChannelBySlug(slug);
      if (!ch) return cb && cb({ ok: false, error: 'Канал не найден' });
      if (ch.verified) return cb && cb({ ok: false, error: 'Уже верифицирован' });
      await db.execute({ sql: 'UPDATE channels SET verified = 1 WHERE id = ?', args: [ch.id] });
      const members = await getChannelMembers(ch.id);
      for (const u of members) sendChannelsTo(u).catch(() => {});
      cb && cb({ ok: true, slug });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('unverify channel', async ({ slug }, cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) return cb && cb({ ok: false });
      slug = String(slug || '').trim().toLowerCase().replace(/^@/, '');
      const ch = await getChannelBySlug(slug);
      if (!ch) return cb && cb({ ok: false, error: 'Канал не найден' });
      await db.execute({ sql: 'UPDATE channels SET verified = 0 WHERE id = ?', args: [ch.id] });
      const members = await getChannelMembers(ch.id);
      for (const u of members) sendChannelsTo(u).catch(() => {});
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 📞 ЗВОНКИ (WebRTC signaling + системные сообщения)
  // ═══════════════════════════════════════════════════════════

  socket.on('call-user', async ({ to, offer, video }) => {
    if (!socket.username) return;
    if (await isBlockedEither(socket.username, to)) {
      return socket.emit('call-failed', { reason: 'Заблокирован' });
    }

    const from = socket.username;
    const toSockets = findSocketsByUsername(to);

    // 📞 Создаём системное сообщение "Исходящий звонок" для обоих
    await createCallSystemMessage(from, to, 'outgoing');

    if (toSockets.length > 0) {
      toSockets.forEach(sid => io.to(sid).emit('incoming-call', { from, offer, video }));
    } else {
      // Пользователь не в сети — превращаем в пропущенный
      await incrementStat(from, 'calls_made');
      await incrementStat(to, 'calls_missed');
      socket.emit('call-failed', { reason: 'Пользователь не в сети' });

      // Меняем "Исходящий" на "Пропущенный" для from и to
      await createCallSystemMessage(from, to, 'missed');
    }
  });

  socket.on('answer-call', async ({ to, answer }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('call-answered', { answer }));
    // Считаем для обоих, что звонок принят
    await incrementStat(to, 'calls_made');
    await incrementStat(socket.username, 'calls_received');
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('ice-candidate', { candidate }));
  });

  socket.on('end-call', async ({ to, duration }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('call-ended'));

    // 📞 Создаём системное сообщение о завершении
    if (socket.username && to) {
      const dur = Number(duration) || 0;
      await createCallSystemMessage(socket.username, to, 'ended', dur);

      // Статистика
      if (dur > 0) {
        await incrementStat(socket.username, 'calls_duration', dur);
        await incrementStat(to, 'calls_duration', dur);
      }
    }
  });
    // ═══════════════════════════════════════════════════════════
  // 📸 ИСТОРИИ
  // ═══════════════════════════════════════════════════════════

  socket.on('load stories', async (cb) => {
    if (!socket.username) return cb && cb({ ok: false, users: [] });
    try {
      const users = await getActiveStories(socket.username);
      cb && cb({ ok: true, users, me: socket.username });
    } catch (e) {
      console.error('load stories:', e);
      cb && cb({ ok: false, users: [] });
    }
  });

  socket.on('post story', async ({ image, caption }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!image || typeof image !== 'string') return cb && cb({ ok: false, error: 'Нет картинки' });

      let imagePath = image;
      if (image.startsWith('data:image/')) {
        const m = image.match(/^data:image\/([a-z]+);base64,(.+)$/i);
        if (!m) return cb && cb({ ok: false, error: 'Неверный формат' });
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > 5_000_000) return cb && cb({ ok: false, error: 'Слишком большая картинка' });
        const fname = socket.username + '_' + now() + '.' + ext;
        fs.writeFileSync(path.join(STORIES_DIR, fname), buf);
        imagePath = '/stories/' + fname;
      }

      const t = now();
      const expires = t + 24 * 60 * 60 * 1000;
      const cap = caption ? String(caption).slice(0, 200) : null;

      const r = await db.execute({
        sql: 'INSERT INTO stories (username, image, caption, time, expires_at) VALUES (?, ?, ?, ?, ?)',
        args: [socket.username, imagePath, cap, t, expires]
      });
      const storyId = Number(r.lastInsertRowid);

      const contactsR = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [socket.username] });
      const payload = { id: storyId, username: socket.username, image: imagePath, caption: cap, time: t, expires_at: expires };
      contactsR.rows.forEach(row => {
        findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit('story new', payload));
      });

      await incrementStat(socket.username, 'stories_posted');
      cb && cb({ ok: true, id: storyId, image: imagePath });
    } catch (e) {
      console.error('post story:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('delete story', async ({ storyId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const res = await deleteStory(storyId, socket.username);
      if (!res.ok) return cb && cb(res);

      const contactsR = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [socket.username] });
      contactsR.rows.forEach(row => {
        findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit('story deleted', { storyId }));
      });
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('view story', async ({ storyId }) => {
    try {
      if (!socket.username) return;
      await db.execute({
        sql: 'INSERT OR IGNORE INTO story_views (story_id, viewer, time) VALUES (?, ?, ?)',
        args: [storyId, socket.username, now()]
      });
      const r = await db.execute({ sql: 'SELECT username FROM stories WHERE id = ?', args: [storyId] });
      if (r.rows[0]) {
        findSocketsByUsername(r.rows[0].username).forEach(sid => io.to(sid).emit('story viewed', { storyId, viewer: socket.username }));
      }
    } catch (e) { console.error('view story:', e); }
  });

  socket.on('get story views', async ({ storyId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, viewers: [] });
      const r = await db.execute({ sql: 'SELECT username FROM stories WHERE id = ?', args: [storyId] });
      if (!r.rows[0] || r.rows[0].username !== socket.username) return cb && cb({ ok: false });
      const views = await db.execute({
        sql: 'SELECT viewer, time FROM story_views WHERE story_id = ? ORDER BY time DESC',
        args: [storyId]
      });
      cb && cb({ ok: true, viewers: views.rows });
    } catch (e) { cb && cb({ ok: false, viewers: [] }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 🖼 СТИКЕРЫ
  // ═══════════════════════════════════════════════════════════

  socket.on('load stickers', async (cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, stickers: [] });
      const rows = await getUserStickers(socket.username);
      cb && cb({ ok: true, stickers: rows });
    } catch (e) { cb && cb({ ok: false, stickers: [] }); }
  });

  socket.on('add sticker', async ({ data, type, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!data || typeof data !== 'string') return cb && cb({ ok: false });
      if (!validStickerData(data)) return cb && cb({ ok: false, error: 'Файл больше 4MB' });

      let url = data;
      if (data.startsWith('data:')) {
        const m = data.match(/^data:(image|video)\/([a-z0-9+.-]+);base64,(.+)$/i);
        if (!m) return cb && cb({ ok: false });
        const kind = m[1];
        const ext = m[2] === 'jpeg' ? 'jpg' : (m[2] === 'quicktime' ? 'mov' : m[2]);
        const buf = Buffer.from(m[3], 'base64');
        const fname = 'sticker_' + socket.username + '_' + now() + '.' + ext;
        fs.writeFileSync(path.join(STICKERS_DIR, fname), buf);
        url = '/stickers/' + fname;
        type = type || (kind === 'video' ? 'video' : 'image');
      } else {
        type = type || 'image';
      }

      const id = await addSticker(socket.username, url, type, emoji || null);
      cb && cb({ ok: true, id, url, type });
    } catch (e) {
      console.error('add sticker:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('delete sticker', async ({ id }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      await deleteSticker(id, socket.username);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('send sticker', async ({ to, groupId, url, type }, cb) => {
    try {
      if (!socket.username || !url) return cb && cb({ ok: false });
      const from = socket.username;
      const t = now();

      if (groupId) {
        if (!await isGroupMember(groupId, from)) return cb && cb({ ok: false });

        const result = await db.execute({
          sql: `INSERT INTO group_messages (group_id, from_user, sticker, reactions, reply_to, edited, deleted, time) 
                VALUES (?, ?, ?, '{}', NULL, 0, 0, ?)`,
          args: [groupId, from, url, t]
        });
        const msgId = Number(result.lastInsertRowid);
        const payload = {
          id: msgId, groupId, from,
          sticker: url, stickerType: type || 'image',
          reactions: {}, replyData: null, time: t, self: false
        };
        notifyGroupMembers(groupId, 'group message', payload).catch(() => {});
        socket.emit('group message', { ...payload, self: true });
        await incrementStat(from, 'stickers_sent');
        cb && cb({ ok: true, id: msgId });
      } else if (to) {
        if (await isBlockedEither(from, to)) return cb && cb({ ok: false });

        const result = await db.execute({
          sql: `INSERT INTO messages (from_user, to_user, sticker, reactions, reply_to, edited, deleted, time) 
                VALUES (?, ?, ?, '{}', NULL, 0, 0, ?)`,
          args: [from, to, url, t]
        });
        const msgId = Number(result.lastInsertRowid);
        const payload = {
          id: msgId, from, to,
          sticker: url, stickerType: type || 'image',
          reactions: {}, replyData: null, time: t
        };
        findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
        socket.emit('private message', { ...payload, self: true });
        await incrementStat(from, 'stickers_sent');

        // Push
        try {
          const senderInfo = await getUser(from);
          const senderName = (senderInfo && senderInfo.first_name) || from;
          sendPushToUser(to, {
            title: senderName,
            body: '🐱 Стикер',
            icon: '/icon-192.png',
            tag: 'chat-' + from,
            data: { url: '/' }
          }).catch(() => {});
        } catch (e) {}

        cb && cb({ ok: true, id: msgId });
      } else {
        cb && cb({ ok: false });
      }
    } catch (e) {
      console.error('send sticker:', e);
      cb && cb({ ok: false });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // ⭐ ЗВЁЗДЫ
  // ═══════════════════════════════════════════════════════════

  socket.on('get stars', async (cb) => {
    if (!socket.username) return cb && cb({ ok: false, stars: 0, transactions: [] });
    const stars = await getStars(socket.username);
    const tx = await db.execute({
      sql: 'SELECT * FROM stars_transactions WHERE username = ? ORDER BY time DESC LIMIT 30',
      args: [socket.username]
    });
    cb && cb({ ok: true, stars, transactions: tx.rows });
  });

  // ═══════════════════════════════════════════════════════════
  // 🎁 ПОДАРКИ
  // ═══════════════════════════════════════════════════════════

  socket.on('get gifts catalog', (cb) => {
    cb && cb({ ok: true, catalog: GIFTS_CATALOG });
  });

  socket.on('get my gifts', async (cb) => {
    if (!socket.username) return cb && cb({ ok: false, gifts: [] });
    const gifts = await getGiftsOfUser(socket.username);
    cb && cb({ ok: true, gifts });
  });

  socket.on('get user gifts', async ({ username }, cb) => {
    if (!socket.username) return cb && cb({ ok: false, gifts: [] });
    username = String(username || '').trim().toLowerCase();
    const target = await getUser(username);
    if (!target) return cb && cb({ ok: false, gifts: [] });
    const gifts = await getGiftsOfUser(username);
    cb && cb({ ok: true, gifts });
  });

  socket.on('send gift', async ({ to, giftKey }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const gift = GIFTS_CATALOG[giftKey];
      if (!gift) return cb && cb({ ok: false, error: 'Такого подарка нет' });

      to = String(to || '').trim().toLowerCase();
      if (to === socket.username) return cb && cb({ ok: false, error: 'Себе дарить нельзя' });

      const target = await getUser(to);
      if (!target) return cb && cb({ ok: false, error: 'Пользователь не найден' });

      const todayCount = await countGiftsToday(socket.username);
      if (todayCount >= CONFIG.MAX_GIFTS_PER_DAY) {
        return cb && cb({ ok: false, error: 'Лимит ' + CONFIG.MAX_GIFTS_PER_DAY + ' подарков в день' });
      }

      const myStars = await getStars(socket.username);
      if (myStars < gift.price) {
        return cb && cb({ ok: false, error: 'Недостаточно звёзд. Нужно ' + gift.price + ' ⭐, у тебя ' + myStars });
      }

      await addStars(socket.username, -gift.price, 'gift_sent:' + to, null);

      const r = await db.execute({
        sql: 'INSERT INTO gifts (gift_key, from_user, to_user, price, time) VALUES (?, ?, ?, ?, ?)',
        args: [giftKey, socket.username, to, gift.price, now()]
      });
      const giftId = Number(r.lastInsertRowid);

      const t = now();
      const msgText = '🎁 Подарок: ' + gift.emoji + ' ' + gift.name;
      const msgResult = await db.execute({
        sql: `INSERT INTO messages (from_user, to_user, text, reactions, reply_to, edited, deleted, time) 
              VALUES (?, ?, ?, '{}', NULL, 0, 0, ?)`,
        args: [socket.username, to, msgText, t]
      });
      const msgId = Number(msgResult.lastInsertRowid);
      const msgPayload = {
        id: msgId, from: socket.username, to, text: msgText,
        reactions: {}, replyData: null, time: t, read: false,
        isGift: true, giftKey
      };

      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', msgPayload));
      socket.emit('private message', { ...msgPayload, self: true });

      const giftPayload = { id: giftId, giftKey, from_user: socket.username, to_user: to, price: gift.price, time: t };
      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('gift received', giftPayload));

      await incrementStat(socket.username, 'gifts_sent');
      await incrementStat(to, 'gifts_received');
      socket.emit('stars updated', { stars: await getStars(socket.username) });

      // Push
      try {
        const senderInfo = await getUser(socket.username);
        const senderName = (senderInfo && senderInfo.first_name) || socket.username;
        sendPushToUser(to, {
          title: senderName,
          body: '🎁 ' + gift.emoji + ' ' + gift.name + '!',
          icon: '/icon-192.png',
          tag: 'gift-' + socket.username,
          data: { url: '/' }
        }).catch(() => {});
      } catch (e) {}

      cb && cb({ ok: true, id: giftId });
    } catch (e) {
      console.error('send gift:', e);
      cb && cb({ ok: false });
    }
  });

  socket.on('sell gift', async ({ giftId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const r = await db.execute({ sql: 'SELECT * FROM gifts WHERE id = ?', args: [giftId] });
      const gift = r.rows[0];
      if (!gift) return cb && cb({ ok: false, error: 'Подарок не найден' });
      if (gift.to_user !== socket.username) return cb && cb({ ok: false, error: 'Не твой подарок' });
      if (gift.sold) return cb && cb({ ok: false, error: 'Уже продан' });

      const returnPrice = Math.floor(gift.price / 2);
      await db.execute({
        sql: 'UPDATE gifts SET sold = 1, sold_at = ?, sold_price = ? WHERE id = ?',
        args: [now(), returnPrice, giftId]
      });
      await addStars(socket.username, returnPrice, 'gift_sold:' + gift.gift_key, null);

      socket.emit('stars updated', { stars: await getStars(socket.username) });
      const gifts = await getGiftsOfUser(socket.username);
      socket.emit('my gifts updated', gifts);
      cb && cb({ ok: true, returned: returnPrice });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 🎟 ПОДАРОЧНЫЕ КОДЫ
  // ═══════════════════════════════════════════════════════════

  socket.on('generate gift code', async (cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) {
        return cb && cb({ ok: false, error: 'Только ' + CONFIG.ADMIN_USERNAME });
      }
      const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      const code = 'AURORA-' + rand() + '-' + rand();
      await db.execute({
        sql: 'INSERT INTO gift_codes (code, created_by, time) VALUES (?, ?, ?)',
        args: [code, socket.username, now()]
      });
      cb && cb({ ok: true, code });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('list gift codes', async (cb) => {
    try {
      if (!socket.username || socket.username !== CONFIG.ADMIN_USERNAME) return cb && cb({ ok: false, codes: [] });
      const r = await db.execute({
        sql: 'SELECT code, used_by, used_at, time FROM gift_codes ORDER BY time DESC LIMIT 100',
        args: []
      });
      cb && cb({ ok: true, codes: r.rows });
    } catch (e) { cb && cb({ ok: false, codes: [] }); }
  });

  socket.on('redeem gift code', async ({ code }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      code = String(code || '').trim().toUpperCase();
      if (!code) return cb && cb({ ok: false, error: 'Введи код' });
      const r = await db.execute({ sql: 'SELECT * FROM gift_codes WHERE code = ?', args: [code] });
      const row = r.rows[0];
      if (!row) return cb && cb({ ok: false, error: 'Код не найден' });
      if (row.used_by) return cb && cb({ ok: false, error: 'Код уже использован' });

      await db.execute({ sql: 'UPDATE user_settings SET premium = 1 WHERE username = ?', args: [socket.username] });
      cacheInvalidate(settingsCache, socket.username);
      await db.execute({
        sql: 'UPDATE gift_codes SET used_by = ?, used_at = ? WHERE code = ?',
        args: [socket.username, now(), code]
      });
      await addStars(socket.username, 25, 'premium_activated', null);

      socket.emit('settings', await getSettings(socket.username));
      socket.emit('stars updated', { stars: await getStars(socket.username) });
      cb && cb({ ok: true, bonus: 25 });
    } catch (e) { cb && cb({ ok: false }); }
  });

  // ═══════════════════════════════════════════════════════════
  // 🔌 DISCONNECT
  // ═══════════════════════════════════════════════════════════

  socket.on('disconnect', async () => {
    const u = socket.username;
    delete onlineUsers[socket.id];
    if (u) {
      sendContactsTo(u).catch(() => {});
      refreshForFriends(u).catch(() => {});

      Object.values(onlineUsers).forEach(other => {
        findSocketsByUsername(other).forEach(sid => io.to(sid).emit('typing', { from: u, isTyping: false }));
      });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 🚀 ЗАПУСК
// ═══════════════════════════════════════════════════════════

console.log('⚙️  Запускаю initDB...');

initDB()
  .then(() => {
    console.log('✅ initDB завершён успешно');
    cleanupOldMessages().catch(() => {});
    setInterval(cleanupOldMessages, 10 * 60 * 1000);

    server.listen(CONFIG.PORT, () => {
      console.log('🌌 Aurora v11.0 запущена на порту ' + CONFIG.PORT);
    });
  })
  .catch(err => {
    console.error('❌ ОШИБКА при инициализации:', err);
    process.exit(1);
  });

process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection:', reason);
});
