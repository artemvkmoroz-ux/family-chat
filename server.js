const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname)));

// ============ БАЗА ============
const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    avatar TEXT,
    registered_at INTEGER NOT NULL
  )
`);
try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    owner TEXT NOT NULL,
    contact TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (owner, contact)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    text TEXT,
    image TEXT,
    time INTEGER NOT NULL
  )
`);
try { db.exec('ALTER TABLE messages ADD COLUMN image TEXT'); } catch (e) {}

const findUser = db.prepare('SELECT * FROM users WHERE username = ?');
const createUser = db.prepare('INSERT INTO users (username, password, avatar, registered_at) VALUES (?, ?, ?, ?)');
const updateAvatar = db.prepare('UPDATE users SET avatar = ? WHERE username = ?');

const addContact = db.prepare('INSERT OR IGNORE INTO contacts (owner, contact, added_at) VALUES (?, ?, ?)');
const removeContact = db.prepare('DELETE FROM contacts WHERE owner = ? AND contact = ?');
const getContacts = db.prepare('SELECT contact FROM contacts WHERE owner = ? ORDER BY added_at ASC');
const getContactInfo = db.prepare('SELECT username, avatar FROM users WHERE username = ?');

const insertMessage = db.prepare(
  'INSERT INTO messages (from_user, to_user, text, image, time) VALUES (?, ?, ?, ?, ?)'
);
const getHistory = db.prepare(`
  SELECT * FROM messages
  WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
  ORDER BY time ASC LIMIT 200
`);

// ============ ПОЛЬЗОВАТЕЛИ ОНЛАЙН ============
const onlineUsers = {}; // { socketId: username }

function findSocketsByUsername(username) {
  return Object.entries(onlineUsers)
    .filter(([, u]) => u === username)
    .map(([sid]) => sid);
}
function isOnline(username) {
  return Object.values(onlineUsers).includes(username);
}

// Отправить список контактов конкретному пользователю
function sendContactsTo(username) {
  const sockets = findSocketsByUsername(username);
  if (sockets.length === 0) return;

  const contactNames = getContacts.all(username).map(r => r.contact);
  const list = contactNames.map(name => {
    const info = getContactInfo.get(name);
    return {
      name,
      avatar: info ? info.avatar : null,
      online: isOnline(name)
    };
  });
  sockets.forEach(sid => io.to(sid).emit('contacts', list));
}

// Обновить контакты у всех, кто имеет этого пользователя в друзьях
function refreshForFriends(username) {
  // Все, у кого username в контактах
  const owners = db.prepare('SELECT owner FROM contacts WHERE contact = ?').all(username);
  owners.forEach(({ owner }) => sendContactsTo(owner));
}

// ============ SOCKET.IO ============
io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  // ---- Регистрация ----
  socket.on('register', ({ username, password }, cb) => {
    username = String(username || '').trim().toLowerCase();
    password = String(password || '');

    if (!username || !password) return cb && cb({ ok: false, error: 'Заполни все поля' });
    if (username.length < 3) return cb && cb({ ok: false, error: 'Ник минимум 3 символа' });
    if (!/^[a-z0-9_]+$/.test(username)) return cb && cb({ ok: false, error: 'Только латиница, цифры и _' });
    if (password.length < 4) return cb && cb({ ok: false, error: 'Пароль минимум 4 символа' });

    const existing = findUser.get(username);
    if (existing) return cb && cb({ ok: false, error: 'Такой ник уже занят' });

    const hash = bcrypt.hashSync(password, 10);
    createUser.run(username, hash, null, Date.now());
    cb && cb({ ok: true });
  });

  // ---- Вход ----
  socket.on('login', ({ username, password }, cb) => {
    username = String(username || '').trim().toLowerCase();
    password = String(password || '');

    const user = findUser.get(username);
    if (!user) return cb && cb({ ok: false, error: 'Пользователь не найден' });
    if (!bcrypt.compareSync(password, user.password)) {
      return cb && cb({ ok: false, error: 'Неверный пароль' });
    }

    onlineUsers[socket.id] = username;
    socket.username = username;
    cb && cb({ ok: true, avatar: user.avatar, username });

    sendContactsTo(username);
    refreshForFriends(username);
  });

  // ---- Установить аватарку ----
  socket.on('set avatar', ({ avatar }) => {
    if (!socket.username || !avatar) return;
    updateAvatar.run(avatar, socket.username);
    refreshForFriends(socket.username);
  });

  // ---- Получить мои данные ----
  socket.on('get me', (cb) => {
    if (!socket.username) return cb && cb(null);
    const u = findUser.get(socket.username);
    cb && cb({ username: u.username, avatar: u.avatar });
  });

  // ---- Добавить контакт по нику ----
  socket.on('add contact', ({ username }, cb) => {
    if (!socket.username) return cb && cb({ ok: false, error: 'Не авторизован' });
    username = String(username || '').trim().toLowerCase();

    if (!username) return cb && cb({ ok: false, error: 'Введи ник' });
    if (username === socket.username) return cb && cb({ ok: false, error: 'Это твой ник' });

    const target = findUser.get(username);
    if (!target) return cb && cb({ ok: false, error: 'Такого пользователя нет' });

    addContact.run(socket.username, username, Date.now());
    sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });

  // ---- Удалить контакт ----
  socket.on('remove contact', ({ username }, cb) => {
    if (!socket.username) return;
    removeContact.run(socket.username, username);
    sendContactsTo(socket.username);
    cb && cb({ ok: true });
  });

  // ---- История ----
  socket.on('load history', ({ withUser }) => {
    if (!socket.username) return;
    const rows = getHistory.all(socket.username, withUser, withUser, socket.username);
    socket.emit('history', { withUser, messages: rows });
  });

  // ---- Личное сообщение ----
  socket.on('private message', ({ to, text, image }) => {
    if (!socket.username) return;
    const from = socket.username;
    const time = Date.now();
    insertMessage.run(from, to, text || null, image || null, time);

    const toSockets = findSocketsByUsername(to);
    toSockets.forEach(sid => io.to(sid).emit('private message', { from, text, image, time }));
    socket.emit('private message', { from, text, image, time, self: true, to });
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
  socket.on('disconnect', () => {
    const u = socket.username;
    delete onlineUsers[socket.id];
    if (u) {
      sendContactsTo(u);
      refreshForFriends(u);
    }
    console.log('Отключился:', socket.id);
  });
});

server.listen(3000, () => console.log('Aurora запущена: http://localhost:3000'));
