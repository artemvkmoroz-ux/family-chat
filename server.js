const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

// ============ БАЗА ДАННЫХ ============
const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    text TEXT NOT NULL,
    time INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY,
    registered_at INTEGER NOT NULL
  )
`);

const insertMessage = db.prepare(
  'INSERT INTO messages (from_user, to_user, text, time) VALUES (?, ?, ?, ?)'
);

const getHistory = db.prepare(`
  SELECT * FROM messages
  WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
  ORDER BY time ASC
  LIMIT 200
`);

const saveUser = db.prepare(
  'INSERT OR IGNORE INTO users (name, registered_at) VALUES (?, ?)'
);

const getAllUsers = db.prepare('SELECT name FROM users ORDER BY registered_at ASC');

const getLastMessage = db.prepare(`
  SELECT text, time FROM messages
  WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
  ORDER BY time DESC
  LIMIT 1
`);

// ============ ПОЛЬЗОВАТЕЛИ ОНЛАЙН ============
const onlineUsers = {}; // { socketId: { name } }

function findSocketByName(name) {
  const entry = Object.entries(onlineUsers).find(([, u]) => u.name === name);
  return entry ? entry[0] : null;
}

function isOnline(name) {
  return Object.values(onlineUsers).some(u => u.name === name);
}

function broadcastContacts() {
  const allUsers = getAllUsers.all();
  const list = allUsers.map(u => ({
    name: u.name,
    online: isOnline(u.name)
  }));
  io.emit('contacts', list);
}

io.on('connection', (socket) => {
  console.log('Подключился:', socket.id);

  // ---- Вход ----
  socket.on('register', (name) => {
    onlineUsers[socket.id] = { name };
    saveUser.run(name, Date.now());
    broadcastContacts();
    console.log(`${name} вошёл`);
  });

  // ---- Запрос истории ----
  socket.on('load history', ({ me, withUser }) => {
    const rows = getHistory.all(me, withUser, withUser, me);
    socket.emit('history', { withUser, messages: rows });
  });

  // ---- Личное сообщение ----
  socket.on('private message', ({ to, text, from }) => {
    const time = Date.now();
    insertMessage.run(from, to, text, time);

    const toSocket = findSocketByName(to);
    if (toSocket) {
      io.to(toSocket).emit('private message', { from, text, time });
    }
    socket.emit('private message', { from, text, time, self: true, to });
  });

  // ---- Звонки ----
  socket.on('call-user', ({ to, from, offer, video }) => {
    const toSocket = findSocketByName(to);
    if (toSocket) {
      io.to(toSocket).emit('incoming-call', { from, offer, video });
    } else {
      socket.emit('call-failed', { reason: 'Пользователь не в сети' });
    }
  });

  socket.on('answer-call', ({ to, answer }) => {
    const toSocket = findSocketByName(to);
    if (toSocket) io.to(toSocket).emit('call-answered', { answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    const toSocket = findSocketByName(to);
    if (toSocket) io.to(toSocket).emit('ice-candidate', { candidate });
  });

  socket.on('end-call', ({ to }) => {
    const toSocket = findSocketByName(to);
    if (toSocket) io.to(toSocket).emit('call-ended');
  });

  // ---- Отключение ----
  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    broadcastContacts();
    console.log('Отключился:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Сервер запущен: http://localhost:3000');
});
