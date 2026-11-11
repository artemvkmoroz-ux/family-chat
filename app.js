'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v19.0 — FINAL CLIENT (Stable Release)
   ═══════════════════════════════════════════════════════════ */

/* ─── 1. УТИЛИТЫ ─── */
const $ = id => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const fmtT = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const initials = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 && p[0] && p[1] ? (p[0][0] + p[1][0]).toUpperCase() : String(n || '?').slice(0, 2).toUpperCase(); };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const vib = ms => { if (state.settings?.vibration == 0) return; try { navigator.vibrate?.(ms || [10, 20, 10]); } catch {} };

let toastTimer = null;
function toast(text) {
  let t = $('aurora-toast');
  if (!t) { t = el('div'); t.id = 'aurora-toast'; document.body.appendChild(t); }
  t.textContent = text;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

const modalStack = [];
function openModal(id) { const m = $(id); if (!m) return; m.classList.add('active'); if (!modalStack.includes(id)) modalStack.push(id); }
function closeModal(id) { $(id)?.classList.remove('active'); const i = modalStack.indexOf(id); if (i !== -1) modalStack.splice(i, 1); }

function hideSplash() {
  const sp = $('splash-screen');
  if (sp) { sp.style.transition = 'opacity 0.3s'; sp.style.opacity = '0'; setTimeout(() => sp.remove(), 350); }
}
// Страховка от черного экрана
setTimeout(hideSplash, 1500);
setTimeout(hideSplash, 3000);

function renderBadges(u) {
  if (!u) return '';
  let h = '';
  if (u.premium) h += '<span class="premium-badge">⭐</span>';
  if (u.verified) h += '<span class="verified-badge">✓</span>';
  return h;
}
function displayName(u) { if (u === state.me.username) return 'Я'; const c = state.contacts.find(x => x.name === u); return c?.displayName || u; }

/* ─── 2. СОСТОЯНИЕ ─── */
const state = {
  me: { username: null, avatar: null, avatarVideo: null, banner: null, bannerVideo: null, premium: false, verified: false, bio: '', firstName: '', lastName: '', birthday: '', emoji: '', stars: 0, sessionId: null, isModerator: false, mute: null },
  contacts: [], groups: [], channels: [], unread: {}, settings: {},
  currentChat: null, currentGroup: null, currentChannel: null, isSavedChat: false, isBotChat: false,
  activeTab: 'chats', replyToMessage: null, activeMessage: null,
  peerConnection: null, localStream: null, callActive: false, micOn: true, camOn: true,
  pendingOffer: null, incomingFrom: null, incomingVideo: false,
  callTimerInterval: null, callStartTime: 0,
  giftsCatalog: {}, myBots: [], modStats: {}, stickersData: []
};

const STORAGE = { SESSION: 'aurora-session', UNREAD: 'aurora-unread', CONTACTS: 'aurora-contacts-cache', SETTINGS: 'aurora-settings-cache' };

/* ─── 3. SOCKET ─── */
const socket = io({ reconnection: true, reconnectionAttempts: Infinity });
const api = (ev, payload, cb) => socket.emit(ev, payload, typeof cb === 'function' ? cb : () => {});

/* ─── 4. ДЕЛЕГИРОВАНИЕ (Кнопки) ─── */
const ACTIONS = {};
function registerActions(map) { Object.assign(ACTIONS, map); }

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fn = ACTIONS[btn.dataset.action];
  if (!fn) return console.warn('⚠️ Нет действия:', btn.dataset.action);
  e.stopPropagation();
  try { fn(btn.dataset, btn, e); } catch (err) { console.error('❌ Ошибка действия:', btn.dataset.action, err); }
}, false);

/* ─── 5. RIPPLE (Красивое нажатие) ─── */
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.auth-btn-primary,.modal-primary,.modal-secondary,.create-menu-btn,.nav-btn,.settings-tg-row,.chat-item,.back-btn,.icon-btn,#burger,#send-btn,.attach,.action-item');
  if (!el || el.disabled) return;
  if (!el.classList.contains('ripple-container')) el.classList.add('ripple-container');
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const d = document.createElement('span'); d.className = 'ripple';
  Object.assign(d.style, { width: s + 'px', height: s + 'px', left: (e.clientX - r.left - s/2) + 'px', top: (e.clientY - r.top - s/2) + 'px' });
  el.appendChild(d); setTimeout(() => d.remove(), 700);
}, { passive: true });

/* ─── 6. АВТОРИЗАЦИЯ ─── */
let autoLoginDone = false;

function showBanScreen(ban) {
  let s = $('ban-screen'); if (!s) { s = el('div'); s.id = 'ban-screen'; document.body.appendChild(s); }
  const until = ban.expires_at ? new Date(ban.expires_at).toLocaleString('ru-RU') : 'никогда';
  s.innerHTML = `<div class="ban-screen-inner"><div class="ban-emoji">🚫</div><h2>Ты забанен</h2><div class="ban-reason"><div class="ban-label">Причина:</div><div class="ban-value">${esc(ban.reason || 'Не указана')}</div></div><div class="ban-until"><div class="ban-label">До:</div><div class="ban-value">${esc(until)}</div></div><button type="button" class="modal-secondary" onclick="location.reload()">🔄 Проверить снова</button></div>`;
  s.classList.add('active');
}

function applyMe(res) {
  Object.assign(state.me, {
    username: res.username, avatar: res.avatar || null, banner: res.banner || null,
    avatarVideo: res.avatarVideo || res.avatar_video || null,
    bannerVideo: res.bannerVideo || res.banner_video || null,
    premium: !!res.premium, verified: !!res.verified,
    bio: res.bio || '', firstName: res.firstName || '', lastName: res.lastName || '',
    sessionId: res.sessionId, stars: Number(res.stars || 0),
    isModerator: !!res.is_moderator, mute: res.mute || null
  });
}

function enterApp(res, auto) {
  applyMe(res);
  state.isLoggedIn = true;
  hideSplash();
  $('auth')?.classList.remove('active');
  $('app')?.classList.add('active');
  $('passcode-screen')?.classList.remove('active');
  
  setTimeout(() => {
    updateMyAvatarBtn(); renderChatList(); applyMuteLock();
  }, 100);
}

function onLoggedIn(res, auto) {
  jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
  enterApp(res, !!auto);
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
}

window.doLogin = function() {
  const username = $('login-username')?.value.trim().toLowerCase() || '';
  const password = $('login-password')?.value || '';
  const err = $('login-error'); if (err) err.textContent = '';
  if (!username || !password) { if (err) err.textContent = 'Заполни все поля'; return; }
  
  const btn = $('login-btn'), t = btn.querySelector('.btn-text');
  if (t) t.textContent = 'Вхожу…'; btn.disabled = true;

  api('login', { username, password }, res => {
    if (t) t.textContent = 'Войти'; btn.disabled = false;
    if (!res?.ok) { if (res?.banned) { showBanScreen(res.ban); return; } if (err) err.textContent = res?.error || 'Ошибка входа'; return; }
    onLoggedIn(res, false);
  });
};

async function tryAutoLogin() {
  const creds = jget(STORAGE.SESSION);
  if (!creds?.sessionId) return false;
  return new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 5000);
    api('login with session', { sessionId: creds.sessionId }, res => {
      if (done) return; done = true; clearTimeout(t);
      if (!res?.ok) {
        if (res?.banned) { showBanScreen(res.ban); resolve(true); return; }
        localStorage.removeItem(STORAGE.SESSION); resolve(false); return;
      }
      onLoggedIn(res, true);
      resolve(true);
    });
  });
}

window.switchAuthScreen = function(mode) {
  qsa('.auth-screen').forEach(x => x.classList.remove('active'));
  $(mode === 'login' ? 'auth-login-screen' : 'auth-register-screen')?.classList.add('active');
};

window.togglePassword = function(id) {
  const i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password';
};

/* ─── 7. НАСТРОЙКИ ─── */
function applyLocalSettings() {
  document.body.classList.toggle('light', state.settings.theme === 'light');
}
window.changeTheme = function() {
  const v = state.settings.theme === 'light' ? 'dark' : 'light';
  api('update settings', { key: 'theme', value: v }, () => { state.settings.theme = v; applyLocalSettings(); renderSettings(); });
};
window.logout = function() {
  if (!confirm('Выйти?')) return;
  localStorage.clear(); location.reload();
};

function renderTgRow(o) {
  const type = o.type || 'arrow', cls = 'settings-tg-row' + (type === 'danger' ? ' danger' : '');
  let right = '';
  if (type === 'switch') right = `<label class="tg-row-switch" onclick="event.stopPropagation()"><input type="checkbox" ${o.checked ? 'checked' : ''}><span class="slider"></span></label>`;
  else if (type === 'color') right = `<span class="tg-row-color-dot" style="background:${o.color || '#e63946'};"></span><span class="tg-row-arrow">›</span>`;
  else if (type === 'arrow') { if (o.value != null && o.value !== '') right += `<span class="tg-row-value">${esc(o.value)}</span>`; right += '<span class="tg-row-arrow">›</span>'; }
  const actionAttr = o.action ? ` data-action="${o.action}"` : '';
  const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : '';
  return `<div class="${cls}"${actionAttr}${dataAttrs}><span class="tg-row-icon">${o.icon || ''}</span><span class="tg-row-text">${esc(o.text || '')}</span>${right}</div>`;
}

function renderSettings() {
  const box = $('settings-content'); if (!box) return;
  const me = state.me, s = state.settings;
  const display = (me.firstName || me.lastName) ? `${me.firstName} ${me.lastName || ''}`.trim() : '@' + me.username;
  
  box.innerHTML = `
    <div class="settings-profile-card-tg" data-action="open-profile">
      <div class="tg-profile-row">
        <div class="tg-profile-avatar" style="${me.avatar ? `background-image:url(${me.avatar})` : ''}">${me.avatar ? '' : initials(me.username)}</div>
        <div class="tg-profile-info">
          <div class="tg-profile-name">${esc(display)} ${renderBadges(me)}</div>
          <div class="tg-profile-username">@${esc(me.username)}</div>
        </div>
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div><div class="settings-tg-group">
      ${renderTgRow({ icon: '🎨', text: 'Тема', value: s.theme === 'light' ? 'Светлая' : 'Тёмная', action: 'change-theme' })}
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">${renderTgRow({ icon: '🚪', text: 'Выйти', type: 'danger', action: 'logout' })}</div></div>
  `;
}
window.renderSettings = renderSettings;
window.renderSettingsTab = function() { const box = $('tab-settings-content'), orig = $('settings-content'); if (!box || !orig) return; renderSettings(); box.innerHTML = orig.innerHTML; };

/* ─── 8. СПИСОК ЧАТОВ ─── */
function renderChatList() {
  const box = $('chat-list'); if (!box) return; box.innerHTML = '';
  state.contacts.forEach(u => {
    const div = el('div', 'chat-item');
    const unread = state.unread[u.name] || 0;
    const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
    const content = u.avatar ? '' : initials(u.displayName || u.name);
    div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)} ${renderBadges(u)}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
    div.onclick = () => openChat(u.name); box.appendChild(div);
  });
}
window.renderChatList = renderChatList;

/* ─── 9. ОТКРЫТИЕ ЧАТА ─── */
function openChat(name) {
  state.currentChat = name; state.isSavedChat = false;
  if (state.unread[name]) { delete state.unread[name]; jset(STORAGE.UNREAD, state.unread); renderChatList(); }
  $('chat-top-name').textContent = displayName(name);
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
}
window.openChat = openChat;
window.closeChat = function() { $('chat-screen').classList.remove('active'); state.currentChat = null; renderChatList(); };

/* ─── 10. СООБЩЕНИЯ ─── */
function renderMessage(msg) {
  const box = $('messages'); if (!box) return;
  const wrap = el('div', 'msg-wrap ' + (msg.self ? 'self' : 'other'));
  wrap.dataset.id = msg.id; if (msg.from) wrap.dataset.from = msg.from;
  const div = el('div', 'msg ' + (msg.self ? 'self' : 'other'));
  if (msg.text) div.appendChild(el('span', 'msg-text', esc(msg.text)));
  div.appendChild(el('span', 'meta', fmtT(msg.time)));
  wrap.appendChild(div); box.appendChild(wrap); box.scrollTop = box.scrollHeight;
}
window.renderMessage = renderMessage;

window.sendMsg = function() {
  const input = $('msgInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  if (state.currentChat) api('private message', { to: state.currentChat, text });
  input.value = ''; cancelReply();
};

function cancelReply() { state.replyToMessage = null; $('reply-preview')?.classList.remove('active'); }
window.cancelReply = cancelReply;
window.updateMyAvatarBtn = function() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatar) btn.innerHTML = `<img src="${state.me.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else btn.textContent = '👤';
};

function applyMuteLock() {
  if (!state.me.mute) return;
  const input = $('msgInput'), send = $('send-btn');
  if (input) { input.disabled = true; input.placeholder = '🔇 Ты в муте'; }
  if (send) send.disabled = true;
}

/* ─── 11. ЗВОНКИ ─── */
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let iceCandidatesQueue = [], isRemoteDescSet = false;

window.startCall = async function(video) {
  if (!state.currentChat || state.callActive) return;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video }); } catch (err) { return alert('Нет доступа'); }
  state.callActive = true;
  $('call-peer-name').textContent = displayName(state.currentChat);
  $('call-status').textContent = 'Вызов...';
  $('call-screen').classList.add('active');
  if (video) { $('local-video-wrap').classList.add('active'); $('localVideo').srcObject = state.localStream; }
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('call-status').textContent = 'В разговоре'; startCallTimer(); };
  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
};

window.acceptIncoming = async function() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;
  const from = state.incomingFrom, offer = state.pendingOffer;
  state.currentChat = from; state.pendingOffer = null; state.incomingFrom = null;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.incomingVideo }); } catch (err) { socket.emit('end-call', { to: from }); return alert('Нет доступа'); }
  state.callActive = true;
  $('call-peer-name').textContent = displayName(from);
  $('call-status').textContent = 'Соединение...';
  $('call-screen').classList.add('active');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('call-status').textContent = 'В разговоре'; startCallTimer(); };
  await state.peerConnection.setRemoteDescription(offer);
  isRemoteDescSet = true;
  iceCandidatesQueue.forEach(c => state.peerConnection.addIceCandidate(c).catch(()=>{}));
  iceCandidatesQueue = [];
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
};

window.cleanupCall = function() {
  state.callActive = false; clearInterval(state.callTimerInterval);
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  $('call-screen').classList.remove('active'); $('incoming-screen').classList.remove('active');
  $('localVideo').srcObject = null; $('remoteVideo').srcObject = null;
};
function startCallTimer() { state.callStartTime = Date.now(); clearInterval(state.callTimerInterval); state.callTimerInterval = setInterval(() => { const s = Math.floor((Date.now() - state.callStartTime) / 1000); $('call-timer').textContent = `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }, 1000); }
window.toggleMic = function() { if (state.localStream) { const t = state.localStream.getAudioTracks()[0]; t.enabled = !t.enabled; $('micBtn').classList.toggle('off', !t.enabled); } };
window.toggleCamera = function() { if (state.localStream) { const t = state.localStream.getVideoTracks()[0]; t.enabled = !t.enabled; $('camBtn').classList.toggle('off', !t.enabled); } };

/* ─── 12. КАРТА ДЕЙСТВИЙ (Кнопки) ─── */
registerActions({
  'tab': (d) => {
    state.activeTab = d.value;
    qsa('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === d.value));
    qsa('.app-tab').forEach(t => t.classList.remove('active'));
    $('tab-' + d.value)?.classList.add('active');
    if (d.value === 'settings') renderSettingsTab();
  },
  'open-settings': () => { $('settings-screen')?.classList.add('active'); renderSettings(); },
  'close-settings': () => $('settings-screen')?.classList.remove('active'),
  'close-chat': () => closeChat(),
  'send-msg': () => sendMsg(),
  'cancel-reply': () => cancelReply(),
  'logout': () => logout(),
  'change-theme': () => changeTheme(),
  'call-audio': () => startCall(false),
  'call-video': () => startCall(true),
  'accept-call': () => acceptIncoming(),
  'decline-call': () => { $('incoming-screen').classList.remove('active'); if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom }); },
  'hangup': () => { if (state.currentChat) socket.emit('end-call', { to: state.currentChat }); cleanupCall(); },
  'toggle-mic': () => toggleMic(),
  'toggle-camera': () => toggleCamera(),
  'reload': () => location.reload(),
  'open-modal': (d) => openModal(d.target),
  'close-modal': (d) => closeModal(d.target),
  'toggle-password': (d) => togglePassword(d.target),
  'switch-auth': (d) => switchAuthScreen(d.mode),
  'login': () => doLogin(),
});

/* ─── 13. СОКЕТЫ (Прием данных) ─── */
socket.on('contacts', list => {
  state.contacts = list || [];
  jset(STORAGE.CONTACTS, state.contacts);
  renderChatList();
});

socket.on('history', data => {
  if (data.withUser !== state.currentChat) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = '';
  data.messages.forEach(m => renderMessage({ id: m.id, from: m.from_user, text: m.text, time: m.time, self: m.from_user === state.me.username }));
});

socket.on('private message', data => {
  if (data.from === state.currentChat && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false });
  } else if (!data.self) {
    state.unread[data.from] = (state.unread[data.from] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread); renderChatList();
  }
});

socket.on('incoming-call', data => {
  state.incomingFrom = data.from; state.incomingVideo = data.video; state.pendingOffer = data.offer;
  $('incoming-name').textContent = displayName(data.from);
  $('incoming-type').textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';
  $('incoming-screen').classList.add('active');
});

socket.on('call-answered', async data => {
  if (!state.peerConnection) return;
  await state.peerConnection.setRemoteDescription(data.answer);
  isRemoteDescSet = true;
  iceCandidatesQueue.forEach(c => state.peerConnection.addIceCandidate(c).catch(()=>{}));
  iceCandidatesQueue = [];
  $('call-status').textContent = 'В разговоре'; startCallTimer();
});

socket.on('ice-candidate', async data => {
  if (!state.peerConnection || !data.candidate) return;
  if (!isRemoteDescSet) iceCandidatesQueue.push(data.candidate);
  else await state.peerConnection.addIceCandidate(data.candidate).catch(()=>{});
});

socket.on('call-ended', () => cleanupCall());
socket.on('message blocked', d => toast(d.reason));

/* ─── 14. ЗАПУСК (Точка входа) ─── */
window.addEventListener('DOMContentLoaded', () => {
  const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
  const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
  
  const creds = jget(STORAGE.SESSION);
  if (creds?.sessionId) {
    tryAutoLogin().then(ok => {
      if (!ok) { hideSplash(); $('auth').classList.add('active'); }
    });
  } else {
    hideSplash(); $('auth').classList.add('active');
  }
});

console.log('%c✅ Azerta v19.0 — Запущена!', 'color:#4ade80;font-weight:bold;font-size:14px');