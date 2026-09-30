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

// 🔑 СЕКРЕТНЫЙ ПАРОЛЬ ДЛЯ ГАЛОЧКИ
const VERIFY_PASSWORD = 'aurora2026';

// ============ БАЗА (TURSO) ============
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Создаём таблицы при запуске
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
      added_at INTEGER NOT NULL,
      PRIMARY KEY (owner, contact)
    )
  `);
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
  console.log('✅ База данных готова (Turso)');
}

// ============ ХЕЛПЕРЫ ============
async function getUser(username) {
  const r = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ?',
    args: [username]
  });
  return r.rows[0] || null;
}

async function getContactsOf(username) {
  const r = await db.execute({
    sql: 'SELECT contact FROM contacts WHERE owner = ? ORDER BY added_at ASC',
    args: [username]
  });
  return r.rows.map(row => row.contact);
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
  const r = await db.execute({
    sql: 'SELECT * FROM messages WHERE id = ?',
    args: [id]
  });
  return r.rows[0] || null;
}

function safeParseReactions(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) { return {}; }
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

  const contactNames = await getContactsOf(username);
  const list = [];
  for (const name of contactNames) {
    const info = await getContactInfo(name);
    list.push({
      name,
      avatar: info ? info.avatar : null,
      verified: info ? !!info.verified : false,
      online: isOnline(name)
    });
  }
  sockets.forEach(sid => io.to(sid).emit('contacts', list));
}

async function refreshForFriends(username) {
  const r = await db.execute({
    sql: 'SELECT owner FROM contacts WHERE contact = ?',
    args: [username]
  });
  for (const row of r.rows) {
    await sendContactsTo(row.owner);
  }
}

// ============ SOCKET ============
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

      const existing = await getUser(username);
      if (existing) return cb && cb({ ok: false, error: 'Такой ник уже занят' });

      const hash = bcrypt.hashSync(password, 10);
      await db.execute({
        sql: 'INSERT INTO users (username, password, avatar, verified, registered_at) VALUES (?, ?, ?, 0, ?)',
        args: [username, hash, null, Date.now()]
      });
      cb && cb({ ok: true });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
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
      cb && cb({ ok: true, avatar: user.avatar, username, verified: !!user.verified });

      await sendContactsTo(username);
      await refreshForFriends(username);
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ---- Аватарка ----
  socket.on('set avatar', async ({ avatar }) => {
    if (!socket.username || !avatar) return;
    await db.execute({
      sql: 'UPDATE users SET avatar = ? WHERE username = ?',
      args: [avatar, socket.username]
    });
    await refreshForFriends(socket.username);
  });

  // ---- Галочка ----
  socket.on('verify', async ({ password }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      if (password !== VERIFY_PASSWORD) return cb && cb({ ok: false, error: 'Неверный пароль' });

      await db.execute({
        sql: 'UPDATE users SET verified = 1 WHERE username = ?',
        args: [socket.username]
      });
      await refreshForFriends(socket.username);
      const u = await getUser(socket.username);
      socket.emit('me updated', { verified: !!u.verified, avatar: u.avatar, username: u.username });
      cb && cb({ ok: true });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ---- Добавить контакт ----
  socket.on('add contact', async ({ username }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
      username = String(username || '').trim().toLowerCase();
      if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
      if (username === socket.username) return cb && cb({ ok: false, error: 'Это твой ник' });
      if (!(await getUser(username))) return cb && cb({ ok: false, error: 'Такого пользователя нет' });

      await db.execute({
        sql: 'INSERT OR IGNORE INTO contacts (owner, contact, added_at) VALUES (?, ?, ?)',
        args: [socket.username, username, Date.now()]
      });
      await sendContactsTo(socket.username);
      cb && cb({ ok: true });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false, error: 'Ошибка сервера' });
    }
  });

  // ---- Удалить контакт ----
  socket.on('remove contact', async ({ username }, cb) => {
    if (!socket.username) return;
    await db.execute({
      sql: 'DELETE FROM contacts WHERE owner = ? AND contact = ?',
      args: [socket.username, username]
    });
    await sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });

  // ---- История ----
  socket.on('load history', async ({ withUser }) => {
    if (!socket.username) return;
    try {
      const rows = await getHistory(socket.username, withUser);
      const messages = rows.map(m => ({
        ...m,
        reactions: safeParseReactions(m.reactions)
      }));
      socket.emit('history', { withUser, messages });
    } catch (e) {
      console.error(e);
    }
  });

  // ---- Сообщение ----
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
    } catch (e) {
      console.error(e);
    }
  });

  // ---- ПЕЧАТАЕТ ----
  socket.on('typing', ({ to, isTyping }) => {
    if (!socket.username) return;
    findSocketsByUsername(to).forEach(sid =>
      io.to(sid).emit('typing', { from: socket.username, isTyping })
    );
  });

  // ---- РЕАКЦИИ ----
  socket.on('react', async ({ messageId, emoji }, cb) => {
    try {
      if (!socket.username) return cb && cb({ ok: false });
      const msg = await getMessageById(messageId);
      if (!msg) return cb && cb({ ok: false, error: 'Сообщение не найдено' });

      const me = socket.username;
      const inDialog = (msg.from_user === me || msg.to_user === me);
      if (!inDialog) return cb && cb({ ok: false, error: 'Нет доступа' });

      let reactions = safeParseReactions(msg.reactions);
      if (!reactions[emoji]) reactions[emoji] = [];
      const idx = reactions[emoji].indexOf(me);

      if (idx === -1) {
        reactions[emoji].push(me);
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
      targets.forEach(u => {
        findSocketsByUsername(u).forEach(sid => io.to(sid).emit('reaction updated', payload));
      });
      cb && cb({ ok: true, reactions });
    } catch (e) {
      console.error(e);
      cb && cb({ ok: false });
    }
  });

  // ---- Звонки ----
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
        findSocketsByUsername(other).forEach(sid =>
          io.to(sid).emit('typing', { from: u, isTyping: false })
        );
      });
    }
  });
});

// ============ СТАРТ ============
initDB()
  .then(() => {
    server.listen(3000, () => console.log('🌌 Aurora запущена на порту 3000 (Turso)'));
  })
  .catch(err => {
    console.error('❌ Ошибка инициализации базы:', err);
    process.exit(1);
  });
