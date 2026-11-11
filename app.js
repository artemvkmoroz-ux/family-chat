'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v20.0 — FULL CLIENT (Part 1: Core)
   ═══════════════════════════════════════════════════════════ */

/* ─── 1. УТИЛИТЫ ─── */
const $ = id => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const fmtT = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fmtD = ms => new Date(ms).toLocaleString('ru-RU');
const ago = ms => { const m = Math.floor((now() - ms) / 6e4); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.floor(m / 60) + ' ч назад' : Math.floor(m / 1440) + ' дн назад'; };
const initials = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 && p[0] && p[1] ? (p[0][0] + p[1][0]).toUpperCase() : String(n || '?').slice(0, 2).toUpperCase(); };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const vib = ms => { if (state.settings?.vibration == 0) return; try { navigator.vibrate?.(ms || [10, 20, 10]); } catch {} };
const api = (ev, payload, cb) => socket.emit(ev, payload, typeof cb === 'function' ? cb : () => {});

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
function openModal(id) { const m = $(id); if (!m) return; m.classList.add('active'); if (!modalStack.includes(id)) modalStack.push(id); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $(id)?.classList.remove('active'); const i = modalStack.indexOf(id); if (i !== -1) modalStack.splice(i, 1); if (!modalStack.length) document.body.style.overflow = ''; }

let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const sp = $('splash-screen');
  if (sp) { sp.style.transition = 'opacity 0.3s'; sp.style.opacity = '0'; setTimeout(() => sp.remove(), 350); }
}
setTimeout(hideSplash, 2000);
setTimeout(hideSplash, 4000);

function renderBadges(u) {
  if (!u) return '';
  let h = '';
  if (u.premium) h += '<span class="premium-badge">⭐</span>';
  if (u.verified) h += '<span class="verified-badge">✓</span>';
  if (u.hammer) h += '<span class="hammer-badge">🔨</span>';
  if (u.scam) h += '<span class="scam-badge">SCAM</span>';
  return h;
}
function renderBadgesBig(u) { return renderBadges(u).replace(/class="(\w+-badge)"/g, 'class="$1 big"'); }
function displayName(u) { if (u === state.me.username) return 'Я'; const c = state.contacts.find(x => x.name === u); return c?.displayName || u; }

/* ─── 2. СОСТОЯНИЕ ─── */
const state = {
  me: { username: null, avatar: null, banner: null, avatarVideo: null, bannerVideo: null, premium: false, verified: false, hammer: false, scam: false, bio: '', firstName: '', lastName: '', birthday: '', emoji: '', stars: 0, sessionId: null, isModerator: false, mute: null },
  contacts: [], groups: [], channels: [], unread: {}, typingUsers: {}, blockedList: [],
  giftsCatalog: {}, myBots: [], storiesUsers: [],
  currentChat: null, currentGroup: null, currentChannel: null, isSavedChat: false, isBotChat: false,
  activeTab: 'chats', settings: {}, regStep: 1, regUsernameAvailable: false,
  replyToMessage: null, editingMessageId: null, pinnedMessageId: null,
  activeReactionMsgId: null, activeReactionGroupId: null, activeMessage: null,
  currentGiftTarget: null, currentGiftKey: null, currentChannelPostId: null,
  stickersData: [], stickerRecent: [], stickerCurrentTab: 'recent', stickerSearchQuery: '',
  currentStoryUserIdx: 0, currentStoryIdx: 0, storyTimer: null, storyTimerStart: 0,
  peerConnection: null, localStream: null, callActive: false, micOn: true, camOn: true,
  pendingOffer: null, incomingFrom: null, incomingVideo: false,
  callTimerInterval: null, callStartTime: 0,
  mediaRecorder: null, audioChunks: [], isRecording: false, cancelledRecording: false,
  recordingStartTime: 0, recordingTimer: null, currentAudioMime: '',
  lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  notificationsAllowed: false, createSelected: new Set(), addMembersSelected: new Set(),
  isLoggedIn: false, chatWallpapers: {}, contactProfileCurrent: null,
  editingBotUsername: null, tempBotAvatar: null,
  modPanelOpen: false, modTab: 'reports', modReportsFilter: 'new',
  modReports: [], modPunishments: [], modLogs: [], modStats: {},
  reportTarget: null, reportTargetMessageId: null, reportIsGroup: false,
  spoilerMode: false, botControlCurrent: null, botControlTab: 'chats',
  botChatCurrent: null, botReplyTo: null, currentColorTarget: null, titleFlashInterval: null
};

const STORAGE = { SESSION: 'aurora-session', UNREAD: 'aurora-unread', CONTACTS: 'aurora-contacts-cache', GROUPS: 'aurora-groups-cache', STICKERS: 'aurora-recent-stickers', SETTINGS: 'aurora-settings-cache', WALLPAPERS: 'aurora-wallpapers' };
const STORY_DURATION = 5000, SWIPE_THRESHOLD = 60, MAX_RECORDING_SEC = 60;

const REPORT_REASONS = { spam: '🚫 Спам', abuse: '🤬 Оскорбления', nsfw: '🔞 18+', scam: '💀 Мошенничество', ads: '📢 Реклама', other: '❓ Другое' };
const PUNISH_LABELS = { ban: '🚫 Бан', mute: '🔇 Мут', warn: '⚠️ Предупреждение' };

/* ─── 3. SOCKET ─── */
const socket = io({ reconnection: true, reconnectionAttempts: Infinity });

/* ─── 4. ДЕЛЕГИРОВАНИЕ ─── */
const ACTIONS = {};
function registerActions(map) { Object.assign(ACTIONS, map); }
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fn = ACTIONS[btn.dataset.action];
  if (!fn) return console.warn('No action:', btn.dataset.action);
  e.stopPropagation();
  try { fn(btn.dataset, btn, e); } catch (err) { console.error('action', btn.dataset.action, err); }
}, false);

/* ─── 5. АВТОРИЗАЦИЯ ─── */
let isLoggedInOnServer = false;

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
    premium: !!res.premium, verified: !!res.verified, hammer: !!res.hammer, scam: !!res.scam,
    bio: res.bio || '', firstName: res.firstName || '', lastName: res.lastName || '',
    birthday: res.birthday || '', emoji: res.emojiStatus || '',
    sessionId: res.sessionId, stars: Number(res.stars || 0),
    isModerator: !!res.is_moderator, mute: res.mute || null
  });
}

function enterApp(res, auto) {
  applyMe(res);
  state.isLoggedIn = true;
  isLoggedInOnServer = true;
  hideSplash();
  $('auth')?.classList.remove('active');
  $('app')?.classList.add('active');
  $('passcode-screen')?.classList.remove('active');
  
  setTimeout(() => {
    updateMyAvatarBtn(); renderChatList(); renderStoriesBar(); applyMuteLock();
    if (state.me.isModerator) api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
  }, 200);
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

/* ─── 6. НАСТРОЙКИ ─── */
function applyLocalSettings() {
  document.body.classList.toggle('light', state.settings.theme === 'light');
  document.body.classList.toggle('no-anim', state.settings.animations == 0);
}
window.changeTheme = function() {
  const v = state.settings.theme === 'light' ? 'dark' : 'light';
  api('update settings', { key: 'theme', value: v }, () => { state.settings.theme = v; applyLocalSettings(); renderSettings(); });
};
window.logout = function() {
  if (!confirm('Выйти?')) return;
  localStorage.clear(); location.reload();
};
window.toggleSetting = function(key) {
  const v = (state.settings[key] == 1) ? 0 : 1;
  api('update settings', { key, value: v }, () => { state.settings[key] = v; applyLocalSettings(); renderSettings(); });
};

function renderTgRow(o) {
  const type = o.type || 'arrow', cls = 'settings-tg-row' + (type === 'danger' ? ' danger' : '');
  let right = '';
  if (type === 'switch') right = `<label class="tg-row-switch" onclick="event.stopPropagation()"><input type="checkbox" ${o.checked ? 'checked' : ''}><span class="slider"></span></label>`;
  else if (type === 'arrow') { if (o.value != null && o.value !== '') right += `<span class="tg-row-value">${esc(o.value)}</span>`; right += '<span class="tg-row-arrow">›</span>'; }
  const actionAttr = o.action ? ` data-action="${o.action}"` : '';
  return `<div class="${cls}"${actionAttr}><span class="tg-row-icon">${o.icon || ''}</span><span class="tg-row-text">${esc(o.text || '')}</span>${right}</div>`;
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

/* ─── 7. СПИСОК ЧАТОВ ─── */
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

/* ─── 8. ОТКРЫТИЕ ЧАТА ─── */
function openChat(name) {
  state.currentChat = name; state.isSavedChat = false;
  if (state.unread[name]) { delete state.unread[name]; jset(STORAGE.UNREAD, state.unread); renderChatList(); }
  $('chat-top-name').textContent = displayName(name);
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
}
window.openChat = openChat;
window.closeChat = function() { $('chat-screen').classList.remove('active'); state.currentChat = null; renderChatList(); };

/* ─── 9. СООБЩЕНИЯ ─── */
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
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v20.0 — FULL CLIENT (Part 2: Features)
   ═══════════════════════════════════════════════════════════ */

/* ─── 10. СПИСОК ЧАТОВ (Группы и Каналы) ─── */
function renderChatListFull() {
  const box = $('chat-list'); if (!box) return; box.innerHTML = '';
  
  // Избранное
  const savedUnread = state.unread.__saved__ || 0;
  const savedItem = el('div', 'chat-item');
  savedItem.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые</div></div><div class="chat-meta">${savedUnread > 0 ? `<div class="chat-badge">${savedUnread}</div>` : ''}</div>`;
  savedItem.onclick = () => window.openSavedChat();
  box.appendChild(savedItem);

  // Группы
  if (state.groups.length) {
    box.appendChild(el('div', 'section-header', 'Группы'));
    state.groups.forEach(g => {
      const div = el('div', 'chat-item' + (state.currentGroup?.id === g.id ? ' active' : ''));
      const unread = state.unread['g:' + g.id] || 0;
      div.innerHTML = `<div class="avatar group">👥</div><div class="chat-info"><div class="chat-name">${esc(g.name)}</div><div class="chat-preview">${g.memberCount} участников</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
      div.onclick = () => window.openGroupChat(g);
      box.appendChild(div);
    });
  }

  // Каналы
  if (state.channels.length) {
    box.appendChild(el('div', 'section-header', 'Каналы'));
    state.channels.forEach(ch => {
      const div = el('div', 'chat-item');
      div.innerHTML = `<div class="avatar channel">📢</div><div class="chat-info"><div class="chat-name">${esc(ch.name)}</div><div class="chat-preview">@${esc(ch.slug)}</div></div>`;
      div.onclick = () => window.openChannelChat(ch);
      box.appendChild(div);
    });
  }

  // Личные чаты
  if (state.contacts.length) {
    box.appendChild(el('div', 'section-header', 'Личные'));
    state.contacts.forEach(u => {
      const div = el('div', 'chat-item');
      const unread = state.unread[u.name] || 0;
      const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
      const content = u.avatar ? '' : initials(u.displayName || u.name);
      div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)} ${renderBadges(u)}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
      div.onclick = () => window.openChat(u.name);
      box.appendChild(div);
    });
  }
}

/* ─── 11. ГРУППЫ ─── */
window.openGroupChat = function(g) {
  state.currentGroup = g; state.currentChat = null; state.currentChannel = null;
  if (state.unread['g:' + g.id]) { delete state.unread['g:' + g.id]; jset(STORAGE.UNREAD, state.unread); renderChatListFull(); }
  $('chat-top-name').textContent = g.name;
  $('chat-top-status').textContent = `${g.memberCount} участников`;
  $('chat-avatar').innerHTML = '👥'; $('chat-avatar').style.background = 'linear-gradient(135deg, #0f5132, #2d9e6b)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load group history', { groupId: g.id });
};

window.openSavedChat = function() {
  state.currentChat = null; state.currentGroup = null; state.isSavedChat = true;
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые';
  $('chat-avatar').innerHTML = '⭐'; $('chat-avatar').style.background = 'var(--gold)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load saved history');
};

window.createGroupAction = function() {
  const name = $('group-name')?.value.trim();
  if (!name) { if($('create-error')) $('create-error').textContent = 'Введи название'; return; }
  api('create group', { name, members: Array.from(state.createSelected) }, res => {
    if (!res?.ok) { if($('create-error')) $('create-error').textContent = res?.error || 'Ошибка'; return; }
    closeModal('create-group-modal'); toast('✓ Группа создана');
  });
};

/* ─── 12. КАНАЛЫ ─── */
window.openChannelChat = function(ch) {
  state.currentChannel = ch; state.currentChat = null; state.currentGroup = null;
  $('channel-top-name').textContent = ch.name;
  $('channel-screen').style.display = 'flex';
  api('load channel posts', { channelId: ch.id }, res => {
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = '';
    if (!res?.ok) return;
    res.posts.forEach(p => {
      const d = el('div', 'channel-post');
      d.innerHTML = `<div style="padding:10px;background:var(--bg-input);border-radius:10px;margin-bottom:10px;color:#fff;">${esc(p.text || '')}</div>`;
      box.appendChild(d);
    });
  });
};

window.createChannelAction = function() {
  const slug = $('channel-slug')?.value.trim().toLowerCase();
  const name = $('channel-name')?.value.trim();
  if (!slug || !name) { if($('create-channel-error')) $('create-channel-error').textContent = 'Заполни поля'; return; }
  api('create channel', { slug, name, description: $('channel-desc')?.value || '' }, res => {
    if (!res?.ok) { if($('create-channel-error')) $('create-channel-error').textContent = res?.error || 'Ошибка'; return; }
    closeModal('create-channel-modal'); toast('📢 Канал создан');
  });
};

/* ─── 13. СТИКЕРЫ ─── */
window.toggleStickersPanel = function() {
  const p = $('stickers-panel'); if (!p) return;
  if (p.classList.contains('active')) p.classList.remove('active');
  else {
    p.classList.add('active');
    api('load stickers', res => {
      if (res?.ok) {
        state.stickersData = res.stickers || [];
        const box = $('stickers-content'); if (!box) return;
        box.innerHTML = '';
        const grid = el('div', 'sticker-grid');
        state.stickersData.forEach(s => {
          const d = el('div', 'sticker-item');
          d.innerHTML = `<img src="${esc(s.url)}" style="width:100%;height:100%;object-fit:contain;">`;
          d.onclick = () => { window.sendSticker(s.url, s.type); window.toggleStickersPanel(); };
          grid.appendChild(d);
        });
        box.appendChild(grid);
      }
    });
  }
};

window.sendSticker = function(url, type) {
  if (state.isSavedChat) api('send sticker', { url, type, to: state.me.username });
  else if (state.currentChat) api('send sticker', { url, type, to: state.currentChat });
  else if (state.currentGroup) api('send sticker', { url, type, groupId: state.currentGroup.id });
};

/* ─── 14. ГЕОЛОКАЦИЯ ─── */
window.sendGeo = function() {
  if (!navigator.geolocation) return toast('⚠️ Геолокация недоступна');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
    const payload = { lat, lng };
    if (state.currentChat) payload.to = state.currentChat;
    else if (state.currentGroup) payload.groupId = state.currentGroup.id;
    else return;
    api('send geo', payload, res => { if (res?.ok) toast('📍 Отправлено'); });
  }, () => toast('⚠️ Нет доступа к гео'));
};

/* ─── 15. ЖАЛОБЫ ─── */
window.openReportModal = function(targetUser, messageId, isGroup) {
  state.reportTarget = targetUser || null;
  state.reportTargetMessageId = messageId || null;
  state.reportIsGroup = !!isGroup;
  const box = $('report-reasons');
  if (box) {
    box.innerHTML = '';
    Object.entries(REPORT_REASONS).forEach(([key, label]) => {
      const b = el('button', 'report-reason-btn', label);
      b.dataset.reason = key;
      b.onclick = () => {
        document.querySelectorAll('.report-reason-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      };
      box.appendChild(b);
    });
  }
  $('report-comment').value = '';
  $('report-error').textContent = '';
  openModal('report-modal');
};

window.submitReport = function() {
  const active = document.querySelector('.report-reason-btn.active'), err = $('report-error');
  if (err) err.textContent = '';
  if (!active) { if (err) err.textContent = 'Выбери причину'; return; }
  api('report', {
    targetUser: state.reportTarget,
    targetMessageId: state.reportTargetMessageId,
    targetIsGroup: state.reportIsGroup,
    reason: active.dataset.reason,
    comment: $('report-comment').value.trim() || null
  }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('report-modal');
    toast('🚨 Жалоба отправлена');
  });
};

/* ─── 16. МОДЕРАЦИЯ ─── */
window.openModPanel = function() {
  if (!state.me.isModerator) return toast('⚠️ Только для модераторов');
  state.modPanelOpen = true;
  window.switchModTab('reports');
  openModal('mod-panel-modal');
  api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
};

window.switchModTab = function(tab) {
  state.modTab = tab;
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.mod-section').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
  
  if (tab === 'reports') {
    api('get reports', { status: state.modReportsFilter }, r => {
      if (r?.ok) {
        state.modReports = r.reports || [];
        const box = $('mod-reports-list'); if (!box) return;
        if (!state.modReports.length) { box.innerHTML = '<div class="mod-empty">Жалоб нет 🎉</div>'; return; }
        box.innerHTML = '';
        state.modReports.forEach(rep => {
          const card = el('div', 'mod-report-card');
          card.innerHTML = `<div class="mrc-head"><span class="mrc-status ${rep.status === 'new' ? 'new' : 'resolved'}">${rep.status === 'new' ? '🆕' : '✓'}</span><span class="mrc-reason">${esc(REPORT_REASONS[rep.reason] || rep.reason)}</span></div><div class="mrc-row">От: @${esc(rep.reporter)}</div>`;
          box.appendChild(card);
        });
      }
    });
  } else if (tab === 'punishments') {
    api('get punishments', { active: true }, r => {
      if (r?.ok) {
        const box = $('mod-punishments-list'); if (!box) return;
        const list = r.punishments || [];
        if (!list.length) { box.innerHTML = '<div class="mod-empty">Наказаний нет ✅</div>'; return; }
        box.innerHTML = '';
        list.forEach(p => {
          const card = el('div', 'mod-punish-card');
          card.innerHTML = `<div class="mpc-head"><span class="mpc-type">${PUNISH_LABELS[p.type] || p.type}</span><span class="mpc-dur">${esc(p.duration_text)}</span></div><div class="mpc-row">@${esc(p.username)}</div>`;
          box.appendChild(card);
        });
      }
    });
  }
};

/* ─── 17. ПОДАРКИ ─── */
window.openGiftsCatalog = function(username) {
  username = username || state.contactProfileCurrent?.username;
  if (!username) return toast('⚠️ Не удалось определить получателя');
  state.currentGiftTarget = username;
  $('gifts-catalog-target').textContent = 'Кому: ' + (state.contacts.find(c => c.name === username)?.displayName || username);
  $('gifts-catalog-balance').textContent = state.me.stars;
  
  const grid = $('gifts-grid'); if (!grid) return;
  grid.innerHTML = '';
  Object.entries(state.giftsCatalog).forEach(([key, gift]) => {
    const affordable = state.me.stars >= gift.price;
    const d = el('div', 'gift-card ' + (affordable ? 'affordable' : 'unaffordable'));
    d.innerHTML = `<span class="gift-emoji">${gift.emoji}</span><span class="gift-name">${esc(gift.name)}</span><span class="gift-price">${gift.price} ⭐</span>`;
    if (affordable) d.onclick = () => window.openGiftMessageModal(key);
    grid.appendChild(d);
  });
  openModal('gifts-catalog-modal');
  closeModal('contact-profile-modal');
};

window.openGiftMessageModal = function(giftKey) {
  const gift = state.giftsCatalog[giftKey]; if (!gift) return;
  state.currentGiftKey = giftKey;
  $('gift-message-target').textContent = 'Кому: ' + state.currentGiftTarget;
  $('gift-message-preview').textContent = gift.emoji;
  $('gift-message-price').textContent = gift.price;
  $('gift-message-input').value = '';
  closeModal('gifts-catalog-modal');
  openModal('gift-message-modal');
};

window.confirmSendGift = function() {
  api('send gift', {
    to: state.currentGiftTarget,
    giftKey: state.currentGiftKey,
    message: $('gift-message-input').value.trim() || null
  }, res => {
    if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
    closeModal('gift-message-modal');
    toast('🎁 Подарок отправлен!');
  });
};

/* ─── 18. ЗВОНКИ (WebRTC) ─── */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};
let iceCandidatesQueue = [], isRemoteDescSet = false;

window.startCall = async function(video) {
  if (!state.currentChat || state.callActive) return;
  if (state.isBotChat) return toast('🤖 Ботам нельзя звонить');
  
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (err) {
    return alert('Нет доступа к микрофону/камере: ' + err.message);
  }

  state.callActive = true;
  $('call-peer-name').textContent = displayName(state.currentChat);
  $('call-status').textContent = 'Вызов...';
  $('call-screen').classList.add('active');
  
  if (video) {
    $('local-video-wrap').classList.add('active');
    $('localVideo').srcObject = state.localStream;
  }

  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  
  state.peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate });
  };
  
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-status').textContent = 'В разговоре';
    window.startCallTimer();
  };

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
};

window.acceptIncoming = async function() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;
  
  const from = state.incomingFrom, offer = state.pendingOffer;
  state.currentChat = from; state.pendingOffer = null; state.incomingFrom = null;
  
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.incomingVideo });
  } catch (err) {
    socket.emit('end-call', { to: from });
    return alert('Нет доступа');
  }

  state.callActive = true;
  $('call-peer-name').textContent = displayName(from);
  $('call-status').textContent = 'Соединение...';
  $('call-screen').classList.add('active');
  
  if (state.incomingVideo) {
    $('local-video-wrap').classList.add('active');
    $('localVideo').srcObject = state.localStream;
  }

  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  
  state.peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate });
  };
  
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-status').textContent = 'В разговоре';
    window.startCallTimer();
  };

  await state.peerConnection.setRemoteDescription(offer);
  isRemoteDescSet = true;
  iceCandidatesQueue.forEach(c => state.peerConnection.addIceCandidate(c).catch(() => {}));
  iceCandidatesQueue = [];

  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
};

window.cleanupCall = function() {
  state.callActive = false;
  clearInterval(state.callTimerInterval);
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  $('call-screen').classList.remove('active');
  $('incoming-screen').classList.remove('active');
  $('localVideo').srcObject = null;
  $('remoteVideo').srcObject = null;
};

window.startCallTimer = function() {
  state.callStartTime = Date.now();
  clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - state.callStartTime) / 1000);
    $('call-timer').textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }, 1000);
};

window.toggleMic = function() {
  if (state.localStream) {
    const t = state.localStream.getAudioTracks()[0];
    t.enabled = !t.enabled;
    $('micBtn').classList.toggle('off', !t.enabled);
  }
};

window.toggleCamera = function() {
  if (state.localStream) {
    const t = state.localStream.getVideoTracks()[0];
    t.enabled = !t.enabled;
    $('camBtn').classList.toggle('off', !t.enabled);
  }
};
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v20.0 — FULL CLIENT (Part 3: Actions & Init)
   ═══════════════════════════════════════════════════════════ */

/* ─── 19. ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (Профиль, Загрузка, Истории) ─── */
window.openProfile = function() {
  $('profile-username').textContent = '@' + (state.me.username || '');
  $('my-first-name').value = state.me.firstName || '';
  $('my-last-name').value = state.me.lastName || '';
  $('my-bio').value = state.me.bio || '';
  const p = $('profile-banner-preview'), img = $('profile-banner-img');
  if (state.me.banner && p && img) { img.src = state.me.banner; p.style.display = 'block'; } else if (p) p.style.display = 'none';
  openModal('profile-modal');
};

window.saveProfile = function() {
  api('update profile', {
    firstName: ($('my-first-name')?.value || '').trim(),
    lastName: ($('my-last-name')?.value || '').trim(),
    bio: ($('my-bio')?.value || '').trim()
  }, res => {
    if (!res?.ok) return;
    Object.assign(state.me, { firstName: $('my-first-name').value, lastName: $('my-last-name').value, bio: $('my-bio').value });
    closeModal('profile-modal');
    renderChatListFull();
    toast('✓ Профиль сохранён');
  });
};

window.pickAvatarMedia = function() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
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
        api('set avatar', { avatar: dataUrl });
        state.me.avatar = dataUrl;
        updateMyAvatarBtn();
        closeModal('profile-modal');
        toast('✓ Аватар обновлён');
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  };
  input.click();
};

window.pickBannerMedia = function() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 1200; c.height = 400;
        const ctx = c.getContext('2d');
        const sc = Math.max(1200/img.width, 400/img.height);
        ctx.drawImage(img, (1200-img.width*sc)/2, (400-img.height*sc)/2, img.width*sc, img.height*sc);
        const dataUrl = c.toDataURL('image/jpeg', 0.75);
        api('set banner', { banner: dataUrl }, res => {
          if (res?.ok) {
            state.me.banner = dataUrl;
            const p = $('profile-banner-preview'), im = $('profile-banner-img');
            if (im) im.src = dataUrl;
            if (p) p.style.display = 'block';
            toast('🎨 Баннер установлен');
          }
        });
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  };
  input.click();
};

window.sendPhoto = function(ev) {
  const file = ev.target.files[0]; if (!file) return;
  if (state.me.mute) { toast('🔇 Ты в муте'); ev.target.value = ''; return; }
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const max = 800; let w = img.width, h = img.height;
      if (w > h && w > max) { h = h * max / w; w = max; } else if (h > max) { w = w * max / h; h = max; }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL('image/jpeg', 0.75);
      if (state.currentChat) api('private message', { to: state.currentChat, image: dataUrl });
      else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, image: dataUrl });
      ev.target.value = '';
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
};

window.renderStoriesBar = function() {
  const row = $('stories-row'); if (!row) return;
  row.innerHTML = '';
  const mineBubble = document.createElement('div');
  mineBubble.className = 'story-bubble';
  mineBubble.innerHTML = `<div class="story-ring mine"><div class="story-ring-inner">${initials(state.me.username || '?')}</div><div class="story-add-badge">+</div></div><div class="story-name">Моя</div>`;
  mineBubble.onclick = () => openModal('story-add-modal');
  row.appendChild(mineBubble);
};

/* ─── 20. КАРТА ДЕЙСТВИЙ (Кнопки) ─── */
const APP_ACTIONS = {
  'tab': (d) => {
    state.activeTab = d.value;
    qsa('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === d.value));
    qsa('.app-tab').forEach(t => t.classList.remove('active'));
    $('tab-' + d.value)?.classList.add('active');
    if (d.value === 'settings') renderSettingsTab();
    if (d.value === 'chats') renderChatListFull();
  },
  'open-settings': () => { $('settings-screen')?.classList.add('active'); renderSettings(); },
  'close-settings': () => $('settings-screen')?.classList.remove('active'),
  'open-profile': () => openProfile(),
  'save-profile': () => saveProfile(),
  'pick-avatar': () => pickAvatarMedia(),
  'pick-banner': () => pickBannerMedia(),
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
  'toggle-attach': () => $('attach-menu')?.classList.toggle('active'),
  'close-attach': () => $('attach-menu')?.classList.remove('active'),
  'attach-photo': () => { $('attach-menu').classList.remove('active'); $('photoFile').click(); },
  'attach-geo': () => { $('attach-menu').classList.remove('active'); sendGeo(); },
  'attach-stickers': () => { $('attach-menu').classList.remove('active'); toggleStickersPanel(); },
  'open-mod-panel': () => openModPanel(),
  'open-gifts-catalog': (d) => openGiftsCatalog(d.username),
  'create-group': () => createGroupAction(),
  'create-channel': () => createChannelAction(),
  'submit-report': () => submitReport(),
};

// Регистрируем действия
registerActions(APP_ACTIONS);

/* ─── 21. СОКЕТЫ (Прием данных) ─── */
socket.on('contacts', list => {
  state.contacts = list || [];
  jset(STORAGE.CONTACTS, state.contacts);
  renderChatListFull();
});

socket.on('groups', list => {
  state.groups = list || [];
  renderChatListFull();
});

socket.on('channels', list => {
  state.channels = list || [];
  renderChatListFull();
});

socket.on('history', data => {
  if (data.withUser !== state.currentChat) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = '';
  data.messages.forEach(m => renderMessage({ id: m.id, from: m.from_user, text: m.text, time: m.time, self: m.from_user === state.me.username }));
});

socket.on('group history', data => {
  if (state.currentGroup?.id !== data.groupId) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = '';
  data.messages.forEach(m => renderMessage({ id: m.id, from: m.from_user, text: m.text, time: m.time, self: m.from_user === state.me.username }));
});

socket.on('private message', data => {
  if (data.from === state.currentChat && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false });
  } else if (!data.self) {
    state.unread[data.from] = (state.unread[data.from] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread);
    renderChatListFull();
  }
});

socket.on('group message', data => {
  if (state.currentGroup?.id === data.groupId && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false });
  } else if (!data.self) {
    state.unread['g:' + data.groupId] = (state.unread['g:' + data.groupId] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread);
    renderChatListFull();
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
  $('call-status').textContent = 'В разговоре';
  startCallTimer();
});

socket.on('ice-candidate', async data => {
  if (!state.peerConnection || !data.candidate) return;
  if (!isRemoteDescSet) iceCandidatesQueue.push(data.candidate);
  else await state.peerConnection.addIceCandidate(data.candidate).catch(()=>{});
});

socket.on('call-ended', () => cleanupCall());
socket.on('message blocked', d => toast(d.reason));

/* ─── 22. ГЛОБАЛЬНЫЙ ЗАПУСК ─── */
window.addEventListener('DOMContentLoaded', () => {
  // Восстанавливаем настройки
  const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
  const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
  const uc = jget(STORAGE.UNREAD); if (uc) state.unread = uc;

  // Проверяем сессию
  const creds = jget(STORAGE.SESSION);
  if (creds?.sessionId) {
    tryAutoLogin().then(ok => {
      if (!ok) { hideSplash(); $('auth').classList.add('active'); }
    });
  } else {
    hideSplash();
    $('auth').classList.add('active');
  }
});

console.log('%c✅ Azerta v20.0 — Запущена!', 'color:#4ade80;font-weight:bold;font-size:14px');