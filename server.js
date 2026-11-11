'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v15.2 — Server (Исправлен автовход)
   ═══════════════════════════════════════════════════════════ */

const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { createClient } = require('@libsql/client');

const CONFIG = {
  PORT: process.env.PORT || 3000, ADMIN_USERNAME: 'moroz',
  SESSION_TTL: 30 * 24 * 60 * 60 * 1000, CACHE_TTL: 30_000, RATE_WINDOW: 60_000,
  MAX_TEXT: 4000, MAX_IMAGE: 3_000_000, MAX_VOICE: 4_000_000, MAX_VIDEO: 15_000_000,
  MAX_STICKER: 4_000_000, MAX_BANNER: 2_000_000, MAX_GIFTS_PER_DAY: 20,
  MAX_USERNAME_LEN: 20, MIN_USERNAME_LEN: 3, MIN_PASSWORD_LEN: 8,
  MAX_DISPLAY_NAME: 40, MAX_BIO: 200, MAX_MESSAGE_BURST: 30, MESSAGE_WINDOW: 10_000,
  MAX_BOTS_PER_USER: 3, MAX_BOT_COMMANDS: 30, MAX_BOT_TRIGGER_LEN: 40, MAX_BOT_RESPONSE_LEN: 1000,
  MAX_BOT_NAME_LEN: 40, MAX_BOT_DESC_LEN: 200, MAX_REPORTS_PER_DAY: 10, REPORT_COMMENT_MAX: 500,
  MAX_CHANNELS_PER_USER: 1, MAX_GROUPS_PER_USER: 1, CALL_TIMEOUT_MS: 45_000,
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.relay.metered.ca:80' },
];

const PUNISHMENT_DURATIONS = {
  ban: { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000, '30d': 2_592_000_000, 'forever': null },
  mute: { '5m': 300_000, '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 },
};

const REPORT_REASONS = { spam: '🚫 Спам', abuse: '🤬 Оскорбления', nsfw: '🔞 18+', scam: '💀 Мошенничество', ads: '📢 Реклама', other: '❓ Другое' };

const GIFTS_CATALOG = {
  cake: { emoji: '🎂', name: 'Тортик', price: 5 }, rose: { emoji: '🌹', name: 'Роза', price: 10 },
  heart: { emoji: '❤️', name: 'Сердечко', price: 10 }, star: { emoji: '⭐', name: 'Звёздочка', price: 15 },
  pizza: { emoji: '🍕', name: 'Пицца', price: 20 }, balloon: { emoji: '🎈', name: 'Шарик', price: 20 },
  diamond: { emoji: '💎', name: 'Алмаз', price: 50 }, crown: { emoji: '👑', name: 'Корона', price: 500 },
  rocket: { emoji: '🚀', name: 'Ракета', price: 200 }, galaxy: { emoji: '🌌', name: 'Галактика', price: 5000 }
};

const SYSTEM_BOTS = {
  azerta: {
    username: 'azerta', name: 'Azerta Assistant', description: 'Официальный помощник.', avatar: null, emoji: '🌌', owner: 'system', is_public: 1,
    commands: [{ trigger: '/start', response: 'Привет! Я Azerta Assistant 🌌\n\n/help, /info' }, { trigger: '/help', response: '📋 Команды: /start, /info' }, { trigger: '/info', response: '🌌 Azerta — семейный мессенджер' }]
  }
};

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);

const io = new Server(server, { maxHttpBufferSize: 5e7, pingTimeout: 25000, pingInterval: 20000, transports: ['websocket', 'polling'], cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(express.static(path.join(__dirname)));
app.get('/health', (req, res) => { res.json({ ok: true, ts: Date.now(), ice: ICE_SERVERS.length, online: Object.keys(onlineUsers).length }); });

const STORIES_DIR = path.join(__dirname, 'stories');
const STICKERS_DIR = path.join(__dirname, 'stickers');
for (const dir of [STORIES_DIR, STICKERS_DIR]) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
app.use('/stories', express.static(STORIES_DIR));
app.use('/stickers', express.static(STICKERS_DIR));

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

function now() { return Date.now(); }
async function migrate(table, columns) { for (const col of columns) { const sql = typeof col === 'string' ? `ALTER TABLE ${table} ADD COLUMN ${col}` : `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`; await db.execute(sql).catch(() => {}); } }

const onlineUsers = {}; const activeCalls = {}; const callTimers = {}; const rateBuckets = new Map(); const settingsCache = new Map();

function findSocketsByUsername(username) { const result = []; for (const [sid, u] of Object.entries(onlineUsers)) { if (u === username) result.push(sid); } return result; }
function isOnline(username) { for (const u of Object.values(onlineUsers)) { if (u === username) return true; } return false; }
function rateLimit(key, max, windowMs) { const t = now(); let b = rateBuckets.get(key); if (!b || t > b.resetAt) { b = { count: 0, resetAt: t + windowMs }; rateBuckets.set(key, b); } b.count++; return b.count <= max; }
setInterval(() => { const t = now(); for (const [k, b] of rateBuckets) { if (t > b.resetAt) rateBuckets.delete(k); } }, 10 * 60 * 1000);

function cacheGet(map, key) { const entry = map.get(key); if (!entry) return null; if (now() > entry.expires) { map.delete(key); return null; } return entry.value; }
function cacheSet(map, key, value) { map.set(key, { value, expires: now() + CONFIG.CACHE_TTL }); }
function cacheInvalidate(map, key) { map.delete(key); }
function isModerator(username) { return username === CONFIG.ADMIN_USERNAME; }

function safeParseReactions(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { const o = JSON.parse(raw); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
function safeParseCommands(raw) { if (!raw) return []; if (Array.isArray(raw)) return raw; try { const o = JSON.parse(raw); return Array.isArray(o) ? o : []; } catch (e) { return []; } }

function validImage(s) { if (typeof s !== 'string' || s.length > CONFIG.MAX_IMAGE) return false; return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(s); }
function validVoice(s) { if (typeof s !== 'string' || s.length > CONFIG.MAX_VOICE) return false; return /^data:audio\/(webm|mp4|ogg|mpeg|wav);base64,/i.test(s); }
function validVideo(s) { if (typeof s !== 'string' || s.length > CONFIG.MAX_VIDEO) return false; return /^data:video\/(webm|mp4|quicktime|ogg);base64,/i.test(s); }
function validBanner(s) { if (typeof s !== 'string' || s.length > CONFIG.MAX_BANNER) return false; return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s); }
function validGeo(lat, lng) { return typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !isNaN(lat) && !isNaN(lng); }
function generateSessionId() { return crypto.randomBytes(32).toString('hex'); }
function extractMentions(text) { if (!text) return []; const matches = text.match(/@([a-z0-9_]{3,20})/gi); if (!matches) return []; const seen = new Set(); const result = []; matches.forEach(function (m) { const u = m.slice(1).toLowerCase(); if (!seen.has(u)) { seen.add(u); result.push(u); } }); return result; }
function formatDuration(expiresAt) { if (!expiresAt) return 'навсегда'; const ms = expiresAt - now(); if (ms <= 0) return 'истёк'; const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); const d = Math.floor(h / 24); if (d > 0) return d + ' д ' + (h % 24) + ' ч'; if (h > 0) return h + ' ч ' + (m % 60) + ' мин'; return m + ' мин'; }

async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, avatar TEXT, banner TEXT, premium INTEGER DEFAULT 0, verified INTEGER DEFAULT 0, badge_hammer INTEGER DEFAULT 0, badge_scam INTEGER DEFAULT 0, bio TEXT, first_name TEXT, last_name TEXT, birthday TEXT, emoji_status TEXT, last_seen_visibility TEXT DEFAULT 'everyone', phone TEXT, is_support INTEGER DEFAULT 0, registered_at INTEGER NOT NULL)`);
  await migrate('users', ['avatar TEXT', 'banner TEXT', 'premium INTEGER DEFAULT 0', 'verified INTEGER DEFAULT 0', 'badge_hammer INTEGER DEFAULT 0', 'badge_scam INTEGER DEFAULT 0', 'bio TEXT', 'first_name TEXT', 'last_name TEXT', 'birthday TEXT', 'emoji_status TEXT', `last_seen_visibility TEXT DEFAULT 'everyone'`, 'phone TEXT', 'is_support INTEGER DEFAULT 0', 'registered_at INTEGER', 'avatar_video TEXT', 'banner_video TEXT']);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS user_settings (username TEXT PRIMARY KEY, theme TEXT DEFAULT 'dark', language TEXT DEFAULT 'ru', font_size TEXT DEFAULT 'medium', accent_color TEXT DEFAULT '#e63946', animations INTEGER DEFAULT 1, sound INTEGER DEFAULT 1, vibration INTEGER DEFAULT 1, notif_private INTEGER DEFAULT 1, notif_groups INTEGER DEFAULT 1, passcode TEXT, profile_color TEXT DEFAULT '#e63946', chat_wallpaper TEXT DEFAULT '', stars INTEGER DEFAULT 0, last_seen_visibility TEXT DEFAULT 'everyone', geo_visibility TEXT DEFAULT 'contacts')`);
  await migrate('user_settings', [`theme TEXT DEFAULT 'dark'`, `language TEXT DEFAULT 'ru'`, `font_size TEXT DEFAULT 'medium'`, `accent_color TEXT DEFAULT '#e63946'`, 'animations INTEGER DEFAULT 1', 'sound INTEGER DEFAULT 1', 'vibration INTEGER DEFAULT 1', 'notif_private INTEGER DEFAULT 1', 'notif_groups INTEGER DEFAULT 1', 'passcode TEXT', `profile_color TEXT DEFAULT '#e63946'`, `chat_wallpaper TEXT DEFAULT ''`, 'stars INTEGER DEFAULT 0', `last_seen_visibility TEXT DEFAULT 'everyone'`, `geo_visibility TEXT DEFAULT 'contacts'`]);

  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, username TEXT NOT NULL, device TEXT, ip TEXT, last_active INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER)`);
  await migrate('sessions', ['device TEXT', 'ip TEXT', 'last_active INTEGER', 'created_at INTEGER', 'expires_at INTEGER']);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS contacts (owner TEXT NOT NULL, contact TEXT NOT NULL, display_name TEXT, added_at INTEGER NOT NULL, PRIMARY KEY (owner, contact))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT NOT NULL, to_user TEXT NOT NULL, text TEXT, image TEXT, voice TEXT, voice_duration INTEGER, video_circle TEXT, video_duration INTEGER, reactions TEXT DEFAULT '{}', reply_to INTEGER, edited INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0, read_at INTEGER, sticker TEXT, time INTEGER NOT NULL, system INTEGER DEFAULT 0, system_type TEXT, geo_lat REAL, geo_lng REAL, geo_label TEXT, spoiler INTEGER DEFAULT 0)`);
  await migrate('messages', ['text TEXT', 'image TEXT', 'voice TEXT', 'voice_duration INTEGER', 'video_circle TEXT', 'video_duration INTEGER', `reactions TEXT DEFAULT '{}'`, 'reply_to INTEGER', 'edited INTEGER DEFAULT 0', 'deleted INTEGER DEFAULT 0', 'read_at INTEGER', 'sticker TEXT', 'time INTEGER', 'system INTEGER DEFAULT 0', 'system_type TEXT', 'geo_lat REAL', 'geo_lng REAL', 'geo_label TEXT', 'spoiler INTEGER DEFAULT 0']);

  await db.execute(`CREATE TABLE IF NOT EXISTS groups_table (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, creator TEXT NOT NULL, avatar TEXT, description TEXT, pinned_message_id INTEGER, created_at INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS group_members (group_id INTEGER NOT NULL, username TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (group_id, username))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS group_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, from_user TEXT NOT NULL, text TEXT, image TEXT, voice TEXT, voice_duration INTEGER, video_circle TEXT, video_duration INTEGER, reactions TEXT DEFAULT '{}', reply_to INTEGER, edited INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0, sticker TEXT, time INTEGER NOT NULL, system INTEGER DEFAULT 0, system_type TEXT, geo_lat REAL, geo_lng REAL, geo_label TEXT, spoiler INTEGER DEFAULT 0)`);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS chat_settings (owner TEXT NOT NULL, chat_key TEXT NOT NULL, archived INTEGER DEFAULT 0, muted INTEGER DEFAULT 0, pinned INTEGER DEFAULT 0, pin_order INTEGER DEFAULT 0, PRIMARY KEY (owner, chat_key))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS blocks (blocker TEXT NOT NULL, blocked TEXT NOT NULL, time INTEGER NOT NULL, PRIMARY KEY (blocker, blocked))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, image TEXT NOT NULL, caption TEXT, time INTEGER NOT NULL, expires_at INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS story_views (story_id INTEGER NOT NULL, viewer TEXT NOT NULL, time INTEGER NOT NULL, PRIMARY KEY (story_id, viewer))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS stickers (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, url TEXT NOT NULL, type TEXT DEFAULT 'image', emoji TEXT, time INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS gift_codes (code TEXT PRIMARY KEY, created_by TEXT NOT NULL, used_by TEXT, used_at INTEGER, time INTEGER NOT NULL)`);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, avatar TEXT, creator TEXT NOT NULL, verified INTEGER DEFAULT 0, created_at INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_members (channel_id INTEGER NOT NULL, username TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (channel_id, username))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER NOT NULL, from_user TEXT NOT NULL, text TEXT, image TEXT, voice TEXT, voice_duration INTEGER, reactions TEXT DEFAULT '{}', deleted INTEGER DEFAULT 0, views INTEGER DEFAULT 0, time INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, from_user TEXT NOT NULL, text TEXT, image TEXT, voice TEXT, voice_duration INTEGER, deleted INTEGER DEFAULT 0, time INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS channel_invites (code TEXT PRIMARY KEY, channel_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_by TEXT NOT NULL)`);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS stars_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, from_user TEXT, time INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, gift_key TEXT NOT NULL, from_user TEXT NOT NULL, to_user TEXT NOT NULL, price INTEGER NOT NULL, time INTEGER NOT NULL, sold INTEGER DEFAULT 0, sold_at INTEGER, sold_price INTEGER, gift_message TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS achievements (username TEXT NOT NULL, achievement_key TEXT NOT NULL, unlocked_at INTEGER NOT NULL, PRIMARY KEY (username, achievement_key))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS user_stats (username TEXT PRIMARY KEY, messages_sent INTEGER DEFAULT 0, calls_made INTEGER DEFAULT 0, calls_received INTEGER DEFAULT 0, calls_missed INTEGER DEFAULT 0, calls_duration INTEGER DEFAULT 0, gifts_sent INTEGER DEFAULT 0, gifts_received INTEGER DEFAULT 0, stories_posted INTEGER DEFAULT 0, groups_created INTEGER DEFAULT 0, channels_created INTEGER DEFAULT 0, bots_created INTEGER DEFAULT 0, friends_added INTEGER DEFAULT 0, days_active INTEGER DEFAULT 0, last_active_day TEXT, stickers_sent INTEGER DEFAULT 0, voice_sent INTEGER DEFAULT 0, circles_sent INTEGER DEFAULT 0, photos_sent INTEGER DEFAULT 0, reactions_given INTEGER DEFAULT 0, edited_messages INTEGER DEFAULT 0, deleted_messages INTEGER DEFAULT 0, geo_sent INTEGER DEFAULT 0, spoilers_sent INTEGER DEFAULT 0)`);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS bots (username TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, description TEXT, avatar TEXT, emoji TEXT, commands TEXT DEFAULT '[]', is_public INTEGER DEFAULT 1, created_at INTEGER NOT NULL, verified INTEGER DEFAULT 0, premium INTEGER DEFAULT 0, badge_hammer INTEGER DEFAULT 0, badge_scam INTEGER DEFAULT 0)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS bot_operators (bot_username TEXT NOT NULL, operator TEXT NOT NULL, added_by TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (bot_username, operator))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS bot_chat_members (bot_username TEXT NOT NULL, chat_key TEXT NOT NULL, chat_type TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (bot_username, chat_key))`);
  
  await db.execute(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT NOT NULL, target_user TEXT, target_message_id INTEGER, target_is_group INTEGER DEFAULT 0, target_chat_key TEXT, reason TEXT NOT NULL, comment TEXT, status TEXT DEFAULT 'new', resolved_by TEXT, resolved_at INTEGER, action_taken TEXT, time INTEGER NOT NULL)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS punishments (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, type TEXT NOT NULL, reason TEXT, issued_by TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER, active INTEGER DEFAULT 1, lifted_by TEXT, lifted_at INTEGER)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS mod_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, moderator TEXT NOT NULL, action TEXT NOT NULL, target_user TEXT, target_report_id INTEGER, details TEXT, time INTEGER NOT NULL)`);

  for (const [uname, bot] of Object.entries(SYSTEM_BOTS)) {
    const existing = await db.execute({ sql: 'SELECT 1 FROM bots WHERE username = ?', args: [uname] }).catch(() => ({ rows: [] }));
    if (existing.rows.length === 0) { await db.execute({ sql: 'INSERT INTO bots (username, owner, name, description, avatar, emoji, commands, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [uname, bot.owner, bot.name, bot.description, bot.avatar, bot.emoji, JSON.stringify(bot.commands), bot.is_public, now()] }); }
  }
  console.log('✅ Схема БД готова');
}

async function getUser(username) { const r = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] }); return r.rows[0] || null; }
async function getContactInfo(username) { const r = await db.execute({ sql: 'SELECT username, avatar, banner, avatar_video, banner_video, premium, verified, badge_hammer, badge_scam, bio, first_name, last_name, emoji_status, last_seen_visibility, is_support FROM users WHERE username = ?', args: [username] }); return r.rows[0] || null; }
async function getSettings(username) { const cached = cacheGet(settingsCache, username); if (cached) return cached; await db.execute({ sql: 'INSERT OR IGNORE INTO user_settings (username) VALUES (?)', args: [username] }); const r = await db.execute({ sql: 'SELECT * FROM user_settings WHERE username = ?', args: [username] }); const result = r.rows[0] || {}; cacheSet(settingsCache, username, result); return result; }
async function getStars(username) { if (username === CONFIG.ADMIN_USERNAME) return 999999; const r = await db.execute({ sql: 'SELECT stars FROM user_settings WHERE username = ?', args: [username] }); return Number(r.rows[0]?.stars || 0); }
async function addStars(username, amount, reason, fromUser) { if (username === CONFIG.ADMIN_USERNAME) return; const s = await getSettings(username); const newStars = Math.max(0, Number(s.stars || 0) + amount); await db.execute({ sql: 'UPDATE user_settings SET stars = ? WHERE username = ?', args: [newStars, username] }); cacheInvalidate(settingsCache, username); await db.execute({ sql: 'INSERT INTO stars_transactions (username, amount, reason, from_user, time) VALUES (?, ?, ?, ?, ?)', args: [username, amount, reason, fromUser || null, now()] }); }

async function getActivePunishment(username, type) { const t = now(); const r = await db.execute({ sql: `SELECT * FROM punishments WHERE username = ? AND type = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY issued_at DESC LIMIT 1`, args: [username, type, t] }); return r.rows[0] || null; }
async function getActivePunishments(username) { const t = now(); const r = await db.execute({ sql: `SELECT * FROM punishments WHERE username = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY issued_at DESC`, args: [username, t] }); return r.rows; }
async function isBanned(username) { return !!(await getActivePunishment(username, 'ban')); }
async function isMuted(username) { return !!(await getActivePunishment(username, 'mute')); }

async function logMod(moderator, action, targetUser, targetReportId, details) { try { await db.execute({ sql: 'INSERT INTO mod_logs (moderator, action, target_user, target_report_id, details, time) VALUES (?, ?, ?, ?, ?, ?)', args: [moderator, action, targetUser || null, targetReportId || null, details || null, now()] }); } catch (e) {} }

async function issuePunishment(username, type, durationKey, reason, issuedBy, reportId) {
  let expiresAt = null;
  if (durationKey && durationKey !== 'forever') { const durations = PUNISHMENT_DURATIONS[type]; const ms = durations ? durations[durationKey] : null; if (ms) expiresAt = now() + ms; }
  const r = await db.execute({ sql: `INSERT INTO punishments (username, type, reason, issued_by, issued_at, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, 1)`, args: [username, type, reason || null, issuedBy, now(), expiresAt] });
  const id = Number(r.lastInsertRowid);
  const emoji = type === 'ban' ? '🚫' : (type === 'mute' ? '🔇' : '⚠️');
  const title = type === 'ban' ? 'Ты забанен' : (type === 'mute' ? 'Ты в муте' : 'Предупреждение');
  const durText = formatDuration(expiresAt);
  const payload = { id, type, reason: reason || null, issued_by: issuedBy, issued_at: now(), expires_at: expiresAt, duration_text: durText, title, emoji };
  findSocketsByUsername(username).forEach(sid => { io.to(sid).emit('punishment issued', payload); if (type === 'ban') setTimeout(() => { io.to(sid).disconnectSockets(true); }, 3000); });
  await logMod(issuedBy, type, username, reportId || null, reason || null);
  return id;
}

async function createSession(username, device, ip) { const id = generateSessionId(); const t = now(); const expiresAt = t + CONFIG.SESSION_TTL; await db.execute({ sql: 'INSERT INTO sessions (id, username, device, ip, last_active, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, username, (device || 'Web').slice(0, 80), (ip || '').slice(0, 60), t, t, expiresAt] }); return id; }
async function getSessionById(sessionId) { if (!sessionId) return null; const r = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessionId] }); const row = r.rows[0]; if (!row) return null; if (row.expires_at && now() > row.expires_at) { await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] }); return null; } return row; }
async function updateSession(sessionId) { if (!sessionId) return false; const s = await getSessionById(sessionId); if (!s) return false; await db.execute({ sql: 'UPDATE sessions SET last_active = ? WHERE id = ?', args: [now(), sessionId] }); return true; }

async function getContactsOf(username) { const r = await db.execute({ sql: 'SELECT contact, display_name FROM contacts WHERE owner = ? ORDER BY added_at ASC', args: [username] }); return r.rows.map(row => ({ contact: row.contact, display_name: row.display_name })); }
async function getHistory(me, withUser) { try { const r = await db.execute({ sql: `SELECT * FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY time ASC LIMIT 300`, args: [me, withUser, withUser, me] }); return r.rows || []; } catch (e) { return []; } }
async function getGroupHistory(groupId) { try { const r = await db.execute({ sql: 'SELECT * FROM group_messages WHERE group_id = ? ORDER BY time ASC LIMIT 300', args: [groupId] }); return r.rows || []; } catch (e) { return []; } }
async function enrichHistoryWithReplies(rows, isGroup) {
  if (!rows || rows.length === 0) return [];
  const replyIds = rows.filter(m => m.reply_to).map(m => m.reply_to);
  const repliesMap = {};
  if (replyIds.length > 0) { try { const ph = replyIds.map(() => '?').join(','); const table = isGroup ? 'group_messages' : 'messages'; const rr = await db.execute({ sql: `SELECT id, from_user, text, image, voice, deleted FROM ${table} WHERE id IN (${ph})`, args: replyIds }); rr.rows.forEach(r => { repliesMap[r.id] = r; }); } catch (e) {} }
  return rows.map(m => { let replyData = null; if (m.reply_to && repliesMap[m.reply_to]) { const r = repliesMap[m.reply_to]; replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted }; } return { ...m, reactions: safeParseReactions(m.reactions), replyData }; });
}

async function isBlocked(blocker, blocked) { const r = await db.execute({ sql: 'SELECT 1 FROM blocks WHERE blocker = ? AND blocked = ?', args: [blocker, blocked] }); return r.rows.length > 0; }
async function isBlockedEither(a, b) { if (await isBlocked(a, b)) return true; if (await isBlocked(b, a)) return true; return false; }

async function sendContactsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  try {
    const contactRows = await getContactsOf(username);
    if (contactRows.length === 0) { sockets.forEach(sid => io.to(sid).emit('contacts', [])); return; }
    const names = contactRows.map(r => r.contact);
    const ph = names.map(() => '?').join(',');
    const usersR = await db.execute({ sql: `SELECT username, avatar, avatar_video, banner, banner_video, premium, verified, badge_hammer, badge_scam, first_name, last_name, emoji_status, last_seen_visibility, is_support FROM users WHERE username IN (${ph})`, args: names });
    const usersMap = {}; usersR.rows.forEach(u => { usersMap[u.username] = u; });
    const botsR = await db.execute({ sql: `SELECT username, name, description, avatar, emoji, verified, premium, badge_hammer, badge_scam FROM bots WHERE username IN (${ph})`, args: names }).catch(() => ({ rows: [] }));
    const botsMap = {}; botsR.rows.forEach(b => { botsMap[b.username] = b; });
    const settingsR = await db.execute({ sql: `SELECT chat_key, archived, muted, pinned, pin_order FROM chat_settings WHERE owner = ? AND chat_key IN (${ph})`, args: [username, ...names] });
    const settingsMap = {}; settingsR.rows.forEach(s => { settingsMap[s.chat_key] = s; });
    const blocksR = await db.execute({ sql: `SELECT blocked FROM blocks WHERE blocker = ? AND blocked IN (${ph})`, args: [username, ...names] });
    const blockedSet = new Set(blocksR.rows.map(r => r.blocked));
    
    const list = contactRows.map(row => {
      const info = usersMap[row.contact];
      const bot = botsMap[row.contact];
      const settings = settingsMap[row.contact] || { archived: 0, muted: 0, pinned: 0, pin_order: 0 };
      if (bot) { return { name: bot.username, displayName: bot.name, avatar: bot.avatar, banner: null, premium: !!bot.premium, verified: !!bot.verified, hammer: !!bot.badge_hammer, scam: !!bot.badge_scam, firstName: null, lastName: null, emojiStatus: bot.emoji, online: true, archived: !!settings.archived, muted: !!settings.muted, pinned: !!settings.pinned, pinOrder: Number(settings.pin_order) || 0, blocked: false, isBot: true, botDescription: bot.description, isSupport: false }; }
      return { name: row.contact, displayName: row.display_name || row.contact, avatar: info ? info.avatar : null, banner: info ? info.banner : null, avatarVideo: info ? info.avatar_video : null, bannerVideo: info ? info.banner_video : null, premium: info ? !!info.premium : false, verified: info ? !!info.verified : false, hammer: info ? !!info.badge_hammer : false, scam: info ? !!info.badge_scam : false, firstName: info ? info.first_name : null, lastName: info ? info.last_name : null, emojiStatus: info ? info.emoji_status : null, online: isOnline(row.contact), archived: !!settings.archived, muted: !!settings.muted, pinned: !!settings.pinned, pinOrder: Number(settings.pin_order) || 0, blocked: blockedSet.has(row.contact), isBot: false, isSupport: info ? !!info.is_support : false };
    });
    sockets.forEach(sid => io.to(sid).emit('contacts', list));
  } catch (e) { console.error('sendContactsTo:', e); }
}

async function sendGroupsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  try {
    const groupsR = await db.execute({ sql: `SELECT g.* FROM groups_table g INNER JOIN group_members gm ON g.id = gm.group_id WHERE gm.username = ? ORDER BY g.created_at ASC`, args: [username] });
    const groups = groupsR.rows;
    const createdCountR = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM groups_table WHERE creator = ?', args: [username] });
    const createdCount = Number(createdCountR.rows[0]?.cnt || 0);
    
    if (groups.length === 0) { sockets.forEach(sid => io.to(sid).emit('groups', [], { canCreate: true, createdCount })); return; }
    const groupIds = groups.map(g => g.id);
    const gph = groupIds.map(() => '?').join(',');
    const membersR = await db.execute({ sql: `SELECT group_id, username FROM group_members WHERE group_id IN (${gph}) ORDER BY joined_at ASC`, args: groupIds });
    const membersMap = {}; membersR.rows.forEach(r => { if (!membersMap[r.group_id]) membersMap[r.group_id] = []; membersMap[r.group_id].push(r.username); });
    const chatKeys = groupIds.map(id => 'g:' + id);
    const kph = chatKeys.map(() => '?').join(',');
    const settingsR = await db.execute({ sql: `SELECT chat_key, archived, muted, pinned, pin_order FROM chat_settings WHERE owner = ? AND chat_key IN (${kph})`, args: [username, ...chatKeys] });
    const settingsMap = {}; settingsR.rows.forEach(s => { settingsMap[s.chat_key] = s; });
    const list = groups.map(g => { const members = membersMap[g.id] || []; const settings = settingsMap['g:' + g.id] || { archived: 0, muted: 0, pinned: 0, pin_order: 0 }; return { id: g.id, name: g.name, avatar: g.avatar, creator: g.creator, description: g.description, pinnedMessageId: g.pinned_message_id, members, memberCount: members.length, archived: !!settings.archived, muted: !!settings.muted, pinned: !!settings.pinned, pinOrder: Number(settings.pin_order) || 0 }; });
    sockets.forEach(sid => io.to(sid).emit('groups', list, { canCreate: true, createdCount }));
  } catch (e) { console.error('sendGroupsTo:', e); }
}

async function sendChannelsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  try {
    const channelsR = await db.execute({ sql: `SELECT c.* FROM channels c INNER JOIN channel_members cm ON c.id = cm.channel_id WHERE cm.username = ? ORDER BY c.created_at ASC`, args: [username] });
    const channels = channelsR.rows;
    const createdCountR = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM channels WHERE creator = ?', args: [username] });
    const createdCount = Number(createdCountR.rows[0]?.cnt || 0);
    if (channels.length === 0) { sockets.forEach(sid => io.to(sid).emit('channels', [], { canCreate: true, createdCount })); return; }
    const ids = channels.map(c => c.id);
    const ph = ids.map(() => '?').join(',');
    const membersR = await db.execute({ sql: `SELECT channel_id, username FROM channel_members WHERE channel_id IN (${ph}) ORDER BY joined_at ASC`, args: ids });
    const membersMap = {}; membersR.rows.forEach(r => { if (!membersMap[r.channel_id]) membersMap[r.channel_id] = []; membersMap[r.channel_id].push(r.username); });
    const list = channels.map(c => { const members = membersMap[c.id] || []; return { id: c.id, slug: c.slug, name: c.name, description: c.description, avatar: c.avatar, creator: c.creator, verified: !!c.verified, members, memberCount: members.length, pinned: false, pinOrder: 0 }; });
    sockets.forEach(sid => io.to(sid).emit('channels', list, { canCreate: true, createdCount }));
  } catch (e) { console.error('sendChannelsTo:', e); }
}

async function refreshForFriends(username) { const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] }); for (const row of r.rows) sendContactsTo(row.owner).catch(() => {}); }
async function notifyAllFriends(username, event, payload) { const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] }); for (const row of r.rows) findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit(event, payload)); }
async function notifyGroupMembers(groupId, event, payload) { const members = await db.execute({ sql: 'SELECT username FROM group_members WHERE group_id = ?', args: [groupId] }); for (const m of members.rows) findSocketsByUsername(m.username).forEach(sid => io.to(sid).emit(event, payload)); }
async function notifyChannelMembers(channelId, event, payload) { const members = await db.execute({ sql: 'SELECT username FROM channel_members WHERE channel_id = ?', args: [channelId] }); for (const m of members.rows) findSocketsByUsername(m.username).forEach(sid => io.to(sid).emit(event, payload)); }

async function getGroupById(id) { const r = await db.execute({ sql: 'SELECT * FROM groups_table WHERE id = ?', args: [id] }); return r.rows[0] || null; }
async function getGroupMembers(groupId) { const r = await db.execute({ sql: 'SELECT username FROM group_members WHERE group_id = ? ORDER BY joined_at ASC', args: [groupId] }); return r.rows.map(row => row.username); }
async function isGroupMember(groupId, username) { const r = await db.execute({ sql: 'SELECT 1 FROM group_members WHERE group_id = ? AND username = ?', args: [groupId, username] }); return r.rows.length > 0; }

async function createCallSystemMessage(fromUser, toUser, type, duration) {
  try {
    const t = now(); let text = '';
    if (type === 'missed') text = '📞 Пропущенный звонок'; else if (type === 'outgoing') text = '📞 Исходящий звонок'; else if (type === 'incoming') text = '📞 Входящий звонок'; else if (type === 'ended') { const m = Math.floor((duration || 0) / 60); const s = (duration || 0) % 60; text = '📞 Звонок · ' + m + ':' + (s < 10 ? '0' : '') + s; }
    const result = await db.execute({ sql: `INSERT INTO messages (from_user, to_user, text, reactions, reply_to, edited, deleted, sticker, time, system, system_type) VALUES (?, ?, ?, '{}', NULL, 0, 0, NULL, ?, 1, ?)`, args: [fromUser, toUser, text, t, type] });
    const msgId = Number(result.lastInsertRowid);
    const payload = { id: msgId, from: fromUser, to: toUser, text, reactions: {}, replyData: null, time: t, system: true, systemType: type, duration: duration || 0 };
    findSocketsByUsername(toUser).forEach(sid => io.to(sid).emit('private message', { ...payload, self: false }));
    findSocketsByUsername(fromUser).forEach(sid => io.to(sid).emit('private message', { ...payload, self: true }));
    return msgId;
  } catch (e) { console.error('createCallSystemMessage:', e); return null; }
}

function clearCallTimer(username) { if (callTimers[username]) { clearTimeout(callTimers[username]); delete callTimers[username]; } }
function endCallBetween(a, b) { clearCallTimer(a); clearCallTimer(b); delete activeCalls[a]; delete activeCalls[b]; if (a) findSocketsByUsername(a).forEach(sid => io.to(sid).emit('call-ended')); if (b) findSocketsByUsername(b).forEach(sid => io.to(sid).emit('call-ended')); }

io.on('connection', (socket) => {
  console.log('🔗 Подключился:', socket.id);

  socket.on('check username', async ({ username }, cb) => {
    try {
      if (!rateLimit('check:' + socket.handshake.address, 60, CONFIG.RATE_WINDOW)) return cb && cb({ ok: false, available: false, error: 'Слишком часто' });
      username = String(username || '').trim().toLowerCase();
      if (!username) return cb && cb({ ok: true, available: false, reason: 'empty' });
      if (username.length < CONFIG.MIN_USERNAME_LEN) return cb && cb({ ok: true, available: false, reason: 'short' });
      if (username.length > CONFIG.MAX_USERNAME_LEN) return cb && cb({ ok: true, available: false, reason: 'long' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: true, available: false, reason: 'chars' });
      const exists = await getUser(username);
      const botExistsR = await db.execute({ sql: 'SELECT 1 FROM bots WHERE username = ?', args: [username] });
      cb && cb({ ok: true, available: !exists && botExistsR.rows.length === 0, reason: (exists || botExistsR.rows.length > 0) ? 'taken' : 'ok' });
    } catch (e) { cb && cb({ ok: false, available: false, error: 'Ошибка' }); }
  });

  socket.on('register', async ({ username, password, displayName }, cb) => {
    try {
      if (!rateLimit('reg:' + socket.handshake.address, 5, CONFIG.RATE_WINDOW)) return cb && cb({ ok: false, error: 'Слишком много попыток.' });
      username = String(username || '').trim().toLowerCase(); password = String(password || ''); displayName = String(displayName || '').trim().slice(0, CONFIG.MAX_DISPLAY_NAME);
      if (!username || !password) return cb && cb({ ok: false, error: 'Заполни все поля' });
      if (username.length < CONFIG.MIN_USERNAME_LEN || username.length > CONFIG.MAX_USERNAME_LEN) return cb && cb({ ok: false, error: 'Ник от 3 до 20' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: false, error: 'Только латиница, цифры и _' });
      if (password.length < CONFIG.MIN_PASSWORD_LEN) return cb && cb({ ok: false, error: 'Пароль минимум 8' });
      if (await getUser(username)) return cb && cb({ ok: false, error: 'Ник занят' });
      
      const hash = bcrypt.hashSync(password, 10); const t = now();
      await db.execute({ sql: `INSERT INTO users (username, password, avatar, banner, premium, verified, badge_hammer, badge_scam, bio, first_name, last_name, birthday, emoji_status, last_seen_visibility, phone, is_support, registered_at) VALUES (?, ?, NULL, NULL, 0, 0, 0, 0, NULL, ?, NULL, NULL, NULL, 'everyone', NULL, 0, ?)`, args: [username, hash, displayName || null, t] });
      await getSettings(username); await addStars(username, 10, 'welcome', null);
      const sessionId = await createSession(username, socket.handshake.headers['user-agent'], socket.handshake.address);
      onlineUsers[socket.id] = username; socket.username = username; socket.sessionId = sessionId;
      const user = await getUser(username); const stars = await getStars(username);
      
      cb && cb({ ok: true, bonus: 10, sessionId, username, avatar: user.avatar, banner: user.banner, premium: false, verified: false, hammer: false, scam: false, bio: user.bio, firstName: user.first_name, stars, is_moderator: isModerator(username) });
      
      getSettings(username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(username).catch(() => {}); sendGroupsTo(username).catch(() => {}); sendChannelsTo(username).catch(() => {});
    } catch (e) { cb && cb({ ok: false, error: 'Ошибка: ' + e.message }); }
  });

  socket.on('login with session', async ({ sessionId }, cb) => {
    try {
      if (!rateLimit('autologin:' + socket.handshake.address, 30, CONFIG.RATE_WINDOW)) return cb && cb({ ok: false, error: 'Слишком часто' });
      const session = await getSessionById(sessionId);
      if (!session) return cb && cb({ ok: false, error: 'Сессия истекла' });
      const user = await getUser(session.username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      
      const activePunishments = await getActivePunishments(session.username);
      const ban = activePunishments.find(p => p.type === 'ban');
      if (ban) return cb && cb({ ok: false, error: 'Ты забанен', banned: true, ban: { reason: ban.reason, expires_at: ban.expires_at, duration_text: formatDuration(ban.expires_at) } });
      
      onlineUsers[socket.id] = session.username; socket.username = session.username; socket.sessionId = sessionId;
      await updateSession(sessionId);
      const stars = await getStars(session.username);
      const mute = activePunishments.find(p => p.type === 'mute');
      
      // ИСПРАВЛЕНИЕ: Добавлены видео-поля!
      cb && cb({ ok: true, avatar: user.avatar, banner: user.banner, avatarVideo: user.avatar_video || null, bannerVideo: user.banner_video || null, premium: !!user.premium, username: session.username, verified: !!user.verified, hammer: !!user.badge_hammer, scam: !!user.badge_scam, bio: user.bio, firstName: user.first_name, lastName: user.last_name, birthday: user.birthday, emojiStatus: user.emoji_status, sessionId, stars, is_moderator: isModerator(session.username), mute: mute ? { reason: mute.reason, expires_at: mute.expires_at, duration_text: formatDuration(mute.expires_at) } : null });
      
      getSettings(session.username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(session.username).catch(() => {}); sendGroupsTo(session.username).catch(() => {}); sendChannelsTo(session.username).catch(() => {}); refreshForFriends(session.username).catch(() => {});
    } catch (e) { cb && cb({ ok: false, error: 'Ошибка: ' + e.message }); }
  });

  socket.on('login', async ({ username, password, device, sessionId }, cb) => {
    try {
      if (!rateLimit('login:' + socket.handshake.address, 10, CONFIG.RATE_WINDOW)) return cb && cb({ ok: false, error: 'Слишком много попыток.' });
      username = String(username || '').trim().toLowerCase(); password = String(password || '');
      const user = await getUser(username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (!bcrypt.compareSync(password, user.password)) return cb && cb({ ok: false, error: 'Неверный пароль' });
      
      const activePunishments = await getActivePunishments(username);
      const ban = activePunishments.find(p => p.type === 'ban');
      if (ban) return cb && cb({ ok: false, error: 'Ты забанен', banned: true, ban: { reason: ban.reason, expires_at: ban.expires_at, duration_text: formatDuration(ban.expires_at) } });
      
      let sessId = null;
      if (sessionId) { const existing = await getSessionById(sessionId); if (existing && existing.username === username) { sessId = sessionId; await updateSession(sessId); } }
      if (!sessId) sessId = await createSession(username, device, socket.handshake.address);
      
      onlineUsers[socket.id] = username; socket.username = username; socket.sessionId = sessId;
      const stars = await getStars(username);
      const mute = activePunishments.find(p => p.type === 'mute');
      
      // ИСПРАВЛЕНИЕ: Добавлены видео-поля!
      cb && cb({ ok: true, avatar: user.avatar, banner: user.banner, avatarVideo: user.avatar_video || null, bannerVideo: user.banner_video || null, premium: !!user.premium, username, verified: !!user.verified, hammer: !!user.badge_hammer, scam: !!user.badge_scam, bio: user.bio, firstName: user.first_name, lastName: user.last_name, birthday: user.birthday, emojiStatus: user.emoji_status, sessionId: sessId, stars, is_moderator: isModerator(username), mute: mute ? { reason: mute.reason, expires_at: mute.expires_at, duration_text: formatDuration(mute.expires_at) } : null });
      
      getSettings(username).then(s => socket.emit('settings', s)).catch(() => {});
      sendContactsTo(username).catch(() => {}); sendGroupsTo(username).catch(() => {}); sendChannelsTo(username).catch(() => {}); refreshForFriends(username).catch(() => {});
    } catch (e) { cb && cb({ ok: false, error: 'Ошибка: ' + e.message }); }
  });

  socket.on('set avatar', async ({ avatar }) => { try { if (!socket.username || !avatar || !validImage(avatar)) return; await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE username = ?', args: [avatar, socket.username] }); refreshForFriends(socket.username).catch(() => {}); notifyAllFriends(socket.username, 'friend updated', { username: socket.username, avatar }).catch(() => {}); } catch (e) {} });
  socket.on('update profile', async ({ firstName, lastName, bio, birthday, emojiStatus }, cb) => { try { if (!socket.username) return cb && cb({ ok: false }); const updates = []; const args = []; if (firstName !== undefined) { updates.push('first_name = ?'); args.push(firstName || null); } if (lastName !== undefined) { updates.push('last_name = ?'); args.push(lastName || null); } if (bio !== undefined) { updates.push('bio = ?'); args.push(bio || null); } if (updates.length === 0) return cb && cb({ ok: true }); args.push(socket.username); await db.execute({ sql: `UPDATE users SET ${updates.join(', ')} WHERE username = ?`, args }); refreshForFriends(socket.username).catch(() => {}); cb && cb({ ok: true }); } catch (e) { cb && cb({ ok: false }); } });

  socket.on('load history', async ({ withUser }) => { try { if (!socket.username) return; const rows = await getHistory(socket.username, withUser); const messages = await enrichHistoryWithReplies(rows, false); socket.emit('history', { withUser, messages }); } catch (e) { socket.emit('history', { withUser, messages: [] }); } });
  socket.on('private message', async ({ to, text, image, voice, voiceDuration, videoCircle, videoDuration, replyTo, sticker, spoiler }) => {
    try {
      if (!socket.username) return;
      if (await isMuted(socket.username)) return socket.emit('message blocked', { reason: '🔇 Ты в муте' });
      if (text && text.length > CONFIG.MAX_TEXT) return socket.emit('message blocked', { reason: 'Слишком длинное' });
      if (await isBlockedEither(socket.username, to)) return socket.emit('message blocked', { reason: 'Пользователь заблокирован' });
      const from = socket.username; const t = now();
      const result = await db.execute({ sql: `INSERT INTO messages (from_user, to_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, spoiler, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?, ?, ?)`, args: [from, to, text || null, image || null, voice || null, voiceDuration || null, videoCircle || null, videoDuration || null, replyTo || null, sticker || null, spoiler ? 1 : 0, t] });
      const msgId = Number(result.lastInsertRowid);
      const payload = { id: msgId, from, to, text, image, sticker, voice, voiceDuration, videoCircle, videoDuration, reactions: {}, replyData: null, time: t, read: false, spoiler: !!spoiler };
      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
      socket.emit('private message', { ...payload, self: true });
    } catch (e) {}
  });

  socket.on('disconnect', async () => {
    try {
      const u = socket.username; delete onlineUsers[socket.id];
      if (u && activeCalls[u]) { const peer = activeCalls[u]; clearCallTimer(u); clearCallTimer(peer); delete activeCalls[u]; delete activeCalls[peer]; if (peer) findSocketsByUsername(peer).forEach(sid => io.to(sid).emit('call-ended')); }
      if (u) { sendContactsTo(u).catch(() => {}); refreshForFriends(u).catch(() => {}); }
    } catch (e) {}
  });
});

async function startServer() {
  console.log('⏳ initDB...');
  await initDB();
  server.listen(CONFIG.PORT, () => {
    console.log('🌌 Azerta v15.2 запущена на порту ' + CONFIG.PORT);
  });
}

startServer();