'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v17.0 — Client (Mega Fix)
   ✓ Исправлен "черный экран" при перезаходе
   ✓ Полная совместимость с server.js
   ✓ Встроенный WebRTC (TURN + ICE Queue)
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
// Страховка от черного экрана
setTimeout(hideSplash, 2000);
setTimeout(hideSplash, 3500);

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

/* ─── 2. СОСТОЯНИЕ ─── */
const state = {
  me: { username: null, avatar: null, banner: null, avatarVideo: null, bannerVideo: null, premium: false, verified: false, hammer: false, scam: false, bio: '', firstName: '', lastName: '', birthday: '', emoji: '', stars: 0, sessionId: null, isModerator: false, mute: null },
  contacts: [], groups: [], channels: [],
  unread: {}, typingUsers: {}, typingTimeouts: {}, blockedList: [],
  giftsCatalog: {}, myBots: [],
  currentChat: null, currentGroup: null, currentChannel: null,
  isSavedChat: false, isBotChat: false, currentBot: null,
  activeTab: 'chats', showArchived: false, settings: {},
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
  circleStartTime: 0, circleMime: '',
  lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  notificationsAllowed: false, reconnectAttempts: 0,
  myTypingTimeout: null, createSelected: new Set(), addMembersSelected: new Set(),
  isLoggedIn: false, chatWallpapers: {},
  contactProfileCurrent: null, editingBotUsername: null, tempBotAvatar: null,
  modPanelOpen: false, modTab: 'reports', modReportsFilter: 'new',
  modReports: [], modPunishments: [], modLogs: [], modStats: {},
  reportTarget: null, reportTargetMessageId: null, reportIsGroup: false,
  spoilerMode: false, botControlCurrent: null, botControlTab: 'chats',
  botChatCurrent: null, botVoiceMode: 'bot', botReplyTo: null,
  currentColorTarget: null, titleFlashInterval: null, isBotChat: false, currentBot: null
};

const STORAGE = { SESSION: 'aurora-session', UNREAD: 'aurora-unread', CONTACTS: 'aurora-contacts-cache', GROUPS: 'aurora-groups-cache', STICKERS: 'aurora-recent-stickers', SETTINGS: 'aurora-settings-cache', WALLPAPERS: 'aurora-wallpapers' };
const STORY_DURATION = 5000, SWIPE_THRESHOLD = 60, MAX_RECORDING_SEC = 60, MAX_CIRCLE_SEC = 30;

const BUILTIN_GIFS = [
  ['😀', 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'], ['😍', 'https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif'],
  ['😂', 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif'], ['😎', 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif'],
  ['👍', 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'], ['❤️', 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif']
].map(([emoji, url]) => ({ emoji, url }));

const REPORT_REASONS = { spam: '🚫 Спам', abuse: '🤬 Оскорбления', nsfw: '🔞 18+', scam: '💀 Мошенничество', ads: '📢 Реклама', other: '❓ Другое' };
const PUNISH_LABELS = { ban: '🚫 Бан', mute: '🔇 Мут', warn: '⚠️ Предупреждение' };

/* ─── 3. SOCKET ─── */
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity });

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

/* ─── 5. RIPPLE ─── */
const RIPPLE_SELECTOR = '.auth-btn-primary,.modal-primary,.modal-secondary,.modal-danger,.create-menu-btn,.nav-btn,.settings-tg-row,.chat-item,.back-btn,.icon-btn,#burger,#send-btn,.attach,.reaction-chip,.action-item,.my-bot-card,.bch-chip,.mod-tab,.report-reason-btn,.punish-duration-btn';
document.addEventListener('pointerdown', e => {
  const el = e.target.closest(RIPPLE_SELECTOR);
  if (!el || el.disabled) return;
  if (!el.classList.contains('ripple-container')) el.classList.add('ripple-container');
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const d = document.createElement('span'); d.className = 'ripple';
  Object.assign(d.style, { width: s + 'px', height: s + 'px', left: (e.clientX - r.left - s/2) + 'px', top: (e.clientY - r.top - s/2) + 'px' });
  el.appendChild(d); setTimeout(() => d.remove(), 700);
}, { passive: true });

/* ─── 6. SWIPE-REPLY ─── */
let swipe = null;
document.addEventListener('pointerdown', e => {
  const msg = e.target.closest('.msg:not(.system):not(.deleted)');
  if (!msg) return;
  const wrap = msg.closest('.msg-wrap'); if (!wrap) return;
  swipe = { wrap, x0: e.clientX, y0: e.clientY, dx: 0, locked: false, isSelf: wrap.classList.contains('self') };
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x0, dy = e.clientY - swipe.y0;
  if (!swipe.locked) {
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { swipe = null; return; }
    if (Math.abs(dx) > 8) { swipe.locked = true; swipe.wrap.classList.add('swiping'); } else return;
  }
  let d = dx;
  if ((swipe.isSelf && d > 0) || (!swipe.isSelf && d < 0)) d = 0;
  if (Math.abs(d) > 90) d = d > 0 ? 90 : -90;
  swipe.dx = d;
  swipe.wrap.style.transform = `translateX(${d}px)`;
  swipe.wrap.classList.toggle('swipe-active', Math.abs(d) > 5);
  swipe.wrap.classList.toggle('swipe-ready', Math.abs(d) >= SWIPE_THRESHOLD);
}, { passive: true });
document.addEventListener('pointerup', () => {
  if (!swipe) return;
  const s = swipe; swipe = null;
  s.wrap.style.transform = ''; s.wrap.classList.remove('swiping', 'swipe-active', 'swipe-ready');
  if (Math.abs(s.dx) >= SWIPE_THRESHOLD) triggerReplyFromSwipe(parseInt(s.wrap.dataset.id, 10), s.wrap.dataset.group === '1');
});
function triggerReplyFromSwipe(id, isGroup) {
  const wrap = qs(`.msg-wrap[data-id="${id}"]`); if (!wrap) return;
  setReplyPreview({ id, from: wrap.dataset.from || state.me.username, text: qs('.msg-text', wrap)?.textContent || '', self: wrap.classList.contains('self'), isGroup });
  vib(15);
}

/* ─── 7. DOUBLE-TAP ❤️ ─── */
let lastTap = 0, lastTapId = null;
document.addEventListener('click', e => {
  const m = e.target.closest('.msg'); if (!m) return;
  const w = m.closest('.msg-wrap'); if (!w) return;
  const id = parseInt(w.dataset.id, 10), isGroup = w.dataset.group === '1', t = Date.now();
  if (lastTapId === id && t - lastTap < 300) {
    if (isGroup && state.currentGroup) api('group react', { groupId: state.currentGroup.id, messageId: id, emoji: '❤️' });
    else api('react', { messageId: id, emoji: '❤️' });
    const h = el('div', 'quick-react-heart', '❤️'); w.style.position = 'relative'; w.appendChild(h);
    setTimeout(() => h.remove(), 1000); vib([30, 20, 30]); lastTapId = null; lastTap = 0; e.stopPropagation(); return;
  }
  lastTapId = id; lastTap = t;
});

/* ─── 8. МОДАЛКИ / ESC ─── */
qsa('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); hideReactionMenu(); hideActionMenu(); } });

/* ─── 9. АВТОРИЗАЦИЯ (Исправлен баг с перезаходом) ─── */
let autoLoginDone = false, isLoggedInOnServer = false;

function showBanScreen(ban) {
  let s = $('ban-screen'); if (!s) { s = el('div'); s.id = 'ban-screen'; document.body.appendChild(s); }
  const until = ban.expires_at ? new Date(ban.expires_at).toLocaleString('ru-RU') : 'никогда';
  s.innerHTML = `<div class="ban-screen-inner"><div class="ban-emoji">🚫</div><h2>Ты забанен</h2><div class="ban-reason"><div class="ban-label">Причина:</div><div class="ban-value">${esc(ban.reason || 'Не указана')}</div></div><div class="ban-until"><div class="ban-label">До:</div><div class="ban-value">${esc(until)}</div><div class="ban-sub">(${esc(ban.duration_text || 'навсегда')})</div></div><button type="button" class="modal-secondary" onclick="location.reload()">🔄 Проверить снова</button></div>`;
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

function applyMe(res) {
  Object.assign(state.me, {
    username: res.username, avatar: res.avatar || null, banner: res.banner || null,
    avatarVideo: res.avatarVideo || res.avatar_video || null, // ФИКС
    bannerVideo: res.bannerVideo || res.banner_video || null, // ФИКС
    premium: !!res.premium, verified: !!res.verified, hammer: !!res.hammer, scam: !!res.scam,
    bio: res.bio || '', firstName: res.firstName || '', lastName: res.lastName || '', birthday: res.birthday || '', emoji: res.emojiStatus || '',
    sessionId: res.sessionId, stars: Number(res.stars || 0), isModerator: !!res.is_moderator, mute: res.mute || null
  });
  state.chatWallpapers = jget(STORAGE.WALLPAPERS, {});
}

function playLoginTransition(username, firstName, auto) {
  state.isLoggedIn = true; isLoggedInOnServer = true;
  const auth = $('auth'), app = $('app'), flash = $('welcome-flash'), wt = $('welcome-toast');
  hideSplash(); $('passcode-screen')?.classList.remove('active');
  if (auth?.classList.contains('active')) { auth.classList.add('auth-exit'); setTimeout(() => auth.classList.remove('active', 'auth-exit'), 450); }
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
    loadStories(); renderChatList(); renderStoriesBar(); applyChatWallpaper(); applyMuteLock();
    registerActions(APP_ACTIONS); // Важно: регистрируем экшены
  }, 200);
}

function forceShowAuth(msg) {
  isLoggedInOnServer = false; state.isLoggedIn = false; state.me.username = null; state.me.sessionId = null;
  $('app')?.classList.remove('active'); $('chat-screen')?.classList.remove('active');
  const a = $('auth'); if (a) { a.classList.remove('auth-exit'); a.classList.add('active'); }
  $('passcode-screen')?.classList.remove('active'); hideSplash(); toast('⚠️ ' + (msg || 'Войди заново'));
}

function onLoggedIn(res, auto) {
  applyMe(res); playLoginTransition(res.username, res.firstName, !!auto);
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
}

function doLogin() {
  const username = $('login-username')?.value || '', password = $('login-password')?.value || '';
  const err = $('login-error'); if (err) err.textContent = '';
  if (!username || !password) { if (err) err.textContent = 'Заполни все поля'; vib([30, 20, 30]); return; }
  showBtnSpinner('login-btn', 'Вхожу…');
  const existing = jget(STORAGE.SESSION);
  api('login', { username: username.trim().toLowerCase(), password, device: (navigator.userAgent || '').slice(0, 40), sessionId: existing?.sessionId || null }, res => {
    hideBtnSpinner('login-btn', 'Войти');
    if (!res?.ok) { if (res?.banned) { showBanScreen(res.ban); return; } if (err) err.textContent = res?.error || 'Ошибка входа'; vib([30, 20, 30]); return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
  });
}

// ИСПРАВЛЕННЫЙ АВТОЛОГИН
async function tryAutoLogin() {
  const creds = jget(STORAGE.SESSION);
  if (!creds?.sessionId) return false;
  return new Promise(resolve => {
    let done = false;
    // Ждем до 6 секунд, если сервер тупит
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

function showBtnSpinner(id, text) { const b = $(id); if (!b) return; const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner'); if (t && text) t.textContent = text; if (s) s.style.display = 'inline-flex'; b.disabled = true; }
function hideBtnSpinner(id, text) { const b = $(id); if (!b) return; const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner'); if (t && text) t.textContent = text; if (s) s.style.display = 'none'; b.disabled = false; }

function switchAuthScreen(s) { qsa('.auth-screen').forEach(x => x.classList.remove('active')); $(s === 'login' ? 'auth-login-screen' : 'auth-register-screen')?.classList.add('active'); if (s === 'register') { state.regStep = 1; regShowStep(1); } vib(10); }
function regShowStep(step) { state.regStep = step; qsa('.reg-progress-seg').forEach(seg => { const s = +seg.dataset.step; seg.classList.toggle('active', s === step); seg.classList.toggle('done', s < step); }); $('reg-back-btn')?.classList.toggle('show', step > 1); qsa('.reg-step-card').forEach(c => c.classList.toggle('active', +c.dataset.step === step)); setTimeout(() => $('reg-username')?.focus(), 200); vib(10); }
function regNext(step) { if (step === 1) { if (state.regUsernameAvailable) regShowStep(2); } else if (step === 2) { if (!($('reg-displayname')?.value || '').trim()) { $('reg-error-2').textContent = 'Введи имя'; return; } $('reg-error-2').textContent = ''; regShowStep(3); } }
function regBack() { if (state.regStep > 1) regShowStep(state.regStep - 1); vib(10); }
function togglePassword(id) { const input = $(id); if (!input) return; const btn = input.parentElement.querySelector('.auth-toggle-password'); if (input.type === 'password') { input.type = 'text'; if (btn) btn.textContent = '🙈'; } else { input.type = 'password'; if (btn) btn.textContent = '👁'; } vib(10); }

/* ─── 10. НАСТРОЙКИ UI ─── */
function renderTgRow(o) {
  const type = o.type || 'arrow', cls = 'settings-tg-row' + (type === 'danger' ? ' danger' : '') + (type === 'disabled' ? ' disabled' : '');
  let right = '';
  if (type === 'switch') right = `<label class="tg-row-switch" onclick="event.stopPropagation()"><input type="checkbox" ${o.checked ? 'checked' : ''} data-switch="${o.switchKey || ''}"><span class="slider"></span></label>`;
  else if (type === 'color') right = `<span class="tg-row-color-dot" style="background:${o.color || '#8b7fff'};"></span><span class="tg-row-arrow">›</span>`;
  else if (type === 'arrow') { if (o.value != null && o.value !== '') right += `<span class="tg-row-value">${esc(o.value)}</span>`; right += '<span class="tg-row-arrow">›</span>'; }
  else if (type === 'value') right = `<span class="tg-row-value">${esc(o.value || '')}</span>`;
  const actionAttr = o.action ? ` data-action="${o.action}"` : '';
  const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : '';
  return `<div class="${cls}"${actionAttr}${dataAttrs}><span class="tg-row-icon">${o.icon || ''}</span><span class="tg-row-text">${esc(o.text || '')}</span>${right}</div>`;
}

function renderSettings() {
  const box = $('settings-content'); if (!box) return;
  const me = state.me, s = state.settings, isAdmin = me.username === 'moroz', isPremium = !!me.premium;
  const display = (me.firstName || me.lastName) ? `${me.firstName} ${me.lastName || ''}`.trim() : '@' + me.username;
  const bannerMedia = me.bannerVideo ? `<video class="tg-banner" autoplay loop muted playsinline style="object-fit:cover;width:100%;height:100%"><source src="${me.bannerVideo}"></video>` : `<div class="tg-banner" style="${me.banner ? `background-image:url(${me.banner})` : ''}"></div>`;
  const avContent = me.avatarVideo ? `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${me.avatarVideo}"></video>` : me.avatar ? '' : initials(me.username);
  
  box.innerHTML = `
    <div class="settings-profile-card-tg${me.banner || me.bannerVideo ? '' : ' no-banner'}${isPremium ? ' premium' : ''}" data-action="open-profile">
      ${bannerMedia}<div class="tg-banner-overlay"></div>
      ${!me.banner && !me.bannerVideo ? '<span class="tg-no-banner-hint">+ Сменить баннер</span>' : ''}
      <div class="tg-profile-row">
        <div class="tg-profile-avatar" style="${me.avatar && !me.avatarVideo ? `background-image:url(${me.avatar})` : ''}">${avContent}</div>
        <div class="tg-profile-info">
          <div class="tg-profile-name${isPremium ? ' premium' : ''}">${esc(display)}${me.emoji ? ' ' + me.emoji : ''} ${renderBadges(me)}</div>
          <div class="tg-profile-username">@${esc(me.username)}</div>
          <div class="tg-profile-status"><span class="dot"></span>${isPremium ? 'Premium активен' : 'в сети'}</div>
        </div>
      </div>
    </div>
    <div class="settings-stars-row" data-action="open-stars-history"><span class="stars-icon">⭐</span><div class="stars-info"><div class="stars-count">${me.stars}${isAdmin ? '∞' : ''}</div><div class="stars-label">звёзды · нажми для истории</div></div><span class="stars-arrow">›</span></div>
    ${me.isModerator ? `<div class="settings-tg-section"><div class="settings-tg-section-title">🛡️ Модерация</div><div class="settings-tg-group">${renderTgRow({ icon: '🚨', text: 'Панель модератора', value: (state.modStats.new_reports || 0) > 0 ? (state.modStats.new_reports || 0) + ' новых' : '', action: 'open-mod-panel' })}</div></div>` : ''}
    <div class="settings-tg-section"><div class="settings-tg-section-title">🤖 Боты</div><div class="settings-tg-group">${renderTgRow({ icon: '🤖', text: 'Мои боты', value: `${state.myBots.length}/3`, action: 'open-my-bots' })}${renderTgRow({ icon: '➕', text: 'Создать бота', action: 'create-bot-open' })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div><div class="settings-tg-group">${renderTgRow({ icon: '🎨', text: 'Тема', value: s.theme === 'light' ? 'Светлая' : 'Тёмная', action: 'change-theme' })}${renderTgRow({ icon: '🎯', text: 'Акцентный цвет', type: 'color', color: s.accent_color || '#e63946', action: 'open-color-picker', data: { target: 'accent_color' } })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">${renderTgRow({ icon: '🚪', text: 'Выйти', type: 'danger', action: 'logout' })}</div></div>
  `;
  setTimeout(showCacheSize, 100);
  if (me.isModerator) api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
}

function renderSettingsTab() { const box = $('tab-settings-content'), orig = $('settings-content'); if (!box || !orig) return; renderSettings(); box.innerHTML = orig.innerHTML; }

/* ─── 11. СПИСОК ЧАТОВ ─── */
function renderChatList() {
  const box = $('chat-list'); if (!box) return; box.innerHTML = '';
  const savedUnread = state.unread.__saved__ || 0;
  const savedItem = el('div', 'chat-item' + (state.isSavedChat ? ' active' : ''));
  savedItem.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые сообщения</div></div><div class="chat-meta">${savedUnread > 0 ? `<div class="chat-badge">${savedUnread}</div>` : ''}</div>`;
  savedItem.onclick = openSavedChat; box.appendChild(savedItem);

  const allContacts = state.contacts.filter(c => state.showArchived ? c.archived : !c.archived);
  const pinSort = (a, b) => (b.pinOrder || 0) - (a.pinOrder || 0);
  const activeContacts = [...allContacts.filter(c => c.pinned).sort(pinSort), ...allContacts.filter(c => !c.pinned)];

  if (activeContacts.length) {
    box.appendChild(el('div', 'section-header', state.showArchived ? 'Архив: личные' : 'Личные чаты'));
    activeContacts.forEach(u => {
      const div = el('div', 'chat-item' + (state.currentChat === u.name ? ' active' : '') + (u.pinned ? ' pinned' : ''));
      const unread = state.unread[u.name] || 0;
      const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
      const content = u.avatar ? '' : initials(u.displayName || u.name);
      div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)}${u.emojiStatus ? ' ' + u.emojiStatus : ''} ${renderBadges(u)}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
      div.onclick = () => openChat(u.name); box.appendChild(div);
    });
  }
}

/* ─── 12. ОТКРЫТИЕ ЧАТОВ ─── */
function openChat(name) {
  state.currentChat = name; state.currentGroup = null; state.currentChannel = null; state.isSavedChat = false;
  const contact = state.contacts.find(c => c.name === name);
  state.isBotChat = !!contact?.isBot;
  if (state.unread[name]) { delete state.unread[name]; jset(STORAGE.UNREAD, state.unread); updateTitle(); renderChatList(); }

  $('chat-top-name').innerHTML = esc(contact?.displayName || name) + ' ' + renderBadgesBig(contact || {});
  const ts = $('chat-top-status'); if (ts) ts.textContent = contact?.online ? 'в сети' : 'был(а) недавно';
  
  const av = $('chat-avatar');
  if (av) {
    if (contact?.avatarVideo) { av.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${contact.avatarVideo}"></video>`; av.style.backgroundImage = ''; }
    else if (contact?.avatar) { av.innerHTML = ''; av.style.backgroundImage = `url(${contact.avatar})`; }
    else { av.innerHTML = initials(contact?.displayName || name); av.style.background = 'var(--accent)'; }
  }
  
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
  setTimeout(() => api('mark read', { withUser: name }), 300);
  renderChatList(); applyChatWallpaper();
}

function openSavedChat() {
  state.currentChat = null; state.currentGroup = null; state.isSavedChat = true; state.isBotChat = false;
  if (state.unread.__saved__) { delete state.unread.__saved__; jset(STORAGE.UNREAD, state.unread); updateTitle(); renderChatList(); }
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые сообщения';
  $('chat-avatar').innerHTML = '⭐'; $('chat-avatar').style.backgroundImage = '';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load saved history');
}

function closeChat() {
  $('chat-screen').classList.remove('active');
  state.currentChat = null; state.currentGroup = null; state.isSavedChat = false; state.isBotChat = false;
  if (state.isRecording) stopVoiceRecording(true);
  hideReactionMenu(); hideActionMenu(); cancelReply();
  renderChatList();
}

/* ─── 13. СООБЩЕНИЯ ─── */
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
  const meta = el('span', 'meta', fmtT(msg.time));
  div.appendChild(meta);
  
  wrap.appendChild(div); box.appendChild(wrap); box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const input = $('msgInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  
  if (state.isSavedChat) api('private message', { to: state.me.username, text });
  else if (state.currentChat) api('private message', { to: state.currentChat, text });
  
  input.value = ''; cancelReply();
}

/* ─── 14. ИНИЦИАЛИЗАЦИЯ (ФИКС БЕЛОГО ЭКРАНА) ─── */
window.addEventListener('load', () => {
  try {
    state.unread = jget(STORAGE.UNREAD, {}) || {};
    initNotifications();
    
    const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
    const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
    
    // ВАЖНО: регистрируем все действия!
    registerActions(APP_ACTIONS);

    // Если сессии нет, показываем авторизацию
    const creds = jget(STORAGE.SESSION);
    if (!creds?.sessionId) {
      hideSplash();
      $('auth')?.classList.add('active');
    }
  } catch (e) {
    console.error('Init error:', e); hideSplash(); $('auth')?.classList.add('active');
  }
});

// Socket Listeners
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
  box.scrollTop = box.scrollHeight;
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
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v17.0 — Часть 2 (Финал)
   Объект действий, звонки, сокеты и инициализация.
   ═══════════════════════════════════════════════════════════ */

/* ─── 15. КАРТА ДЕЙСТВИЙ (обработчики data-action) ─── */
const APP_ACTIONS = {
  // --- Навигация ---
  'tab': (d) => switchTab(d.value),
  'open-settings': () => $('settings-screen')?.classList.add('active'),
  'close-settings': () => $('settings-screen')?.classList.remove('active'),
  'open-profile': () => {
    $('profile-username').textContent = '@' + (state.me.username || '');
    $('my-first-name').value = state.me.firstName || '';
    $('my-last-name').value = state.me.lastName || '';
    $('my-bio').value = state.me.bio || '';
    openModal('profile-modal');
  },
  'save-profile': () => {
    api('update profile', {
      firstName: $('my-first-name')?.value.trim(),
      lastName: $('my-last-name')?.value.trim(),
      bio: $('my-bio')?.value.trim()
    }, res => {
      if (res?.ok) { Object.assign(state.me, { firstName: $('my-first-name').value, lastName: $('my-last-name').value, bio: $('my-bio').value }); closeModal('profile-modal'); toast('✓ Сохранено'); }
    });
  },
  
  // --- Модалки ---
  'open-modal': (d) => openModal(d.target),
  'close-modal': (d) => closeModal(d.target),
  'reload': () => location.reload(),

  // --- Чат ---
  'close-chat': () => closeChat(),
  'open-contact-profile': () => {
    if (state.currentChat) openContactProfile(state.currentChat);
    else if (state.currentGroup) openGroupInfo();
  },
  'send-msg': () => sendMsg(),
  'toggle-attach': () => $('attach-menu')?.classList.toggle('active'),
  'close-attach': () => $('attach-menu')?.classList.remove('active'),

  // --- Настройки (переключатели) ---
  'change-theme': () => {
    const v = state.settings.theme === 'light' ? 'dark' : 'light';
    api('update settings', { key: 'theme', value: v }, () => { state.settings.theme = v; applyLocalSettings(); renderSettings(); });
  },
  'logout': () => { if(confirm('Выйти?')) { localStorage.clear(); location.reload(); } },
  'open-color-picker': (d) => openColorPicker(d.target),

  // --- Вложения ---
  'attach-photo': () => { $('attach-menu').classList.remove('active'); $('photoFile').click(); },
  'attach-voice': () => { $('attach-menu').classList.remove('active'); toggleVoiceRecording(); },
  'attach-geo': () => { $('attach-menu').classList.remove('active'); sendGeo(); },
  'attach-stickers': () => { $('attach-menu').classList.remove('active'); $('stickers-panel').classList.add('active'); },
  'attach-spoiler': () => { $('attach-menu').classList.remove('active'); state.spoilerMode = !state.spoilerMode; toast(state.spoilerMode ? '👁 Спойлер вкл' : '👁 Спойлер выкл'); },
  'send-photo': (d, el, e) => sendPhoto(e),

  // --- Звонки (кнопки в чате) ---
  'call-audio': () => startCall(false),
  'call-video': () => startCall(true),
  'accept-call': () => acceptIncoming(),
  'decline-call': () => { $('incoming-screen').classList.remove('active'); if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom }); },
  'hangup': () => { if (state.currentChat) socket.emit('end-call', { to: state.currentChat }); cleanupCall(); },
  'toggle-mic': () => toggleMic(),
  'toggle-camera': () => toggleCamera(),
  
  // --- Разное ---
  'toggle-password': (d) => togglePassword(d.target),
  'enable-notifications': () => enableNotifications(),
  'open-stars-history': () => toast('⭐ История звёзд (в разработке)'),
  'scroll-bottom': () => { const box = $('messages'); if(box) box.scrollTo({top: box.scrollHeight, behavior: 'smooth'}); },
  'cancel-reply': () => cancelReply(),
};

/* ─── 16. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Звонки, поиск, звук) ─── */
function setReplyPreview(msg) {
  state.replyToMessage = msg;
  $('rp-name').textContent = msg.self ? 'Я' : displayName(msg.from);
  $('rp-msg').textContent = msg.text || 'Вложение';
  $('reply-preview').classList.add('active');
  $('msgInput').focus();
}
function cancelReply() { state.replyToMessage = null; $('reply-preview')?.classList.remove('active'); }
function hideReactionMenu() { $('reaction-menu')?.classList.remove('active'); }
function hideActionMenu() { $('action-menu')?.classList.remove('active'); }
function updateMyAvatarBtn() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatar) btn.style.backgroundImage = `url(${state.me.avatar})`;
  else btn.textContent = '👤';
}
function updateVerifyButton() { const b = $('verify-btn'); if (b) b.style.display = state.me.username === 'moroz' ? 'block' : 'none'; }
function updateVerifyChannelButton() { const b = $('verify-channel-btn'); if (b) b.style.display = state.me.username === 'moroz' ? 'block' : 'none'; }
function renderStoriesBar() { /* Заглушка, если нет JS для историй */ }
function loadStories() { /* Заглушка */ }
function applyChatWallpaper() { /* Заглушка */ }
function openContactProfile(username) {
  api('get profile', { username }, data => {
    if (!data) return;
    $('contact-profile-content').innerHTML = `<div style="text-align:center;"><div style="font-size:50px;margin-bottom:10px;">${initials(username)}</div><h3>${esc(data.firstName || username)}</h3><p style="color:var(--text-muted)">@${esc(username)}</p></div>`;
    openModal('contact-profile-modal');
  });
}
function openGroupInfo() { toast('Инфо о группе'); }
function openSavedChat() { /* Уже есть в части 1 */ }

/* ─── 17. WEBRTC (Полный фикс звонков) ─── */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceCandidatePoolSize: 4
};

let iceCandidatesQueue = [];
let isRemoteDescSet = false;

async function startCall(video) {
  if (!state.currentChat || state.callActive) return;
  if (state.isBotChat) return toast('🤖 Ботам нельзя звонить');
  
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  } catch (err) { return alert('Нет доступа к микрофону/камере: ' + err.message); }

  state.callActive = true;
  showCallScreen(state.currentChat, video, 'Вызов...');
  
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;

  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  
  state.peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate });
  };
  
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    startCallTimer();
  };

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
}

function showCallScreen(peerName, video, statusText) {
  $('call-peer-name').textContent = peerName;
  $('call-status').textContent = statusText;
  $('call-screen').classList.add('active');
  if (video) {
    $('local-video-wrap').classList.add('active');
    $('localVideo').srcObject = state.localStream;
  }
}

async function acceptIncoming() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;

  const from = state.incomingFrom, offer = state.pendingOffer;
  state.currentChat = from; state.pendingOffer = null; state.incomingFrom = null;
  
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.incomingVideo });
  } catch (err) { socket.emit('end-call', { to: from }); return alert('Нет доступа: ' + err.message); }

  state.callActive = true;
  showCallScreen(from, state.incomingVideo, 'Соединение...');

  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  iceCandidatesQueue = []; isRemoteDescSet = false;

  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  
  state.peerConnection.onicecandidate = e => {
    if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate });
  };
  
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    startCallTimer();
  };

  await state.peerConnection.setRemoteDescription(offer);
  isRemoteDescSet = true;
  iceCandidatesQueue.forEach(c => state.peerConnection.addIceCandidate(c).catch(()=>{}));
  iceCandidatesQueue = [];

  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
}

function cleanupCall() {
  state.callActive = false;
  clearInterval(state.callTimerInterval);
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  $('call-screen').classList.remove('active');
  $('incoming-screen').classList.remove('active');
  $('localVideo').srcObject = null;
  $('remoteVideo').srcObject = null;
}
function startCallTimer() {
  state.callStartTime = Date.now();
  clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - state.callStartTime) / 1000);
    $('call-timer').textContent = `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  }, 1000);
}
function toggleMic() { if (state.localStream) { const t = state.localStream.getAudioTracks()[0]; t.enabled = !t.enabled; $('micBtn').classList.toggle('off', !t.enabled); } }
function toggleCamera() { if (state.localStream) { const t = state.localStream.getVideoTracks()[0]; t.enabled = !t.enabled; $('camBtn').classList.toggle('off', !t.enabled); } }


/* ─── 18. ОБРАБОТЧИКИ СОКЕТОВ (Сигналинг звонков и др.) ─── */
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
  $('call-status').textContent = 'В разговоре';
  startCallTimer();
});

socket.on('ice-candidate', async data => {
  if (!state.peerConnection || !data.candidate) return;
  if (!isRemoteDescSet) iceCandidatesQueue.push(data.candidate);
  else await state.peerConnection.addIceCandidate(data.candidate).catch(()=>{});
});

socket.on('call-ended', () => cleanupCall());
socket.on('call-failed', data => { alert('Звонок не удался: ' + (data.reason || 'Ошибка')); cleanupCall(); });

/* ─── 19. SOCKET: ПРИЁМ СООБЩЕНИЙ ─── */
socket.on('private message', data => {
  if (data.from === state.currentChat && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false });
  } else if (!data.self) {
    state.unread[data.from] = (state.unread[data.from] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread); updateTitle(); renderChatList(); playPing();
  }
});

socket.on('message blocked', d => toast(d.reason));


/* ─── 20. ФИНАЛЬНЫЙ ЗАПУСК (ТОЧКА ВХОДА) ─── */
// ВАЖНО: регистрируем действия ДО того, как что-то произойдет
registerActions(APP_ACTIONS);

// Слушаем загрузку, чтобы восстановить состояние
window.addEventListener('DOMContentLoaded', () => {
  // Восстанавливаем кэш
  const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
  const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
  const uc = jget(STORAGE.UNREAD); if (uc) state.unread = uc;

  // Подгружаем каталог подарков
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });

  // ПРИНУДИТЕЛЬНЫЙ АВТОЛОГИН
  const creds = jget(STORAGE.SESSION);
  if (creds?.sessionId) {
    // Показываем сплэш, пока идет авторизация
    tryAutoLogin().then(ok => {
      if (!ok) {
        hideSplash();
        $('auth').classList.add('active');
      }
    });
  } else {
    hideSplash();
    $('auth').classList.add('active');
  }
});

console.log('%c✅ Azerta v17.0 — Установлена', 'color:#4ade80;font-weight:bold;font-size:14px');