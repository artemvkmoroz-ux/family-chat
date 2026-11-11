'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v13.8 — Часть 1 (Ядро, Авторизация)
   ═══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now();
const fmtT = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fmtD = ms => new Date(ms).toLocaleString('ru-RU');
const initials = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 && p[0] && p[1] ? (p[0][0] + p[1][0]).toUpperCase() : String(n || '?').slice(0, 2).toUpperCase(); };
const ago = ms => { const m = Math.floor((now() - ms) / 6e4); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.floor(m / 60) + ' ч назад' : Math.floor(m / 1440) + ' дн назад'; };
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
  if (u.premium) h += '<span class="premium-badge" title="Premium">⭐</span>';
  if (u.verified) h += '<span class="verified-badge" title="Verified">✓</span>';
  if (u.hammer) h += '<span class="hammer-badge" title="Mod">🔨</span>';
  if (u.scam) h += '<span class="scam-badge" title="Scam">SCAM</span>';
  return h;
}
function renderBadgesBig(u) { return renderBadges(u).replace(/class="(\w+-badge)"/g, 'class="$1 big"'); }
function displayName(u) { if (u === state.me.username) return 'Я'; const c = state.contacts.find(x => x.name === u); return c?.displayName || u; }

const state = {
  me: { username: null, avatar: null, banner: null, avatarVideo: null, bannerVideo: null, premium: false, verified: false, hammer: false, scam: false, bio: '', firstName: '', lastName: '', birthday: '', emoji: '', stars: 0, sessionId: null, isModerator: false, mute: null },
  contacts: [], groups: [], channels: [], unread: {}, typingUsers: {}, typingTimeouts: {}, blockedList: [],
  giftsCatalog: {}, myBots: [], currentChat: null, currentGroup: null, currentChannel: null,
  isSavedChat: false, isBotChat: false, currentBot: null, activeTab: 'chats', showArchived: false, settings: {},
  regStep: 1, regUsernameAvailable: false, regUsernameCheckTimer: null,
  replyToMessage: null, editingMessageId: null, pinnedMessageId: null,
  activeReactionMsgId: null, activeReactionGroupId: null, activeMessage: null,
  qrFoundUser: null, currentGiftTarget: null, currentGiftKey: null,
  currentChannelPostId: null, currentInviteCode: null,
  stickersData: [], stickerRecent: [], stickerCurrentTab: 'recent', stickerSearchQuery: '',
  storiesUsers: [], currentStoryUserIdx: 0, currentStoryIdx: 0, storyTimer: null, storyTimerStart: 0,
  peerConnection: null, localStream: null, callActive: false, micOn: true, camOn: true,
  pendingOffer: null, incomingFrom: null, incomingVideo: false,
  callTimerInterval: null, callStartTime: 0,
  mediaRecorder: null, audioChunks: [], isRecording: false, cancelledRecording: false,
  recordingStartTime: 0, recordingTimer: null, currentAudioMime: '',
  circleStream: null, circleRecorder: null, circleChunks: [], circleTimer: null,
  circleStartTime: 0, circleMime: '', lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  galleryWaiting: false, notificationsAllowed: false, reconnectAttempts: 0,
  titleFlashInterval: null, myTypingTimeout: null,
  createSelected: new Set(), addMembersSelected: new Set(),
  toastTimeout: null, isLoggedIn: false, chatWallpapers: {},
  contactProfileCurrent: null, editingBotUsername: null, tempBotAvatar: null,
  modPanelOpen: false, modTab: 'reports', modReportsFilter: 'new',
  modReports: [], modPunishments: [], modLogs: [], modStats: {},
  reportTarget: null, reportTargetMessageId: null, reportIsGroup: false,
  spoilerMode: false, botControlCurrent: null, botControlTab: 'chats', botChatCurrent: null,
  botVoiceMode: 'bot', botReplyTo: null, currentColorTarget: null
};

const STORAGE = { SESSION: 'aurora-session', UNREAD: 'aurora-unread', CONTACTS: 'aurora-contacts-cache', GROUPS: 'aurora-groups-cache', STICKERS: 'aurora-recent-stickers', SETTINGS: 'aurora-settings-cache', WALLPAPERS: 'aurora-wallpapers' };
const STORY_DURATION = 5000, SWIPE_THRESHOLD = 60, MAX_RECORDING_SEC = 60, MAX_CIRCLE_SEC = 30;

const BUILTIN_GIFS = [['😀', 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'], ['😍', 'https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif'], ['😂', 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif']].map(([emoji, url]) => ({ emoji, url }));

const REPORT_REASONS = { spam: '🚫 Спам', abuse: '🤬 Оскорбления', nsfw: '🔞 18+', scam: '💀 Мошенничество', ads: '📢 Реклама', other: '❓ Другое' };
const PUNISH_LABELS = { ban: '🚫 Бан', mute: '🔇 Мут', warn: '⚠️ Предупреждение' };

const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity });

function attachRipple(e) {
  if (!e || e.dataset.ripple) return;
  e.dataset.ripple = '1'; e.classList.add('ripple-container');
  e.addEventListener('pointerdown', ev => {
    const r = e.getBoundingClientRect(), s = Math.max(r.width, r.height);
    const x = ev.clientX - r.left - s / 2, y = ev.clientY - r.top - s / 2;
    const d = el('span', 'ripple');
    Object.assign(d.style, { width: s + 'px', height: s + 'px', left: x + 'px', top: y + 'px' });
    e.appendChild(d); setTimeout(() => d.remove(), 700);
  });
}
function bindRipples(root) {
  const sel = '.auth-btn-primary,.modal-primary,.modal-secondary,.modal-danger,.create-menu-btn,.nav-btn,.settings-tg-row,.chat-item,.back-btn,.icon-btn,#burger,#send-btn,.attach,.reaction-chip,.action-item,.my-bot-card,.bch-chip,.mod-tab,.report-reason-btn,.punish-duration-btn';
  (root || document).querySelectorAll(sel).forEach(attachRipple);
}

document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));

let autoLoginDone = false, isLoggedInOnServer = false;

function showBanScreen(ban) {
  let s = $('ban-screen') || (() => { const d = el('div'); d.id = 'ban-screen'; document.body.appendChild(d); return d; })();
  const until = ban.expires_at ? new Date(ban.expires_at).toLocaleString('ru-RU') : 'никогда';
  s.innerHTML = `<div class="ban-screen-inner"><div class="ban-emoji">🚫</div><h2>Ты забанен</h2><div class="ban-reason"><div class="ban-label">Причина:</div><div class="ban-value">${esc(ban.reason || 'Не указана')}</div></div><div class="ban-until"><div class="ban-label">До:</div><div class="ban-value">${esc(until)}</div><div class="ban-sub">(${esc(ban.duration_text || 'навсегда')})</div></div><button class="modal-secondary" onclick="location.reload()">🔄 Проверить снова</button></div>`;
  s.classList.add('active');
}

function applyMuteLock() {
  if (!state.isLoggedIn) return;
  const mute = state.me.mute, input = $('msgInput'), send = $('send-btn'), attach = $('attachBtn');
  if (!mute) { if (input) { input.disabled = false; input.placeholder = 'Сообщение...'; } if (send) send.disabled = false; if (attach) attach.disabled = false; $('mute-banner')?.remove(); return; }
  const until = mute.expires_at ? new Date(mute.expires_at).toLocaleString('ru-RU') : '';
  if (input) { input.disabled = true; input.placeholder = '🔇 Ты в муте'; }
  if (send) send.disabled = true; if (attach) attach.disabled = true;
  let b = $('mute-banner'); if (!b) { b = el('div'); b.id = 'mute-banner'; $('input-area')?.parentNode?.insertBefore(b, $('input-area')); }
  b.innerHTML = '🔇 Ты в муте' + (mute.reason ? ' · ' + esc(mute.reason) : '') + (until ? ' · до ' + esc(until) : '');
}

function playLoginTransition(username, firstName, auto) {
  state.isLoggedIn = true; isLoggedInOnServer = true;
  const auth = $('auth'), app = $('app'), flash = $('welcome-flash'), wt = $('welcome-toast');
  hideSplash(); $('passcode-screen')?.classList.remove('active');
  if (auth?.classList.contains('active')) { auth.classList.add('auth-exit'); setTimeout(() => { auth.classList.remove('active', 'auth-exit'); }, 450); }
  else auth?.classList.remove('active');
  if (app) { app.classList.add('active', 'app-enter'); void app.offsetWidth; setTimeout(() => app.classList.remove('app-enter'), 700); }
  if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 1000); }
  if (!auto && wt) {
    wt.querySelector('.wt-emoji').textContent = ['👋', '🌌', '✨', '🚀', '💫'][Math.floor(Math.random() * 5)];
    wt.querySelector('.wt-name').textContent = 'Привет, ' + ((firstName && firstName.trim()) || username || 'друг') + '!';
    wt.querySelector('.wt-sub').textContent = 'С возвращением в Azerta';
    wt.classList.add('active'); setTimeout(() => wt.classList.remove('active'), 2200);
  }
  setTimeout(() => {
    updateMyAvatarBtn(); updateVerifyButton(); updateVerifyChannelButton();
    loadStories(); renderChatList(); renderStoriesBar(); applyChatWallpaper(); bindRipples(); applyMuteLock();
  }, 200);
}

function forceShowAuth(msg) {
  isLoggedInOnServer = false; state.isLoggedIn = false; state.me.username = null; state.me.sessionId = null;
  $('app')?.classList.remove('active'); $('chat-screen')?.classList.remove('active');
  const a = $('auth'); if (a) { a.classList.remove('auth-exit'); a.classList.add('active'); }
  $('passcode-screen')?.classList.remove('active'); hideSplash();
  toast('⚠️ ' + (msg || 'Войди заново'));
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
  state.chatWallpapers = jget(STORAGE.WALLPAPERS, {});
}

function onLoggedIn(res, auto) {
  applyMe(res); playLoginTransition(res.username, res.firstName, !!auto);
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
}

function doRegister() {
  const username = $('reg-username')?.value || '';
  const displayName = $('reg-displayname')?.value || '';
  const password = $('reg-password')?.value || '';
  const err = $('reg-error-3'); if (err) err.textContent = '';
  showBtnSpinner('reg-submit', 'Создаю…');
  api('register', { username: username.trim().toLowerCase(), password, displayName: displayName.trim() }, res => {
    hideBtnSpinner('reg-submit', 'Создать аккаунт');
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; vib([30, 20, 30]); return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
    toast('🎉 Добро пожаловать! +' + res.bonus + ' ⭐'); vib([50, 30, 50]);
  });
}

function doLogin() {
  const username = $('login-username')?.value || '';
  const password = $('login-password')?.value || '';
  const err = $('login-error'); if (err) err.textContent = '';
  if (!username || !password) { if (err) err.textContent = 'Заполни все поля'; vib([30, 20, 30]); return; }
  showBtnSpinner('login-btn', 'Вхожу…');
  const existing = jget(STORAGE.SESSION);
  api('login', { username: username.trim().toLowerCase(), password, device: (navigator.userAgent || '').slice(0, 40), sessionId: existing?.sessionId || null }, res => {
    hideBtnSpinner('login-btn', 'Войти');
    if (!res?.ok) { if (res?.banned) { showBanScreen(res.ban); return; } if (err) err.textContent = res?.error || 'Ошибка'; vib([30, 20, 30]); return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
  });
}

async function tryAutoLogin() {
  const creds = jget(STORAGE.SESSION);
  if (!creds?.sessionId) return false;
  return new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 6000);
    api('login with session', { sessionId: creds.sessionId }, res => {
      if (done) return; done = true; clearTimeout(t);
      if (!res?.ok) {
        if (res?.banned) { showBanScreen(res.ban); resolve(true); return; }
        localStorage.removeItem(STORAGE.SESSION); forceShowAuth('Сессия истекла'); resolve(false); return;
      }
      jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
      applyMe(res);
      api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
      api('has passcode', has => {
        if (has) $('passcode-screen')?.classList.add('active');
        else playLoginTransition(res.username, res.firstName, true);
      });
      resolve(true);
    });
  });
}

function showBtnSpinner(id, text) {
  const b = $(id); if (!b) return;
  const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner');
  if (t && text) t.textContent = text; if (s) s.style.display = 'inline-flex'; b.disabled = true;
}
function hideBtnSpinner(id, text) {
  const b = $(id); if (!b) return;
  const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner');
  if (t && text) t.textContent = text; if (s) s.style.display = 'none'; b.disabled = false;
}

function switchAuthScreen(s) {
  document.querySelectorAll('.auth-screen').forEach(x => x.classList.remove('active'));
  $(s === 'login' ? 'auth-login-screen' : 'auth-register-screen')?.classList.add('active');
  if (s === 'register') { state.regStep = 1; regShowStep(1); }
  vib(10);
}
function regShowStep(step) {
  state.regStep = step;
  document.querySelectorAll('.reg-progress-seg').forEach(seg => { const s = +seg.dataset.step; seg.classList.toggle('active', s === step); seg.classList.toggle('done', s < step); });
  $('reg-back-btn')?.classList.toggle('show', step > 1);
  document.querySelectorAll('.reg-step-card').forEach(c => c.classList.toggle('active', +c.dataset.step === step));
  setTimeout(() => $('reg-username')?.focus(), 200); vib(10);
}
function regNext(step) {
  if (step === 1) { if (state.regUsernameAvailable) regShowStep(2); }
  else if (step === 2) {
    if (!($('reg-displayname')?.value || '').trim()) { $('reg-error-2').textContent = 'Введи имя'; return; }
    $('reg-error-2').textContent = ''; regShowStep(3);
  }
}
function regBack() { if (state.regStep > 1) regShowStep(state.regStep - 1); vib(10); }
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v13.8 — Часть 2 (Настройки, Чаты, Сообщения)
   ═══════════════════════════════════════════════════════════ */

function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') state.notificationsAllowed = true;
  else if (Notification.permission === 'default') setTimeout(() => $('notif-banner')?.classList.add('active'), 1500);
}
async function enableNotifications() {
  $('notif-banner')?.classList.remove('active');
  if (!('Notification' in window)) return;
  try { if (await Notification.requestPermission() === 'granted') { state.notificationsAllowed = true; new Notification('Azerta', { body: 'Уведомления включены! 🎉' }); } } catch {}
}
function playPing() {
  if (state.settings.sound == 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination); osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
function browserNotif(from, text) {
  if (!state.notificationsAllowed) return;
  try { const n = new Notification(from, { body: text }); n.onclick = () => { window.focus(); n.close(); }; } catch {}
}
function updateTitle() {
  const total = Object.values(state.unread).reduce((a, b) => a + b, 0);
  clearInterval(state.titleFlashInterval);
  if (total > 0) { let on = true; state.titleFlashInterval = setInterval(() => { document.title = on ? `(${total}) Azerta` : 'Azerta'; on = !on; }, 1000); }
  else document.title = 'Azerta';
  const nb = $('nav-badge-chats');
  if (nb) { if (total > 0 && state.activeTab !== 'chats') { nb.textContent = total > 99 ? '99+' : total; nb.style.display = 'block'; } else nb.style.display = 'none'; }
}
function applyLocalSettings() {
  const s = state.settings;
  document.body.classList.toggle('light', s.theme === 'light');
  document.body.classList.toggle('no-anim', s.animations == 0);
  document.documentElement.style.setProperty('--font-size', { small: '13px', medium: '15px', large: '17px' }[s.font_size] || '15px');
  if (s.accent_color) {
    document.documentElement.style.setProperty('--accent', s.accent_color);
    const hex = s.accent_color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) || 230, g = parseInt(hex.substr(2, 2), 16) || 57, b = parseInt(hex.substr(4, 2), 16) || 70;
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.15)`);
  }
}
const TAB_TITLES = { chats: 'Azerta', calls: 'Звонки', contacts: 'Контакты', settings: 'Настройки' };
function switchTab(tab) {
  state.activeTab = tab;
  const app = $('app'); if (!app) return;
  app.dataset.tab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const h = document.querySelector('#main-header h2'); if (h) h.textContent = TAB_TITLES[tab] || 'Azerta';
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'chats') { $('search-wrap').style.display = ''; renderChatList(); renderStoriesBar(); }
  else { $('tab-' + tab)?.classList.add('active'); $('search-wrap').style.display = 'none'; if (tab === 'contacts') renderContactsTab(); else if (tab === 'settings') renderSettingsTab(); }
  if (tab === 'chats') $('nav-badge-chats').style.display = 'none';
}

function renderTgRow(o) {
  const type = o.type || 'arrow';
  const cls = 'settings-tg-row' + (type === 'danger' ? ' danger' : '') + (type === 'disabled' ? ' disabled' : '');
  const onClick = o.onClick ? ` onclick="${o.onClick}"` : '';
  let right = '';
  if (type === 'switch') right = `<label class="tg-row-switch" onclick="event.stopPropagation()"><input type="checkbox" ${o.checked ? 'checked' : ''} onchange="${o.onToggle || ''}" /><span class="slider"></span></label>`;
  else if (type === 'color') right = `<span class="tg-row-color-dot" style="background:${o.color || '#8b7fff'};"></span><span class="tg-row-arrow">›</span>`;
  else if (type === 'arrow') { if (o.value != null && o.value !== '') right += `<span class="tg-row-value">${esc(o.value)}</span>`; right += '<span class="tg-row-arrow">›</span>'; }
  else if (type === 'value') right = `<span class="tg-row-value">${esc(o.value || '')}</span>`;
  return `<div class="${cls}"${onClick}><span class="tg-row-icon">${o.icon || ''}</span><span class="tg-row-text">${esc(o.text || '')}</span>${right}</div>`;
}
const visibilityLabel = v => ({ everyone: 'Все', contacts: 'Контакты', nobody: 'Никто' }[v] || 'Все');

function renderSettings() {
  const box = $('settings-content'); if (!box) return;
  const me = state.me, s = state.settings, isAdmin = me.username === 'moroz', isPremium = !!me.premium;
  const display = (me.firstName || me.lastName) ? `${me.firstName} ${me.lastName || ''}`.trim() : '@' + me.username;
  const emoji = me.emoji ? ' ' + me.emoji : '';
  const bannerStyle = me.bannerVideo ? '' : me.banner ? `background-image:url(${me.banner})` : '';
  const bannerMedia = me.bannerVideo ? `<video class="tg-banner" autoplay loop muted playsinline style="object-fit:cover;width:100%;height:100%"><source src="${me.bannerVideo}"></video>` : `<div class="tg-banner" style="${bannerStyle}"></div>`;
  const avStyle = me.avatarVideo ? '' : me.avatar ? `background-image:url(${me.avatar})` : '';
  const avContent = me.avatarVideo ? `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${me.avatarVideo}"></video>` : me.avatar ? '' : initials(me.username);
  const pending = state.modStats.new_reports || 0;
  const modSection = me.isModerator ? `<div class="settings-tg-section"><div class="settings-tg-section-title">🛡️ Модерация</div><div class="settings-tg-group">${renderTgRow({ icon: '🚨', text: 'Панель модератора', value: pending > 0 ? pending + ' новых' : '', onClick: 'openModPanel()' })}</div></div>` : '';

  let html = `
    <div class="settings-profile-card-tg${me.banner || me.bannerVideo ? '' : ' no-banner'}${isPremium ? ' premium' : ''}" onclick="openProfile()">
      ${bannerMedia}<div class="tg-banner-overlay"></div>
      ${!me.banner && !me.bannerVideo ? '<span class="tg-no-banner-hint">+ Сменить баннер</span>' : ''}
      <div class="tg-profile-row">
        <div class="tg-profile-avatar" style="${avStyle}">${avContent}</div>
        <div class="tg-profile-info">
          <div class="tg-profile-name${isPremium ? ' premium' : ''}">${esc(display)}${emoji} ${renderBadges(me)}</div>
          <div class="tg-profile-username">@${esc(me.username)}</div>
          <div class="tg-profile-status"><span class="dot"></span>${isPremium ? 'Premium активен' : 'в сети'}</div>
        </div>
      </div>
    </div>
    <div class="settings-stars-row" onclick="openStarsHistory()"><span class="stars-icon">⭐</span><div class="stars-info"><div class="stars-count">${me.stars}${isAdmin ? '∞' : ''}</div><div class="stars-label">звёзды · нажми для истории</div></div><span class="stars-arrow">›</span></div>
    ${modSection}
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div><div class="settings-tg-group">
      ${renderTgRow({ icon: '🎨', text: 'Тема', value: s.theme === 'light' ? 'Светлая' : 'Тёмная', onClick: 'changeTheme()' })}
      ${renderTgRow({ icon: '🎯', text: 'Акцентный цвет', type: 'color', color: s.accent_color || '#e63946', onClick: "openColorPicker('accent_color')" })}
      ${renderTgRow({ icon: '⚡', text: 'Отключить анимации', type: 'switch', checked: s.animations == 0, onToggle: "toggleSetting('animations')", onClick: "toggleSetting('animations')" })}
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🔔 Уведомления</div><div class="settings-tg-group">
      ${renderTgRow({ icon: '🔔', text: 'Звук', type: 'switch', checked: s.sound == 1, onToggle: "toggleSetting('sound')", onClick: "toggleSetting('sound')" })}
      ${renderTgRow({ icon: '📳', text: 'Вибрация', type: 'switch', checked: s.vibration == 1, onToggle: "toggleSetting('vibration')", onClick: "toggleSetting('vibration')" })}
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">
      ${renderTgRow({ icon: '🚪', text: 'Выйти', type: 'danger', onClick: 'logout()' })}
    </div></div>
    <div style="padding:30px 20px 10px;text-align:center;color:var(--text-muted);font-size:12px;">🌌 Azerta v13.8<br><br>Сделано с ❤️</div>`;
  box.innerHTML = html;
  setTimeout(showCacheSize, 100);
  bindRipples(box);
  if (me.isModerator) api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
}
function renderSettingsTab() { const box = $('tab-settings-content'), orig = $('settings-content'); if (!box || !orig) return; renderSettings(); box.innerHTML = orig.innerHTML; bindRipples(box); }
function toggleSetting(key) { const v = (state.settings[key] == 1) ? 0 : 1; api('update settings', { key, value: v }, () => { state.settings[key] = v; applyLocalSettings(); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); }); }
function changeTheme() { const v = state.settings.theme === 'light' ? 'dark' : 'light'; api('update settings', { key: 'theme', value: v }, () => { state.settings.theme = v; applyLocalSettings(); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); }); }
function openColorPicker(target) {
  state.currentColorTarget = target;
  const grid = $('color-grid'); if (!grid) return;
  const colors = ['#e63946', '#ec4899', '#8b7fff', '#fbbf24', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#a78bfa', '#14b8a6', '#f43f5e', '#3b82f6'];
  grid.innerHTML = '';
  colors.forEach(c => { const d = el('div', 'color-dot'); d.style.background = c; if (state.settings[target] === c) d.classList.add('active'); d.onclick = () => api('update settings', { key: target, value: c }, () => { state.settings[target] = c; applyLocalSettings(); closeModal('color-modal'); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); }); grid.appendChild(d); });
  $('color-modal-title').textContent = 'Акцентный цвет'; openModal('color-modal');
}
function showCacheSize() { const e = $('cache-size'); if (!e) return; let size = 0; try { for (const k in localStorage) { if (Object.prototype.hasOwnProperty.call(localStorage, k)) size += (localStorage[k].length + k.length) * 2; } } catch {} e.textContent = (size / 1024).toFixed(1) + ' КБ'; }
function logout() { if (!confirm('Выйти из аккаунта?')) return; [STORAGE.SESSION, STORAGE.UNREAD, STORAGE.CONTACTS, STORAGE.GROUPS].forEach(k => localStorage.removeItem(k)); location.reload(); }

function updateMyAvatarBtn() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatarVideo) btn.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${state.me.avatarVideo}"></video>`;
  else if (state.me.avatar) btn.innerHTML = `<img src="${state.me.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else btn.textContent = '👤';
}
function updateVerifyButton() { const b = $('verify-btn'); if (!b) return; b.style.display = state.me.username === 'moroz' ? 'block' : 'none'; if (state.me.username === 'moroz') b.onclick = openBadgeModal; }
function updateVerifyChannelButton() { const b = $('verify-channel-btn'); if (!b) return; b.style.display = state.me.username === 'moroz' ? 'block' : 'none'; if (state.me.username === 'moroz') b.onclick = () => { $('verify-channel-slug').value = ''; $('verify-channel-error').textContent = ''; openModal('verify-channel-modal'); }; }
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v13.8 — Часть 3 (Профиль, Чаты, Сообщения)
   ═══════════════════════════════════════════════════════════ */

/* ─── ПРОФИЛЬ ─── */
function openProfile() {
  $('profile-username').textContent = '@' + (state.me.username || '');
  $('my-first-name').value = state.me.firstName || '';
  $('my-last-name').value = state.me.lastName || '';
  $('my-bio').value = state.me.bio || '';
  $('my-birthday').value = state.me.birthday || '';
  $('my-emoji').value = state.me.emoji || '';
  const p = $('profile-banner-preview'), img = $('profile-banner-img');
  if (state.me.banner && p && img) { img.src = state.me.banner; p.style.display = 'block'; p.classList.remove('removing'); }
  else if (p) p.style.display = 'none';
  updateVerifyButton(); updateVerifyChannelButton();
  openModal('profile-modal');
  setTimeout(patchProfileButtons, 50);
}

function patchProfileButtons() {
  document.querySelectorAll('#profile-modal .modal-primary').forEach(btn => {
    const t = btn.textContent || '';
    if (t.includes('Сменить фото')) btn.onclick = pickAvatarMedia;
    else if (t.includes('Сменить баннер')) btn.onclick = pickBannerMedia;
  });
}

function saveProfile() {
  const payload = { firstName: ($('my-first-name')?.value || '').trim(), lastName: ($('my-last-name')?.value || '').trim(), bio: ($('my-bio')?.value || '').trim(), birthday: $('my-birthday')?.value || '', emojiStatus: ($('my-emoji')?.value || '').trim() };
  api('update profile', payload, res => {
    if (!res?.ok) return;
    Object.assign(state.me, payload);
    closeModal('profile-modal'); renderChatList(); toast('✓ Профиль сохранён');
  });
}

function pickMedia(kind) {
  const input = el('input'); input.type = 'file'; input.accept = 'image/*,video/*'; input.style.display = 'none';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type.startsWith('video/')) uploadVideo(kind, f);
    else if (f.type.startsWith('image/')) uploadPhoto(kind, f);
  };
  document.body.appendChild(input); input.click();
  setTimeout(() => input.remove(), 1000);
}
function pickAvatarMedia() { pickMedia('avatar'); }
function pickBannerMedia() { pickMedia('banner'); }

function uploadPhoto(kind, file) {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const isAvatar = kind === 'avatar';
      const W = isAvatar ? 200 : 1200, H = isAvatar ? 200 : 400;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      if (isAvatar) { const m = Math.min(img.width, img.height); ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, W, H); }
      else { const sc = Math.max(W / img.width, H / img.height); const w = img.width * sc, h = img.height * sc; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); }
      const dataUrl = c.toDataURL('image/jpeg', isAvatar ? 0.8 : 0.75);
      if (isAvatar) {
        api('remove avatar video', () => { state.me.avatarVideo = null; state.me.avatar = dataUrl; api('set avatar', { avatar: dataUrl }); updateMyAvatarBtn(); closeModal('profile-modal'); });
      } else {
        api('remove banner video', () => { state.me.bannerVideo = null; state.me.banner = dataUrl; api('set banner', { banner: dataUrl }, res => { if (res?.ok) { const p = $('profile-banner-preview'), im = $('profile-banner-img'); if (im) im.src = dataUrl; if (p) p.style.display = 'block'; } }); });
      }
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

/* ─── СПИСОК ЧАТОВ ─── */
function renderChatList() {
  const box = $('chat-list'); if (!box) return;
  box.innerHTML = '';
  
  const savedUnread = state.unread.__saved__ || 0;
  const savedItem = el('div', 'chat-item' + (state.isSavedChat ? ' active' : ''));
  savedItem.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые сообщения</div></div><div class="chat-meta">${savedUnread > 0 ? `<div class="chat-badge">${savedUnread}</div>` : ''}</div>`;
  savedItem.onclick = openSavedChat;
  box.appendChild(savedItem); attachRipple(savedItem);

  const allContacts = state.contacts.filter(c => state.showArchived ? c.archived : !c.archived);
  const allGroups = state.groups.filter(g => state.showArchived ? g.archived : !g.archived);
  const pinSort = (a, b) => (b.pinOrder || 0) - (a.pinOrder || 0);
  const activeContacts = [...allContacts.filter(c => c.pinned).sort(pinSort), ...allContacts.filter(c => !c.pinned)];
  const activeGroups = [...allGroups.filter(g => g.pinned).sort(pinSort), ...allGroups.filter(g => !g.pinned)];

  if (state.channels.length) { box.appendChild(el('div', 'section-header', '📢 Каналы')); state.channels.forEach(ch => box.appendChild(renderChannelItem(ch))); }
  if (activeGroups.length) { box.appendChild(el('div', 'section-header', state.showArchived ? 'Архив: группы' : 'Группы')); activeGroups.forEach(g => box.appendChild(renderGroupItem(g))); }
  if (activeContacts.length) { box.appendChild(el('div', 'section-header', state.showArchived ? 'Архив: личные' : 'Личные чаты')); activeContacts.forEach(u => box.appendChild(renderContactItem(u))); }
  if (!activeContacts.length && !activeGroups.length && !state.channels.length) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = '<div class="big">👋</div>Пока никого нет.<br>Нажми <b>＋</b> и добавь друга, бота или создай канал.';
    box.appendChild(empty);
  }
}

function renderChannelItem(ch) {
  const div = el('div', 'chat-item');
  const av = ch.avatar ? `<div class="avatar channel" style="background-image:url(${ch.avatar})"></div>` : '<div class="avatar channel">📢</div>';
  div.innerHTML = `${av}<div class="chat-info"><div class="chat-name">${esc(ch.name)}${ch.verified ? '<span class="verified-badge">✓</span>' : ''}</div><div class="chat-preview">@${esc(ch.slug)} · ${ch.memberCount} подпис.</div></div>`;
  div.onclick = () => openChannelChat(ch); attachRipple(div);
  return div;
}
function renderGroupItem(g) {
  const div = el('div'); const key = 'g:' + g.id, unread = state.unread[key] || 0;
  div.className = 'chat-item' + (state.currentGroup?.id === g.id ? ' active' : '') + (g.pinned ? ' pinned' : '');
  const avatar = g.avatar ? `<div class="avatar" style="background-image:url(${g.avatar})"></div>` : '<div class="avatar group">👥</div>';
  const word = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  div.innerHTML = `${avatar}<div class="chat-info"><div class="chat-name">${esc(g.name)} ${g.pinned ? '<span class="pin-mark">📌</span>' : ''}</div><div class="chat-preview">${g.memberCount} участник${word}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
  div.onclick = () => openGroupChat(g); attachRipple(div);
  return div;
}
function renderContactItem(u) {
  const div = el('div'); const unread = state.unread[u.name] || 0;
  div.className = 'chat-item' + (state.currentChat === u.name ? ' active' : '') + (u.pinned ? ' pinned' : '');
  let avHtml;
  if (u.avatarVideo) avHtml = `<div class="avatar"><video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${u.avatarVideo}"></video>${u.online ? '<span class="online-dot"></span>' : ''}</div>`;
  else {
    const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
    const content = u.avatar ? '' : initials(u.displayName || u.name);
    avHtml = `<div class="avatar" style="${style}">${content}${u.online ? '<span class="online-dot"></span>' : ''}</div>`;
  }
  const isTyping = !!state.typingUsers[u.name];
  const preview = isTyping ? '<span class="typing">печатает…</span>' : (unread > 0 ? 'новое сообщение' : (u.online ? 'в сети' : 'был(а) недавно'));
  div.innerHTML = `${avHtml}<div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)} ${renderBadges(u)} ${u.pinned ? '<span class="pin-mark">📌</span>' : ''}</div><div class="chat-preview">${preview}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
  div.onclick = () => openChat(u.name); attachRipple(div);
  return div;
}

/* ─── ОТКРЫТИЕ ЧАТОВ ─── */
function openChat(name) {
  state.currentChat = name; state.currentGroup = null; state.currentChannel = null; state.isSavedChat = false;
  const contact = state.contacts.find(c => c.name === name);
  state.isBotChat = !!contact?.isBot;
  clearUnread(name);
  
  const display = contact?.displayName || name;
  $('chat-top-name').innerHTML = esc(display) + ' ' + renderBadgesBig(contact || {});
  $('chat-top-status').textContent = contact?.online ? 'в сети' : 'был(а) недавно';
  $('chat-avatar').innerHTML = contact?.avatar ? '' : initials(display);
  if (contact?.avatar) $('chat-avatar').style.backgroundImage = `url(${contact.avatar})`; else $('chat-avatar').style.background = 'var(--accent)';
  
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
  setTimeout(() => api('mark read', { withUser: name }), 300);
  renderChatList();
}

function openGroupChat(g) {
  state.currentGroup = g; state.currentChat = null; state.currentChannel = null;
  clearUnread('g:' + g.id);
  $('chat-top-name').textContent = g.name;
  $('chat-top-status').textContent = `${g.memberCount} участников`;
  $('chat-avatar').innerHTML = '👥'; $('chat-avatar').style.background = 'linear-gradient(135deg, #0f5132, #2d9e6b)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load group history', { groupId: g.id });
  renderChatList();
}

function openSavedChat() {
  state.currentChat = null; state.currentGroup = null; state.isSavedChat = true;
  clearUnread('__saved__');
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые сообщения';
  $('chat-avatar').innerHTML = '⭐'; $('chat-avatar').style.background = 'var(--gold)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load saved history');
}

function closeChat() {
  $('chat-screen').classList.remove('active');
  state.currentChat = null; state.currentGroup = null;
  state.isSavedChat = false;
  renderChatList();
}

function clearUnread(key) { if (state.unread[key]) { delete state.unread[key]; jset(STORAGE.UNREAD, state.unread); updateTitle(); renderChatList(); } }

/* ─── СООБЩЕНИЯ ─── */
function renderMessage(msg) {
  const box = $('messages'); if (!box) return;
  if (msg.time) {
    const d = new Date(msg.time), key = d.toDateString();
    if (key !== state.lastDateShown) {
      state.lastDateShown = key;
      const dd = el('div', 'date-divider');
      dd.innerHTML = `<span>${d.toDateString() === new Date().toDateString() ? 'Сегодня' : d.toDateString() === new Date(Date.now() - 864e5).toDateString() ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>`;
      box.appendChild(dd);
    }
  }
  const wrap = el('div', 'msg-wrap ' + (msg.self ? 'self' : 'other'));
  wrap.dataset.id = msg.id; if (msg.from) wrap.dataset.from = msg.from;
  const div = el('div', 'msg ' + (msg.self ? 'self' : 'other'));
  if (msg.text) div.appendChild(el('span', 'msg-text', esc(msg.text)));
  const meta = el('span', 'meta');
  meta.innerHTML = msg.time ? fmtT(msg.time) : '';
  div.appendChild(meta);
  wrap.appendChild(div); box.appendChild(wrap); box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const input = $('msgInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  if (state.isSavedChat) api('private message', { to: state.me.username, text });
  else if (state.currentChat) api('private message', { to: state.currentChat, text });
  else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, text });
  input.value = ''; cancelReply();
}
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v13.8 — Часть 4 (Звонки, Сокеты, Запуск)
   ═══════════════════════════════════════════════════════════ */

/* ─── ЗВОНКИ ─── */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};
let iceCandidatesQueue = [], isRemoteDescSet = false;

async function startCall(video) {
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
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('remote-video-wrap').classList.remove('audio-only'); $('call-status').textContent = 'В разговоре'; startCallTimer(); };
  
  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
}

async function acceptIncoming() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;
  const from = state.incomingFrom, offer = state.pendingOffer;
  state.currentChat = from; state.pendingOffer = null; state.incomingFrom = null;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.incomingVideo }); } catch (err) { socket.emit('end-call', { to: from }); return alert('Нет доступа'); }
  
  state.callActive = true;
  $('call-peer-name').textContent = displayName(from);
  $('call-status').textContent = 'Соединение...';
  $('call-screen').classList.add('active');
  if (state.incomingVideo) { $('local-video-wrap').classList.add('active'); $('localVideo').srcObject = state.localStream; }
  
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => { $('remoteVideo').srcObject = e.streams[0]; $('remote-video-wrap').classList.remove('audio-only'); $('call-status').textContent = 'В разговоре'; startCallTimer(); };
  
  await state.peerConnection.setRemoteDescription(offer);
  isRemoteDescSet = true;
  iceCandidatesQueue.forEach(c => state.peerConnection.addIceCandidate(c).catch(()=>{}));
  iceCandidatesQueue = [];
  
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
}

function cleanupCall() {
  state.callActive = false; clearInterval(state.callTimerInterval);
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  $('call-screen').classList.remove('active'); $('incoming-screen').classList.remove('active');
  $('localVideo').srcObject = null; $('remoteVideo').srcObject = null;
}

function startCallTimer() {
  state.callStartTime = Date.now(); clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => { const s = Math.floor((Date.now() - state.callStartTime) / 1000); $('call-timer').textContent = `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }, 1000);
}

function declineIncoming() {
  $('incoming-screen').classList.remove('active');
  if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom });
}

function hangup() {
  if (state.currentChat) socket.emit('end-call', { to: state.currentChat });
  cleanupCall();
}

function toggleMic() {
  if (state.localStream) { const t = state.localStream.getAudioTracks()[0]; t.enabled = !t.enabled; $('micBtn').classList.toggle('off', !t.enabled); }
}

function toggleCamera() {
  if (state.localStream) { const t = state.localStream.getVideoTracks()[0]; t.enabled = !t.enabled; $('camBtn').classList.toggle('off', !t.enabled); }
}

/* ─── СОКЕТЫ ─── */
socket.on('connect', async () => {
  const ok = await tryAutoLogin();
  if (!ok) {
    $('app').classList.remove('active');
    $('auth').classList.add('active');
    state.isLoggedIn = false; isLoggedInOnServer = false;
  }
  autoLoginDone = true;
});

socket.on('contacts', list => { state.contacts = list || []; jset(STORAGE.CONTACTS, state.contacts); renderChatList(); });
socket.on('history', data => {
  if (data.withUser !== state.currentChat) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = ''; state.lastDateShown = '';
  data.messages.forEach(m => renderMessage({ id: m.id, from: m.from_user, text: m.text, time: m.time, self: m.from_user === state.me.username }));
});
socket.on('private message', data => {
  if (data.from === state.currentChat || data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: data.self });
  } else {
    state.unread[data.from] = (state.unread[data.from] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread); updateTitle(); renderChatList();
    playPing();
  }
});

socket.on('incoming-call', data => {
  state.incomingFrom = data.from; state.incomingVideo = data.video; state.pendingOffer = data.offer;
  $('incoming-name').textContent = displayName(data.from);
  $('incoming-type').textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';
  $('incoming-screen').classList.add('active');
  playPing(); vib([100, 50, 100]);
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

/* ─── ИНИЦИАЛИЗАЦИЯ ─── */
window.addEventListener('load', () => {
  try {
    state.unread = jget(STORAGE.UNREAD, {}) || {};
    initNotifications();
    
    const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
    const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
    
    bindRipples();

    const creds = jget(STORAGE.SESSION);
    if (!creds?.sessionId) { hideSplash(); $('auth')?.classList.add('active'); }
  } catch (e) {
    console.error('Init error:', e); hideSplash(); $('auth')?.classList.add('active');
  }
});