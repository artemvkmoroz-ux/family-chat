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

async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      avatar TEXT,
      verified INTEGER DEFAULT 0,
      registered_at INTEGER NOT NULL
    )
  `);
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
      reactions TEXT DEFAULT '{}',
      time INTEGER NOT NULL
    )
  `);
  // Группы
  await db.execute(`
    CREATE TABLE IF NOT EXISTS groups_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      creator TEXT NOT NULL,
      avatar TEXT,
      created_at INTEGER NOT NULL
    )
  `);
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
      reactions TEXT DEFAULT '{}',
      time INTEGER NOT NULL
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
    sql: 'SELECT username, avatar, verified FROM users WHERE username = ?',
    args: [username]
  });
  return r.rows[0] || null;
}
async function getHistory(me, withUser) {
  const r = await db.execute({
    sql: `SELECT * FROM messages
          WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
          ORDER BY time ASC LIMIT 200`,
    args: [me, withUser, withUser, me]
  });
  return r.rows;
}
async function getMessageById(id) {
  const r = await db.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}
function safeParseReactions(raw) {
  if (!raw) return {};
  try { const obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : {}; }
  catch (e) { return {}; }
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
async function getGroupHistory(groupId) {
  const r = await db.execute({
    sql: 'SELECT * FROM group_messages WHERE group_id = ? ORDER BY time ASC LIMIT 200',
    args: [groupId]
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

async function sendGroupsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;
  const groups = await getUserGroups(username);
  const list = [];
  for (const g of groups) {
    const members = await getGroupMembers(g.id);
    list.push({
      id: g.id,
      name: g.name,
      avatar: g.avatar,
      creator: g.creator,
      members: members,
      memberCount: members.length
    });
  }
  sockets.forEach(sid => io.to(sid).emit('groups', list));
}

async function notifyGroupMembers(groupId, event, payload) {
  const members = await getGroupMembers(groupId);
  members.forEach(u => {
    findSocketsByUsername(u).forEach(sid => io.to(sid).emit(event, payload));
  });
}

// ============ ONLINE ============
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
    list.push({
      name: row.contact,
      displayName: row.display_name || row.contact,
      avatar: info ? info.avatar : null,
      verified: info ? !!info.verified : false,
      online: isOnline(row.contact)
    });
  }
  sockets.forEach(sid => io.to(sid).emit('contacts', list));
}
async function refreshForFriends(username) {
  const r = await db.execute({ sql: 'SELECT owner FROM contacts WHERE contact = ?', args: [username] });
  for (const row of r.rows) await sendContactsTo(row.owner);
}

// ============ SOCKET ============
io.on('connection', (socket) => {
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
        sql: 'INSERT INTO users (username, password, avatar, verified, registered_at) VALUES (?, ?, ?, 0, ?)',
        args: [username, hash, null, Date.now()]
      });
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('login', async ({ username, password }, cb) => {
    try {
      username = String(username || '').trim().toLowerCase();
      password = String(password || '');
      const user = await getUser(username);
      if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
      if (!bcrypt.compareSync(password, user.password)) return cb && cb({ ok: false, error: 'Неверный пароль' });
      onlineUsers[socket.id] = username;
      socket.username = username;
      cb && cb({ ok: true, avatar: user.avatar, username, verified: !!user.verified });
      await sendContactsTo(username);
      await sendGroupsTo(username);
      await refreshForFriends(username);
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('set avatar', async ({ avatar }) => {
    if (!socket.username || !avatar) return;
    await db.execute({ sql: 'UPDATE users SET avatar = ? WHERE username = ?', args: [avatar, socket.username] });
    await refreshForFriends(socket.username);
    await notifyGroupMembers(-1, 'noop', {}); // noop
  });

  socket.on('verify', async ({ password }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (password !== VERIFY_PASSWORD) return cb && cb({ ok: false, error: 'Неверный пароль' });
      await db.execute({ sql: 'UPDATE users SET verified = 1 WHERE username = ?', args: [socket.username] });
      await refreshForFriends(socket.username);
      const u = await getUser(socket.username);
      socket.emit('me updated', { verified: !!u.verified, avatar: u.avatar, username: u.username });
      cb && cb({ ok: true });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

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

  socket.on('remove contact', async ({ username }, cb) => {
    if (!socket.username) return;
    await db.execute({ sql: 'DELETE FROM contacts WHERE owner = ? AND contact = ?', args: [socket.username, username] });
    await sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });

  socket.on('load history', async ({ withUser }) => {
    if (!socket.username) return;
    try {
      const rows = await getHistory(socket.username, withUser);
      const messages = rows.map(m => ({ ...m, reactions: safeParseReactions(m.reactions) }));
      socket.emit('history', { withUser, messages });
    } catch (e) { console.error(e); }
  });

  socket.on('private message', async ({ to, text, image, voice, voiceDuration }) => {
    if (!socket.username) return;
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO messages (from_user, to_user, text, image, voice, voice_duration, reactions, time)
              VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
        args: [from, to, text || null, image || null, voice || null, voiceDuration || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      const payload = { id: msgId, from, text, image, voice, voiceDuration, reactions: {}, time };
      findSocketsByUsername(to).forEach(sid => io.to(sid).emit('private message', payload));
      socket.emit('private message', { ...payload, self: true, to });
    } catch (e) { console.error(e); }
  });

  socket.on('typing', ({ to, isTyping }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid => io.to(sid).emit('typing', { from: socket.username, isTyping }));
  });

  // ============ ГРУППЫ ============
  socket.on('create group', async ({ name, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      name = String(name || '').trim();
      if (!name) return cb && cb({ ok: false, error: 'Введи название' });
      if (name.length > 50) return cb && cb({ ok: false, error: 'Название максимум 50 символов' });
      members = Array.isArray(members) ? members : [];

      const now = Date.now();
      const r = await db.execute({
        sql: 'INSERT INTO groups_table (name, creator, avatar, created_at) VALUES (?, ?, NULL, ?)',
        args: [name, socket.username, now]
      });
      const groupId = Number(r.lastInsertRowid);

      // Создатель всегда участник
      await db.execute({
        sql: 'INSERT INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
        args: [groupId, socket.username, now]
      });

      // Остальные — только те, кто есть в контактах
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu || mu === socket.username) continue;
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, Date.now()]
        });
      }

      // Оповестить всех участников
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);

      cb && cb({ ok: true, groupId });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
  });

  socket.on('add group members', async ({ groupId, members }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (!await isGroupMember(groupId, socket.username)) return cb && cb({ ok: false, error: 'Нет доступа' });
      members = Array.isArray(members) ? members : [];

      const added = [];
      for (const m of members) {
        const mu = String(m || '').trim().toLowerCase();
        if (!mu) continue;
        if (await isGroupMember(groupId, mu)) continue; // уже в группе
        await db.execute({
          sql: 'INSERT OR IGNORE INTO group_members (group_id, username, joined_at) VALUES (?, ?, ?)',
          args: [groupId, mu, Date.now()]
        });
        added.push(mu);
      }

      // Обновить группы у всех
      const allMembers = await getGroupMembers(groupId);
      for (const u of allMembers) await sendGroupsTo(u);

      cb && cb({ ok: true, added });
    } catch (e) { console.error(e); cb && cb({ ok: false, error: 'Ошибка сервера' }); }
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
    cb && cb({ ok: true });
  });

  socket.on('load group history', async ({ groupId }) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return;
    try {
      const rows = await getGroupHistory(groupId);
      const messages = rows.map(m => ({ ...m, reactions: safeParseReactions(m.reactions) }));
      socket.emit('group history', { groupId, messages });
    } catch (e) { console.error(e); }
  });

  socket.on('group message', async ({ groupId, text, image, voice, voiceDuration }) => {
    if (!socket.username) return;
    if (!await isGroupMember(groupId, socket.username)) return;
    try {
      const from = socket.username;
      const time = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO group_messages (group_id, from_user, text, image, voice, voice_duration, reactions, time)
              VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
        args: [groupId, from, text || null, image || null, voice || null, voiceDuration || null, time]
      });
      const msgId = Number(result.lastInsertRowid);
      const payload = { id: msgId, groupId, from, text, image, voice, voiceDuration, reactions: {}, time, self: false };
      await notifyGroupMembers(groupId, 'group message', payload);
      // Отправителю — с пометкой self
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
      const r = await db.execute({
        sql: 'SELECT * FROM group_messages WHERE id = ? AND group_id = ?',
        args: [messageId, groupId]
      });
      const msg = r.rows[0];
      if (!msg) return cb && cb({ ok: false, error: 'Сообщение не найдено' });

      let reactions = safeParseReactions(msg.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const me = socket.username;
      const idx = reactions[emoji].indexOf(me);
      if (idx === -1) reactions[emoji].push(me);
      else { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }

      await db.execute({
        sql: 'UPDATE group_messages SET reactions = ? WHERE id = ?',
        args: [JSON.stringify(reactions), messageId]
      });

      await notifyGroupMembers(groupId, 'group reaction updated', { groupId, messageId, reactions });
      cb && cb({ ok: true, reactions });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
  });

  // ============ ЛИЧНЫЕ РЕАКЦИИ ============
  socket.on('react', async ({ messageId, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const msg = await getMessageById(messageId);
      if (!msg) return cb && cb({ ok: false, error: 'Сообщение не найдено' });
      const me = socket.username;
      if (msg.from_user !== me && msg.to_user !== me) return cb && cb({ ok: false, error: 'Нет доступа' });
      let reactions = safeParseReactions(msg.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const idx = reactions[emoji].indexOf(me);
      if (idx === -1) reactions[emoji].push(me);
      else { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
      await db.execute({ sql: 'UPDATE messages SET reactions = ? WHERE id = ?', args: [JSON.stringify(reactions), messageId] });
      const payload = { messageId, reactions, from: msg.from_user, to: msg.to_user };
      const targets = new Set([msg.from_user, msg.to_user]);
      targets.forEach(u => findSocketsByUsername(u).forEach(sid => io.to(sid).emit('reaction updated', payload)));
      cb && cb({ ok: true, reactions });
    } catch (e) { console.error(e); cb && cb({ ok: false }); }
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

initDB()
  .then(() => server.listen(3000, () => console.log('🌌 Aurora запущена на порту 3000 (Turso)')))
  .catch(err => { console.error('❌ Ошибка инициализации базы:', err); process.exit(1); });
