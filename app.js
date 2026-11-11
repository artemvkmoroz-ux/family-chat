'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA — FINAL FIXED APP.JS (Всё в одном файле)
   ═══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const initials = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 && p[0] && p[1] ? (p[0][0] + p[1][0]).toUpperCase() : String(n || '?').slice(0, 2).toUpperCase(); };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };

const socket = io({ reconnection: true, reconnectionAttempts: Infinity });
const api = (ev, payload, cb) => socket.emit(ev, payload, typeof cb === 'function' ? cb : () => {});

const state = {
  me: { username: null, avatar: null, banner: null, avatarVideo: null, bannerVideo: null, premium: false, verified: false, bio: '', firstName: '', lastName: '', stars: 0, sessionId: null, isModerator: false, mute: null },
  contacts: [], groups: [], channels: [], unread: {}, settings: {}, giftsCatalog: {},
  currentChat: null, currentGroup: null, currentChannel: null, activeTab: 'chats', isBotChat: false,
  peerConnection: null, localStream: null, callActive: false, micOn: true, camOn: true, incomingFrom: null, incomingVideo: false, pendingOffer: null
};

const STORAGE = { SESSION: 'aurora-session', UNREAD: 'aurora-unread', CONTACTS: 'aurora-contacts-cache', SETTINGS: 'aurora-settings-cache' };

function hideSplash() { const sp = $('splash-screen'); if (sp) { sp.style.opacity = '0'; setTimeout(() => sp.remove(), 300); } }
setTimeout(hideSplash, 1500); // ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ

function toast(text) { alert(text); }
function openModal(id) { $(id)?.classList.add('active'); }
function closeModal(id) { $(id)?.classList.remove('active'); }
function playPing() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(), g = ctx.createGain(); osc.connect(g); g.connect(ctx.destination); osc.frequency.setValueAtTime(880, ctx.currentTime); g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2); osc.start(); osc.stop(ctx.currentTime + 0.25); } catch {} }

/* ─── АВТОРИЗАЦИЯ ─── */
window.doLogin = function() {
  const u = $('login-username')?.value.trim().toLowerCase();
  const p = $('login-password')?.value;
  if (!u || !p) return alert('Заполни поля');
  
  const btn = $('login-btn'), t = btn.querySelector('.btn-text');
  if (t) t.textContent = 'Вхожу...';

  api('login', { username: u, password: p }, (res) => {
    if (t) t.textContent = '🎅 Войти';
    if (res && res.ok) {
      jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
      applyMe(res);
      showApp();
    } else {
      alert(res?.error || 'Ошибка');
    }
  });
};

async function tryAutoLogin() {
  const creds = jget(STORAGE.SESSION);
  if (!creds?.sessionId) return false;
  return new Promise(res => {
    api('login with session', { sessionId: creds.sessionId }, (r) => {
      if (r && r.ok) { applyMe(r); showApp(); res(true); }
      else { res(false); }
    });
  });
}

function applyMe(res) {
  Object.assign(state.me, {
    username: res.username, avatar: res.avatar, banner: res.banner,
    avatarVideo: res.avatarVideo || res.avatar_video, bannerVideo: res.bannerVideo || res.banner_video,
    premium: !!res.premium, verified: !!res.verified, firstName: res.firstName, lastName: res.lastName,
    stars: Number(res.stars || 0), isModerator: !!res.is_moderator, mute: res.mute
  });
}

function showApp() {
  hideSplash();
  $('auth')?.classList.remove('active');
  $('app')?.classList.add('active');
  updateMyAvatarBtn();
  renderChatList();
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
}

/* ─── СПИСОК ЧАТОВ ─── */
function renderChatList() {
  const box = $('chat-list'); if (!box) return;
  box.innerHTML = '';
  
  const saved = el('div', 'chat-item');
  saved.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые</div></div>`;
  saved.onclick = () => openChat('__saved__');
  box.appendChild(saved);

  if (state.contacts.length) {
    box.appendChild(el('div', 'section-header', 'ЛИЧНЫЕ'));
    state.contacts.forEach(u => {
      const div = el('div', 'chat-item');
      const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
      const content = u.avatar ? '' : initials(u.displayName || u.name);
      div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div>`;
      div.onclick = () => openChat(u.name);
      box.appendChild(div);
    });
  }
}

/* ─── ЧАТ ─── */
function openChat(name) {
  state.currentChat = name;
  $('chat-screen').classList.add('active');
  $('chat-top-name').textContent = name === '__saved__' ? 'Избранное' : name;
  $('messages').innerHTML = '';
  
  api('load history', { withUser: name === '__saved__' ? state.me.username : name }, (data) => {
    const box = $('messages');
    if (data && data.messages) {
      data.messages.forEach(m => {
        const isSelf = m.from_user === state.me.username;
        const d = el('div', `msg-wrap ${isSelf ? 'self' : 'other'}`);
        d.innerHTML = `<div class="msg ${isSelf ? 'self' : 'other'}">${esc(m.text)}</div>`;
        box.appendChild(d);
      });
      box.scrollTop = box.scrollHeight;
    }
  });
}

window.closeChat = function() { $('chat-screen').classList.remove('active'); state.currentChat = null; };

window.sendMsg = function() {
  const input = $('msgInput');
  const text = input.value.trim();
  if (!text || !state.currentChat) return;
  const to = state.currentChat === '__saved__' ? state.me.username : state.currentChat;
  api('private message', { to, text });
  input.value = '';
};

/* ─── НАСТРОЙКИ ─── */
window.openSettings = function() {
  $('settings-screen').classList.add('active');
  renderSettings();
};

window.closeSettings = function() {
  $('settings-screen').classList.remove('active');
};

function renderSettings() {
  const box = $('settings-content'); if (!box) return;
  const me = state.me;
  
  box.innerHTML = `
    <div class="settings-profile-card-tg" onclick="openProfile()">
      <div class="tg-profile-row">
        <div class="tg-profile-avatar" style="${me.avatar ? `background-image:url(${me.avatar})` : ''}">${me.avatar ? '' : '👤'}</div>
        <div class="tg-profile-info">
          <div class="tg-profile-name">${esc(me.firstName || me.username || 'Профиль')}</div>
          <div class="tg-profile-username">@${esc(me.username || '')}</div>
        </div>
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div><div class="settings-tg-group">
      <div class="settings-tg-row" onclick="changeTheme()"><span class="tg-row-icon">🎨</span><span class="tg-row-text">Сменить тему</span><span class="tg-row-arrow">›</span></div>
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">
      <div class="settings-tg-row danger" onclick="logout()"><span class="tg-row-icon">🚪</span><span class="tg-row-text">Выйти</span></div>
    </div></div>
  `;
}

window.openProfile = function() {
  $('profile-username').textContent = '@' + (state.me.username || '');
  $('my-first-name').value = state.me.firstName || '';
  $('my-last-name').value = state.me.lastName || '';
  $('my-bio').value = state.me.bio || '';
  openModal('profile-modal');
};

window.saveProfile = function() {
  const data = { firstName: $('my-first-name').value.trim(), lastName: $('my-last-name').value.trim(), bio: $('my-bio').value.trim() };
  api('update profile', data, (res) => {
    if (res && res.ok) { Object.assign(state.me, data); closeModal('profile-modal'); renderSettings(); alert('Сохранено'); }
  });
};

window.pickAvatarMedia = function() {
  const input = el('input'); input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const ctx = c.getContext('2d'); const m = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, 200, 200);
        const dataUrl = c.toDataURL('image/jpeg', 0.8);
        api('set avatar', { avatar: dataUrl }); state.me.avatar = dataUrl;
        closeModal('profile-modal'); updateMyAvatarBtn(); alert('Аватар обновлён');
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  };
  input.click();
};

window.changeTheme = function() {
  const v = state.settings.theme === 'light' ? 'dark' : 'light';
  api('update settings', { key: 'theme', value: v }, () => { state.settings.theme = v; document.body.classList.toggle('light', v === 'light'); renderSettings(); });
};

window.logout = function() { if (confirm('Выйти?')) { localStorage.clear(); location.reload(); } };

window.togglePassword = function(id) { const i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password'; };

/* ─── ВКЛАДКИ ─── */
window.switchTab = function(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  $('tab-' + tab)?.classList.add('active');
  
  if (tab === 'chats') {
    $('chat-list').style.display = 'block';
    $('search-wrap').style.display = 'block';
    renderChatList();
  } else {
    $('chat-list').style.display = 'none';
    $('search-wrap').style.display = 'none';
    if (tab === 'settings') openSettings();
  }
};

window.updateMyAvatarBtn = function() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatar) btn.style.backgroundImage = `url(${state.me.avatar})`;
  else btn.textContent = '👤';
};

/* ─── ЗВОНКИ ─── */
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

window.startCall = async function(video) {
  if (!state.currentChat || state.callActive) return;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video }); } catch (err) { return alert('Нет доступа'); }
  state.callActive = true;
  $('call-peer-name').textContent = state.currentChat;
  $('call-status').textContent = 'Вызов...';
  $('call-screen').classList.add('active');
  if (video) { $('local-video-wrap').classList.add('active'); $('localVideo').srcObject = state.localStream; }
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('call-status').textContent = 'В разговоре'; };
  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
};

window.acceptIncoming = async function() {
  $('incoming-screen').classList.remove('active');
  const from = state.incomingFrom, offer = state.pendingOffer;
  state.incomingFrom = null;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.incomingVideo }); } catch (err) { socket.emit('end-call', { to: from }); return alert('Нет доступа'); }
  state.callActive = true;
  $('call-peer-name').textContent = from;
  $('call-status').textContent = 'Соединение...';
  $('call-screen').classList.add('active');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('call-status').textContent = 'В разговоре'; };
  await state.peerConnection.setRemoteDescription(offer);
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
};

window.declineIncoming = function() { $('incoming-screen').classList.remove('active'); if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom }); };
window.hangup = function() { if (state.currentChat) socket.emit('end-call', { to: state.currentChat }); cleanupCall(); };
function cleanupCall() { state.callActive = false; if (state.peerConnection) state.peerConnection.close(); if (state.localStream) state.localStream.getTracks().forEach(t => t.stop()); $('call-screen').classList.remove('active'); }
window.toggleMic = function() { if (state.localStream) { const t = state.localStream.getAudioTracks()[0]; t.enabled = !t.enabled; } };
window.toggleCamera = function() { if (state.localStream) { const t = state.localStream.getVideoTracks()[0]; t.enabled = !t.enabled; } };

/* ─── СОКЕТЫ ─── */
socket.on('private message', data => {
  if (data.from === state.currentChat && !data.self) {
    const box = $('messages');
    const d = el('div', 'msg-wrap other');
    d.innerHTML = `<div class="msg other">${esc(data.text)}</div>`;
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
});

socket.on('contacts', list => { state.contacts = list || []; renderChatList(); });
socket.on('incoming-call', data => {
  state.incomingFrom = data.from; state.incomingVideo = data.video; state.pendingOffer = data.offer;
  $('incoming-name').textContent = data.from;
  $('incoming-screen').classList.add('active'); playPing();
});
socket.on('call-answered', async data => {
  if (!state.peerConnection) return;
  await state.peerConnection.setRemoteDescription(data.answer);
  $('call-status').textContent = 'В разговоре';
});
socket.on('ice-candidate', async data => { if (state.peerConnection && data.candidate) await state.peerConnection.addIceCandidate(data.candidate).catch(()=>{}); });
socket.on('call-ended', () => cleanupCall());

/* ─── ЗАПУСК ─── */
window.addEventListener('load', async () => {
  const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
  const sc = jget(STORAGE.SETTINGS); if (sc) state.settings = sc;
  
  const ok = await tryAutoLogin();
  if (!ok) {
    $('auth').classList.add('active');
    hideSplash();
  }
});