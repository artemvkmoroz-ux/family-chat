const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 5e6 });

app.use(express.static(path.join(__dirname)));

// ============ БАЗА ============
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
    avatar TEXT,
    registered_at INTEGER NOT NULL
  )
`);

// Если таблица старая и без avatar — добавим колонку
try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT'); } catch (e) {}

const insertMessage = db.prepare(
  'INSERT INTO messages (from_user, to_user, text, time) VALUES (?, ?, ?, ?)'
);
const getHistory = db.prepare(`
  SELECT * FROM messages
  WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?)
  ORDER BY time ASC LIMIT 200
`);
const saveUser = db.prepare(
  'INSERT OR IGNORE INTO users (name, registered_at) VALUES (?, ?)'
);
const updateAvatar = db.prepare('UPDATE users SET avatar = ? WHERE name = ?');
const getAllUsers = db.prepare('SELECT name, avatar FROM users ORDER BY registered_at ASC');

// ============ ONLINE ============
const onlineUsers = {};
function findSocketByName(name) {
  const e = Object.entries(onlineUsers).find(([, u]) => u.name === name);
  return e ? e[0] : null;
}
function isOnline(name) {
  return Object.values(onlineUsers).some(u => u.name === name);
}
function broadcastContacts() {
  const all = getAllUsers.all().map(u => ({
    name: u.name,
    avatar: u.avatar || null,
    online: isOnline(u.name)
  }));
  io.emit('contacts', all);
}

io.on('connection', (socket) => {
  socket.on('register', (name) => {
    onlineUsers[socket.id] = { name };
    saveUser.run(name, Date.now());
    broadcastContacts();
  });

  socket.on('set avatar', ({ name, avatar }) => {
    updateAvatar.run(avatar, name);
    broadcastContacts();
  });

  socket.on('load history', ({ me, withUser }) => {
    const rows = getHistory.all(me, withUser, withUser, me);
    socket.emit('history', { withUser, messages: rows });
  });

  socket.on('private message', ({ to, text, from }) => {
    const time = Date.now();
    insertMessage.run(from, to, text, time);
    const toSocket = findSocketByName(to);
    if (toSocket) io.to(toSocket).emit('private message', { from, text, time });
    socket.emit('private message', { from, text, time, self: true, to });
  });

  socket.on('call-user', ({ to, from, offer, video }) => {
    const toSocket = findSocketByName(to);
    if (toSocket) io.to(toSocket).emit('incoming-call', { from, offer, video });
    else socket.emit('call-failed', { reason: 'Пользователь не в сети' });
  });
  socket.on('answer-call', ({ to, answer }) => {
    const s = findSocketByName(to); if (s) io.to(s).emit('call-answered', { answer });
  });
  socket.on('ice-candidate', ({ to, candidate }) => {
    const s = findSocketByName(to); if (s) io.to(s).emit('ice-candidate', { candidate });
  });
  socket.on('end-call', ({ to }) => {
    const s = findSocketByName(to); if (s) io.to(s).emit('call-ended');
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    broadcastContacts();
  });
});

server.listen(3000, () => console.log('Сервер запущен: http://localhost:3000'));
