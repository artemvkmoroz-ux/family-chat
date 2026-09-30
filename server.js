const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname)));

const VERIFY_PASSWORD = 'aurora2026';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ============ ИНИЦИАЛИЗАЦИЯ БАЗЫ ============
async function initDB() {
  // Пользователи
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      bio TEXT,
      registered_at INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE users ADD COLUMN bio TEXT`).catch(() => {});

  // Контакты
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

  // Личные сообщения
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      text TEXT,
      image TEXT,
      voice TEXT,
      voice_duration INTEGER,
      reactions TEXT DEFAULT '{}',
      reply_to INTEGER,
      edited INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      read_at INTEGER,
      time INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE messages ADD COLUMN reply_to INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN edited INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN read_at INTEGER`).catch(() => {});

  // Группы
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

  // Участники групп
  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, username)
    )
  `);

  // Сообщения групп
  await db.execute(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      from_user TEXT NOT NULL,
      text TEXT,
      image TEXT,
      voice TEXT,
      voice_duration INTEGER,
      reactions TEXT DEFAULT '{}',
      reply_to INTEGER,
      edited INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      time INTEGER NOT NULL
    )
  `);
  await db.execute(`ALTER TABLE group_messages ADD COLUMN reply_to INTEGER`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN edited INTEGER DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE group_messages ADD COLUMN deleted INTEGER DEFAULT 0`).catch(() => {});

  // Настройки чата (архив, mute)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_settings (
      owner TEXT NOT NULL,
      chat_key TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      muted INTEGER DEFAULT 0,
      PRIMARY KEY (owner, chat_key)
    )
  `);

  console.log('✅ База данных готова (Turso)');
}

// ============ ХЕЛПЕРЫ ============
async function getUser(username) {
  const r = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  return r.rows[0] || null;
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
    sql: 'SELECT username, avatar, verified, bio FROM users WHERE username = ?',
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

// ============ НАСТРОЙКИ ЧАТА ============
async function getChatSettings(owner, chatKey) {
  const r = await db.execute({
    sql: 'SELECT * FROM chat_settings WHERE owner = ? AND chat_key = ?',
    args: [owner, chatKey]
  });
  return r.rows[0] || { archived: 0, muted: 0 };
}
async function setChatSetting(owner, chatKey, field, value) {
  // Сначала создаём запись если нет
  await db.execute({
    sql: 'INSERT OR IGNORE INTO chat_settings (owner, chat_key, archived, muted) VALUES (?, ?, 0, 0)',
    args: [owner, chatKey]
  });
  await db.execute({
    sql: `UPDATE chat_settings SET ${field} = ? WHERE owner = ? AND chat_key = ?`,
    args: [value, owner, chatKey]
  });
}

// ============ ГРУППЫ ============
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
          WHERE gm.username = ?
          ORDER BY g.created_at ASC`,
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

// ============ ONLINE ============
const onlineUsers = {};
function findSocketsByUsername(username) {
  return Object.entries(onlineUsers).filter(([, u]) => u === username).map(([sid]) => sid);
}
function isOnline(username) {
  return Object.values(onlineUsers).includes(username);
}

// ============ ОТПРАВКА СПИСКОВ ============
async function sendContactsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  const contactRows = await getContactsOf(username);
  const list = [];
  for (const row of contactRows) {
    const info = await getContactInfo(row.contact);
    const settings = await getChatSettings(username, row.contact);
    list.push({
      name: row.contact,
      displayName: row.display_name || row.contact,
      avatar: info ? info.avatar : null,
      verified: info ? !!info.verified : false,
      bio: info ? info.bio : null,
      online: isOnline(row.contact),
      archived: !!settings.archived,
      muted: !!settings.muted
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
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      creator: g.creator,
      description: g.description,
      pinnedMessageId: g.pinned_message_id,
      members: members,
      memberCount: members.length,
      archived: !!settings.archived,
      muted: !!settings.muted
    });
  }
  sockets.forEach(sid => io.to(sid).emit('groups', list));
}

async function refreshForFriends(username) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) await sendContactsTo(row.owner);
}

async function notifyGroupMembers(groupId, event, payload) {
  const members = await getGroupMembers(groupId);
  members.forEach(u => {
    findSocketsByUsername(u).forEach(sid => io.to(sid).emit(event, payload));
  });
}

// ============ СОКЕТЫ ============
io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  // ---- Регистрация ----
  socket.on('register', async ({ username, password }, cb) => {
    try {
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      if (!username || !password) return cb && cb({ ok: false, error: 'Заполни все поля' });
      if (username.length < 3) return cb && cb({ ok: false, error: 'Ник минимум 3 символа' });
      if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: false, error: 'Только латиница, цифры и _' });
      if (password.length < 4) return cb && cb({ ok: false, error: 'Пароль минимум 4 символа' });
      if (await getUser(username)) return cb && cb({ ok: false, error: 'Такой ник уже занят' });
      const hash = bcrypt.hashSync(password, 10);
      await db.execute({
        sql: 'INSERT INTO users (username, password, avatar, verified, bio, registered_at) VALUES (?, ?, ?, 0, NULL, ?)',
        args: [username, hash, null, Date.now()]
      });
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  // ---- Вход ----
  socket.on('login', async ({ username, password }, cb) => {
    try {
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      const user = await getUser(username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (!bcrypt.compareSync(password, user.password)) return cb && cb({ ok: false, error: 'Неверный пароль' });
      onlineUsers[socket.id] = username;
      socket.username = username;
      cb && cb({ ok: true, avatar: user.avatar, username, verified: !!user.verified, bio: user.bio });
      await sendContactsTo(username);
      await sendGroupsTo(username);
      await refreshForFriends(username);
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  // ---- Аватарка ----
  socket.on('set avatar', async ({ avatar }) => {
    if (!socket.username || !avatar) return;
    await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE username = ?', args: [avatar, socket.username] });
    await refreshForFriends(socket.username);
    await notifyAllFriends(socket.username, 'friend updated', { username: socket.username, avatar });
  });

  // ---- Bio ----
  socket.on('set bio', async ({ bio }) => {
    if (!socket.username) return;
    bio = String(bio || '').slice(0, 200);
    await db.execute({ sql: 'UPDATE users SET bio = ? WHERE username = ?', args: [bio, socket.username] });
    await notifyAllFriends(socket.username, 'friend updated', { username: socket.username, bio });
  });

  // ---- Галочка ----
  socket.on('verify', async ({ password }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (password !== VERIFY_PASSWORD) return cb && cb({ ok: false, error: 'Неверный пароль' });
      await db.execute({ sql: 'UPDATE users SET verified = 1 WHERE username = ?', args: [socket.username] });
      await refreshForFriends(socket.username);
      const u = await getUser(socket.username);
      socket.emit('me updated', { verified: !!u.verified, avatar: u.avatar, username: u.username, bio: u.bio });
      await notifyAllFriends(socket.username, 'friend updated', { username: socket.username, verified: true });
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  // ---- Добавить контакт ----
  socket.on('add contact', async ({ username, displayName }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      username = String(username || '').trim().toLowerCase();
      displayName = String(displayName || '').trim();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      if (!displayName) return cb && cb({ ok: false, error: 'Введи имя' });
      if (username === socket.username) return cb && cb({ ok: false, error: 'Это твой ник' });
      if (!(await getUser(username))) return cb && cb({ ok: false, error: 'Такого пользователя нет' });
      await db.execute({
        sql: 'INSERT OR REPLACE INTO contacts (owner, contact, display_name, added_at) VALUES (?, ?, ?, ?)',
        args: [socket.username, username, displayName, Date.now()]
      });
      await sendContactsTo(socket.username);
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  // ---- Удалить контакт ----
  socket.on('remove contact', async ({ username }, cb) => {
    if (!socket.username) return;
    await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? AND contact = ?', args: [socket.username, username] });
    await sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });

  // ---- Профиль контакта ----
  socket.on('get profile', async ({ username }, cb) => {
    if (!socket.username) return cb && cb(null);
    const info = await getContactInfo(username);
    if (!info) return cb && cb(null);
    cb && cb({
      username: info.username,
      avatar: info.avatar,
      verified: !!info.verified,
      bio: info.bio,
      online: isOnline(username)
    });
  });

  // ---- Настройки чата: архив ----
  socket.on('toggle archive', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.archived ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'archived', newVal);
    await sendContactsTo(socket.username);
    await sendGroupsTo(socket.username);
    cb && cb({ ok: true, archived: !!newVal });
  });

  // ---- Настройки чата: mute ----
  socket.on('toggle mute', async ({ chatKey }, cb) => {
    if (!socket.username) return;
    const settings = await getChatSettings(socket.username, chatKey);
    const newVal = settings.muted ? 0 : 1;
    await setChatSetting(socket.username, chatKey, 'muted', newVal);
    await sendContactsTo(socket.username);
    await sendGroupsTo(socket.username);
    cb && cb({ ok: true, muted: !!newVal });
  });

  // ---- История личных ----
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

  // ---- Личное сообщение ----
  socket.on('private message', async ({ to, text, image, voice, voiceDuration, replyTo }) => {
    if (!socket.username) return;
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO messages (from_user, to_user, text, image, voice, voice_duration, reactions, reply_to, edited, deleted, time)
              VALUES (?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?)`,
        args: [from, to, text || null, image || null, voice || null, voiceDuration || null, replyTo || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      let replyData = null;
      if (replyTo) {
        const r = await getMessageById(replyTo);
        if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
      }
      const payload = { id: msgId, from, text, image, voice, voiceDuration, reactions: {}, replyData, time, read: false };
      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
      socket.emit('private message', { ...payload, self: true, to });
    } catch (e) { console.error(e); }
  });

  // ---- Редактировать сообщение ----
  socket.on('edit message', async ({ messageId, text, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (isGroup) {
        const msg = await getGroupMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false, error: 'Нет доступа' });
        await db.execute({ sql: 'UPDATE group_messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        await notifyGroupMembers(msg.group_id, 'message edited', { messageId, text, isGroup: true });
      } else {
        const msg = await getMessageById(messageId);
        if (!msg || msg.from_user !== socket.username) return cb && cb({ ok: false, error: 'Нет доступа' });
        await db.execute({ sql: 'UPDATE messages SET text = ?, edited = 1 WHERE id = ?', args: [text, messageId] });
        const payload = { messageId, text, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message edited', payload));
        socket.emit('message edited', payload);
      }
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ---- Удалить сообщение ----
  socket.on('delete message', async ({ messageId, forAll, isGroup }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (isGroup) {
        const msg = await getGroupMessageById(messageId);
        if (!msg) return cb && cb({ ok: false });
        const group = await getGroupById(msg.group_id);
        const canDelete = msg.from_user === socket.username || group?.creator === socket.username;
        if (!canDelete) return cb && cb({ ok: false, error: 'Нет доступа' });
        await db.execute({ sql: 'UPDATE group_messages SET deleted = 1, text = NULL, image = NULL, voice = NULL WHERE id = ?', args: [messageId] });
        await notifyGroupMembers(msg.group_id, 'message deleted', { messageId, isGroup: true });
      } else {
        const msg = await getMessageById(messageId);
        if (!msg) return cb && cb({ ok: false });
        if (msg.from_user !== socket.username) return cb && cb({ ok: false, error: 'Нет доступа' });
        await db.execute({ sql: 'UPDATE messages SET deleted = 1, text = NULL, image = NULL, voice = NULL WHERE id = ?', args: [messageId] });
        const payload = { messageId, isGroup: false };
        findSocketsByUsername(msg.to_user).forEach(sid => io.to(sid).emit('message deleted', payload));
        socket.emit('message deleted', payload);
      }
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ---- Прочитано ----
  socket.on('mark read', async ({ withUser }) => {
    if (!socket.username) return;
    await db.execute({
      sql: 'UPDATE messages SET read_at = ? WHERE from_user = ? AND to_user = ? AND read_at IS NULL',
      args: [Date.now(), withUser, socket.username]
    });
    findSocketsByUsername(withUser).forEach(sid =>
      io.to(sid).emit('messages read', { by: socket.username })
    );
  });

  // ---- Печатает ----
  socket.on('typing', ({ to, isTyping }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('typing', { from: socket.username, isTyping }));
  });

  // ---- Реакции личные ----
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
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ============ ГРУППЫ ============
  socket.on('create group', async ({ name, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      name = String(name || '').trim();
      if (!name) return cb && cb({ ok: false, error: 'Введи название' });
      members = Array.isArray(members) ? members : [];
      const now = Date.now();
      const r = await db.execute({
        sql: 'INSERT INTO groups_table (name, creator, avatar, created_at) VALUES (?, ?, NULL, ?)',
        args: [name, socket.username, now]
      });
      const groupId = Number(r.lastInsertRowid);
      await db.execute({
        sql: 'INSERT INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
        args: [groupId, socket.username, now]
      });
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu || mu === socket.username) continue;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, Date.now()]
        });
      }
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);
      cb && cb({ ok: true, groupId });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('add group members', async ({ groupId, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
      members = Array.isArray(members) ? members : [];
      const added = [];
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu) continue;
        if (await isGroupMember(groupId, mu)) continue;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, Date.now()]
        });
        added.push(mu);
      }
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);
      await notifyGroupMembers(groupId, 'group updated', { groupId });
      cb && cb({ ok: true, added });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('leave group', async ({ groupId }, cb) => {
    if (!socket.username) return;
    await db.execute({
      sql: 'DELETE FROM group_members WHERE group_id = ? AND username = ?',
      args: [groupId, socket.username]
    });
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
      if (!group) return cb && cb({ ok: false, error: 'Группа не найдена' });
      if (group.creator !== socket.username) return cb && cb({ ok: false, error: 'Только создатель' });
      const members = await getGroupMembers(groupId);
      await db.execute({ sql: 'DELETE FROM group_messages WHERE group_id = ?', args: [groupId] });
      await db.execute({ sql: 'DELETE FROM group_members WHERE group_id = ?', args: [groupId] });
      await db.execute({ sql: 'DELETE FROM groups_table WHERE id = ?', args: [groupId] });
      for (const u of members) {
        await sendGroupsTo(u);
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('group deleted', { groupId }));
      }
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  socket.on('update group', async ({ groupId, name, description }, cb) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    if (name) await db.execute({ sql: 'UPDATE groups_table SET name = ? WHERE id = ?', args: [String(name).slice(0, 60), groupId] });
    if (typeof description === 'string') await db.execute({ sql: 'UPDATE groups_table SET description = ? WHERE id = ?', args: [description.slice(0, 200), groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) await sendGroupsTo(u);
    cb && cb({ ok: true });
  });

  socket.on('pin message', async ({ groupId, messageId }, cb) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
    await db.execute({ sql: 'UPDATE groups_table SET pinned_message_id = ? WHERE id = ?', args: [messageId, groupId] });
    const allMembers = await getGroupMembers(groupId);
    for (const u of allMembers) await sendGroupsTo(u);
    await notifyGroupMembers(groupId, 'group updated', { groupId });
    cb && cb({ ok: true });
  });

  socket.on('load group history', async ({ groupId }) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return;
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

  socket.on('group message', async ({ groupId, text, image, voice, voiceDuration, replyTo }) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return;
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO group_messages (group_id, from_user, text, image, voice, voice_duration, reactions, reply_to, edited, deleted, time)
              VALUES (?, ?, ?, ?, ?, ?, '{}', ?, 0, 0, ?)`,
        args: [groupId, from, text || null, image || null, voice || null, voiceDuration || null, replyTo || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      let replyData = null;
      if (replyTo) {
        const r = await getGroupMessageById(replyTo);
        if (r) replyData = { id: r.id, from: r.from_user, text: r.text, image: !!r.image, voice: !!r.voice, deleted: !!r.deleted };
      }
      const payload = { id: msgId, groupId, from, text, image, voice, voiceDuration, reactions: {}, replyData, time, self: false };
      await notifyGroupMembers(groupId, 'group message', payload);
      socket.emit('group message', { ...payload, self: true });
    } catch (e) { console.error(e); }
  });

  socket.on('group typing', ({ groupId, isTyping }) => {
    if (!socket.username) return;
    getGroupMembers(groupId).then(members => {
      members.forEach(u => {
        if (u === socket.username) return;
        findSocketsByUsername(u).forEach(sid =>
          io.to(sid).emit('group typing', { groupId, from: socket.username, isTyping })
        );
      });
    });
  });

  socket.on('group react', async ({ groupId, messageId, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      if (!await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false });
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
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ============ ПОИСК ============
  socket.on('search messages', async ({ query, withUser, groupId }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, results: [] });
      query = String(query || '').trim();
      if (!query || query.length < 2) return cb && cb({ ok: true, results: [] });
      let rows = [];
      if (groupId) {
        const r = await db.execute({
          sql: `SELECT * FROM group_messages WHERE group_id = ? AND deleted = 0 AND text LIKE ?
                ORDER BY time DESC LIMIT 50`,
          args: [groupId, '%' + query + '%']
        });
        rows = r.rows;
      } else if (withUser) {
        const r = await db.execute({
          sql: `SELECT * FROM messages
                WHERE deleted = 0 AND text LIKE ?
                AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))
                ORDER BY time DESC LIMIT 50`,
          args: ['%' + query + '%', socket.username, withUser, withUser, socket.username]
        });
        rows = r.rows;
      }
      cb && cb({ ok: true, results: rows });
    } catch (e) { console.error(e); cb && cb({ ok: false, results: [] }); }
  });

  // ============ ЗВОНКИ ============
  socket.on('call-user', ({ to, offer, video }) => {
    if (!socket.username) return;
    const toSockets = findSocketsByUsername(to);
    if (toSockets.length > 0) {
      toSockets.forEach(sid => io.to(sid).emit('incoming-call', { from: socket.username, offer, video }));
    } else {
      socket.emit('call-failed', { reason: 'Пользователь не в сети' });
    }
  });
  socket.on('answer-call', ({ to, answer }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('call-answered', { answer }));
  });
  socket.on('ice-candidate', ({ to, candidate }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('ice-candidate', { candidate }));
  });
  socket.on('end-call', ({ to }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('call-ended'));
  });

  // ---- Отключение ----
  socket.on('disconnect', async () => {
    const u = socket.username;
    delete onlineUsers[socket.id];
    if (u) {
      await sendContactsTo(u);
      await refreshForFriends(u);
      Object.values(onlineUsers).forEach(other => {
        findSocketsByUsername(other).forEach(sid => io.to(sid).emit('typing', { from: u, isTyping: false }));
      });
    }
  });
});

// Оповестить всех, у кого username в контактах, об изменении профиля
async function notifyAllFriends(username, event, payload) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) {
    findSocketsByUsername(row.owner).forEach(sid => io.to(sid).emit(event, payload));
  }
}

initDB()
  .then(() => server.listen(3000, () => console.log('🌌 Aurora запущена на порту 3000 (Turso)')))
  .catch(err => { console.error('❌ Ошибка инициализации базы:', err); process.exit(1); });
