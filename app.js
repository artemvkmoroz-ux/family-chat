'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v18.0 — Client (Part 1: Core, Auth, Settings)
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
  activeTab: 'chats', settings: {},
  regStep: 1, regUsernameAvailable: false, regUsernameCheckTimer: null,
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
  circleStream: null, circleRecorder: null, circleChunks: [], circleTimer: null, circleStartTime: 0, circleMime: '',
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
const STORY_DURATION = 5000, SWIPE_THRESHOLD = 60, MAX_RECORDING_SEC = 60, MAX_CIRCLE_SEC = 30;

const BUILTIN_GIFS = [
  ['😀','https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'],
  ['😍','https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif'],
  ['😂','https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif'],
  ['👍','https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'],
  ['❤️','https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif']
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

/* ─── 5. RIPPLE + SWIPE + DOUBLE-TAP ─── */
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
  if (Math.abs(s.dx) >= SWIPE_THRESHOLD) {
    const id = parseInt(s.wrap.dataset.id, 10);
    if (id) triggerReplyFromSwipe(id, s.wrap.dataset.group === '1');
  }
});
function triggerReplyFromSwipe(id, isGroup) {
  const wrap = qs(`.msg-wrap[data-id="${id}"]`); if (!wrap) return;
  const txt = qs('.msg-text', wrap)?.textContent || '';
  const from = wrap.dataset.from || state.me.username;
  setReplyPreview({ id, from, text: txt, self: wrap.classList.contains('self'), isGroup });
  vib(15);
}

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

qsa('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (modalStack.length) closeModal(modalStack[modalStack.length - 1]); hideReactionMenu(); hideActionMenu(); } });

/* ─── 6. АВТОРИЗАЦИЯ ─── */
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
  if (input) { input.disabled = true; input.placeholder = '🔇 Ты в муте'; }
  if (send) send.disabled = true; if (attach) attach.disabled = true;
  let b = $('mute-banner'); if (!b) { b = el('div'); b.id = 'mute-banner'; $('input-area')?.parentNode?.insertBefore(b, $('input-area')); }
  b.innerHTML = '🔇 Ты в муте' + (mute.reason ? ' · ' + esc(mute.reason) : '');
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

function playLoginTransition(username, firstName, auto) {
  state.isLoggedIn = true; isLoggedInOnServer = true;
  const auth = $('auth'), app = $('app');
  hideSplash(); $('passcode-screen')?.classList.remove('active');
  if (auth?.classList.contains('active')) { auth.classList.add('auth-exit'); setTimeout(() => auth.classList.remove('active', 'auth-exit'), 450); }
  else auth?.classList.remove('active');
  if (app) { app.classList.add('active', 'app-enter'); void app.offsetWidth; setTimeout(() => app.classList.remove('app-enter'), 700); }
  
  setTimeout(() => {
    updateMyAvatarBtn(); renderChatList(); renderStoriesBar(); applyChatWallpaper(); applyMuteLock();
    if (state.me.isModerator) api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
  }, 200);
}

function forceShowAuth(msg) {
  isLoggedInOnServer = false; state.isLoggedIn = false; state.me.username = null;
  $('app')?.classList.remove('active'); $('chat-screen')?.classList.remove('active');
  const a = $('auth'); if (a) { a.classList.remove('auth-exit'); a.classList.add('active'); }
  hideSplash(); toast('⚠️ ' + (msg || 'Войди заново'));
}

function onLoggedIn(res, auto) {
  applyMe(res); playLoginTransition(res.username, res.firstName, !!auto);
  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
}

function doLogin() {
  const username = $('login-username')?.value || '', password = $('login-password')?.value || '';
  const err = $('login-error'); if (err) err.textContent = '';
  if (!username || !password) { if (err) err.textContent = 'Заполни все поля'; return; }
  const btn = $('login-btn'), t = btn.querySelector('.btn-text'), s = btn.querySelector('.btn-spinner');
  if (t) t.textContent = 'Вхожу…'; if (s) s.style.display = 'inline-flex'; btn.disabled = true;
  api('login', { username: username.trim().toLowerCase(), password }, res => {
    if (t) t.textContent = 'Войти'; if (s) s.style.display = 'none'; btn.disabled = false;
    if (!res?.ok) { if (res?.banned) { showBanScreen(res.ban); return; } if (err) err.textContent = res?.error || 'Ошибка входа'; return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
  });
}

function doRegister() {
  const username = $('reg-username')?.value || '';
  const displayName = $('reg-displayname')?.value || '';
  const password = $('reg-password')?.value || '';
  const err = $('reg-error-3'); if (err) err.textContent = '';
  const btn = $('reg-submit'); if (btn) { btn.disabled = true; btn.querySelector('.btn-text').textContent = 'Создаю…'; }
  api('register', { username: username.trim().toLowerCase(), password, displayName: displayName.trim() }, res => {
    if (btn) { btn.disabled = false; btn.querySelector('.btn-text').textContent = 'Создать аккаунт'; }
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка регистрации'; return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
    toast('🎉 Добро пожаловать! +' + res.bonus + ' ⭐');
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

function switchAuthScreen(s) {
  qsa('.auth-screen').forEach(x => x.classList.remove('active'));
  $(s === 'login' ? 'auth-login-screen' : 'auth-register-screen')?.classList.add('active');
  if (s === 'register') { state.regStep = 1; regShowStep(1); }
}
function regShowStep(step) {
  state.regStep = step;
  qsa('.reg-progress-seg').forEach(seg => {
    const s = +seg.dataset.step;
    seg.classList.toggle('active', s === step); seg.classList.toggle('done', s < step);
  });
  $('reg-back-btn')?.classList.toggle('show', step > 1);
  qsa('.reg-step-card').forEach(c => c.classList.toggle('active', +c.dataset.step === step));
  setTimeout(() => $('reg-username')?.focus(), 200);
}
function regNext(step) {
  if (step === 1) { if (state.regUsernameAvailable) regShowStep(2); }
  else if (step === 2) {
    if (!($('reg-displayname')?.value || '').trim()) { $('reg-error-2').textContent = 'Введи имя'; return; }
    $('reg-error-2').textContent = ''; regShowStep(3);
  }
}
function regBack() { if (state.regStep > 1) regShowStep(state.regStep - 1); }
function onRegUsernameInput() {
  const input = $('reg-username'), wrap = $('reg-username-wrap'), status = $('reg-username-status'), hint = $('reg-username-hint'), next = $('reg-next-1');
  if (!input) return;
  const v = input.value.trim().toLowerCase(); input.value = v;
  wrap.classList.remove('error', 'success'); status.textContent = ''; hint.classList.remove('error', 'success');
  next.disabled = true; state.regUsernameAvailable = false;
  if (v.length < 3) { hint.textContent = 'Минимум 3 символа'; hint.classList.add('error'); return; }
  if (!/^[a-z0-9_]+$/.test(v)) { hint.textContent = 'Только латиница и _'; hint.classList.add('error'); wrap.classList.add('error'); return; }
  hint.textContent = 'Проверяю...'; status.textContent = '⏳';
  clearTimeout(state.regUsernameCheckTimer);
  state.regUsernameCheckTimer = setTimeout(() => {
    api('check username', { username: v }, res => {
      if (!res?.ok) { hint.textContent = 'Ошибка проверки'; hint.classList.add('error'); return; }
      if (res.available) { wrap.classList.add('success'); status.textContent = '✅'; hint.textContent = 'Свободен!'; hint.classList.add('success'); next.disabled = false; state.regUsernameAvailable = true; }
      else { wrap.classList.add('error'); status.textContent = '❌'; hint.textContent = 'Ник занят'; hint.classList.add('error'); next.disabled = true; }
    });
  }, 350);
}
function onRegPasswordInput() {
  const p = $('reg-password')?.value || '';
  const bar = $('reg-strength-bar'), label = $('reg-strength-label');
  if (!bar || !label) return;
  bar.classList.remove('weak', 'medium', 'strong');
  if (!p) { label.textContent = 'Введи пароль'; bar.style.width = '0'; return; }
  let score = 0;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (p.length < 8) { bar.classList.add('weak'); label.textContent = 'Слишком короткий'; }
  else if (score <= 2) { bar.classList.add('weak'); label.textContent = 'Слабый'; }
  else if (score === 3) { bar.classList.add('medium'); label.textContent = 'Средний'; }
  else { bar.classList.add('strong'); label.textContent = 'Сильный 💪'; }
  onRegPassword2Input();
}
function onRegPassword2Input() {
  const p = $('reg-password')?.value || '', p2 = $('reg-password2')?.value || '';
  const hint = $('reg-password2-hint');
  if (hint) { if (p2 && p === p2) { hint.textContent = '✓ Совпадают'; hint.className = 'auth-hint success'; } else if (p2) { hint.textContent = 'Не совпадают'; hint.className = 'auth-hint error'; } else { hint.textContent = ''; } }
  const dn = ($('reg-displayname')?.value || '').trim();
  const btn = $('reg-submit');
  if (btn) btn.disabled = !(p.length >= 8 && p === p2 && dn && state.regUsernameAvailable);
}
function togglePassword(id) { const i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password'; }
function tryPasscode() {
  const v = $('passcode-input')?.value || '', err = $('passcode-error'); if (err) err.textContent = '';
  api('check passcode', { passcode: v }, res => {
    if (!res?.ok) { if (err) err.textContent = 'Неверный код'; return; }
    $('passcode-screen')?.classList.remove('active');
    playLoginTransition(state.me.username, state.me.firstName, true);
  });
}

/* ─── 7. НАСТРОЙКИ ─── */
function renderTgRow(o) {
  const type = o.type || 'arrow', cls = 'settings-tg-row' + (type === 'danger' ? ' danger' : '');
  let right = '';
  if (type === 'switch') right = `<label class="tg-row-switch" onclick="event.stopPropagation()"><input type="checkbox" ${o.checked ? 'checked' : ''} data-switch="${o.switchKey || ''}"><span class="slider"></span></label>`;
  else if (type === 'color') right = `<span class="tg-row-color-dot" style="background:${o.color || '#e63946'};"></span><span class="tg-row-arrow">›</span>`;
  else if (type === 'arrow') { if (o.value != null && o.value !== '') right += `<span class="tg-row-value">${esc(o.value)}</span>`; right += '<span class="tg-row-arrow">›</span>'; }
  const actionAttr = o.action ? ` data-action="${o.action}"` : '';
  const dataAttrs = o.data ? Object.entries(o.data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('') : '';
  return `<div class="${cls}"${actionAttr}${dataAttrs}><span class="tg-row-icon">${o.icon || ''}</span><span class="tg-row-text">${esc(o.text || '')}</span>${right}</div>`;
}
const visibilityLabel = v => ({ everyone: 'Все', contacts: 'Контакты', nobody: 'Никто' }[v] || 'Все');

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
    <div class="settings-stars-row" data-action="open-stars-history"><span class="stars-icon">⭐</span><div class="stars-info"><div class="stars-count">${me.stars}${isAdmin ? '∞' : ''}</div><div class="stars-label">звёзды</div></div><span class="stars-arrow">›</span></div>
    ${me.isModerator ? `<div class="settings-tg-section"><div class="settings-tg-section-title">🛡️ Модерация</div><div class="settings-tg-group">${renderTgRow({ icon: '🚨', text: 'Панель модератора', value: (state.modStats.new_reports || 0) > 0 ? (state.modStats.new_reports || 0) + ' новых' : '', action: 'open-mod-panel' })}</div></div>` : ''}
    <div class="settings-tg-section"><div class="settings-tg-section-title">🤖 Боты</div><div class="settings-tg-group">${renderTgRow({ icon: '🤖', text: 'Мои боты', value: `${state.myBots.length}/3`, action: 'open-my-bots' })}${renderTgRow({ icon: '➕', text: 'Создать бота', action: 'create-bot-open' })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎁 Подарки</div><div class="settings-tg-group">${renderTgRow({ icon: '🎁', text: 'Мои подарки', action: 'open-my-gifts' })}${renderTgRow({ icon: '💳', text: 'Активировать премиум по коду', action: 'open-gift-modal' })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🔔 Уведомления</div><div class="settings-tg-group">
      ${renderTgRow({ icon: '🔔', text: 'Звук', type: 'switch', checked: s.sound == 1, switchKey: 'sound', action: 'toggle-setting', data: { key: 'sound' } })}
      ${renderTgRow({ icon: '📳', text: 'Вибрация', type: 'switch', checked: s.vibration == 1, switchKey: 'vibration', action: 'toggle-setting', data: { key: 'vibration' } })}
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div><div class="settings-tg-group">
      ${renderTgRow({ icon: '🎨', text: 'Тема', value: s.theme === 'light' ? 'Светлая' : 'Тёмная', action: 'change-theme' })}
      ${renderTgRow({ icon: '🎯', text: 'Акцентный цвет', type: 'color', color: s.accent_color || '#e63946', action: 'open-color-picker', data: { target: 'accent_color' } })}
      ${renderTgRow({ icon: '⚡', text: 'Отключить анимации', type: 'switch', checked: s.animations == 0, switchKey: 'animations', action: 'toggle-setting', data: { key: 'animations' } })}
    </div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">${renderTgRow({ icon: '📱', text: 'Мой QR-код', action: 'show-my-qr' })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">
      ${renderTgRow({ icon: '🚪', text: 'Выйти', type: 'danger', action: 'logout' })}
    </div></div>
    <div style="padding:30px 20px 10px;text-align:center;color:var(--text-muted);font-size:12px;">🌌 Azerta v18.0</div>`;
  if (me.isModerator) api('mod panel stats', r => { if (r?.ok) { state.modStats = r.stats || {}; const pending = (state.modStats.new_reports || 0); if (pending > 0) { const card = document.querySelector('.settings-tg-row[data-action="open-mod-panel"]'); if (card) { const val = card.querySelector('.tg-row-value'); if (val) val.textContent = pending + ' новых'; } } } });
}
function renderSettingsTab() { const box = $('tab-settings-content'), orig = $('settings-content'); if (!box || !orig) return; renderSettings(); box.innerHTML = orig.innerHTML; }
function applyLocalSettings() {
  const s = state.settings;
  document.body.classList.toggle('light', s.theme === 'light');
  document.body.classList.toggle('no-anim', s.animations == 0);
  document.documentElement.style.setProperty('--font-size', { small: '13px', medium: '15px', large: '17px' }[s.font_size] || '15px');
  if (s.accent_color) {
    document.documentElement.style.setProperty('--accent', s.accent_color);
    const hex = s.accent_color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) || 230;
    const g = parseInt(hex.substr(2, 2), 16) || 57;
    const b = parseInt(hex.substr(4, 2), 16) || 70;
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.15)`);
  }
}
function toggleSetting(key) {
  const v = (state.settings[key] == 1) ? 0 : 1;
  api('update settings', { key, value: v }, () => {
    state.settings[key] = v; applyLocalSettings(); renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeTheme() {
  const v = state.settings.theme === 'light' ? 'dark' : 'light';
  api('update settings', { key: 'theme', value: v }, () => {
    state.settings.theme = v; applyLocalSettings(); renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeFontSize() {
  const order = ['small', 'medium', 'large'];
  const v = order[(order.indexOf(state.settings.font_size || 'medium') + 1) % order.length];
  api('update settings', { key: 'font_size', value: v }, () => {
    state.settings.font_size = v; applyLocalSettings(); renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeLastSeen() {
  const opts = ['everyone', 'contacts', 'nobody'];
  const v = opts[(opts.indexOf(state.settings.last_seen_visibility || 'everyone') + 1) % opts.length];
  api('set last seen visibility', { value: v }, () => { state.settings.last_seen_visibility = v; renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function changeGeoVisibility() {
  const opts = ['everyone', 'contacts', 'nobody'];
  const v = opts[(opts.indexOf(state.settings.geo_visibility || 'contacts') + 1) % opts.length];
  api('update settings', { key: 'geo_visibility', value: v }, () => { state.settings.geo_visibility = v; renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function openColorPicker(target) {
  state.currentColorTarget = target;
  const grid = $('color-grid'); if (!grid) return;
  const colors = ['#e63946', '#ec4899', '#8b7fff', '#fbbf24', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#a78bfa', '#14b8a6', '#f43f5e', '#3b82f6'];
  grid.innerHTML = '';
  colors.forEach(c => {
    const d = el('div', 'color-dot'); d.style.background = c; d.style.cssText = `width:40px;height:40px;border-radius:50%;cursor:pointer;margin:4px;display:inline-block;background:${c};`;
    if (state.settings[target] === c) d.style.boxShadow = '0 0 0 3px #fff';
    d.onclick = () => api('update settings', { key: target, value: c }, () => { state.settings[target] = c; applyLocalSettings(); closeModal('color-modal'); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
    grid.appendChild(d);
  });
  openModal('color-modal');
}
function showCacheSize() {
  const e = $('cache-size'); if (!e) return;
  let size = 0; try { for (const k in localStorage) if (Object.prototype.hasOwnProperty.call(localStorage, k)) size += (localStorage[k].length + k.length) * 2; } catch {}
  e.textContent = (size / 1024).toFixed(1) + ' КБ';
}
function clearCache() {
  if (!confirm('Очистить кэш?')) return;
  const keep = ['SESSION', 'UNREAD', 'WALLPAPERS'].map(k => [STORAGE[k], localStorage.getItem(STORAGE[k])]).filter(([, v]) => v);
  localStorage.clear(); keep.forEach(([k, v]) => localStorage.setItem(k, v));
  alert('Кэш очищен'); showCacheSize();
}
function logout() {
  if (!confirm('Выйти из аккаунта?')) return;
  [STORAGE.SESSION, STORAGE.UNREAD, STORAGE.CONTACTS, STORAGE.GROUPS].forEach(k => localStorage.removeItem(k));
  location.reload();
}
function openPasscodeModal() { $('passcode-new').value = ''; $('passcode-confirm').value = ''; $('passcode-error-modal').textContent = ''; openModal('passcode-setup-modal'); }
function savePasscode() {
  const p1 = $('passcode-new').value, p2 = $('passcode-confirm').value, err = $('passcode-error-modal');
  if (err) err.textContent = '';
  if (p1.length < 4) { if (err) err.textContent = 'Минимум 4 символа'; return; }
  if (p1 !== p2) { if (err) err.textContent = 'Коды не совпадают'; return; }
  api('set passcode', { passcode: p1 }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    state.settings.passcode = 'set'; closeModal('passcode-setup-modal'); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function removePasscode() { api('set passcode', { passcode: '' }, () => { state.settings.passcode = null; closeModal('passcode-setup-modal'); renderSettings(); }); }
function showMyQr() {
  const c = $('qr-display'); if (!c) return;
  c.innerHTML = '';
  const link = location.origin + '/?add=' + state.me.username;
  const img = new Image();
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
  c.appendChild(img); openModal('my-qr-modal');
}
function copyQrLink() { navigator.clipboard.writeText(location.origin + '/?add=' + state.me.username).then(() => toast('📋 Скопировано')).catch(() => {}); }
function openProfile() {
  $('profile-username').textContent = '@' + (state.me.username || '');
  $('my-first-name').value = state.me.firstName || '';
  $('my-last-name').value = state.me.lastName || '';
  $('my-bio').value = state.me.bio || '';
  $('my-birthday').value = state.me.birthday || '';
  $('my-emoji').value = state.me.emoji || '';
  const p = $('profile-banner-preview'), img = $('profile-banner-img');
  if (state.me.banner && p && img) { img.src = state.me.banner; p.style.display = 'block'; p.classList.remove('removing'); } else if (p) p.style.display = 'none';
  $('verify-btn').style.display = state.me.username === 'moroz' ? 'block' : 'none';
  $('verify-channel-btn').style.display = state.me.username === 'moroz' ? 'block' : 'none';
  openModal('profile-modal');
}
function saveProfile() {
  api('update profile', {
    firstName: ($('my-first-name')?.value || '').trim(),
    lastName: ($('my-last-name')?.value || '').trim(),
    bio: ($('my-bio')?.value || '').trim(),
    birthday: $('my-birthday')?.value || '',
    emojiStatus: ($('my-emoji')?.value || '').trim()
  }, res => { if (!res?.ok) return; Object.assign(state.me, { firstName: $('my-first-name').value, lastName: $('my-last-name').value, bio: $('my-bio').value, birthday: $('my-birthday').value, emoji: $('my-emoji').value }); closeModal('profile-modal'); renderChatList(); toast('✓ Профиль сохранён'); });
}
function updateMyAvatarBtn() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatarVideo) btn.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${state.me.avatarVideo}"></video>`;
  else if (state.me.avatar) btn.innerHTML = `<img src="${state.me.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else btn.textContent = '👤';
  btn.style.boxShadow = state.me.premium ? '0 0 0 2px var(--gold), 0 0 12px rgba(255, 215, 0, 0.5)' : '';
}
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v18.0 — Client (Part 2: Features)
   ═══════════════════════════════════════════════════════════ */

/* ─── 8. СПИСОК ЧАТОВ ─── */
function renderChatList() {
  const box = $('chat-list'); if (!box) return; box.innerHTML = '';
  
  // Избранное
  const savedUnread = state.unread.__saved__ || 0;
  const savedItem = el('div', 'chat-item');
  savedItem.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые сообщения</div></div><div class="chat-meta">${savedUnread > 0 ? `<div class="chat-badge">${savedUnread}</div>` : ''}</div>`;
  savedItem.onclick = openSavedChat; box.appendChild(savedItem);

  // Группы
  if (state.groups.length) {
    box.appendChild(el('div', 'section-header', 'Группы'));
    state.groups.forEach(g => {
      const div = el('div', 'chat-item' + (state.currentGroup?.id === g.id ? ' active' : ''));
      const unread = state.unread['g:' + g.id] || 0;
      div.innerHTML = `<div class="avatar group">👥</div><div class="chat-info"><div class="chat-name">${esc(g.name)}</div><div class="chat-preview">${g.memberCount} участников</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
      div.onclick = () => openGroupChat(g); box.appendChild(div);
    });
  }

  // Каналы
  if (state.channels.length) {
    box.appendChild(el('div', 'section-header', 'Каналы'));
    state.channels.forEach(ch => {
      const div = el('div', 'chat-item');
      div.innerHTML = `<div class="avatar channel">📢</div><div class="chat-info"><div class="chat-name">${esc(ch.name)}${ch.verified ? '<span class="verified-badge">✓</span>' : ''}</div><div class="chat-preview">@${esc(ch.slug)}</div></div>`;
      div.onclick = () => openChannelChat(ch); box.appendChild(div);
    });
  }

  // Личные чаты
  if (state.contacts.length) {
    box.appendChild(el('div', 'section-header', 'Личные чаты'));
    state.contacts.forEach(u => {
      const div = el('div', 'chat-item' + (state.currentChat === u.name ? ' active' : ''));
      const unread = state.unread[u.name] || 0;
      const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
      const content = u.avatar ? '' : initials(u.displayName || u.name);
      div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${esc(u.displayName || u.name)} ${renderBadges(u)}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
      div.onclick = () => openChat(u.name); box.appendChild(div);
    });
  }
}

/* ─── 9. ОТКРЫТИЕ ЧАТОВ ─── */
function openChat(name) {
  state.currentChat = name; state.currentGroup = null; state.currentChannel = null; state.isSavedChat = false;
  const contact = state.contacts.find(c => c.name === name);
  state.isBotChat = !!contact?.isBot;
  if (state.unread[name]) { delete state.unread[name]; jset(STORAGE.UNREAD, state.unread); renderChatList(); }

  $('chat-top-name').innerHTML = esc(contact?.displayName || name) + ' ' + renderBadgesBig(contact || {});
  $('chat-top-status').textContent = contact?.online ? 'в сети' : 'был(а) недавно';
  
  const av = $('chat-avatar');
  if (av) {
    if (contact?.avatar) { av.innerHTML = ''; av.style.backgroundImage = `url(${contact.avatar})`; }
    else { av.innerHTML = initials(contact?.displayName || name); av.style.background = 'var(--accent)'; }
  }
  
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
  setTimeout(() => api('mark read', { withUser: name }), 300);
  renderChatList();
}

function openGroupChat(g) {
  state.currentGroup = g; state.currentChat = null; state.currentChannel = null; state.isSavedChat = false;
  if (state.unread['g:' + g.id]) { delete state.unread['g:' + g.id]; jset(STORAGE.UNREAD, state.unread); renderChatList(); }
  $('chat-top-name').textContent = g.name;
  $('chat-top-status').textContent = `${g.memberCount} участников`;
  $('chat-avatar').innerHTML = '👥'; $('chat-avatar').style.background = 'linear-gradient(135deg, #0f5132, #2d9e6b)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load group history', { groupId: g.id });
}

function openSavedChat() {
  state.currentChat = null; state.currentGroup = null; state.currentChannel = null; state.isSavedChat = true;
  if (state.unread.__saved__) { delete state.unread.__saved__; jset(STORAGE.UNREAD, state.unread); renderChatList(); }
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые сообщения';
  $('chat-avatar').innerHTML = '⭐'; $('chat-avatar').style.background = 'var(--gold)';
  $('messages').innerHTML = ''; $('chat-screen').classList.add('active');
  api('load saved history');
}

function openChannelChat(ch) {
  state.currentChannel = ch; state.currentChat = null; state.currentGroup = null;
  $('channel-top-name').textContent = ch.name + (ch.verified ? ' ✓' : '');
  $('channel-top-status').textContent = `@${ch.slug} · ${ch.memberCount} подписчиков`;
  $('channel-screen').style.display = 'flex';
  api('load channel posts', { channelId: ch.id }, res => {
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = '';
    if (!res?.ok) return;
    res.posts.forEach(p => renderChannelPost(p));
  });
  $('channel-input-area').style.display = ch.creator === state.me.username ? 'flex' : 'none';
}

function closeChat() {
  $('chat-screen').classList.remove('active');
  state.currentChat = null; state.currentGroup = null; state.isSavedChat = false;
  if (state.isRecording) stopVoiceRecording(true);
  hideReactionMenu(); hideActionMenu(); cancelReply();
  renderChatList();
}

/* ─── 10. СООБЩЕНИЯ ─── */
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
  if (msg.isGroup) wrap.dataset.group = '1';
  const div = el('div', 'msg ' + (msg.self ? 'self' : 'other'));
  
  if (msg.text) div.appendChild(el('span', 'msg-text', esc(msg.text)));
  div.appendChild(el('span', 'meta', fmtT(msg.time)));
  
  wrap.appendChild(div); box.appendChild(wrap); box.scrollTop = box.scrollHeight;
}

function sendMsg() {
  const input = $('msgInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  
  if (state.isSavedChat) api('private message', { to: state.me.username, text });
  else if (state.currentChat) api('private message', { to: state.currentChat, text });
  else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, text });
  
  input.value = ''; cancelReply();
}

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
function showReactionMenu(e, messageId, wrap, isGroup) {
  state.activeReactionMsgId = messageId; state.activeReactionGroupId = isGroup && state.currentGroup ? state.currentGroup.id : null;
  const menu = $('reaction-menu'); if (!menu) return;
  const t = e.touches?.[0] || e;
  menu.classList.add('active');
  menu.style.left = Math.min(Math.max(t.clientX - 125, 10), window.innerWidth - 260) + 'px';
  menu.style.top = Math.max(t.clientY - 80, 10) + 'px';
}
function applyReaction(emoji) {
  if (state.activeReactionMsgId == null) return;
  if (state.activeReactionGroupId) api('group react', { groupId: state.activeReactionGroupId, messageId: state.activeReactionMsgId, emoji });
  else api('react', { messageId: state.activeReactionMsgId, emoji });
  hideReactionMenu();
}

/* ─── 11. СТИКЕРЫ ─── */
function toggleStickersPanel() {
  const p = $('stickers-panel'); if (!p) return;
  if (p.classList.contains('active')) p.classList.remove('active');
  else { p.classList.add('active'); api('load stickers', res => { if (res?.ok) { state.stickersData = res.stickers || []; renderStickersContent(); } }); }
}
function renderStickersContent() {
  const box = $('stickers-content'); if (!box) return;
  box.innerHTML = '';
  const grid = el('div', 'sticker-grid');
  state.stickersData.forEach(s => {
    const d = el('div', 'sticker-item');
    d.innerHTML = `<img src="${esc(s.url)}" alt="">`;
    d.onclick = () => { sendSticker(s.url, s.type); toggleStickersPanel(); };
    grid.appendChild(d);
  });
  box.appendChild(grid);
}
function sendSticker(url, type) {
  if (state.isSavedChat) api('send sticker', { url, type, to: state.me.username });
  else if (state.currentChat) api('send sticker', { url, type, to: state.currentChat });
  else if (state.currentGroup) api('send sticker', { url, type, groupId: state.currentGroup.id });
}

/* ─── 12. ГЕО ─── */
function sendGeo() {
  if (!navigator.geolocation) return toast('⚠️ Геолокация недоступна');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
    const payload = { lat, lng };
    if (state.currentChat) payload.to = state.currentChat;
    else if (state.currentGroup) payload.groupId = state.currentGroup.id;
    else return;
    api('send geo', payload, res => { if (res?.ok) toast('📍 Отправлено'); });
  });
}

/* ─── 13. ЖАЛОБЫ ─── */
function openReportModal(targetUser, messageId, isGroup) {
  state.reportTarget = targetUser || null; state.reportTargetMessageId = messageId || null; state.reportIsGroup = !!isGroup;
  const box = $('report-reasons'); if (box) {
    box.innerHTML = '';
    Object.entries(REPORT_REASONS).forEach(([key, label]) => {
      const b = el('button', 'report-reason-btn', label); b.dataset.reason = key;
      b.onclick = () => { document.querySelectorAll('.report-reason-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
      box.appendChild(b);
    });
  }
  $('report-comment').value = ''; $('report-error').textContent = ''; $('report-comment-wrap').style.display = 'none';
  hideActionMenu(); openModal('report-modal');
}
function submitReport() {
  const active = document.querySelector('.report-reason-btn.active'), err = $('report-error'); if (err) err.textContent = '';
  if (!active) { if (err) err.textContent = 'Выбери причину'; return; }
  api('report', { targetUser: state.reportTarget, targetMessageId: state.reportTargetMessageId, targetIsGroup: state.reportIsGroup, reason: active.dataset.reason, comment: $('report-comment').value.trim() || null }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('report-modal'); toast('🚨 Жалоба отправлена');
  });
}

/* ─── 14. МОДЕРАЦИЯ ─── */
function openModPanel() {
  if (!state.me.isModerator) return toast('⚠️ Только для модераторов');
  state.modPanelOpen = true; switchModTab('reports'); openModal('mod-panel-modal'); refreshModStats();
}
function switchModTab(tab) {
  state.modTab = tab;
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.mod-section').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
  if (tab === 'reports') loadModReports();
  else if (tab === 'punishments') loadModPunishments();
  else if (tab === 'logs') loadModLogs();
}
function refreshModStats() { api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; }); }
function loadModReports() { api('get reports', { status: state.modReportsFilter }, r => { if (r?.ok) { state.modReports = r.reports || []; renderModReports(); } }); }
function renderModReports() {
  const box = $('mod-reports-list'); if (!box) return;
  if (!state.modReports.length) { box.innerHTML = '<div class="mod-empty">Жалоб нет 🎉</div>'; return; }
  box.innerHTML = '';
  state.modReports.forEach(rep => {
    const card = el('div', 'mod-report-card');
    card.innerHTML = `<div class="mrc-head"><span class="mrc-status ${rep.status === 'new' ? 'new' : 'resolved'}">${rep.status === 'new' ? '🆕' : '✓'}</span><span class="mrc-reason">${esc(REPORT_REASONS[rep.reason] || rep.reason)}</span><span class="mrc-time">${ago(rep.time)}</span></div><div class="mrc-row"><b>От:</b> @${esc(rep.reporter)}</div><div class="mrc-row"><b>На:</b> @${esc(rep.target_user || '—')}</div>`;
    box.appendChild(card);
  });
}
function loadModPunishments() { api('get punishments', { active: true }, r => { if (r?.ok) { state.modPunishments = r.punishments || []; renderModPunishments(); } }); }
function renderModPunishments() {
  const box = $('mod-punishments-list'); if (!box) return;
  if (!state.modPunishments.length) { box.innerHTML = '<div class="mod-empty">Наказаний нет ✅</div>'; return; }
  box.innerHTML = '';
  state.modPunishments.forEach(p => {
    const card = el('div', 'mod-punish-card');
    card.innerHTML = `<div class="mpc-head"><span class="mpc-type">${PUNISH_LABELS[p.type] || p.type}</span><span class="mpc-dur">${esc(p.duration_text)}</span></div><div class="mpc-row"><b>@</b>${esc(p.username)}</div>`;
    box.appendChild(card);
  });
}
function loadModLogs() { api('get mod logs', { limit: 200 }, r => { if (r?.ok) { state.modLogs = r.logs || []; renderModLogs(); } }); }
function renderModLogs() {
  const box = $('mod-logs-list'); if (!box) return;
  if (!state.modLogs.length) { box.innerHTML = '<div class="mod-empty">Логов нет</div>'; return; }
  box.innerHTML = '';
  state.modLogs.forEach(log => {
    const row = el('div', 'mod-log-row');
    row.innerHTML = `<div class="mlr-head"><span class="mlr-action">${log.action}</span><span class="mlr-time">${fmtD(log.time)}</span></div><div class="mlr-row">Модератор: <b>@${esc(log.moderator)}</b></div>`;
    box.appendChild(row);
  });
}

/* ─── 15. ПОДАРКИ ─── */
function openGiftsCatalog(username) {
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
    if (affordable) d.onclick = () => openGiftMessageModal(key);
    grid.appendChild(d);
  });
  openModal('gifts-catalog-modal'); closeModal('contact-profile-modal');
}
function openGiftMessageModal(giftKey) {
  const gift = state.giftsCatalog[giftKey]; if (!gift) return;
  state.currentGiftKey = giftKey;
  $('gift-message-target').textContent = 'Кому: ' + state.currentGiftTarget;
  $('gift-message-preview').textContent = gift.emoji;
  $('gift-message-price').textContent = gift.price;
  $('gift-message-input').value = '';
  closeModal('gifts-catalog-modal'); openModal('gift-message-modal');
}
function confirmSendGift() {
  api('send gift', { to: state.currentGiftTarget, giftKey: state.currentGiftKey, message: $('gift-message-input').value.trim() || null }, res => {
    if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
    closeModal('gift-message-modal'); toast('🎁 Подарок отправлен!');
  });
}

/* ─── 16. ЗВОНКИ (WebRTC) ─── */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};
let iceCandidatesQueue = [], isRemoteDescSet = false;

async function startCall(video) {
  if (!state.currentChat || state.callActive) return;
  if (state.isBotChat) return toast('🤖 Ботам нельзя звонить');
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video }); } catch (err) { return alert('Нет доступа: ' + err.message); }
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
function toggleMic() { if (state.localStream) { const t = state.localStream.getAudioTracks()[0]; t.enabled = !t.enabled; $('micBtn').classList.toggle('off', !t.enabled); } }
function toggleCamera() { if (state.localStream) { const t = state.localStream.getVideoTracks()[0]; t.enabled = !t.enabled; $('camBtn').classList.toggle('off', !t.enabled); } }
/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v18.0 — Client (Part 3: Final Actions & Init)
   ═══════════════════════════════════════════════════════════ */

/* ─── 17. НЕДОСТАЮЩИЕ ФУНКЦИИ (Загрузки, истории, боты) ─── */
function pickAvatarMedia() { const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 200; const ctx = c.getContext('2d'); const m = Math.min(img.width, img.height); ctx.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, 200, 200); const dataUrl = c.toDataURL('image/jpeg', 0.8); api('remove avatar video', () => { state.me.avatarVideo = null; state.me.avatar = dataUrl; api('set avatar', { avatar: dataUrl }); updateMyAvatarBtn(); renderChatList(); toast('✓ Аватар обновлён'); closeModal('profile-modal'); }); }; img.src = ev.target.result; }; r.readAsDataURL(f); }; input.click(); }
function pickBannerMedia() { const input = el('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 1200; c.height = 400; const ctx = c.getContext('2d'); const sc = Math.max(1200/img.width, 400/img.height); ctx.drawImage(img, (1200-img.width*sc)/2, (400-img.height*sc)/2, img.width*sc, img.height*sc); const dataUrl = c.toDataURL('image/jpeg', 0.75); api('remove banner video', () => { state.me.bannerVideo = null; state.me.banner = dataUrl; api('set banner', { banner: dataUrl }, res => { if (res?.ok) { const p = $('profile-banner-preview'), im = $('profile-banner-img'); if (im) im.src = dataUrl; if (p) p.style.display = 'block'; toast('🎨 Баннер установлен'); } }); }); }; img.src = ev.target.result; }; r.readAsDataURL(f); }; input.click(); }
function removeMyBanner(ev) { ev?.stopPropagation(); if (!state.me.banner && !state.me.bannerVideo) return; if (!confirm('Убрать баннер?')) return; const p = $('profile-banner-preview'); if (p) p.classList.add('removing'); const done = () => { state.me.banner = null; state.me.bannerVideo = null; setTimeout(() => { if (p) { p.style.display = 'none'; p.classList.remove('removing'); } }, 400); toast('🎨 Баннер убран'); }; state.me.bannerVideo ? api('remove banner video', done) : api('remove banner', res => { if (res?.ok) done(); }); }

function sendPhoto(ev) { const file = ev.target.files[0]; if (!file) return; if (state.me.mute) { toast('🔇 Ты в муте'); ev.target.value = ''; return; } const r = new FileReader(); r.onload = e => { const img = new Image(); img.onload = () => { const max = 800; let w = img.width, h = img.height; if (w > h && w > max) { h = h * max / w; w = max; } else if (h > max) { w = w * max / h; h = max; } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); const dataUrl = c.toDataURL('image/jpeg', 0.75); if (state.isSavedChat) api('private message', { to: state.me.username, image: dataUrl }); else if (state.currentChat) api('private message', { to: state.currentChat, image: dataUrl }); else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, image: dataUrl }); ev.target.value = ''; cancelReply(); }; img.src = e.target.result; }; r.readAsDataURL(file); }

function openAchievements() { toast('🏆 Достижения'); }
function openStats() { toast('📊 Статистика'); }
function openMyGifts() { toast('🎁 Мои подарки'); }
function openGiftModal() { $('gift-code-input').value = ''; $('gift-error').textContent = ''; openModal('gift-modal'); }
function redeemGiftCode() { api('redeem gift code', { code: $('gift-code-input').value.trim() }, res => { if (!res?.ok) { $('gift-error').textContent = res?.error; return; } closeModal('gift-modal'); toast('⭐ Премиум активирован!'); renderSettings(); }); }
function openStarsHistory() { toast('⭐ История звёзд'); }
function openCreateBotModal() { $('bot-username').value = ''; $('bot-name').value = ''; $('bot-description').value = ''; $('bot-emoji').value = '🤖'; $('create-bot-error').textContent = ''; $('bot-commands-list').innerHTML = ''; $('bot-avatar-preview').style.display = 'none'; state.tempBotAvatar = null; addBotCommandRow('bot-commands-list'); openModal('create-bot-modal'); }
function addBotCommandRow(boxId) { const box = $(boxId); if (!box) return; const row = el('div', 'bot-command-row'); row.innerHTML = '<input class="bcc-trigger" placeholder="/start"><textarea class="bcc-response" placeholder="Ответ" rows="2"></textarea><button class="bcc-remove" type="button">×</button>'; row.querySelector('.bcc-remove').onclick = () => row.remove(); box.appendChild(row); }
function openMyBots() { $('my-bots-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>'; openModal('my-bots-modal'); }
function openFindBotModal() { $('find-bot-input').value = ''; $('find-bot-error').textContent = ''; openModal('find-bot-modal'); }
function openStoryAddModal() { $('story-file').value = ''; $('story-preview-wrap').style.display = 'none'; $('story-caption-input').value = ''; openModal('story-add-modal'); }
function renderStoriesBar() { const row = $('stories-row'); if (!row) return; row.innerHTML = ''; const mineBubble = el('div', 'story-bubble'); mineBubble.innerHTML = `<div class="story-ring mine"><div class="story-ring-inner">${initials(state.me.username || '?')}</div><div class="story-add-badge">+</div></div><div class="story-name">Моя</div>`; mineBubble.onclick = openStoryAddModal; row.appendChild(mineBubble); }
function applyChatWallpaper() { const box = $('messages'); if (!box) return; box.style.backgroundImage = ''; }
function openWallpaperPicker() { toast('🎨 Обои'); }
function removeChatWallpaper() { toast('🗑 Обои убраны'); }
function openSearchInChat() { openModal('search-modal'); }
function openGallery() { openModal('gallery-modal'); }
function openChatMenuV2() { openModal('chat-menu-modal'); }
function openClearHistoryConfirm() { openModal('clear-history-modal'); }
function confirmClearHistory() { if (!state.currentChat) return; api('clear history', { withUser: state.currentChat }, res => { if (res?.ok) { $('messages').innerHTML = ''; closeModal('clear-history-modal'); toast('История очищена'); } }); }
function openSessions() { toast('Сеансы'); }
function openBlockedList() { toast('Заблокированные'); }
function openMyQr() { showMyQr(); }
function openGiftAdminModal() { openModal('gift-admin-modal'); }
function loadGiftCodes() { $('gift-codes-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>'; }
function generateGiftCode() { api('generate gift code', res => { if (res?.ok) { alert('Код: ' + res.code); loadGiftCodes(); } else alert('Ошибка'); }); }
function openCreateGroupModal() { $('group-name').value = ''; openModal('create-group-modal'); }
function openCreateChannelModal() { $('channel-slug').value = ''; $('channel-name').value = ''; $('channel-desc').value = ''; openModal('create-channel-modal'); }
function openFindChannelModal() { openModal('find-channel-modal'); }
function openChannelInfo() { if (state.currentChannel) openModal('channel-info-modal'); }

/* ─── 18. КАРТА ДЕЙСТВИЙ (Обработчики кнопок) ─── */
const APP_ACTIONS = {
  'tab': (d) => {
    state.activeTab = d.value;
    qsa('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === d.value));
    qsa('.app-tab').forEach(t => t.classList.remove('active'));
    $('tab-' + d.value)?.classList.add('active');
    if (d.value === 'settings') renderSettingsTab();
    if (d.value === 'chats') renderChatList();
  },
  'open-settings': () => { $('settings-screen')?.classList.add('active'); renderSettings(); },
  'close-settings': () => $('settings-screen')?.classList.remove('active'),
  'open-profile': () => openProfile(),
  'save-profile': () => saveProfile(),
  'close-chat': () => closeChat(),
  'send-msg': () => sendMsg(),
  'cancel-reply': () => cancelReply(),
  'logout': () => logout(),
  'change-theme': () => changeTheme(),
  'open-color-picker': (d) => openColorPicker(d.target),
  'toggle-attach': () => $('attach-menu')?.classList.toggle('active'),
  'close-attach': () => $('attach-menu')?.classList.remove('active'),
  'attach-photo': () => { $('attach-menu').classList.remove('active'); $('photoFile').click(); },
  'attach-voice': () => { $('attach-menu').classList.remove('active'); toast('🎤 Запись...'); },
  'attach-geo': () => { $('attach-menu').classList.remove('active'); sendGeo(); },
  'attach-stickers': () => { $('attach-menu').classList.remove('active'); toggleStickersPanel(); },
  'attach-spoiler': () => { $('attach-menu').classList.remove('active'); state.spoilerMode = !state.spoilerMode; toast(state.spoilerMode ? '👁 Спойлер вкл' : '👁 Спойлер выкл'); },
  'open-search-chat': () => openSearchInChat(),
  'open-gallery': () => openGallery(),
  'open-chat-menu': () => openChatMenuV2(),
  'open-mod-panel': () => openModPanel(),
  'open-achievements': () => openAchievements(),
  'open-stats': () => openStats(),
  'open-my-bots': () => openMyBots(),
  'create-bot-open': () => openCreateBotModal(),
  'open-my-gifts': () => openMyGifts(),
  'open-gift-modal': () => openGiftModal(),
  'open-stars-history': () => openStarsHistory(),
  'create-group-open': () => openCreateGroupModal(),
  'create-channel-open': () => openCreateChannelModal(),
  'open-find-channel': () => openFindChannelModal(),
  'pick-avatar': () => pickAvatarMedia(),
  'pick-banner': () => pickBannerMedia(),
  'remove-banner': (d, el, e) => removeMyBanner(e),
  'toggle-password': (d) => togglePassword(d.target),
  'switch-auth': (d) => switchAuthScreen(d.mode),
  'reg-next': (d) => regNext(+d.step),
  'reg-back': () => regBack(),
  'login': () => doLogin(),
  'register': () => doRegister(),
  'open-modal': (d) => openModal(d.target),
  'close-modal': (d) => closeModal(d.target),
  'reload': () => location.reload(),
  'call-audio': () => startCall(false),
  'call-video': () => startCall(true),
  'accept-call': () => acceptIncoming(),
  'decline-call': () => { $('incoming-screen').classList.remove('active'); if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom }); },
  'hangup': () => { if (state.currentChat) socket.emit('end-call', { to: state.currentChat }); cleanupCall(); },
  'toggle-mic': () => toggleMic(),
  'toggle-camera': () => toggleCamera(),
  'open-stars-history': () => openStarsHistory(),
};

/* ─── 19. SOCKET LISTENERS (Все входящие события) ─── */
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

socket.on('group history', data => {
  if (state.currentGroup?.id !== data.groupId) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = ''; state.lastDateShown = '';
  data.messages.forEach(m => renderMessage({ id: m.id, from: m.from_user, text: m.text, time: m.time, self: m.from_user === state.me.username, isGroup: true }));
  box.scrollTop = box.scrollHeight;
});

socket.on('private message', data => {
  if (data.from === state.currentChat && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false });
  } else if (!data.self) {
    state.unread[data.from] = (state.unread[data.from] || 0) + 1;
    jset(STORAGE.UNREAD, state.unread); renderChatList();
  }
});

socket.on('group message', data => {
  if (state.currentGroup?.id === data.groupId && !data.self) {
    renderMessage({ id: data.id, from: data.from, text: data.text, time: data.time, self: false, isGroup: true });
  } else if (!data.self) {
    state.unread['g:' + data.groupId] = (state.unread['g:' + data.groupId] || 0) + 1;
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
socket.on('call-failed', data => { alert('Звонок не удался: ' + (data.reason || 'Ошибка')); cleanupCall(); });
socket.on('message blocked', d => toast(d.reason));

/* ─── 20. ГЛОБАЛЬНЫЙ ЗАПУСК ─── */
window.addEventListener('DOMContentLoaded', () => {
  registerActions(APP_ACTIONS);

  const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
  const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
  const uc = jget(STORAGE.UNREAD); if (uc) state.unread = uc;

  api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });

  const creds = jget(STORAGE.SESSION);
  if (creds?.sessionId) {
    tryAutoLogin().then(ok => {
      if (!ok) { hideSplash(); $('auth').classList.add('active'); }
    });
  } else {
    hideSplash(); $('auth').classList.add('active');
  }
});

console.log('%c✅ Azerta v18.0 — Готова к работе!', 'color:#4ade80;font-weight:bold;font-size:14px');