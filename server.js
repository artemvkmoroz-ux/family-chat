const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e7 });

app.use(express.static(path.join(__dirname)));

// 📁 Папки
const STORIES_DIR = path.join(__dirname, 'stories');
if (!fs.existsSync(STORIES_DIR)) fs.mkdirSync(STORIES_DIR, { recursive: true });
app.use('/stories', express.static(STORIES_DIR));

const STICKERS_DIR = path.join(__dirname, 'stickers');
if (!fs.existsSync(STICKERS_DIR)) fs.mkdirSync(STICKERS_DIR, { recursive: true });
app.use('/stickers', express.static(STICKERS_DIR));

const ADMIN_USERNAME = 'moroz';

console.log('🚀 Aurora: старт...');
console.log('🔌 TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? 'задан' : '❌ НЕ ЗАДАН');
console.log('🔑 TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'задан' : '❌ НЕ ЗАДАН');
console.log('👑 Админ:', ADMIN_USERNAME);

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 🛡 Rate limit
const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + windowMs }; rateBuckets.set(key, b); }
  b.count++;
  return b.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (now > b.resetAt) rateBuckets.delete(k);
}, 10 * 60 * 1000);

// 📏 Лимиты
const MAX_TEXT = 4000;
const MAX_IMAGE = 3_000_000;
const MAX_VOICE = 4_000_000;
const MAX_VIDEO = 15_000_000;
const MAX_STICKER = 4_000_000;

function validImage(s) { return typeof s === 'string' && s.startsWith('data:image/') && s.length <= MAX_IMAGE; }
function validVoice(s) { return typeof s === 'string' && s.startsWith('data:audio/') && s.length <= MAX_VOICE; }
function validVideo(s) { return typeof s === 'string' && s.startsWith('data:video/') && s.length <= MAX_VIDEO; }
function validStickerData(s) {
  if (typeof s !== 'string' || s.length > MAX_STICKER) return false;
  return s.startsWith('data:image/') || s.startsWith('data:video/');
}

async function initDB() {
  console.log('📦 Инициализация базы...');
  const start = Date.now();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
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
    )
  `);
  await db.execute(`ALTER TABLE users ADD COLUMN bio TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN first_name TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN last_name TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN birthday TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN emoji_status TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN last_seen_visibility TEXT DEFAULT 'everyone'`).catch(() => {});
  await db.execute(`ALTER TABLE users ADD COLUMN phone TEXT`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      owner TEXT NOT NULL,
      contact TEXT NOT NULL,
      display_name TEXT,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (owner, contact)
    )
  `);
  await db.execute(`ALTER TABLE contacts ADD COLUMN display_name TEXT`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
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
      time INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE messages ADD COLUMN reply_to INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN read_at INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN video_circle TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN video_duration INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN sticker TEXT`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS groups_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creator TEXT NOT NULL,
      avatar TEXT,
      description TEXT,
      pinned_message_id INTEGER,
      created_at INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE groups_table ADD COLUMN description TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE groups_table ADD COLUMN pinned_message_id INTEGER`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, username)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_messages (
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
      time INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE group_messages ADD COLUMN reply_to INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN edited INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN deleted INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN video_circle TEXT`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN video_duration INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN sticker TEXT`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_settings (
      owner TEXT NOT NULL,
      chat_key TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      muted INTEGER DEFAULT 0,
      PRIMARY KEY (owner, chat_key)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
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
      FOREIGN KEY (username) REFERENCES users(username)
    )
  `);
  await db.execute(`ALTER TABLE user_settings ADD COLUMN profile_color TEXT DEFAULT '#a855f7'`).catch(() => {});
  await db.execute(`ALTER TABLE user_settings ADD COLUMN chat_wallpaper TEXT DEFAULT ''`).catch(() => {});
  await db.execute(`ALTER TABLE user_settings ADD COLUMN premium INTEGER DEFAULT 1`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS blocks (
      blocker TEXT NOT NULL,
      blocked TEXT NOT NULL,
      time INTEGER NOT NULL,
      PRIMARY KEY (blocker, blocked)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      device TEXT,
      ip TEXT,
      last_active INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      image TEXT NOT NULL,
      caption TEXT,
      time INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(username, expires_at DESC)`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS story_views (
      story_id INTEGER NOT NULL,
      viewer TEXT NOT NULL,
      time INTEGER NOT NULL,
      PRIMARY KEY (story_id, viewer)
    )
  `);

  // 🐱 Стикеры (свои + из видео)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT DEFAULT 'image',
      emoji TEXT,
      time INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE stickers ADD COLUMN type TEXT DEFAULT 'image'`).catch(() => {});
  await db.execute(`ALTER TABLE stickers ADD COLUMN emoji TEXT`).catch(() => {});

  console.log(`✅ База данных готова за ${Date.now() - start}мс`);
}

async function getUser(username) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  return r.rows[0] || null;
}
async function getSettings(username) {
  await db.execute({ sql: 'INSERT OR IGNORE INTO user_settings (username) VALUES (?)', args: [username] });
  const r = await db.execute({ sql: 'SELECT * FROM user_settings WHERE username = ?', args: [username] });
  return r.rows[0] || {};
}
async function getContactsOf(username) {
  const r = await db.execute({
    sql: 'SELECT contact, display_name FROM contacts WHERE owner = ? ORDER BY added_at ASC',
    args: [username]
  });
  return r.rows.map(row => ({ contact: row.contact, display_name: row.display_name }));
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
  try { const obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : {}; }
  catch (e) { return {}; }
}
async function getHistory(me, withUser) {
  const r = await db.execute({
    sql: `SELECT * FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY time ASC LIMIT 300`,
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
async function isBlocked(blocker, blocked) {
  const r = await db.execute({ sql: 'SELECT 1 FROM blocks WHERE blocker = ? AND blocked = ?', args: [blocker, blocked] });
  return r.rows.length > 0;
}
async function isBlockedEither(a, b) {
  return (await isBlocked(a, b)) || (await isBlocked(b, a));
}
async function cleanupOldMessages() {
  try {
    const r = await db.execute("SELECT username, auto_delete FROM user_settings WHERE auto_delete != 'off'");
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    for (const row of r.rows) {
      const ttl = row.auto_delete === '24h' ? DAY : row.auto_delete === '7d' ? 7 * DAY : row.auto_delete === '30d' ? 30 * DAY : 0;
      if (ttl === 0) continue;
      const cutoff = now - ttl;
      await db.execute({
        sql: 'UPDATE messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, video_circle = NULL, sticker = NULL WHERE (from_user = ? OR to_user = ?) AND time < ? AND deleted = 0',
        args: [row.username, row.username, cutoff]
      });
      await db.execute({
        sql: 'UPDATE group_messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, video_circle = NULL, sticker = NULL WHERE from_user = ? AND time < ? AND deleted = 0',
        args: [row.username, cutoff]
      });
    }
    await cleanupExpiredStories();
  } catch (e) { console.error('cleanup error:', e); }
}
async function cleanupExpiredStories() {
  try {
    const now = Date.now();
    const r = await db.execute({ sql: 'SELECT id, image FROM stories WHERE expires_at < ?', args: [now] });
    for (const row of r.rows) {
      if (row.image && row.image.startsWith('/stories/')) {
        const fname = row.image.replace('/stories/', '');
        const fpath = path.join(STORIES_DIR, fname);
        try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
      }
    }
    await db.execute({ sql: 'DELETE FROM stories WHERE expires_at < ?', args: [now] });
    await db.execute({ sql: 'DELETE FROM story_views WHERE story_id NOT IN (SELECT id FROM stories)' }).catch(() => {});
  } catch (e) { console.error('cleanup stories error:', e); }
}
async function getActiveStories(viewer) {
  const now = Date.now();
  const contactsR = await db.execute({ sql: 'SELECT contact FROM contacts WHERE owner = ?', args: [viewer] });
  const allowedUsers = contactsR.rows.map(r => r.contact);
  allowedUsers.push(viewer);

  if (allowedUsers.length === 0) return [];
  const placeholders = allowedUsers.map(() => '?').join(',');
  const r = await db.execute({
    sql: `SELECT s.*, u.avatar, u.verified, u.first_name, u.last_name FROM stories s
          LEFT JOIN users u ON u.username = s.username
          WHERE s.username IN (${placeholders}) AND s.expires_at > ?
          ORDER BY s.time ASC`,
    args: [...allowedUsers, now]
  });

  const byUser = {};
  for (const row of r.rows) {
    if (!byUser[row.username]) {
      byUser[row.username] = {
        username: row.username,
        avatar: row.avatar,
        verified: !!row.verified,
        firstName: row.first_name,
        lastName: row.last_name,
        stories: []
      };
    }
    const viewedR = await db.execute({ sql: 'SELECT 1 FROM story_views WHERE story_id = ? AND viewer = ?', args: [row.id, viewer] });
    byUser[row.username].stories.push({
      id: row.id, image: row.image, caption: row.caption,
      time: row.time, expires_at: row.expires_at,
      viewed: viewedR.rows.length > 0
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
    const fname = story.image.replace('/stories/', '');
    const fpath = path.join(STORIES_DIR, fname);
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
    args: [username, url, type || 'image', emoji || null, Date.now()]
  });
  return Number(r.lastInsertRowid);
}
async function deleteSticker(id, username) {
  const r = await db.execute({ sql: 'SELECT url FROM stickers WHERE id = ? AND username = ?', args: [id, username] });
  if (r.rows[0]) {
    const url = r.rows[0].url;
    if (url && url.startsWith('/stickers/')) {
      const fname = url.replace('/stickers/', '');
      const fpath = path.join(STICKERS_DIR, fname);
      try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
    }
  }
  await db.execute({ sql: 'DELETE FROM stickers WHERE id = ? AND username = ?', args: [id, username] });
}
async function createSession(username, device, ip) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await db.execute({
    sql: 'INSERT INTO sessions (id, username, device, ip, last_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, username, device || 'Web', ip || '', Date.now(), Date.now()]
  });
  return id;
}
async function updateSession(sessionId) {
  if (!sessionId) return;
  await db.execute({ sql: 'UPDATE sessions SET last_active = ? WHERE id = ?', args: [Date.now(), sessionId] });
}
async function getUserSessions(username) {
  const r = await db.execute({ sql: 'SELECT * FROM sessions WHERE username = ? ORDER BY last_active DESC', args: [username] });
  return r.rows;
}
async function getChatSettings(owner, chatKey) {
  const r = await db.execute({ sql: 'SELECT * FROM chat_settings WHERE owner = ? AND chat_key = ?', args: [owner, chatKey] });
  return r.rows[0] || { archived: 0, muted: 0 };
}
async function setChatSetting(owner, chatKey, field, value) {
  const FIELD_MAP = { archived: 'archived', muted: 'muted' };
  const col = FIELD_MAP[field];
  if (!col) throw new Error('Invalid field');
  await db.execute({ sql: 'INSERT OR IGNORE INTO chat_settings (owner, chat_key, archived, muted) VALUES (?, ?, 0, 0)', args: [owner, chatKey] });
  await db.execute({ sql: `UPDATE chat_settings SET ${col} = ? WHERE owner = ? AND chat_key = ?`, args: [value, owner, chatKey] });
}
async function getGroupById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM groups_table WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
async function getGroupMembers(groupId) {
  const r = await db.execute({ sql: 'SELECT username FROM group_members WHERE group_id = ? ORDER BY joined_at ASC', args: [groupId] });
  return r.rows.map(row => row.username);
}
async function getUserGroups(username) {
  const r = await db.execute({
    sql: `SELECT g.* FROM groups_table g INNER JOIN group_members gm ON g.id = gm.group_id WHERE gm.username = ? ORDER BY g.created_at ASC`,
    args: [username]
  });
  return r.rows;
}
async function isGroupMember(groupId, username) {
  const r = await db.execute({ sql: 'SELECT 1 FROM group_members WHERE group_id = ? AND username = ?', args: [groupId, username] });
  return r.rows.length > 0;
}
async function countUserCreatedGroups(username) {
  const r = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM groups_table WHERE creator = ?', args: [username] });
  return Number(r.rows[0]?.cnt || 0);
}

const onlineUsers = {};
function findSocketsByUsername(username) {
  return Object.entries(onlineUsers).filter(([, u]) => u === username).map(([sid]) => sid);
}
function isOnline(username) {
  return Object.values(onlineUsers).includes(username);
}
async function sendContactsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  const contactRows = await getContactsOf(username);
  const list = [];
  for (const row of contactRows) {
    const info = await getContactInfo(row.contact);
    const settings = await getChatSettings(username, row.contact);
    const blockedByMe = await isBlocked(username, row.contact);
    let online = isOnline(row.contact);
    let lastSeenVisible = true;
    if (info && info.last_seen_visibility === 'nobody') lastSeenVisible = false;
    list.push({
      name: row.contact, displayName: row.display_name || row.contact,
      avatar: info ? info.avatar : null, verified: info ? !!info.verified : false,
      firstName: info ? info.first_name : null, lastName: info ? info.last_name : null,
      emojiStatus: info ? info.emoji_status : null,
      online: lastSeenVisible ? online : false,
      archived: !!settings.archived, muted: !!settings.muted, blocked: blockedByMe
    });
  }
  sockets.forEach(sid => io.to(sid).emit('contacts', list));
}
async function sendGroupsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  const groups = await getUserGroups(username);
  const list = [];
  for (const g of groups) {
    const members = await getGroupMembers(g.id);
    const settings = await getChatSettings(username, 'g:' + g.id);
    list.push({
      id: g.id, name: g.name, avatar: g.avatar, creator: g.creator,
      description: g.description, pinnedMessageId: g.pinned_message_id,
      members, memberCount: members.length,
      archived: !!settings.archived, muted: !!settings.muted
    });
  }
  const createdCount = await countUserCreatedGroups(username);
  sockets.forEach(sid => io.to(sid).emit('groups', list, { canCreate: createdCount < 1, createdCount }));
}
async function refreshForFriends(username) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) await sendContactsTo(row.owner);
}
async function notifyAllFriends(username, event, payload) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit(event, payload));
}
async function notifyGroupMembers(groupId, event, payload) {
  const members = await getGroupMembers(groupId);
  members.forEach(u => findSocketsByUsername(u).forEach(sid => io.to(sid).emit(event, payload)));
}

io.on('connection', (socket) => {
  console.log('🔗 Подключился:', socket.id);

  socket.on('register', async ({ username, password }, cb) => {
    try {
      if (!rateLimit('reg:' + socket.handshake.address, 5, 60_000)) return cb && cb({ ok: false, error: 'Слишком много попыток. Подожди минуту.' });
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      if (!username || !password) return cb && cb({ ok: false, error: 'Заполни все поля' });
      if (username.length < 3) return cb && cb({ ok: false, error: 'Ник минимум 3 символа' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: false, error: 'Только латиница, цифры и _' });
      if (password.length < 4) return cb && cb({ ok: false, error: 'Пароль минимум 4 символа' });
      if (await getUser(username)) return cb && cb({ ok: false, error: 'Такой ник уже занят' });
      const hash = bcrypt.hashSync(password, 10);
      await db.execute({
        sql: 'INSERT INTO users (username, password, avatar, verified, bio, first_name, last_name, birthday, emoji_status, last_seen_visibility, phone, registered_at) VALUES (?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL, \'everyone\', NULL, ?)',
        args: [username, hash, null, Date.now()]
      });
      await getSettings(username);
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('login', async ({ username, password, device, sessionId }, cb) => {
    try {
      if (!rateLimit('login:' + socket.handshake.address, 10, 60_000)) return cb && cb({ ok: false, error: 'Слишком много попыток. Подожди минуту.' });
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      const user = await getUser(username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (!bcrypt.compareSync(password, user.password)) return cb && cb({ ok: false, error: 'Неверный пароль' });
      onlineUsers[socket.id] = username;
      socket.username = username;
      let sessId = sessionId;
      if (sessId) {
        const r = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [sessId] });
        if (r.rows.length === 0) sessId = await createSession(username, device, socket.handshake.address);
        else await updateSession(sessId);
      } else sessId = await createSession(username, device, socket.handshake.address);
      socket.sessionId = sessId;
      const settings = await getSettings(username);
      cb && cb({ ok: true, avatar: user.avatar, username, verified: !!user.verified, bio: user.bio, sessionId: sessId });
      await sendContactsTo(username);
      await sendGroupsTo(username);
      await refreshForFriends(username);
      socket.emit('settings', settings);
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('set avatar', async ({ avatar }) => {
    if (!socket.username || !avatar) return;
    if (!validImage(avatar)) return;
    await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE username = ?', args: [avatar, socket.username] });
    await refreshForFriends(socket.username);
    await notifyAllFriends(socket.username, 'friend updated', { username: socket.username, avatar });
  });

  socket.on('update profile', async ({ firstName, lastName, bio, birthday, emojiStatus }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      firstName = firstName !== undefined ? String(firstName).slice(0, 40) : undefined;
      lastName = lastName !== undefined ? String(lastName).slice(0, 40) : undefined;
      bio = bio !== undefined ? String(bio).slice(0, 200) : undefined;
      birthday = birthday !== undefined ? String(birthday).slice(0, 20) : undefined;
      emojiStatus = emojiStatus !== undefined ? String(emojiStatus).slice(0, 10) : undefined;
      const updates = [], args = [];
      if (firstName !== undefined) { updates.push('first_name = ?'); args.push(firstName || null); }
      if (lastName !== undefined) { updates.push('last_name = ?'); args.push(lastName || null); }
      if (bio !== undefined) { updates.push('bio = ?'); args.push(bio || null); }
      if (birthday !== undefined) { updates.push('birthday = ?'); args.push(birthday || null); }
      if (emojiStatus !== undefined) { updates.push('emoji_status = ?'); args.push(emojiStatus || null); }
      if (updates.length === 0) return cb && cb({ ok: true });
      args.push(socket.username);
      await db.execute({ sql: `UPDATE users SET ${updates.join(', ')} WHERE username = ?`, args });
      await refreshForFriends(socket.username);
      await notifyAllFriends(socket.username, 'friend updated', { username: socket.username });
      const user = await getUser(socket.username);
      socket.emit('me updated', { firstName: user.first_name, lastName: user.last_name, bio: user.bio, birthday: user.birthday, emojiStatus: user.emoji_status, avatar: user.avatar, verified: !!user.verified });
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('get settings', async () => { if (socket.username) socket.emit('settings', await getSettings(socket.username)); });

  socket.on('update settings', async ({ key, value }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const allowed = ['theme', 'language', 'font_size', 'accent_color', 'animations', 'sound', 'vibration', 'notif_private', 'notif_groups', 'auto_delete', 'profile_color', 'chat_wallpaper', 'premium'];
      if (!allowed.includes(key)) return cb && cb({ ok: false });
      await db.execute({ sql: `UPDATE user_settings SET ${key} = ? WHERE username = ?`, args: [value, socket.username] });
      socket.emit('settings', await getSettings(socket.username));
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // 🔒 ГАЛОЧКИ
  socket.on('verify', async ({ username }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (socket.username !== ADMIN_USERNAME) return cb && cb({ ok: false, error: 'Только ' + ADMIN_USERNAME + ' может выдавать галочки' });
      username = String(username || '').trim().toLowerCase();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      const target = await getUser(username);
      if (!target) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (target.verified) return cb && cb({ ok: false, error: 'У него уже есть галочка' });
      await db.execute({ sql: 'UPDATE users SET verified = 1 WHERE username = ?', args: [username] });
      await refreshForFriends(username);
      await notifyAllFriends(username, 'friend updated', { username, verified: true });
      if (username === socket.username) socket.emit('me updated', { verified: true, username });
      cb && cb({ ok: true, username });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('unverify', async ({ username }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (socket.username !== ADMIN_USERNAME) return cb && cb({ ok: false, error: 'Только ' + ADMIN_USERNAME });
      username = String(username || '').trim().toLowerCase();
      const target = await getUser(username);
      if (!target) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      await db.execute({ sql: 'UPDATE users SET verified = 0 WHERE username = ?', args: [username] });
      await refreshForFriends(username);
      await notifyAllFriends(username, 'friend updated', { username, verified: false });
      if (username === socket.username) socket.emit('me updated', { verified: false, username });
      cb && cb({ ok: true, username });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('set passcode', async ({ passcode }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (passcode && passcode.length < 4) return cb && cb({ ok: false, error: 'Минимум 4 символа' });
      const hash = passcode ? bcrypt.hashSync(passcode, 10) : null;
      await db.execute({ sql: 'UPDATE user_settings SET passcode = ? WHERE username = ?', args: [hash, socket.username] });
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
  socket.on('set last seen visibility', async ({ value }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    if (!['everyone', 'contacts', 'nobody'].includes(value)) return cb && cb({ ok: false });
    await db.execute({ sql: 'UPDATE users SET last_seen_visibility = ? WHERE username = ?', args: [value, socket.username] });
    cb && cb({ ok: true });
  });
  socket.on('block user', async ({ username }, cb) => {
    try {
      if (!socket.username || username === socket.username) return cb && cb({ ok: false });
      await db.execute({ sql: 'INSERT OR REPLACE INTO blocks (blocker, blocked, time) VALUES (?, ?, ?)', args: [socket.username, username, Date.now()] });
      await sendContactsTo(socket.username);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('unblock user', async ({ username }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    await db.execute({ sql: 'DELETE FROM blocks WHERE blocker = ? AND blocked = ?', args: [socket.username, username] });
    await sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });
  socket.on('get blocked', async (cb) => {
    if (!socket.username) return cb && cb([]);
    const r = await db.execute({ sql: 'SELECT blocked FROM blocks WHERE blocker = ?', args: [socket.username] });
    cb && cb(r.rows.map(row => row.blocked));
  });
  socket.on('get sessions', async (cb) => {
    if (!socket.username) return cb && cb([]);
    cb && cb(await getUserSessions(socket.username));
  });
  socket.on('terminate session', async ({ sessionId }, cb) => {
    if (!socket.username) return cb && cb({ ok: false });
    Object.entries(onlineUsers).forEach(([sid]) => {
      if (sid !== socket.id) {
        const s = io.sockets.sockets.get(sid);
        if (s && s.username === socket.username && s.sessionId === sessionId) { s.emit('session terminated'); s.disconnect(true); }
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
        if (s && s.username === socket.username) { s.emit('session terminated'); s.disconnect(true); }
      }
    });
    await db.execute({ sql: 'DELETE FROM sessions WHERE username = ? AND id != ?', args: [socket.username, socket.sessionId || ''] });
    cb && cb({ ok: true });
  });
  socket.on('delete account', async ({ password }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const user = await getUser(socket.username);
      if (!user || !bcrypt.compareSync(password, user.password)) return cb && cb({ ok: false, error: 'Неверный пароль' });
      const me = socket.username;
      await db.execute({ sql: 'DELETE FROM messages WHERE from_user = ? OR to_user = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM group_messages WHERE from_user = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM group_members WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM groups_table WHERE creator = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? OR contact = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM chat_settings WHERE owner = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM blocks WHERE blocker = ? OR blocked = ?', args: [me, me] });
      await db.execute({ sql: 'DELETE FROM sessions WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM user_settings WHERE username = ?', args: [me] });
      // Истории
      const myStories = await db.execute({ sql: 'SELECT id, image FROM stories WHERE username = ?', args: [me] });
      for (const s of myStories.rows) {
        if (s.image && s.image.startsWith('/stories/')) {
          const fpath = path.join(STORIES_DIR, s.image.replace('/stories/', ''));
          try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
        }
      }
      await db.execute({ sql: 'DELETE FROM stories WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM story_views WHERE viewer = ?', args: [me] });
      // Стикеры
      const myStickers = await db.execute({ sql: 'SELECT url FROM stickers WHERE username = ?', args: [me] });
      for (const s of myStickers.rows) {
        if (s.url && s.url.startsWith('/stickers/')) {
          const fpath = path.join(STICKERS_DIR, s.url.replace('/stickers/', ''));
          try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch (e) {}
        }
      }
      await db.execute({ sql: 'DELETE FROM stickers WHERE username = ?', args: [me] });
      await db.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [me] });
      socket.emit('account deleted');
      socket.disconnect(true);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });

  socket.on('add contact', async ({ username, displayName }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      username = String(username || '').trim().toLowerCase();
      displayName = String(displayName || '').trim();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      if (!displayName) return cb && cb({ ok: false, error: 'Введи имя' });
      if (username === socket.username) return cb && cb({ ok: false, error: 'Это твой ник' });
      if (!(await getUser(username))) return cb && cb({ ok: false, error: 'Такого пользователя нет' });
      await db.execute({ sql: 'INSERT OR REPLACE INTO contacts (owner, contact, display_name, added_at) VALUES (?, ?, ?, ?)', args: [socket.username, username, displayName, Date.now()] });
      await sendContactsTo(socket.username);
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('remove contact', async ({ username }, cb) => {
    if (!socket.username) return;
    await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? AND contact = ?', args: [socket.username, username] });
    await sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });
  socket.on('get profile', async ({ username }, cb) => {
    if (!socket.username) return cb && cb(null);
    const info = await getContactInfo(username);
    if (!info) return cb && cb(null);
    let lastSeenVisible = info.last_seen_visibility !== 'nobody';
    const blockedByMe = await isBlocked(socket.username, username);
    const blockedMe = await isBlocked(username, socket.username);
    cb && cb({
      username: info.username, avatar: info.avatar, verified: !!info.verified,
      bio: info.bio, firstName: info.first_name, lastName: info.last_name,
      emojiStatus: info.emoji_status, online: lastSeenVisible && isOnline(username),
      blockedByMe, blockedMe
    });
  });
  socket.on('get public profile', async ({ username }, cb) => {
    if (!socket.username) return cb && cb(null);
    const info = await getContactInfo(username);
    if (!info) return cb && cb(null);
    cb && cb({
      username: info.username, avatar: info.avatar, verified: !!info.verified,
      bio: info.bio, firstName: info.first_name, lastName: info.last_name, emojiStatus: info.emoji_status
    });
  });
  socket.on('toggle archive', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.archived ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'archived', newVal);
    await sendContactsTo(socket.username);
    await sendGroupsTo(socket.username);
    cb && cb({ ok: true, archived: !!newVal });
  });
  socket.on('toggle mute', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.muted ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'muted', newVal);
    await sendContactsTo(socket.username);
    await sendGroupsTo(socket.username);
    cb && cb({ ok: true, muted: !!newVal });
  });
  socket.on('load history', async ({ withUser }) => {
    if (!socket.username) return;
    try {
      const rows = await getHistory(socket.username, withUser);
      const messages = [];
      for (const m of rows) {
        let replyData = null;
        if (m.reply_to) {
          const r = await getMessageById(m.reply_to);
          if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
        }
        messages.push({ ...m, reactions: safeParseReactions(m.reactions), replyData });
      }
      socket.emit('history', { withUser, messages });
    } catch (e) { console.error(e); }
  });
  socket.on('load saved history', async () => {
    if (!socket.username) return;
    try {
      const me = socket.username;
      const r = await db.execute({ sql: 'SELECT * FROM messages WHERE from_user = ? AND to_user = ? ORDER BY time ASC LIMIT 300', args: [me, me] });
      const messages = [];
      for (const m of r.rows) messages.push({ ...m, reactions: safeParseReactions(m.reactions), replyData: null });
      socket.emit('saved history', { messages });
    } catch (e) { console.error(e); }
  });
  socket.on('save to saved', async ({ originalMessageId, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      let origMsg;
      if (isGroup) origMsg = await getGroupMessageById(originalMessageId);
      else origMsg = await getMessageById(originalMessageId);
      if (!origMsg) return cb && cb({ ok: false, error: 'Сообщение не найдено' });
      const me = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO messages (from_user, to_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', NULL, 0, 0, ?, ?)`,
        args: [me, me, origMsg.text || null, origMsg.image || null, origMsg.voice || null, origMsg.voice_duration || null, origMsg.video_circle || null, origMsg.video_duration || null, origMsg.sticker || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      const newMsg = await getMessageById(msgId);
      if (newMsg) {
        socket.emit('private message', {
          id: newMsg.id, from: me, to: me,
          text: newMsg.text, image: newMsg.image, voice: newMsg.voice,
          voiceDuration: newMsg.voice_duration,
          videoCircle: newMsg.video_circle, videoDuration: newMsg.video_duration,
          sticker: newMsg.sticker,
          reactions: {}, time: newMsg.time, self: true, saved: true
        });
      }
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('private message', async ({ to, text, image, voice, voiceDuration, videoCircle, videoDuration, replyTo, sticker }) => {
    if (!socket.username) return;
    if (!rateLimit('pm:' + socket.username, 30, 10_000)) { socket.emit('message blocked', { reason: 'Слишком часто. Подожди.' }); return; }
    if (text && text.length > MAX_TEXT) return socket.emit('message blocked', { reason: 'Слишком длинное сообщение' });
    if (image && !validImage(image)) return socket.emit('message blocked', { reason: 'Недопустимое изображение' });
    if (voice && !validVoice(voice)) return socket.emit('message blocked', { reason: 'Недопустимое голосовое' });
    if (videoCircle && !validVideo(videoCircle)) return socket.emit('message blocked', { reason: 'Недопустимый кружок' });
    if (await isBlockedEither(socket.username, to)) { socket.emit('message blocked', { reason: 'Пользователь заблокирован' }); return; }
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO messages (from_user, to_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?, ?)`,
        args: [from, to, text || null, image || null, voice || null, voiceDuration || null, videoCircle || null, videoDuration || null, replyTo || null, sticker || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      let replyData = null;
      if (replyTo) {
        const r = await getMessageById(replyTo);
        if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
      }
      const payload = { id: msgId, from, text, image, voice, voiceDuration, videoCircle, videoDuration, sticker, reactions: {}, replyData, time, read: false };
      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
      socket.emit('private message', { ...payload, self: true, to });
    } catch (e) { console.error(e); }
  });

  socket.on('edit message', async ({ messageId, text, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (isGroup) {
        const msg = await getGroupMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE group_messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        await notifyGroupMembers(msg.group_id, 'message edited', { messageId, text, isGroup: true });
      } else {
        const msg = await getMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        const payload = { messageId, text, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message edited', payload));
        socket.emit('message edited', payload);
      }
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
        if (msg.from_user !== socket.username && group?.creator !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE group_messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, video_circle = NULL, sticker = NULL WHERE id = ?', args: [messageId] });
        await notifyGroupMembers(msg.group_id, 'message deleted', { messageId, isGroup: true });
      } else {
        const msg = await getMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false });
        await db.execute({ sql: 'UPDATE messages SET deleted = 1, text = NULL, image = NULL, voice = NULL, video_circle = NULL, sticker = NULL WHERE id = ?', args: [messageId] });
        const payload = { messageId, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message deleted', payload));
        socket.emit('message deleted', payload);
      }
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('mark read', async ({ withUser }) => {
    if (!socket.username) return;
    await db.execute({
      sql: 'UPDATE messages SET read_at = ? WHERE from_user = ? AND to_user = ? AND read_at IS NULL',
      args: [Date.now(), withUser, socket.username]
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
      if (idx === -1) reactions[emoji].push(me);
      else { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
      await db.execute({ sql: 'UPDATE messages SET reactions = ? WHERE id = ?', args: [JSON.stringify(reactions), messageId] });
      const payload = { messageId, reactions, from: msg.from_user, to: msg.to_user };
      const targets = new Set([msg.from_user, msg.to_user]);
      targets.forEach(u => findSocketsByUsername(u).forEach(sid => io.to(sid).emit('reaction updated', payload)));
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('create group', async ({ name, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const createdCount = await countUserCreatedGroups(socket.username);
      if (createdCount >= 1) return cb && cb({ ok: false, error: 'Ты уже создал группу. Максимум — одна.' });
      name = String(name || '').trim();
      if (!name) return cb && cb({ ok: false, error: 'Введи название' });
      members = Array.isArray(members) ? members : [];
      const now = Date.now();
      const r = await db.execute({ sql: 'INSERT INTO groups_table (name, creator, avatar, created_at) VALUES (?, ?, NULL, ?)', args: [name, socket.username, now] });
      const groupId = Number(r.lastInsertRowid);
      await db.execute({ sql: 'INSERT INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)', args: [groupId, socket.username, now] });
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu || mu === socket.username) continue;
        await db.execute({ sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)', args: [groupId, mu, Date.now()] });
      }
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);
      cb && cb({ ok: true, groupId });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('add group members', async ({ groupId, members }, cb) => {
    try {
      if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
      members = Array.isArray(members) ? members : [];
      const added = [];
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu || await isGroupMember(groupId, mu)) continue;
        await db.execute({ sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)', args: [groupId, mu, Date.now()] });
        added.push(mu);
      }
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);
      await notifyGroupMembers(groupId, 'group updated', { groupId });
      cb && cb({ ok: true, added });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('leave group', async ({ groupId }, cb) => {
    if (!socket.username) return;
    await db.execute({ sql: 'DELETE FROM group_members WHERE group_id = ? AND username = ?', args: [groupId, socket.username] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) await sendGroupsTo(u);
    await sendGroupsTo(socket.username);
    await notifyGroupMembers(groupId, 'group updated', { groupId });
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
      for (const u of members) { await sendGroupsTo(u); findSocketsByUsername(u).forEach(sid => io.to(sid).emit('group deleted', { groupId })); }
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('update group', async ({ groupId, name, description }, cb) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    if (name) await db.execute({ sql: 'UPDATE groups_table SET name = ? WHERE id = ?', args: [String(name).slice(0, 60), groupId] });
    if (typeof description === 'string') await db.execute({ sql: 'UPDATE groups_table SET description = ? WHERE id = ?', args: [description.slice(0, 200), groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) await sendGroupsTo(u);
    cb && cb({ ok: true });
  });
  socket.on('pin message', async ({ groupId, messageId }, cb) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    await db.execute({ sql: 'UPDATE groups_table SET pinned_message_id = ? WHERE id = ?', args: [messageId, groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) await sendGroupsTo(u);
    await notifyGroupMembers(groupId, 'group updated', { groupId });
    cb && cb({ ok: true });
  });
  socket.on('load group history', async ({ groupId }) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return;
    try {
      const rows = await getGroupHistory(groupId);
      const messages = [];
      for (const m of rows) {
        let replyData = null;
        if (m.reply_to) {
          const r = await getGroupMessageById(m.reply_to);
          if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
        }
        messages.push({ ...m, reactions: safeParseReactions(m.reactions), replyData });
      }
      socket.emit('group history', { groupId, messages });
    } catch (e) { console.error(e); }
  });
  socket.on('group message', async ({ groupId, text, image, voice, voiceDuration, videoCircle, videoDuration, replyTo, sticker }) => {
    if (!socket.username || !await isGroupMember(groupId, socket.username)) return;
    if (!rateLimit('gm:' + socket.username, 30, 10_000)) { socket.emit('message blocked', { reason: 'Слишком часто в группах.' }); return; }
    if (text && text.length > MAX_TEXT) return socket.emit('message blocked', { reason: 'Слишком длинное сообщение' });
    if (image && !validImage(image)) return socket.emit('message blocked', { reason: 'Недопустимое изображение' });
    if (voice && !validVoice(voice)) return socket.emit('message blocked', { reason: 'Недопустимое голосовое' });
    if (videoCircle && !validVideo(videoCircle)) return socket.emit('message blocked', { reason: 'Недопустимый кружок' });
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO group_messages (group_id, from_user, text, image, voice, voice_duration, video_circle, video_duration, reactions, reply_to, edited, deleted, sticker, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?, ?)`,
        args: [groupId, from, text || null, image || null, voice || null, voiceDuration || null, videoCircle || null, videoDuration || null, replyTo || null, sticker || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      let replyData = null;
      if (replyTo) {
        const r = await getGroupMessageById(replyTo);
        if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
      }
      const payload = { id: msgId, groupId, from, text, image, voice, voiceDuration, videoCircle, videoDuration, sticker, reactions: {}, replyData, time, self: false };
      await notifyGroupMembers(groupId, 'group message', payload);
      socket.emit('group message', { ...payload, self: true });
    } catch (e) { console.error(e); }
  });
  socket.on('group typing', ({ groupId, isTyping }) => {
    if (!socket.username) return;
    getGroupMembers(groupId).then(members => {
      members.forEach(u => {
        if (u === socket.username) return;
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('group typing', { groupId, from: socket.username, isTyping }));
      });
    });
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
      if (idx === -1) reactions[emoji].push(me);
      else { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
      await db.execute({ sql: 'UPDATE group_messages SET reactions = ? WHERE id = ?', args: [JSON.stringify(reactions), messageId] });
      await notifyGroupMembers(groupId, 'group reaction updated', { groupId, messageId, reactions });
      cb && cb({ ok: true });
    } catch (e) { cb && cb({ ok: false }); }
  });
  socket.on('search messages', async ({ query, withUser, groupId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, results: [] });
      query = String(query || '').trim();
      if (!query || query.length < 2) return cb && cb({ ok: true, results: [] });
      let rows = [];
      if (groupId) {
        const r = await db.execute({ sql: `SELECT * FROM group_messages WHERE group_id = ? AND deleted = 0 AND text LIKE ? ORDER BY time DESC LIMIT 50`, args: [groupId, '%' + query + '%'] });
        rows = r.rows;
      } else if (withUser) {
        const r = await db.execute({ sql: `SELECT * FROM messages WHERE deleted = 0 AND text LIKE ? AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)) ORDER BY time DESC LIMIT 50`, args: ['%' + query + '%', socket.username, withUser, withUser, socket.username] });
        rows = r.rows;
      }
      cb && cb({ ok: true, results: rows });
    } catch (e) { cb && cb({ ok: false, results: [] }); }
  });

  // ═══════════════════════════════════════════
  // 📸 ИСТОРИИ
  // ═══════════════════════════════════════════
  socket.on('load stories', async (cb) => {
    if (!socket.username) return cb && cb({ ok: false, users: [] });
    try {
      const users = await getActiveStories(socket.username);
      cb && cb({ ok: true, users, me: socket.username });
    } catch (e) { console.error(e); cb && cb({ ok: false, users: [] }); }
  });

  socket.on('post story', async ({ image, caption }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (!image || typeof image !== 'string') return cb && cb({ ok: false, error: 'Нет картинки' });
      let imagePath = image;
      if (image.startsWith('data:image/')) {
        const m = image.match(/^data:image\/([a-z]+);base64,(.+)$/i);
        if (!m) return cb && cb({ ok: false, error: 'Неверный формат' });
        const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length > 5_000_000) return cb && cb({ ok: false, error: 'Слишком большая картинка' });
        const fname = `${socket.username}_${Date.now()}.${ext}`;
        const fpath = path.join(STORIES_DIR, fname);
        fs.writeFileSync(fpath, buf);
        imagePath = '/stories/' + fname;
      }
      const now = Date.now();
      const expires = now + 24 * 60 * 60 * 1000;
      const cap = caption ? String(caption).slice(0, 200) : null;
      const r = await db.execute({
        sql: 'INSERT INTO stories (username, image, caption, time, expires_at) VALUES (?, ?, ?, ?, ?)',
        args: [socket.username, imagePath, cap, now, expires]
      });
      const storyId = Number(r.lastInsertRowid);
      const contactsR = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [socket.username] });
      const payload = { id: storyId, username: socket.username, image: imagePath, caption: cap, time: now, expires_at: expires };
      contactsR.rows.forEach(row => {
        findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit('story new', payload));
      });
      cb && cb({ ok: true, id: storyId, image: imagePath });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
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
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('view story', async ({ storyId }) => {
    try {
      if (!socket.username) return;
      await db.execute({ sql: 'INSERT OR IGNORE INTO story_views (story_id, viewer, time) VALUES (?, ?, ?)', args: [storyId, socket.username, Date.now()] });
      const r = await db.execute({ sql: 'SELECT username FROM stories WHERE id = ?', args: [storyId] });
      if (r.rows[0]) findSocketsByUsername(r.rows[0].username).forEach(sid => io.to(sid).emit('story viewed', { storyId, viewer: socket.username }));
    } catch (e) { console.error(e); }
  });

  socket.on('get story views', async ({ storyId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, viewers: [] });
      const r = await db.execute({ sql: 'SELECT username FROM stories WHERE id = ?', args: [storyId] });
      if (!r.rows[0] || r.rows[0].username !== socket.username) return cb && cb({ ok: false });
      const views = await db.execute({ sql: 'SELECT viewer, time FROM story_views WHERE story_id = ? ORDER BY time DESC', args: [storyId] });
      cb && cb({ ok: true, viewers: views.rows });
    } catch (e) { cb && cb({ ok: false, viewers: [] }); }
  });

  // ═══════════════════════════════════════════
  // 🐱 СТИКЕРЫ (image + video/gif)
  // ═══════════════════════════════════════════
  socket.on('load stickers', async (cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, stickers: [] });
      const rows = await getUserStickers(socket.username);
      cb && cb({ ok: true, stickers: rows });
    } catch (e) { console.error(e); cb && cb({ ok: false, stickers: [] }); }
  });

  socket.on('add sticker', async ({ data, type, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (!data || typeof data !== 'string') return cb && cb({ ok: false, error: 'Нет данных' });
      if (!validStickerData(data)) return cb && cb({ ok: false, error: 'Файл больше 4MB или неверный формат' });

      let url = data;
      // Если base64 — сохраняем в файл
      if (data.startsWith('data:')) {
        const m = data.match(/^data:(image|video)\/([a-z0-9+.-]+);base64,(.+)$/i);
        if (!m) return cb && cb({ ok: false, error: 'Неверный формат' });
        const kind = m[1];
        const ext = m[2] === 'jpeg' ? 'jpg' : (m[2] === 'quicktime' ? 'mov' : m[2]);
        const buf = Buffer.from(m[3], 'base64');
        const fname = `sticker_${socket.username}_${Date.now()}.${ext}`;
        const fpath = path.join(STICKERS_DIR, fname);
        fs.writeFileSync(fpath, buf);
        url = '/stickers/' + fname;
        type = type || (kind === 'video' ? 'video' : 'image');
      } else {
        type = type || 'image';
      }

      const id = await addSticker(socket.username, url, type, emoji || null);
      cb && cb({ ok: true, id, url, type });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
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
      if (!socket.username) return cb && cb({ ok: false });
      if (!url) return cb && cb({ ok: false });
      const from = socket.username;
      const time = Date.now();
      const stickerType = type || 'image';

      if (groupId) {
        if (!await isGroupMember(groupId, from)) return cb && cb({ ok: false });
        const result = await db.execute({
          sql: `INSERT INTO group_messages (group_id, from_user, sticker, reactions, reply_to, edited, deleted, time) VALUES (?, ?, ?, '{}', NULL, 0, 0, ?)`,
          args: [groupId, from, url, time]
        });
        const msgId = Number(result.lastInsertRowid);
        const payload = { id: msgId, groupId, from, sticker: url, stickerType, reactions: {}, replyData: null, time, self: false };
        await notifyGroupMembers(groupId, 'group message', payload);
        socket.emit('group message', { ...payload, self: true });
        cb && cb({ ok: true, id: msgId });
      } else if (to) {
        if (await isBlockedEither(from, to)) return cb && cb({ ok: false, error: 'Заблокирован' });
        const result = await db.execute({
          sql: `INSERT INTO messages (from_user, to_user, sticker, reactions, reply_to, edited, deleted, time) VALUES (?, ?, ?, '{}', NULL, 0, 0, ?)`,
          args: [from, to, url, time]
        });
        const msgId = Number(result.lastInsertRowid);
        const payload = { id: msgId, from, to, sticker: url, stickerType, reactions: {}, replyData: null, time };
        findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
        socket.emit('private message', { ...payload, self: true });
        cb && cb({ ok: true, id: msgId });
      } else {
        cb && cb({ ok: false });
      }
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('disconnect', async () => {
    const u = socket.username;
    delete onlineUsers[socket.id];
    if (u) {
      await sendContactsTo(u);
      await refreshForFriends(u);
      Object.values(onlineUsers).forEach(other => findSocketsByUsername(other).forEach(sid => io.to(sid).emit('typing', { from: u, isTyping: false })));
    }
  });
});

setInterval(cleanupOldMessages, 10 * 60 * 1000);

console.log('⚙️ Запускаю initDB...');
initDB()
  .then(() => {
    console.log('✅ initDB завершён успешно');
    cleanupOldMessages().catch(() => {});
    server.listen(3000, () => console.log('🌌 Aurora запущена на порту 3000 (Turso)'));
  })
  .catch(err => { console.error('❌ ОШИБКА:', err); process.exit(1); });
