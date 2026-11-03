'use strict';

/* ═══════════════════════════════════════════════════════════
   AZERTA v13.7 — Client (rewritten & fixed)
   ═══════════════════════════════════════════════════════════ */

/* ─── 1. УТИЛИТЫ ─── */
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const now = () => Date.now();
const fmtT = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
const fmtD = ms => new Date(ms).toLocaleString('ru-RU');
const initials = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 && p[0] && p[1] ? (p[0][0]+p[1][0]).toUpperCase() : String(n || '?').slice(0,2).toUpperCase(); };
const ago = ms => { const m = Math.floor((now()-ms)/6e4); return m<1?'только что':m<60?m+' мин назад':m<1440?Math.floor(m/60)+' ч назад':Math.floor(m/1440)+' дн назад'; };
const dur = exp => { if (!exp) return 'навсегда'; const m = Math.floor((exp-now())/6e4); if (m<=0) return 'истёк'; const h=Math.floor(m/60), d=Math.floor(h/24); return d?`${d} д ${h%24} ч`:h?`${h} ч ${m%60} мин`:`${m} мин`; };
const jset = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const jget = (k,f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const vib = ms => { if (state.settings.vibration == 0) return; try { navigator.vibrate?.(ms || [10,20,10]); } catch {} };
const api = (ev, payload, cb) => socket.emit(ev, payload, typeof cb === 'function' ? cb : () => {});
const toast = (() => {
  let t, timer;
  return text => {
    if (!t) { t = el('div'); t.id = 'aurora-toast'; document.body.appendChild(t); }
    t.textContent = text;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(timer);
    timer = setTimeout(() => t.classList.remove('show'), 3000);
  };
})();

function openModal(id) { $(id)?.classList.add('active'); }
function closeModal(id) { $(id)?.classList.remove('active'); }
function renderBadges(u) {
  if (!u) return '';
  let h = '';
  if (u.premium)  h += '<span class="premium-badge" title="Premium">⭐</span>';
  if (u.verified) h += '<span class="verified-badge" title="Verified">✓</span>';
  if (u.hammer)   h += '<span class="hammer-badge" title="Mod">🔨</span>';
  if (u.scam)     h += '<span class="scam-badge" title="Scam">SCAM</span>';
  return h;
}
function renderBadgesBig(u) { return renderBadges(u).replace(/class="(\w+-badge)"/g, 'class="$1 big"'); }
function displayName(u) {
  if (u === state.me.username) return 'Я';
  const c = state.contacts.find(x => x.name === u);
  return c?.displayName || u;
}

/* ─── 2. СОСТОЯНИЕ ─── */
const state = {
  me: { username: null, avatar: null, banner: null, avatarVideo: null, bannerVideo: null,
        premium: false, verified: false, hammer: false, scam: false,
        bio: '', firstName: '', lastName: '', birthday: '', emoji: '',
        stars: 0, sessionId: null, isModerator: false, mute: null },
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
  screenStream: null, screenTrack: null, isScreenSharing: false,
  mediaRecorder: null, audioChunks: [], isRecording: false, cancelledRecording: false,
  recordingStartTime: 0, recordingTimer: null, currentAudioMime: '',
  circleStream: null, circleRecorder: null, circleChunks: [], circleTimer: null, circleStartTime: 0, circleMime: '',
  lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  galleryWaiting: false, notificationsAllowed: false, reconnectAttempts: 0,
  titleFlashInterval: null, myTypingTimeout: null,
  createSelected: new Set(), addMembersSelected: new Set(),
  toastTimeout: null, isLoggedIn: false, chatWallpapers: {},
  contactProfileCurrent: null, editingBotUsername: null, tempBotAvatar: null,
  modPanelOpen: false, modTab: 'reports', modReportsFilter: 'new',
  modReports: [], modPunishments: [], modLogs: [], modStats: {},
  reportTarget: null, reportTargetMessageId: null, reportIsGroup: false,
  spoilerMode: false,
  botControlCurrent: null, botControlTab: 'chats', botChatCurrent: null,
  botVoiceMode: 'bot', botReplyTo: null,
};

const STORAGE = {
  SESSION:'aurora-session', UNREAD:'aurora-unread', CONTACTS:'aurora-contacts-cache',
  GROUPS:'aurora-groups-cache', STICKERS:'aurora-recent-stickers',
  SETTINGS:'aurora-settings-cache', WALLPAPERS:'aurora-wallpapers',
};
const STORY_DURATION = 5000, SWIPE_THRESHOLD = 60, MAX_RECORDING_SEC = 60, MAX_CIRCLE_SEC = 30;

const BUILTIN_GIFS = [
  ['😀','https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'],
  ['😍','https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif'],
  ['😂','https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif'],
  ['😎','https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif'],
  ['👍','https://media.giphy.com/media/111ebonMs90YLu/giphy.gif'],
  ['❤️','https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif'],
  ['🔥','https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif'],
  ['🎉','https://media.giphy.com/media/g9582DNuQppxC/giphy.gif'],
  ['🤔','https://media.giphy.com/media/3o7aCSPqXE5C6T8tBC/giphy.gif'],
  ['😢','https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif'],
  ['🙈','https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif'],
  ['🚀','https://media.giphy.com/media/3o7TKu8av7E0e1dFS0/giphy.gif'],
  ['🐱','https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif'],
  ['🐶','https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif'],
  ['🍕','https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif'],
  ['👏','https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif'],
].map(([emoji, url]) => ({ emoji, url }));

const REPORT_REASONS = { spam:'🚫 Спам', abuse:'🤬 Оскорбления', nsfw:'🔞 18+', scam:'💀 Мошенничество', ads:'📢 Реклама', other:'❓ Другое' };
const PUNISH_LABELS = { ban:'🚫 Бан', mute:'🔇 Мут', warn:'⚠️ Предупреждение' };

/* ─── 3. SOCKET ─── */
const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity });

/* ─── 4. RIPPLE ─── */
function attachRipple(e) {
  if (!e || e.dataset.ripple) return;
  e.dataset.ripple = '1';
  e.classList.add('ripple-container');
  e.addEventListener('pointerdown', ev => {
    const r = e.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const x = ev.clientX - r.left - s/2, y = ev.clientY - r.top - s/2;
    const d = el('span', 'ripple');
    Object.assign(d.style, { width: s+'px', height: s+'px', left: x+'px', top: y+'px' });
    e.appendChild(d);
    setTimeout(() => d.remove(), 700);
  });
}
function bindRipples(root) {
  const sel = '.auth-btn-primary,.modal-primary,.modal-secondary,.modal-danger,.create-menu-btn,.nav-btn,.settings-item,.settings-tg-row,.chat-item,.back-btn,.icon-btn,#burger,#send-btn,.attach,.mic,.camera,.reaction-chip,.action-item,.my-bot-card,.bch-chip,.mod-tab,.report-reason-btn,.punish-duration-btn';
  (root || document).querySelectorAll(sel).forEach(attachRipple);
}

/* ─── 5. МОДАЛКИ / TOASTS ─── */
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));

/* ─── 6. АВТОРИЗАЦИЯ ─── */
let autoLoginDone = false, isLoggedInOnServer = false;

function showBanScreen(ban) {
  let s = $('ban-screen') || (() => { const d = el('div'); d.id = 'ban-screen'; document.body.appendChild(d); return d; })();
  const until = ban.expires_at ? new Date(ban.expires_at).toLocaleString('ru-RU') : 'никогда';
  s.innerHTML = `<div class="ban-screen-inner">
    <div class="ban-emoji">🚫</div><h2>Ты забанен</h2>
    <div class="ban-reason"><div class="ban-label">Причина:</div><div class="ban-value">${esc(ban.reason || 'Не указана')}</div></div>
    <div class="ban-until"><div class="ban-label">До:</div><div class="ban-value">${esc(until)}</div>
      <div class="ban-sub">(${esc(ban.duration_text || 'навсегда')})</div></div>
    <button class="modal-secondary" onclick="location.reload()">🔄 Проверить снова</button></div>`;
  s.classList.add('active');
}

function applyMuteLock() {
  if (!state.isLoggedIn) return;
  const mute = state.me.mute;
  const input = $('msgInput'), send = $('send-btn'), attach = $('attachBtn');
  if (!mute) {
    if (input) { input.disabled = false; input.placeholder = 'Сообщение...'; }
    if (send) send.disabled = false;
    if (attach) attach.disabled = false;
    $('mute-banner')?.remove();
    return;
  }
  const until = mute.expires_at ? new Date(mute.expires_at).toLocaleString('ru-RU') : '';
  if (input) { input.disabled = true; input.placeholder = '🔇 Ты в муте'; }
  if (send) send.disabled = true;
  if (attach) attach.disabled = true;
  let b = $('mute-banner');
  if (!b) { b = el('div'); b.id = 'mute-banner'; $('input-area')?.parentNode?.insertBefore(b, $('input-area')); }
  b.innerHTML = '🔇 Ты в муте' + (mute.reason ? ' · ' + esc(mute.reason) : '') + (until ? ' · до ' + esc(until) : '');
}

function hideSplash() {
  const sp = $('splash-screen');
  if (sp && !sp.classList.contains('hide')) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 500); }
}
setTimeout(hideSplash, 2000);
setTimeout(hideSplash, 3000);

function playLoginTransition(username, firstName, auto) {
  state.isLoggedIn = true; isLoggedInOnServer = true;
  const auth = $('auth'), app = $('app'), flash = $('welcome-flash'), wt = $('welcome-toast');
  hideSplash();
  $('passcode-screen')?.classList.remove('active');
  if (auth?.classList.contains('active')) {
    auth.classList.add('auth-exit');
    setTimeout(() => { auth.classList.remove('active','auth-exit'); }, 450);
  } else auth?.classList.remove('active');
  if (app) {
    app.classList.add('active','app-enter');
    void app.offsetWidth;
    setTimeout(() => app.classList.remove('app-enter'), 700);
  }
  if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 1000); }
  if (!auto && wt) {
    const emoji = ['👋','🌌','✨','🚀','💫'][Math.floor(Math.random()*5)];
    wt.querySelector('.wt-emoji').textContent = emoji;
    wt.querySelector('.wt-name').textContent = 'Привет, ' + ((firstName && firstName.trim()) || username || 'друг') + '!';
    wt.querySelector('.wt-sub').textContent = 'С возвращением в Azerta';
    wt.classList.add('active');
    setTimeout(() => wt.classList.remove('active'), 2200);
  }
  setTimeout(() => {
    updateMyAvatarBtn(); updateVerifyButton(); updateVerifyChannelButton();
    loadStories(); renderChatList(); renderStoriesBar();
    applyChatWallpaper(); bindRipples(); applyMuteLock();
  }, 200);
}

function forceShowAuth(msg) {
  isLoggedInOnServer = false; state.isLoggedIn = false;
  state.me.username = null; state.me.sessionId = null;
  $('app')?.classList.remove('active');
  $('chat-screen')?.classList.remove('active');
  const a = $('auth'); if (a) { a.classList.remove('auth-exit'); a.classList.add('active'); }
  $('passcode-screen')?.classList.remove('active');
  hideSplash();
  toast('⚠️ ' + (msg || 'Войди заново'));
}

function onLoggedIn(res, auto) {
  Object.assign(state.me, {
    username: res.username, avatar: res.avatar || null, banner: res.banner || null,
    avatarVideo: res.avatarVideo || null, bannerVideo: res.bannerVideo || null,
    premium: !!res.premium, verified: !!res.verified, hammer: !!res.hammer, scam: !!res.scam,
    bio: res.bio || '', firstName: res.firstName || '', lastName: res.lastName || '',
    birthday: res.birthday || '', emoji: res.emojiStatus || '', sessionId: res.sessionId,
    stars: Number(res.stars || 0), isModerator: !!res.is_moderator, mute: res.mute || null,
  });
  state.chatWallpapers = jget(STORAGE.WALLPAPERS, {});
  playLoginTransition(res.username, res.firstName, !!auto);
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
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка регистрации'; vib([30,20,30]); return; }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
    toast('🎉 Добро пожаловать! +' + res.bonus + ' ⭐'); vib([50,30,50]);
  });
}

function doLogin() {
  const username = $('login-username')?.value || '';
  const password = $('login-password')?.value || '';
  const err = $('login-error'); if (err) err.textContent = '';
  if (!username || !password) { if (err) err.textContent = 'Заполни все поля'; vib([30,20,30]); return; }
  showBtnSpinner('login-btn', 'Вхожу…');
  const existing = jget(STORAGE.SESSION);
  api('login', { username: username.trim().toLowerCase(), password, device: (navigator.userAgent||'').slice(0,40), sessionId: existing?.sessionId || null }, res => {
    hideBtnSpinner('login-btn', 'Войти');
    if (!res?.ok) {
      if (res?.banned) { showBanScreen(res.ban); return; }
      if (err) err.textContent = res?.error || 'Ошибка входа'; vib([30,20,30]); return;
    }
    jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
  });
}

async function tryAutoLogin() {
  const creds = jget(STORAGE.SESSION);
  if (!creds?.sessionId) return false;
  return new Promise(resolve => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(false); } }, 8000);
    api('login with session', { sessionId: creds.sessionId }, res => {
      if (done) return; done = true; clearTimeout(t);
      if (!res?.ok) {
        if (res?.banned) { showBanScreen(res.ban); resolve(true); return; }
        localStorage.removeItem(STORAGE.SESSION);
        forceShowAuth('Сессия истекла — войди заново');
        resolve(false); return;
      }
      jset(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
      Object.assign(state.me, {
        username: res.username, avatar: res.avatar || null, banner: res.banner || null,
        avatarVideo: res.avatarVideo || null, bannerVideo: res.bannerVideo || null,
        premium: !!res.premium, verified: !!res.verified, hammer: !!res.hammer, scam: !!res.scam,
        bio: res.bio || '', firstName: res.firstName || '', lastName: res.lastName || '',
        birthday: res.birthday || '', emoji: res.emojiStatus || '', sessionId: res.sessionId,
        stars: Number(res.stars || 0), isModerator: !!res.is_moderator, mute: res.mute || null,
      });
      state.chatWallpapers = jget(STORAGE.WALLPAPERS, {});
      api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
      api('has passcode', has => {
        if (has) $('passcode-screen')?.classList.add('active');
        else playLoginTransition(res.username, res.firstName, true);
      });
      resolve(true);
    });
  });
}

/* ─── 7. SPINNER ─── */
function showBtnSpinner(id, text) {
  const b = $(id); if (!b) return;
  const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner');
  if (t && text) t.textContent = text;
  if (s) s.style.display = 'inline-flex';
  b.disabled = true;
}
function hideBtnSpinner(id, text) {
  const b = $(id); if (!b) return;
  const t = b.querySelector('.btn-text'), s = b.querySelector('.btn-spinner');
  if (t && text) t.textContent = text;
  if (s) s.style.display = 'none';
  b.disabled = false;
}

/* ─── 8. РЕГИСТРАЦИЯ UI ─── */
function switchAuthScreen(s) {
  document.querySelectorAll('.auth-screen').forEach(x => x.classList.remove('active'));
  $(s === 'login' ? 'auth-login-screen' : 'auth-register-screen')?.classList.add('active');
  if (s === 'register') { state.regStep = 1; regShowStep(1); }
  vib(10);
}
function regShowStep(step) {
  state.regStep = step;
  document.querySelectorAll('.reg-progress-seg').forEach(seg => {
    const s = +seg.dataset.step;
    seg.classList.toggle('active', s === step); seg.classList.toggle('done', s < step);
  });
  $('reg-back-btn')?.classList.toggle('show', step > 1);
  document.querySelectorAll('.reg-step-card').forEach(c => c.classList.toggle('active', +c.dataset.step === step));
  setTimeout(() => $('reg-username')?.focus(), 200);
  vib(10);
}
function regNext(step) {
  if (step === 1) { if (state.regUsernameAvailable) regShowStep(2); }
  else if (step === 2) {
    if (!($('reg-displayname')?.value || '').trim()) { $('reg-error-2').textContent = 'Введи имя'; return; }
    $('reg-error-2').textContent = ''; regShowStep(3);
  }
}
function regBack() { if (state.regStep > 1) regShowStep(state.regStep - 1); vib(10); }

function onRegUsernameInput() {
  const input = $('reg-username'), wrap = $('reg-username-wrap'), status = $('reg-username-status'),
        hint = $('reg-username-hint'), next = $('reg-next-1');
  if (!input) return;
  const v = input.value.trim().toLowerCase(); input.value = v;
  wrap.classList.remove('error','success'); status.textContent = ''; hint.classList.remove('error','success');
  next.disabled = true; state.regUsernameAvailable = false;
  if (v.length < 3) { hint.textContent = 'Минимум 3 символа'; hint.classList.add('error'); return; }
  if (v.length > 20) { hint.textContent = 'Максимум 20 символов'; hint.classList.add('error'); return; }
  if (!/^[a-z0-9_]+$/.test(v)) { hint.textContent = 'Только латиница, цифры и _'; hint.classList.add('error'); wrap.classList.add('error'); return; }
  hint.textContent = 'Проверяю...'; status.textContent = '⏳';
  clearTimeout(state.regUsernameCheckTimer);
  state.regUsernameCheckTimer = setTimeout(() => {
    api('check username', { username: v }, res => {
      if (!res?.ok) { hint.textContent = 'Ошибка проверки'; hint.classList.add('error'); return; }
      if (res.available) {
        wrap.classList.add('success'); status.textContent = '✅';
        hint.textContent = 'Свободен!'; hint.classList.add('success');
        next.disabled = false; state.regUsernameAvailable = true; vib(15);
      } else {
        wrap.classList.add('error'); status.textContent = '❌';
        hint.textContent = { taken:'Этот ник занят', short:'Слишком короткий', long:'Слишком длинный', chars:'Только латиница, цифры и _', empty:'Введи ник' }[res.reason] || 'Недоступен';
        hint.classList.add('error'); next.disabled = true; vib([30,20,30]);
      }
    });
  }, 350);
}
function onRegPasswordInput() {
  const p = $('reg-password')?.value || '';
  const bar = $('reg-strength-bar'), label = $('reg-strength-label');
  if (!bar || !label) return;
  bar.classList.remove('weak','medium','strong');
  if (!p) { label.textContent = 'Введи пароль'; label.style.color = ''; bar.style.width = '0'; onRegPassword2Input(); return; }
  let score = 0;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  if (p.length < 8) { bar.classList.add('weak'); label.textContent = 'Слишком короткий (мин. 8)'; label.style.color = '#f87171'; }
  else if (score <= 2) { bar.classList.add('weak'); label.textContent = 'Слабый'; label.style.color = '#f87171'; }
  else if (score === 3) { bar.classList.add('medium'); label.textContent = 'Средний'; label.style.color = '#fbbf24'; }
  else { bar.classList.add('strong'); label.textContent = 'Сильный 💪'; label.style.color = '#4ade80'; }
  onRegPassword2Input();
}
function onRegPassword2Input() {
  const p = $('reg-password')?.value || '', p2 = $('reg-password2')?.value || '';
  const hint = $('reg-password2-hint'); if (!hint) return;
  if (!p2) { hint.textContent = ''; hint.classList.remove('success','error'); }
  else if (p === p2) { hint.textContent = '✓ Совпадают'; hint.classList.add('success'); hint.classList.remove('error'); }
  else { hint.textContent = 'Пароли не совпадают'; hint.classList.add('error'); hint.classList.remove('success'); }
  updateRegSubmit();
}
function updateRegSubmit() {
  const btn = $('reg-submit'); if (!btn) return;
  const p = $('reg-password')?.value || '', p2 = $('reg-password2')?.value || '', dn = ($('reg-displayname')?.value || '').trim();
  btn.disabled = !(p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p) && p === p2 && dn && state.regUsernameAvailable);
}
function togglePassword(id) {
  const input = $(id); if (!input) return;
  const btn = input.parentElement.querySelector('.auth-toggle-password');
  if (input.type === 'password') { input.type = 'text'; if (btn) btn.textContent = '🙈'; }
  else { input.type = 'password'; if (btn) btn.textContent = '👁'; }
  vib(10);
}
function tryPasscode() {
  const v = $('passcode-input')?.value || '', err = $('passcode-error');
  if (err) err.textContent = '';
  api('check passcode', { passcode: v }, res => {
    if (!res?.ok) { if (err) err.textContent = 'Неверный код'; vib([30,20,30]); return; }
    $('passcode-screen')?.classList.remove('active');
    playLoginTransition(state.me.username, state.me.firstName, true);
  });
}

/* ─── 9. НАСТРОЙКИ / ТЕМА / УВЕДОМЛЕНИЯ ─── */
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
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
function browserNotif(from, text) {
  if (!state.notificationsAllowed) return;
  try { const n = new Notification(from, { body: text }); n.onclick = () => { window.focus(); n.close(); }; } catch {}
}
function updateTitle() {
  const total = Object.values(state.unread).reduce((a,b) => a+b, 0);
  clearInterval(state.titleFlashInterval);
  if (total > 0) {
    let on = true;
    state.titleFlashInterval = setInterval(() => { document.title = on ? `(${total}) Azerta` : 'Azerta'; on = !on; }, 1000);
  } else document.title = 'Azerta';
  const nb = $('nav-badge-chats');
  if (nb) { if (total > 0 && state.activeTab !== 'chats') { nb.textContent = total > 99 ? '99+' : total; nb.style.display = 'block'; } else nb.style.display = 'none'; }
}
function applyLocalSettings() {
  const s = state.settings;
  document.body.classList.toggle('light', s.theme === 'light');
  document.body.classList.toggle('no-anim', s.animations == 0);
  document.documentElement.style.setProperty('--font-size', { small:'13px', medium:'15px', large:'17px' }[s.font_size] || '15px');
  if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);
}

/* ─── 10. ВКЛАДКИ ─── */
const TAB_TITLES = { chats:'Azerta', calls:'Звонки', contacts:'Контакты', settings:'Настройки' };
function switchTab(tab) {
  state.activeTab = tab;
  const app = $('app'); if (!app) return;
  app.dataset.tab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const h = document.querySelector('#main-header h2'); if (h) h.textContent = TAB_TITLES[tab] || 'Azerta';
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'chats') { $('search-wrap').style.display = ''; renderChatList(); renderStoriesBar(); }
  else {
    $('tab-' + tab)?.classList.add('active');
    $('search-wrap').style.display = 'none';
    if (tab === 'contacts') renderContactsTab();
    else if (tab === 'settings') renderSettingsTab();
  }
  if (tab === 'chats') $('nav-badge-chats').style.display = 'none';
}

/* ─── 11. НАСТРОЙКИ ─── */
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

const visibilityLabel = v => ({ everyone:'Все', contacts:'Контакты', nobody:'Никто' }[v] || 'Все');

function renderSettings() {
  const box = $('settings-content'); if (!box) return;
  const me = state.me, s = state.settings, isAdmin = me.username === 'moroz', isPremium = !!me.premium;
  const display = (me.firstName || me.lastName) ? `${me.firstName} ${me.lastName || ''}`.trim() : '@' + me.username;
  const emoji = me.emoji ? ' ' + me.emoji : '';
  const bannerStyle = me.bannerVideo ? '' : me.banner ? `background-image:url(${me.banner})` : '';
  const bannerMedia = me.bannerVideo
    ? `<video class="tg-banner" autoplay loop muted playsinline style="object-fit:cover;width:100%;height:100%"><source src="${me.bannerVideo}"></video>`
    : `<div class="tg-banner" style="${bannerStyle}"></div>`;
  const avStyle = me.avatarVideo ? '' : me.avatar ? `background-image:url(${me.avatar})` : '';
  const avContent = me.avatarVideo
    ? `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${me.avatarVideo}"></video>`
    : me.avatar ? '' : initials(me.username);

  const pending = state.modStats.new_reports || 0;
  const modSection = me.isModerator ? `<div class="settings-tg-section"><div class="settings-tg-section-title">🛡️ Модерация</div><div class="settings-tg-group">${renderTgRow({ icon:'🚨', text:'Панель модератора', value: pending > 0 ? pending + ' новых' : '', onClick:'openModPanel()' })}</div></div>` : '';

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
    <div class="settings-stars-row" onclick="openStarsHistory()">
      <span class="stars-icon">⭐</span>
      <div class="stars-info"><div class="stars-count">${me.stars}${isAdmin ? '∞' : ''}</div><div class="stars-label">звёзды · нажми для истории</div></div>
      <span class="stars-arrow">›</span>
    </div>
    ${modSection}
    <div class="settings-tg-section"><div class="settings-tg-section-title">🤖 Боты</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🤖', text:'Мои боты', value:`${state.myBots.length}/3`, onClick:'openMyBots()' })}
        ${renderTgRow({ icon:'➕', text:'Создать бота', onClick:'openCreateBotModal()' })}
        ${renderTgRow({ icon:'🔍', text:'Найти бота', onClick:'openFindBotModal()' })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">📈 Прогресс</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🏆', text:'Достижения', onClick:'openAchievements()' })}
        ${renderTgRow({ icon:'📊', text:'Статистика', onClick:'openStats()' })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎁 Подарки</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🎁', text:'Мои подарки', onClick:'openMyGifts()' })}
        ${renderTgRow({ icon:'💳', text:'Активировать премиум по коду', onClick:'openGiftModal()' })}
        ${isAdmin ? renderTgRow({ icon:'🔑', text:'Управление кодами', onClick:'openGiftAdminModal()' }) : ''}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🔔 Уведомления и звуки</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🔔', text:'Звук', type:'switch', checked:s.sound == 1, onToggle:"toggleSetting('sound')", onClick:"toggleSetting('sound')" })}
        ${renderTgRow({ icon:'📳', text:'Вибрация', type:'switch', checked:s.vibration == 1, onToggle:"toggleSetting('vibration')", onClick:"toggleSetting('vibration')" })}
        ${renderTgRow({ icon:'💬', text:'Личные чаты', type:'switch', checked:s.notif_private == 1, onToggle:"toggleSetting('notif_private')", onClick:"toggleSetting('notif_private')" })}
        ${renderTgRow({ icon:'👥', text:'Группы', type:'switch', checked:s.notif_groups == 1, onToggle:"toggleSetting('notif_groups')", onClick:"toggleSetting('notif_groups')" })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🔒 Конфиденциальность</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🔐', text:'Код-пароль', value:s.passcode ? 'Включён' : 'Выключен', onClick:'openPasscodeModal()' })}
        ${renderTgRow({ icon:'👁', text:'Последнее посещение', value:visibilityLabel(s.last_seen_visibility), onClick:'changeLastSeen()' })}
        ${renderTgRow({ icon:'📍', text:'Кто видит геолокацию', value:visibilityLabel(s.geo_visibility || 'contacts'), onClick:'changeGeoVisibility()' })}
        ${renderTgRow({ icon:'🚫', text:'Заблокированные', value:state.blockedList.length, onClick:'openBlockedList()' })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">📱 Устройства</div>
      <div class="settings-tg-group">${renderTgRow({ icon:'📱', text:'Активные сеансы', onClick:'openSessions()' })}</div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">💾 Данные и память</div>
      <div class="settings-tg-group">
        <div class="settings-tg-row" onclick="showCacheSize()"><span class="tg-row-icon">💾</span><span class="tg-row-text">Размер кэша</span><span class="tg-row-value" id="cache-size">…</span></div>
        ${renderTgRow({ icon:'🧹', text:'Очистить кэш', onClick:'clearCache()' })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-section-title">🎨 Оформление</div>
      <div class="settings-tg-group">
        ${renderTgRow({ icon:'🎨', text:'Тема', value:s.theme === 'light' ? 'Светлая' : 'Тёмная', onClick:'changeTheme()' })}
        ${renderTgRow({ icon:'📏', text:'Размер текста', value:{ small:'Маленький', medium:'Средний', large:'Большой' }[s.font_size] || 'Средний', onClick:'changeFontSize()' })}
        ${renderTgRow({ icon:'🎯', text:'Акцентный цвет', type:'color', color:s.accent_color || '#8b7fff', onClick:"openColorPicker('accent_color')" })}
        ${renderTgRow({ icon:'⚡', text:'Отключить анимации', type:'switch', checked:s.animations == 0, onToggle:"toggleSetting('animations')", onClick:"toggleSetting('animations')" })}
      </div>
    </div>
    <div class="settings-tg-section"><div class="settings-tg-group">${renderTgRow({ icon:'📱', text:'Мой QR-код', onClick:'showMyQr()' })}</div></div>
    <div class="settings-tg-section"><div class="settings-tg-group">
      ${renderTgRow({ icon:'🚪', text:'Выйти', type:'danger', onClick:'logout()' })}
      ${renderTgRow({ icon:'🗑', text:'Удалить аккаунт', type:'danger', onClick:"openModal('delete-account-modal')" })}
    </div></div>
    <div style="padding:30px 20px 10px;text-align:center;color:var(--text-muted);font-size:12px;">🌌 Azerta v13.7<br><br>Сделано с ❤️</div>`;
  box.innerHTML = html;
  setTimeout(showCacheSize, 100);
  bindRipples(box);
  if (me.isModerator) api('mod panel stats', r => { if (r?.ok) state.modStats = r.stats || {}; });
}
function renderSettingsTab() {
  const box = $('tab-settings-content'), orig = $('settings-content');
  if (!box || !orig) return;
  renderSettings(); box.innerHTML = orig.innerHTML; bindRipples(box);
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
  api('update settings', { key:'theme', value:v }, () => { state.settings.theme = v; applyLocalSettings(); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function changeFontSize() {
  const order = ['small','medium','large'], v = order[(order.indexOf(state.settings.font_size || 'medium') + 1) % order.length];
  api('update settings', { key:'font_size', value:v }, () => { state.settings.font_size = v; applyLocalSettings(); renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function changeLastSeen() {
  const opts = ['everyone','contacts','nobody'], v = opts[(opts.indexOf(state.settings.last_seen_visibility || 'everyone') + 1) % opts.length];
  api('set last seen visibility', { value: v }, () => { state.settings.last_seen_visibility = v; renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function changeGeoVisibility() {
  const opts = ['everyone','contacts','nobody'], v = opts[(opts.indexOf(state.settings.geo_visibility || 'contacts') + 1) % opts.length];
  api('update settings', { key:'geo_visibility', value:v }, () => { state.settings.geo_visibility = v; renderSettings(); if (state.activeTab === 'settings') renderSettingsTab(); });
}
function openColorPicker(target) {
  state.currentColorTarget = target;
  const grid = $('color-grid'); if (!grid) return;
  const colors = ['#8b7fff','#ec4899','#6d5eff','#fbbf24','#22c55e','#06b6d4','#ef4444','#f97316','#a78bfa','#14b8a6','#f43f5e','#3b82f6'];
  grid.innerHTML = '';
  colors.forEach(c => {
    const d = el('div', 'color-dot'); d.style.background = c;
    if (state.settings[target] === c) d.classList.add('active');
    d.onclick = () => api('update settings', { key: target, value: c }, () => {
      state.settings[target] = c; applyLocalSettings(); closeModal('color-modal'); renderSettings();
      if (state.activeTab === 'settings') renderSettingsTab();
    });
    grid.appendChild(d);
  });
  $('color-modal-title').textContent = 'Акцентный цвет';
  openModal('color-modal');
}
function showCacheSize() {
  const e = $('cache-size'); if (!e) return;
  let size = 0;
  try { for (const k in localStorage) if (Object.prototype.hasOwnProperty.call(localStorage, k)) size += (localStorage[k].length + k.length) * 2; } catch {}
  e.textContent = (size/1024).toFixed(1) + ' КБ';
}
function clearCache() {
  if (!confirm('Очистить кэш?')) return;
  const keep = ['SESSION','UNREAD','WALLPAPERS'].map(k => [STORAGE[k], localStorage.getItem(STORAGE[k])]).filter(([,v]) => v);
  localStorage.clear();
  keep.forEach(([k,v]) => localStorage.setItem(k, v));
  alert('Кэш очищен'); showCacheSize();
}
function logout() {
  if (!confirm('Выйти из аккаунта?')) return;
  [STORAGE.SESSION, STORAGE.UNREAD, STORAGE.CONTACTS, STORAGE.GROUPS].forEach(k => localStorage.removeItem(k));
  location.reload();
}
function confirmDeleteAccount() {
  const pass = $('delete-account-pass')?.value || '', err = $('delete-account-error');
  if (err) err.textContent = '';
  if (!pass) { if (err) err.textContent = 'Введи пароль'; return; }
  api('delete account', { password: pass }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Не удалось'; return; }
    localStorage.clear(); location.reload();
  });
}

/* ─── 12. ПРОФИЛЬ ─── */
function updateMyAvatarBtn() {
  const btn = $('my-avatar-btn'); if (!btn) return;
  if (state.me.avatarVideo) btn.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${state.me.avatarVideo}"></video>`;
  else if (state.me.avatar) btn.innerHTML = `<img src="${state.me.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  else btn.textContent = '👤';
  btn.style.boxShadow = state.me.premium ? '0 0 0 2px var(--gold), 0 0 12px rgba(251, 191, 36, 0.5)' : '';
}
function updateVerifyButton() { $('verify-btn') && ($('verify-btn').style.display = state.me.username === 'moroz' ? 'block' : 'none'); if (state.me.username === 'moroz') $('verify-btn').onclick = openBadgeModal; }
function updateVerifyChannelButton() {
  const b = $('verify-channel-btn'); if (!b) return;
  b.style.display = state.me.username === 'moroz' ? 'block' : 'none';
  if (state.me.username === 'moroz') b.onclick = () => { $('verify-channel-slug').value = ''; $('verify-channel-error').textContent = ''; openModal('verify-channel-modal'); };
}
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
  const payload = {
    firstName: ($('my-first-name')?.value || '').trim(),
    lastName: ($('my-last-name')?.value || '').trim(),
    bio: ($('my-bio')?.value || '').trim(),
    birthday: $('my-birthday')?.value || '',
    emojiStatus: ($('my-emoji')?.value || '').trim(),
  };
  api('update profile', payload, res => {
    if (!res?.ok) return;
    Object.assign(state.me, payload);
    closeModal('profile-modal'); renderChatList(); toast('✓ Профиль сохранён');
  });
}

/* ─── 13. ВИДЕО-АВАТАР / БАННЕР ─── */
function pickMedia(kind) {
  const input = el('input'); input.type = 'file'; input.accept = 'image/*,video/*'; input.style.display = 'none';
  input.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type.startsWith('video/')) uploadVideo(kind, f);
    else if (f.type.startsWith('image/')) uploadPhoto(kind, f);
    else toast('⚠️ Только фото или видео');
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
      if (isAvatar) { const m = Math.min(img.width, img.height); ctx.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, W, H); }
      else { const sc = Math.max(W/img.width, H/img.height), w = img.width*sc, h = img.height*sc; ctx.drawImage(img, (W-w)/2, (H-h)/2, w, h); }
      const dataUrl = c.toDataURL('image/jpeg', isAvatar ? 0.8 : 0.75);
      if (isAvatar) {
        api('remove avatar video', () => {
          state.me.avatarVideo = null; state.me.avatar = dataUrl;
          api('set avatar', { avatar: dataUrl });
          updateMyAvatarBtn(); renderStoriesBar();
          toast('✓ Фото-аватар установлен'); closeModal('profile-modal');
        });
      } else {
        api('remove banner video', () => {
          state.me.bannerVideo = null; state.me.banner = dataUrl;
          api('set banner', { banner: dataUrl }, res => {
            if (res?.ok) {
              state.me.banner = dataUrl;
              const p = $('profile-banner-preview'), im = $('profile-banner-img');
              if (im) im.src = dataUrl; if (p) p.style.display = 'block';
              toast('🎨 Баннер установлен'); vib(15);
            } else toast('❌ Ошибка');
          });
        });
      }
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

async function uploadVideo(kind, file) {
  const isAvatar = kind === 'avatar';
  const MAX = isAvatar ? 6 : 15, MAX_DUR = isAvatar ? 8 : 20;
  if (file.size > MAX * 1024 * 1024) return toast(`⚠️ Видео больше ${MAX} МБ`);
  const v = document.createElement('video'); v.preload = 'metadata';
  v.onloadedmetadata = () => {
    if (v.duration > MAX_DUR) { toast(`⚠️ Видео не длиннее ${MAX_DUR} секунд`); URL.revokeObjectURL(v.src); return; }
    URL.revokeObjectURL(v.src);
    const r = new FileReader();
    r.onload = e => {
      const dataUrl = e.target.result;
      if (dataUrl.length > MAX * 1024 * 1024 * 1.4) return toast('⚠️ Видео слишком большое после кодирования');
      const ev = isAvatar ? 'set avatar video' : 'set banner video';
      api(ev, { video: dataUrl }, res => {
        if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
        if (isAvatar) { state.me.avatarVideo = dataUrl; state.me.avatar = null; updateMyAvatarBtn(); renderStoriesBar(); toast('🎬 Видео-аватар установлен'); }
        else { state.me.bannerVideo = dataUrl; state.me.banner = null; toast('🎬 Видео-баннер установлен'); }
        vib(15); closeModal('profile-modal');
      });
    };
    r.readAsDataURL(file);
  };
  v.src = URL.createObjectURL(file);
}

function removeMyBanner(ev) {
  ev?.stopPropagation();
  if (!state.me.banner && !state.me.bannerVideo) return;
  if (!confirm('Убрать баннер?')) return;
  const p = $('profile-banner-preview'); if (p) p.classList.add('removing');
  const done = () => { state.me.banner = null; state.me.bannerVideo = null; setTimeout(() => { if (p) { p.style.display = 'none'; p.classList.remove('removing'); } }, 400); toast('🎨 Баннер убран'); vib(15); };
  state.me.bannerVideo ? api('remove banner video', done) : api('remove banner', res => { if (res?.ok) done(); else { if (p) p.classList.remove('removing'); toast('❌ Не удалось убрать'); } });
}

/* ─── 14. QR / СЕССИИ / БЛОКИРОВКИ / PASSCODE ─── */
function showMyQr() {
  const c = $('qr-display'); if (!c) return;
  c.innerHTML = '';
  const link = location.origin + '/?add=' + state.me.username;
  const img = new Image();
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
  img.onerror = () => c.innerHTML = `<div style="color:#000;text-align:center;font-size:12px;word-break:break-all;">${esc(link)}</div>`;
  c.appendChild(img);
  openModal('my-qr-modal');
}
function copyQrLink() { navigator.clipboard.writeText(location.origin + '/?add=' + state.me.username).then(() => toast('📋 Скопировано')).catch(() => toast('⚠️ Не удалось')); }
function addFromQr() {
  if (!state.qrFoundUser) return;
  const u = state.qrFoundUser.username;
  const dn = ((state.qrFoundUser.firstName || '') + ' ' + (state.qrFoundUser.lastName || '')).trim() || u;
  api('add contact', { username: u, displayName: dn }, res => {
    if (!res?.ok) return alert(res?.error || 'Ошибка');
    closeModal('qr-found-modal'); state.qrFoundUser = null; toast('✓ Контакт добавлен');
  });
}

function openSessions() {
  api('get sessions', sessions => {
    const box = $('settings-content'); if (!box) return;
    let html = '<div class="settings-tg-section-title">Активные сеансы</div>';
    if (!sessions?.length) html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Нет активных сессий</div>';
    else sessions.forEach(s => {
      const cur = s.id === state.me.sessionId;
      html += `<div class="session-item"><div class="device">${esc(s.device || 'Web')}${cur ? ' <span style="color:#4ade80">— это устройство</span>' : ''}</div><div class="meta">Активность: ${fmtD(+s.last_active)}</div>${!cur ? `<button onclick="terminateSession('${s.id}')">Завершить</button>` : ''}</div>`;
    });
    html += '<button class="modal-danger" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="terminateAllOthers()">Завершить все другие</button>';
    html += '<button class="modal-secondary" style="margin:8px 16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="renderSettings()">Назад</button>';
    box.innerHTML = html;
  });
}
function terminateSession(id) { if (!confirm('Завершить сеанс?')) return; api('terminate session', { sessionId: id }, () => openSessions()); }
function terminateAllOthers() { if (!confirm('Завершить все другие сеансы?')) return; api('delete all other sessions', () => openSessions()); }

function openBlockedList() {
  api('get blocked', list => {
    state.blockedList = list || [];
    const box = $('settings-content'); if (!box) return;
    let html = `<div class="settings-tg-section-title">Заблокированные (${state.blockedList.length})</div>`;
    if (!state.blockedList.length) html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Список пуст</div>';
    else state.blockedList.forEach(u => { html += `<div class="session-item"><div class="device">@${esc(u)}</div><button onclick="unblockUser('${esc(u)}')">Разблокировать</button></div>`; });
    html += '<button class="modal-secondary" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="renderSettings()">Назад</button>';
    box.innerHTML = html;
  });
}
function unblockUser(u) { api('unblock user', { username: u }, () => openBlockedList()); }

function openPasscodeModal() { $('passcode-new').value = ''; $('passcode-confirm').value = ''; $('passcode-error-modal').textContent = ''; openModal('passcode-setup-modal'); }
function savePasscode() {
  const p1 = $('passcode-new').value, p2 = $('passcode-confirm').value, err = $('passcode-error-modal');
  if (err) err.textContent = '';
  if (p1.length < 4) { if (err) err.textContent = 'Минимум 4 символа'; return; }
  if (p1 !== p2) { if (err) err.textContent = 'Коды не совпадают'; return; }
  api('set passcode', { passcode: p1 }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    state.settings.passcode = 'set'; closeModal('passcode-setup-modal'); renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function removePasscode() {
  api('set passcode', { passcode: '' }, () => {
    state.settings.passcode = null; closeModal('passcode-setup-modal'); renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

/* ─── 15. ГЕО ─── */
function sendGeo() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return toast('⚠️ Открой чат');
  if (!navigator.geolocation) return toast('⚠️ Геолокация недоступна');
  toast('📍 Определяю позицию…');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
    const replyId = state.replyToMessage?.id || null;
    const payload = { lat, lng, replyTo: replyId };
    if (state.isSavedChat) payload.to = state.me.username;
    else if (state.currentChat) payload.to = state.currentChat;
    else if (state.currentGroup) payload.groupId = state.currentGroup.id;
    api('send geo', payload, res => {
      if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
      cancelReply(); toast('📍 Геолокация отправлена'); vib(15);
    });
  }, err => toast({ 1:'🚫 Доступ к геолокации запрещён', 2:'📡 Позиция недоступна', 3:'⏱ Таймаут' }[err.code] || 'Не удалось получить позицию'),
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
function renderGeoBlock(geo) {
  if (!geo || geo.lat == null || geo.lng == null) return null;
  const lat = +geo.lat, lng = +geo.lng;
  const map = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x260&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  const w = el('div', 'geo-block');
  w.onclick = e => { e.stopPropagation(); window.open(link, '_blank'); };
  w.innerHTML = `<div class="geo-img" style="background-image:url(${map})"></div>
    <div class="geo-info"><div class="geo-label">📍 ${esc(geo.label || 'Моя геолокация')}</div>
    <div class="geo-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
    <div class="geo-open">Открыть в картах →</div></div>`;
  return w;
}

/* ─── 16. ЖАЛОБЫ ─── */
function openReportModal(targetUser, messageId, isGroup) {
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
        $('report-comment-wrap').style.display = key === 'other' ? 'block' : 'none';
      };
      box.appendChild(b);
    });
  }
  const t = $('report-target-info');
  if (t) t.textContent = state.reportTarget ? 'На: @' + state.reportTarget : state.reportTargetMessageId ? 'На сообщение #' + state.reportTargetMessageId : '';
  $('report-comment').value = ''; $('report-error').textContent = '';
  $('report-comment-wrap').style.display = 'none';
  hideActionMenu(); openModal('report-modal');
}
function submitReport() {
  const active = document.querySelector('.report-reason-btn.active'), err = $('report-error');
  if (err) err.textContent = '';
  if (!active) { if (err) err.textContent = 'Выбери причину'; return; }
  const reason = active.dataset.reason, comment = ($('report-comment')?.value || '').trim();
  if (reason === 'other' && !comment) { if (err) err.textContent = 'Опиши причину'; return; }
  api('report', { targetUser: state.reportTarget, targetMessageId: state.reportTargetMessageId, targetIsGroup: state.reportIsGroup, reason, comment: comment || null }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('report-modal'); toast('🚨 Жалоба отправлена модераторам'); vib([50,30,50]);
  });
}

/* ─── 17. МОДЕРАЦИЯ ─── */
function openModPanel() {
  if (!state.me.isModerator) return toast('⚠️ Только для модераторов');
  state.modPanelOpen = true; state.modTab = 'reports';
  switchModTab('reports'); openModal('mod-panel-modal'); refreshModStats();
}
function closeModPanel() { state.modPanelOpen = false; closeModal('mod-panel-modal'); }
function switchModTab(tab) {
  state.modTab = tab;
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.mod-section').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
  if (tab === 'reports') loadModReports();
  else if (tab === 'punishments') loadModPunishments();
  else if (tab === 'logs') loadModLogs();
}
function refreshModStats() { api('mod panel stats', r => { if (r?.ok) { state.modStats = r.stats || {}; updateModStatsUI(); } }); }
function updateModStatsUI() {
  const s = state.modStats;
  ['new_reports','resolved_reports','active_bans','active_mutes'].forEach(k => { const e = $('mod-stat-' + k.replace('_reports','').replace('active_','')); if (e) e.textContent = s[k] || 0; });
}
function loadModReports() { api('get reports', { status: state.modReportsFilter }, r => { if (r?.ok) { state.modReports = r.reports || []; renderModReports(); } }); }
function renderModReports() {
  const box = $('mod-reports-list'); if (!box) return;
  if (!state.modReports.length) { box.innerHTML = '<div class="mod-empty">Жалоб нет 🎉</div>'; return; }
  box.innerHTML = '';
  state.modReports.forEach(rep => {
    const card = el('div', 'mod-report-card');
    const reason = REPORT_REASONS[rep.reason] || rep.reason;
    let preview = '';
    if (rep.target_message_text) preview = `<div class="mrc-msg">💬 ${esc(rep.target_message_text.slice(0,120))}</div>`;
    else if (rep.target_message_image) preview = '<div class="mrc-msg">📷 Фото</div>';
    else if (rep.target_message_voice) preview = '<div class="mrc-msg">🎤 Голосовое</div>';
    else if (rep.target_message_geo) preview = '<div class="mrc-msg">📍 Геолокация</div>';
    card.innerHTML = `
      <div class="mrc-head"><span class="mrc-status ${rep.status === 'new' ? 'new' : 'resolved'}">${rep.status === 'new' ? '🆕' : '✓'}</span><span class="mrc-reason">${esc(reason)}</span><span class="mrc-time">${ago(rep.time)}</span></div>
      <div class="mrc-row"><b>От:</b> @${esc(rep.reporter)}</div>
      <div class="mrc-row"><b>На:</b> @${esc(rep.target_user || '—')}</div>
      ${preview}
      ${rep.comment ? `<div class="mrc-comment">💬 ${esc(rep.comment)}</div>` : ''}
      ${rep.action_taken && rep.action_taken !== 'ignore' ? `<div class="mrc-action">Мера: ${PUNISH_LABELS[rep.action_taken] || rep.action_taken}</div>` : ''}`;
    if (rep.status === 'new') {
      const actions = el('div', 'mrc-actions');
      actions.innerHTML = '<button class="mrc-btn danger" data-action="ban">🚫 Бан</button><button class="mrc-btn warn" data-action="mute">🔇 Мут</button><button class="mrc-btn" data-action="warn">⚠️ Warn</button><button class="mrc-btn ghost" data-action="ignore">❌ Игнор</button>';
      actions.querySelectorAll('.mrc-btn').forEach(b => b.onclick = () => handleReportAction(rep.id, b.dataset.action));
      card.appendChild(actions);
    }
    box.appendChild(card);
  });
}
function handleReportAction(reportId, action) {
  if (action === 'ignore') return api('resolve report', { reportId, action:'ignore' }, res => { if (res?.ok) { toast('✓ Жалоба проигнорирована'); loadModReports(); refreshModStats(); } else toast('❌ ' + (res?.error || 'Ошибка')); });
  if (action === 'warn') {
    const reason = prompt('Причина предупреждения:'); if (reason == null) return;
    api('resolve report', { reportId, action:'warn', reason }, res => { if (res?.ok) { toast('⚠️ Предупреждение выдано'); loadModReports(); refreshModStats(); } else toast('❌ ' + (res?.error || 'Ошибка')); });
    return;
  }
  if (action === 'ban' || action === 'mute') openPunishDurationModal(reportId, action);
}
function openPunishDurationModal(reportId, action) {
  const title = $('punish-duration-title'), options = $('punish-duration-options');
  if (!title || !options) return;
  title.textContent = action === 'ban' ? '🚫 Забанить на:' : '🔇 Замутить на:';
  const durations = action === 'ban'
    ? [['1h','1 час'],['24h','24 часа'],['7d','7 дней'],['30d','30 дней'],['forever','Навсегда']]
    : [['5m','5 минут'],['1h','1 час'],['24h','24 часа'],['7d','7 дней']];
  options.innerHTML = '';
  durations.forEach(([key, label]) => {
    const b = el('button', 'punish-duration-btn' + (key === 'forever' ? ' danger' : ''), label);
    b.onclick = () => {
      const reason = prompt('Причина (необязательно):') || null;
      closeModal('punish-duration-modal');
      api('resolve report', { reportId, action, duration: key, reason }, res => {
        if (res?.ok) { toast('✓ ' + (action === 'ban' ? 'Забанен' : 'Замучен') + ' на ' + label); loadModReports(); refreshModStats(); }
        else toast('❌ ' + (res?.error || 'Ошибка'));
      });
    };
    options.appendChild(b);
  });
  openModal('punish-duration-modal');
}
function loadModPunishments() { api('get punishments', { active: true }, r => { if (r?.ok) { state.modPunishments = r.punishments || []; renderModPunishments(); } }); }
function renderModPunishments() {
  const box = $('mod-punishments-list'); if (!box) return;
  if (!state.modPunishments.length) { box.innerHTML = '<div class="mod-empty">Активных наказаний нет ✅</div>'; return; }
  box.innerHTML = '';
  state.modPunishments.forEach(p => {
    const card = el('div', 'mod-punish-card');
    card.innerHTML = `<div class="mpc-head"><span class="mpc-type">${PUNISH_LABELS[p.type] || p.type}</span><span class="mpc-dur">${esc(p.duration_text)}</span></div>
      <div class="mpc-row"><b>@</b>${esc(p.username)}</div>
      ${p.reason ? `<div class="mpc-reason">💬 ${esc(p.reason)}</div>` : ''}
      <div class="mpc-meta">Выдал: @${esc(p.issued_by)} · ${ago(p.issued_at)}</div>
      <button class="mrc-btn ghost" data-lift="${p.id}">✅ Снять</button>`;
    card.querySelector('[data-lift]').onclick = () => {
      if (!confirm('Снять наказание с @' + p.username + '?')) return;
      api('lift punishment', { punishmentId: p.id }, res => { if (res?.ok) { toast('✅ Снято'); loadModPunishments(); refreshModStats(); } else toast('❌ ' + (res?.error || 'Ошибка')); });
    };
    box.appendChild(card);
  });
}
function loadModLogs() { api('get mod logs', { limit: 200 }, r => { if (r?.ok) { state.modLogs = r.logs || []; renderModLogs(); } }); }
function renderModLogs() {
  const box = $('mod-logs-list'); if (!box) return;
  if (!state.modLogs.length) { box.innerHTML = '<div class="mod-empty">Логов нет</div>'; return; }
  box.innerHTML = '';
  const labels = { ban:'🚫 Бан', unban:'✅ Разбан', mute:'🔇 Мут', unmute:'✅ Размут', warn:'⚠️ Warn', ignore:'❌ Игнор', resolve:'✓ Решено' };
  state.modLogs.forEach(log => {
    const row = el('div', 'mod-log-row');
    row.innerHTML = `<div class="mlr-head"><span class="mlr-action">${labels[log.action] || log.action}</span><span class="mlr-time">${fmtD(log.time)}</span></div>
      <div class="mlr-row">Модератор: <b>@${esc(log.moderator)}</b></div>
      ${log.target_user ? `<div class="mlr-row">Цель: @${esc(log.target_user)}</div>` : ''}
      ${log.details ? `<div class="mlr-details">${esc(log.details)}</div>` : ''}`;
    box.appendChild(row);
  });
}
function openModBanUserModal(username, type) {
  $('mod-ban-target').textContent = '@' + username;
  $('mod-ban-title').textContent = type === 'ban' ? '🚫 Забанить' : '🔇 Замутить';
  $('mod-ban-username').value = username;
  $('mod-ban-type').value = type;
  $('mod-ban-error').textContent = '';
  const options = $('mod-ban-durations'); if (!options) return;
  options.innerHTML = '';
  const durations = type === 'ban'
    ? [['1h','1 час'],['24h','24 часа'],['7d','7 дней'],['30d','30 дней'],['forever','Навсегда']]
    : [['5m','5 минут'],['1h','1 час'],['24h','24 часа'],['7d','7 дней']];
  durations.forEach(([key, label], i) => {
    const b = el('button', 'punish-duration-btn' + (i === 0 ? ' active' : '') + (key === 'forever' ? ' danger' : ''), label);
    b.dataset.dur = key;
    b.onclick = () => { options.querySelectorAll('.punish-duration-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); };
    options.appendChild(b);
  });
  openModal('mod-ban-user-modal');
}
function submitModBan() {
  const username = $('mod-ban-username').value.trim().toLowerCase();
  const type = $('mod-ban-type').value;
  const durEl = document.querySelector('#mod-ban-durations .punish-duration-btn.active');
  const reason = ($('mod-ban-reason')?.value || '').trim() || null;
  const err = $('mod-ban-error'); if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник'; return; }
  if (!durEl) { if (err) err.textContent = 'Выбери срок'; return; }
  api(type === 'ban' ? 'ban user' : 'mute user', { username, duration: durEl.dataset.dur, reason }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('mod-ban-user-modal'); toast('✓ Готово'); refreshModStats();
    if (state.modPanelOpen && state.modTab === 'punishments') loadModPunishments();
  });
}
function modBanFromProfile() { const u = $('mod-contact-actions')?.dataset.target; if (u) openModBanUserModal(u, 'ban'); }
function modMuteFromProfile() { const u = $('mod-contact-actions')?.dataset.target; if (u) openModBanUserModal(u, 'mute'); }
function modWarnFromProfile() { const u = $('mod-contact-actions')?.dataset.target; if (!u) return; const reason = prompt('Причина предупреждения для @' + u + ':'); if (reason == null) return; api('warn user', { username: u, reason }, res => { if (res?.ok) toast('⚠️ Предупреждение выдано'); else toast('❌ ' + (res?.error || 'Ошибка')); }); }

/* ─── 18. ЗВЁЗДЫ / ПОДАРКИ ─── */
function openStarsHistory() {
  api('get stars', res => {
    if (!res?.ok) return;
    state.me.stars = res.stars;
    const box = $('stars-history-list'); if (!box) return;
    if (!res.transactions?.length) box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Пока нет операций</div>';
    else {
      box.innerHTML = '';
      res.transactions.forEach(t => {
        let label = t.reason;
        if (t.reason === 'welcome') label = '🎉 Бонус за регистрацию';
        else if (t.reason === 'premium_activated') label = '⭐ Активация премиума';
        else if (t.reason.startsWith('gift_sent:')) label = '🎁 Подарок для @' + t.reason.slice(10);
        else if (t.reason.startsWith('gift_sold:')) { const g = state.giftsCatalog[t.reason.slice(10)]; label = '💸 Продажа ' + (g ? g.emoji + ' ' + g.name : t.reason.slice(10)); }
        else if (t.reason.startsWith('achievement:')) label = '🏆 Достижение: ' + t.reason.slice(12);
        const color = t.amount > 0 ? '#4ade80' : '#f87171';
        const div = el('div', 'session-item');
        div.innerHTML = `<div class="device">${label}</div><div class="meta" style="color:${color};font-weight:700;font-size:14px;">${t.amount > 0 ? '+' : ''}${t.amount} ⭐</div><div class="meta">${fmtD(t.time)}</div>`;
        box.appendChild(div);
      });
    }
    openModal('stars-history-modal');
  });
}
function openGiftsCatalog(username) {
  username = username || state.currentGiftTarget || state.contactProfileCurrent?.username;
  if (!username) return toast('⚠️ Не удалось определить получателя');
  if (username === state.me.username) return toast('Себе дарить нельзя 🐎');
  state.currentGiftTarget = username;
  const contact = state.contacts.find(c => c.name === username);
  const dn = contact?.displayName || username;
  $('gifts-catalog-target').textContent = 'Кому: ' + dn;
  $('gifts-catalog-balance').textContent = state.me.stars;
  $('gifts-catalog-error').textContent = '';
  const grid = $('gifts-grid'); if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.giftsCatalog);
  if (!entries.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">Загрузка каталога...</div>';
    api('get gifts catalog', r => { if (r?.ok) { state.giftsCatalog = r.catalog || {}; openGiftsCatalog(username); } });
    openModal('gifts-catalog-modal'); closeModal('contact-profile-modal');
    return;
  }
  entries.forEach(([key, gift]) => {
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
  const to = state.currentGiftTarget; if (!to) return toast('⚠️ Не выбран получатель');
  state.currentGiftKey = giftKey;
  const contact = state.contacts.find(c => c.name === to);
  $('gift-message-target').textContent = 'Кому: ' + (contact?.displayName || to);
  $('gift-message-preview').textContent = gift.emoji;
  $('gift-message-price').textContent = gift.price;
  $('gift-message-input').value = ''; $('gift-message-error').textContent = '';
  closeModal('gifts-catalog-modal'); openModal('gift-message-modal');
}
function confirmSendGift() {
  const gift = state.giftsCatalog[state.currentGiftKey]; if (!gift) return toast('⚠️ Подарок не найден');
  const to = state.currentGiftTarget; if (!to) return toast('⚠️ Не выбран получатель');
  const message = ($('gift-message-input')?.value || '').trim();
  const err = $('gift-message-error'); if (err) err.textContent = '';
  api('send gift', { to, giftKey: state.currentGiftKey, message: message || null }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('gift-message-modal'); toast('🎁 Подарок отправлен! -' + gift.price + ' ⭐');
    state.currentGiftTarget = null; state.currentGiftKey = null;
  });
}
function openMyGifts() {
  api('get my gifts', res => {
    const box = $('my-gifts-list'); if (!box) return;
    if (!res?.ok || !res.gifts?.length) box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Пока нет подарков 🎁</div>';
    else {
      box.innerHTML = '';
      const grid = el('div', 'my-gifts-grid');
      res.gifts.forEach(g => {
        const gift = state.giftsCatalog[g.gift_key]; if (!gift) return;
        const card = el('div', 'my-gift-card');
        const fromName = state.contacts.find(c => c.name === g.from_user)?.displayName || g.from_user;
        card.innerHTML = `<span class="gift-emoji">${gift.emoji}</span><span class="gift-name" style="font-size:11px;font-weight:600;">${esc(gift.name)}</span><span class="gift-from">от @${esc(fromName)}</span><button class="gift-sell" onclick="sellGift(${g.id})">💸 ${Math.floor(gift.price/2)}⭐</button>`;
        grid.appendChild(card);
      });
      box.appendChild(grid);
    }
    openModal('my-gifts-modal');
  });
}
function sellGift(id) {
  if (!confirm('Продать подарок за 50% цены?')) return;
  api('sell gift', { giftId: id }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); toast('💸 Продано! +' + res.returned + ' ⭐'); openMyGifts(); });
}
function openGiftModal() { $('gift-code-input').value = ''; $('gift-error').textContent = ''; openModal('gift-modal'); }
function redeemGiftCode() {
  const code = ($('gift-code-input')?.value || '').trim().toUpperCase(), err = $('gift-error');
  if (err) err.textContent = '';
  if (!code) { if (err) err.textContent = 'Введи код'; return; }
  api('redeem gift code', { code }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('gift-modal'); toast('⭐ Премиум активирован! +' + (res.bonus || 25) + ' ⭐');
    renderSettings(); if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function openGiftAdminModal() { if (state.me.username !== 'moroz') return; $('gift-codes-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>'; openModal('gift-admin-modal'); loadGiftCodes(); }
function loadGiftCodes() {
  api('list gift codes', res => {
    const box = $('gift-codes-list'); if (!box) return;
    if (!res?.ok) { box.innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">Нет доступа</div>'; return; }
    if (!res.codes.length) { box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Пока нет кодов</div>'; return; }
    box.innerHTML = '';
    res.codes.forEach(c => {
      const div = el('div', 'gift-code-item');
      div.innerHTML = `<span class="code" onclick="copyText('${c.code}')">${esc(c.code)}</span>${c.used_by ? `<span class="status used">✓ ${esc(c.used_by)}</span>` : '<span class="status">свободен</span>'}`;
      box.appendChild(div);
    });
  });
}
function generateGiftCode() { api('generate gift code', res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); alert('🎁 Код создан:\n\n' + res.code); loadGiftCodes(); }); }
function copyText(t) { navigator.clipboard.writeText(t).then(() => toast('📋 Скопировано')).catch(() => {}); }

/* ─── 19. ДОСТИЖЕНИЯ / СТАТИСТИКА ─── */
function openAchievements() {
  const box = $('achievements-content'); if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Загрузка…</div>';
  openModal('achievements-modal');
  api('get achievements', res => {
    if (!res?.ok) { box.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">Не удалось загрузить</div>'; return; }
    box.innerHTML = '';
    const unlocked = res.achievements.filter(a => a.unlocked).length;
    const summary = el('div');
    summary.style.cssText = 'text-align:center;padding:12px 0 18px;color:var(--text-muted);font-size:13px;';
    summary.innerHTML = `Разблокировано: <b style="color:var(--accent);">${unlocked}</b> / ${res.achievements.length}`;
    box.appendChild(summary);
    res.achievements.forEach(a => {
      const card = el('div', 'achievement-card ' + (a.unlocked ? 'unlocked' : 'locked'));
      const pct = Math.min(100, Math.round(a.current / a.target * 100));
      card.innerHTML = `<div class="achievement-emoji">${a.emoji}</div><div class="achievement-info"><div class="achievement-name">${esc(a.name)}</div><div class="achievement-desc">${esc(a.desc)}</div><div class="achievement-progress-bar"><div class="achievement-progress-fill" style="width:${pct}%;"></div></div><div class="achievement-progress-text">${Math.min(a.current, a.target)} / ${a.target}</div></div>${a.unlocked ? '<div class="achievement-unlocked-badge">✓</div>' : ''}`;
      box.appendChild(card);
    });
  });
}
function openStats() {
  const box = $('stats-content'); if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Загрузка…</div>';
  openModal('stats-modal');
  api('get achievements', res => {
    if (!res?.ok || !res.stats) { box.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">Не удалось загрузить</div>'; return; }
    const s = res.stats;
    const stats = [
      ['💬','Сообщений',s.messages_sent],['📞','Звонков',s.calls_made],['📲','Принято',s.calls_received],
      ['🎁','Подарков',s.gifts_sent],['❤️','Получено',s.gifts_received],['📸','Историй',s.stories_posted],
      ['👥','Друзей',s.friends_added],['🔥','Дней подряд',s.days_active],['🤖','Ботов',s.bots_created],
      ['🎤','Голосовых',s.voice_sent],['🎥','Кружков',s.circles_sent],['📷','Фото',s.photos_sent],
      ['😍','Реакций',s.reactions_given],['🐱','Стикеров',s.stickers_sent],['📍','Гео',s.geo_sent],
    ];
    let html = '<div class="stats-grid">';
    stats.forEach(([e, l, v]) => html += `<div class="stat-card"><div class="stat-emoji">${e}</div><div class="stat-value">${Number(v || 0)}</div><div class="stat-label">${l}</div></div>`);
    html += '</div>';
    const dur = Number(s.calls_duration || 0), min = Math.floor(dur/60), h = Math.floor(min/60);
    const timeStr = h > 0 ? `${h} ч ${min%60} мин` : min > 0 ? `${min} мин` : `${dur} сек`;
    html += `<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:13px;">📞 Всего в звонках: <b style="color:var(--accent);">${timeStr}</b></div>`;
    box.innerHTML = html;
  });
}

/* ─── 20. БОТЫ ─── */
function openCreateBotModal() {
  $('bot-username').value = ''; $('bot-name').value = ''; $('bot-description').value = ''; $('bot-emoji').value = '🤖';
  $('create-bot-error').textContent = ''; $('bot-commands-list').innerHTML = '';
  $('bot-avatar-preview').style.display = 'none';
  state.tempBotAvatar = null;
  addBotCommandRow('bot-commands-list');
  openModal('create-bot-modal');
}
function addBotCommandRow(boxId) {
  const box = $(boxId); if (!box) return;
  const row = el('div', 'bot-command-row');
  row.innerHTML = '<input class="bcc-trigger" placeholder="/start" maxlength="40" /><textarea class="bcc-response" placeholder="Ответ бота" rows="2" maxlength="1000"></textarea><button class="bcc-remove" type="button">×</button>';
  row.querySelector('.bcc-remove').onclick = () => row.remove();
  box.appendChild(row);
}
function collectBotCommands(boxId) {
  const box = $(boxId); if (!box) return [];
  return Array.from(box.querySelectorAll('.bot-command-row')).map(r => {
    const t = r.querySelector('.bcc-trigger')?.value.trim(), resp = r.querySelector('.bcc-response')?.value.trim();
    return t && resp ? { trigger: t, response: resp } : null;
  }).filter(Boolean);
}
function uploadBotAvatar(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 200;
      const ctx = c.getContext('2d'), m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, 200, 200);
      state.tempBotAvatar = c.toDataURL('image/jpeg', 0.8);
      $('bot-avatar-img').src = state.tempBotAvatar;
      $('bot-avatar-preview').style.display = 'block';
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file); ev.target.value = '';
}
function doCreateBot() {
  const username = ($('bot-username')?.value || '').trim().toLowerCase();
  const name = ($('bot-name')?.value || '').trim();
  const description = ($('bot-description')?.value || '').trim();
  const emoji = ($('bot-emoji')?.value || '').trim();
  const commands = collectBotCommands('bot-commands-list');
  const err = $('create-bot-error'); if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник бота'; return; }
  if (!/_bot$/.test(username)) { if (err) err.textContent = 'Ник должен заканчиваться на _bot'; return; }
  if (!name) { if (err) err.textContent = 'Введи имя бота'; return; }
  api('create bot', { username, name, description: description || null, avatar: state.tempBotAvatar, emoji: emoji || null, commands }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('create-bot-modal'); toast('🤖 Бот ' + name + ' создан!'); vib([50,30,50]);
    api('get my bots', r => { if (r?.ok) state.myBots = r.bots || []; });
  });
}
function openMyBots() {
  const box = $('my-bots-list'); if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>';
  openModal('my-bots-modal');
  api('get my managed bots', res => {
    if (!res?.ok) { box.innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">Ошибка</div>'; return; }
    if (!res.bots.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока нет ботов 🤖<br><br>Нажми «Создать бота»</div>'; return; }
    box.innerHTML = '';
    res.bots.forEach(b => {
      const card = el('div', 'my-bot-card');
      const avStyle = b.avatar ? `background-image:url(${b.avatar})` : '';
      const avContent = b.avatar ? '' : (b.emoji || '🤖');
      card.innerHTML = `<div class="bot-avatar" style="${avStyle}">${avContent}</div><div class="bot-info"><div class="bot-name">${esc(b.name)} <span class="bot-mark">бот</span></div><div class="bot-desc">@${esc(b.username)} · ${b.role === 'owner' ? '👑 Владелец' : '👥 Оператор'}</div></div><button class="mrc-btn" onclick="event.stopPropagation(); openBotControl('${b.username}')">Управление</button>`;
      card.onclick = () => openEditBot(b.username);
      box.appendChild(card);
    });
  });
}
function openEditBot(username) {
  api('find bot', { username }, res => {
    if (!res?.ok) return toast('⚠️ Бот не найден');
    const b = res.bot;
    state.editingBotUsername = b.username;
    $('edit-bot-username').value = b.username; $('edit-bot-name').value = b.name;
    $('edit-bot-description').value = b.description || ''; $('edit-bot-emoji').value = b.emoji || '';
    $('edit-bot-error').textContent = '';
    const cb = $('edit-bot-commands-list'); cb.innerHTML = '';
    if (!b.commands.length) addBotCommandRow('edit-bot-commands-list');
    else b.commands.forEach(c => {
      const row = el('div', 'bot-command-row');
      row.innerHTML = `<input class="bcc-trigger" placeholder="/start" maxlength="40" value="${esc(c.trigger)}" /><textarea class="bcc-response" placeholder="Ответ бота" rows="2" maxlength="1000">${esc(c.response)}</textarea><button class="bcc-remove" type="button">×</button>`;
      row.querySelector('.bcc-remove').onclick = () => row.remove();
      cb.appendChild(row);
    });
    closeModal('my-bots-modal'); openModal('edit-bot-modal');
  });
}
function doUpdateBot() {
  const username = state.editingBotUsername; if (!username) return;
  const name = ($('edit-bot-name')?.value || '').trim();
  const description = ($('edit-bot-description')?.value || '').trim();
  const emoji = ($('edit-bot-emoji')?.value || '').trim();
  const commands = collectBotCommands('edit-bot-commands-list');
  const err = $('edit-bot-error'); if (err) err.textContent = '';
  if (!name) { if (err) err.textContent = 'Введи имя'; return; }
  api('update bot', { username, name, description: description || null, emoji: emoji || null, commands }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('edit-bot-modal'); toast('✓ Бот обновлён');
    api('get my bots', r => { if (r?.ok) state.myBots = r.bots || []; });
  });
}
function confirmDeleteBot() {
  const username = state.editingBotUsername; if (!username) return;
  if (!confirm('Удалить бота @' + username + '? Все его сообщения будут удалены.')) return;
  api('delete bot', { username }, res => {
    if (!res?.ok) return alert(res?.error || 'Ошибка');
    closeModal('edit-bot-modal'); toast('🗑 Бот удалён');
    api('get my bots', r => { if (r?.ok) state.myBots = r.bots || []; });
  });
}
function openFindBotModal() { $('find-bot-input').value = ''; $('find-bot-error').textContent = ''; openModal('find-bot-modal'); }
function doFindBot() {
  const username = ($('find-bot-input')?.value || '').trim().toLowerCase();
  const err = $('find-bot-error'); if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник'; return; }
  api('find bot', { username }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Бот не найден'; return; }
    closeModal('find-bot-modal'); showBotInfoModal(res.bot);
  });
}
function showBotInfoModal(bot) {
  state.currentBot = bot;
  const box = $('bot-info-content'); if (!box) return;
  const avStyle = bot.avatar ? `background-image:url(${bot.avatar})` : '';
  const avContent = bot.avatar ? '' : (bot.emoji || '🤖');
  let cmds = '';
  if (bot.commands?.length) {
    cmds = '<div class="bot-commands-preview"><div class="bcp-title">📋 Команды</div>';
    bot.commands.forEach(c => cmds += `<div class="bcp-row"><span class="bcp-trigger">${esc(c.trigger)}</span>${esc(c.response.slice(0, 80))}</div>`);
    cmds += '</div>';
  } else cmds = '<div class="modal-desc" style="margin-bottom:14px;">У бота нет команд</div>';
  box.innerHTML = `<div class="profile-header"><div class="profile-avatar-big bot" style="${avStyle}">${avContent}</div><div class="profile-name">${esc(bot.name)} <span class="bot-mark">бот</span></div><div class="profile-nick">@${esc(bot.username)}</div></div>${bot.description ? `<div class="profile-bio">${esc(bot.description)}</div>` : ''}${cmds}`;
  openModal('bot-info-modal');
}
function addFoundBot() {
  if (!state.currentBot) return;
  api('add contact', { username: state.currentBot.username, displayName: state.currentBot.name }, res => {
    if (!res?.ok) return alert(res?.error || 'Ошибка');
    closeModal('bot-info-modal'); toast('✓ Бот добавлен в контакты'); switchTab('chats');
    setTimeout(() => openChat(state.currentBot.username), 300);
  });
}

/* ─── 21. BOT CONTROL ─── */
function openBotControl(botUsername) {
  state.botControlCurrent = botUsername;
  $('bot-control-title').textContent = '🤖 Управление @' + botUsername;
  switchBotControlTab('chats'); loadBotChats(botUsername); loadBotOperators(botUsername);
  closeModal('my-bots-modal'); openModal('bot-control-modal');
}
function switchBotControlTab(tab) {
  state.botControlTab = tab;
  document.querySelectorAll('.bot-control-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.bot-control-section').forEach(s => s.classList.toggle('active', s.dataset.tab === tab));
}
function loadBotChats(botUsername) {
  const box = $('bot-chats-list'); if (!box) return;
  box.innerHTML = '<div class="mod-empty">Загрузка…</div>';
  api('get bot chats', { botUsername }, res => {
    if (!res?.ok) { box.innerHTML = '<div class="mod-empty">Ошибка</div>'; return; }
    if (!res.chats.length) { box.innerHTML = '<div class="mod-empty">Бот ещё ни с кем не общался.</div>'; return; }
    box.innerHTML = '';
    res.chats.forEach(c => {
      const row = el('div', 'bot-chat-item');
      const av = c.avatar ? `<div class="avatar" style="background-image:url(${c.avatar})"></div>` : `<div class="avatar ${c.type === 'group' ? 'group' : ''}">${c.type === 'group' ? '👥' : '👤'}</div>`;
      row.innerHTML = `${av}<div class="chat-info"><div class="chat-name">${esc(c.displayName)}</div><div class="chat-preview">${c.type === 'group' ? c.memberCount + ' участников' : '@' + esc(c.target)}</div></div><span class="tg-row-arrow">›</span>`;
      row.onclick = () => openBotChat(c);
      box.appendChild(row);
    });
  });
}
function loadBotOperators(botUsername) {
  const box = $('bot-operators-list'); if (!box) return;
  box.innerHTML = '<div class="mod-empty">Загрузка…</div>';
  api('get bot operators', { botUsername }, res => {
    if (!res?.ok) { box.innerHTML = '<div class="mod-empty">Ошибка</div>'; return; }
    box.innerHTML = '';
    const owner = el('div', 'bot-operator-row owner');
    owner.innerHTML = `<div class="avatar" style="background:var(--gold);color:#0a1628;font-size:16px;">👑</div><div class="chat-info"><div class="chat-name">@${esc(res.owner)}</div><div class="chat-preview">Владелец</div></div>`;
    box.appendChild(owner);
    if (!res.operators.length) { const e = el('div', 'mod-empty', 'Операторов пока нет'); box.appendChild(e); return; }
    res.operators.forEach(op => {
      const row = el('div', 'bot-operator-row');
      const av = op.avatar ? `<div class="avatar" style="background-image:url(${op.avatar})"></div>` : `<div class="avatar">${initials(op.firstName || op.username)}</div>`;
      const dn = ((op.firstName || '') + ' ' + (op.lastName || '')).trim() || '@' + op.username;
      row.innerHTML = `${av}<div class="chat-info"><div class="chat-name">${esc(dn)}</div><div class="chat-preview">@${esc(op.username)}</div></div><button class="mrc-btn ghost" onclick="removeBotOperator('${op.username}')">Убрать</button>`;
      box.appendChild(row);
    });
  });
}
function addBotOperator() {
  const inp = $('bot-operator-input'); const op = (inp?.value || '').trim().toLowerCase().replace(/^@/, '');
  if (!op) return;
  api('add bot operator', { botUsername: state.botControlCurrent, operator: op }, res => {
    if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
    inp.value = ''; toast('✓ Оператор добавлен'); loadBotOperators(state.botControlCurrent);
  });
}
function removeBotOperator(op) {
  if (!confirm('Убрать @' + op + ' из операторов?')) return;
  api('remove bot operator', { botUsername: state.botControlCurrent, operator: op }, res => { if (res?.ok) { toast('✓ Оператор удалён'); loadBotOperators(state.botControlCurrent); } });
}
function openBotChat(chat) {
  state.botChatCurrent = { botUsername: state.botControlCurrent, chatKey: chat.key, chatType: chat.type, target: chat.target, displayName: chat.displayName };
  state.botReplyTo = null;
  const av = $('bot-chat-avatar');
  if (av) {
    if (chat.avatar) { av.style.backgroundImage = `url(${chat.avatar})`; av.textContent = ''; }
    else { av.style.backgroundImage = ''; av.textContent = chat.type === 'group' ? '👥' : initials(chat.displayName); av.style.background = chat.type === 'group' ? 'linear-gradient(135deg,#0f5132,#2d9e6b)' : 'var(--accent)'; }
  }
  $('bot-chat-name').textContent = chat.displayName;
  $('bot-chat-botname').textContent = '@' + chat.botUsername;
  const box = $('bot-chat-messages'); if (box) box.innerHTML = '<div class="mod-empty">Загрузка…</div>';
  api('load bot history', { botUsername: chat.botUsername, chatKey: chat.chatKey }, res => {
    if (!res?.ok) { if (box) box.innerHTML = '<div class="mod-empty">Ошибка</div>'; return; }
    if (box) box.innerHTML = '';
    res.messages.forEach(m => renderBotMessage(m));
    if (box) box.scrollTop = box.scrollHeight;
  });
  closeModal('bot-control-modal');
  $('bot-chat-screen')?.classList.add('active');
}
function closeBotChat() {
  state.botChatCurrent = null; state.botReplyTo = null;
  $('bot-chat-screen')?.classList.remove('active');
  if (state.botControlCurrent) openBotControl(state.botControlCurrent);
}
function renderBotMessage(m) {
  const box = $('bot-chat-messages'); if (!box) return;
  const wrap = el('div', 'msg-wrap ' + (m.self ? 'self' : 'other'));
  wrap.dataset.id = m.id;
  const div = el('div', 'msg ' + (m.self ? 'self' : 'other'));
  if (m.replyData) {
    const rb = el('div', 'reply-block');
    rb.innerHTML = `<div class="reply-name">${esc(m.replyData.from)}</div><div class="reply-text">${esc((m.replyData.text || '').slice(0, 80))}</div>`;
    div.appendChild(rb);
  }
  if (m.deleted) { div.classList.add('deleted'); div.innerHTML += '<i>Сообщение удалено</i>'; }
  else {
    if (m.sticker) {
      const isVideo = /\.(mp4|webm)(\?|$)/i.test(m.sticker);
      if (isVideo) { const v = el('video', 'sticker-video'); Object.assign(v, { src: m.sticker, autoplay: true, loop: true, muted: true, playsInline: true }); div.appendChild(v); }
      else { const img = el('img', 'sticker-img'); img.src = m.sticker; div.appendChild(img); }
    } else if (m.image) { const img = el('img', 'photo'); img.src = m.image; div.appendChild(img); }
    if (m.text) { const sp = el('span', 'msg-text', highlightMentions(m.text)); div.appendChild(sp); }
  }
  const meta = el('span', 'meta', m.time ? fmtT(m.time) : '');
  div.appendChild(meta); wrap.appendChild(div); box.appendChild(wrap);
}
function sendBotMessage() {
  const inp = $('bot-msg-input'); const text = (inp?.value || '').trim();
  if (!text || !state.botChatCurrent) return;
  api('bot send message', { botUsername: state.botChatCurrent.botUsername, chatKey: state.botChatCurrent.chatKey, text, replyTo: state.botReplyTo?.id || null }, res => {
    if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
    inp.value = ''; cancelBotReply();
  });
}
function cancelBotReply() { state.botReplyTo = null; const rp = $('bot-chat-reply-preview'); if (rp) rp.style.display = 'none'; }
function openBotGiftPicker() {
  if (!state.botChatCurrent || state.botChatCurrent.chatType !== 'private') return toast('🎁 Подарки только в личных чатах');
  const grid = $('bot-gift-grid'); if (!grid) return;
  grid.innerHTML = '';
  Object.entries(state.giftsCatalog).forEach(([key, gift]) => {
    const d = el('div', 'gift-card affordable');
    d.innerHTML = `<span class="gift-emoji">${gift.emoji}</span><span class="gift-name">${esc(gift.name)}</span><span class="gift-price">${gift.price} ⭐</span>`;
    d.onclick = () => sendBotGift(key, gift);
    grid.appendChild(d);
  });
  $('bot-gift-target').textContent = 'Кому: ' + state.botChatCurrent.displayName + ' (от @' + state.botChatCurrent.botUsername + ')';
  openModal('bot-gift-modal');
}
function sendBotGift(key, gift) {
  const msg = prompt('Добавить пожелание от бота? (необязательно)') || null;
  api('bot send gift', { botUsername: state.botChatCurrent.botUsername, chatKey: state.botChatCurrent.chatKey, giftKey: key, message: msg }, res => {
    closeModal('bot-gift-modal');
    if (!res?.ok) return toast('❌ ' + (res?.error || 'Ошибка'));
    toast('🎁 Подарок отправлен от @' + state.botChatCurrent.botUsername);
  });
}

/* ─── 22. КОНТАКТЫ ─── */
function renderContactsTab() {
  const box = $('contacts-list'); if (!box) return;
  const q = ($('contacts-search')?.value || '').trim().toLowerCase();
  const list = state.contacts.filter(c => !q || (c.displayName || '').toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = `<div class="tab-empty"><div class="big">👥</div>${q ? 'Ничего не найдено' : 'Пока нет контактов'}<br><br><button style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:14px;font-weight:600;" onclick="openAddContactModal()">➕ Добавить контакт</button></div>`;
    return;
  }
  list.forEach(c => {
    const div = el('div', 'chat-item' + (c.premium ? ' premium-user' : ''));
    let avHtml;
    if (c.avatarVideo) avHtml = `<div class="avatar${c.isBot ? ' bot' : ''}${c.premium ? ' premium' : ''}"><video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${c.avatarVideo}"></video>${c.online ? '<span class="online-dot"></span>' : ''}</div>`;
    else {
      const style = c.avatar ? `background-image:url(${c.avatar})` : (c.isBot ? 'background:linear-gradient(135deg,#06b6d4,#0891b2)' : 'background:var(--accent)');
      const content = c.avatar ? '' : (c.isBot ? (c.emojiStatus || '🤖') : initials(c.displayName || c.name));
      avHtml = `<div class="avatar${c.isBot ? ' bot' : ''}${c.premium ? ' premium' : ''}" style="${style}">${content}${c.online ? '<span class="online-dot"></span>' : ''}</div>`;
    }
    div.innerHTML = avHtml + `<div class="chat-info"><div class="chat-name">${esc(c.displayName || c.name)}${c.isBot ? ' <span class="bot-mark">бот</span>' : ''}${renderBadges(c)}</div><div class="chat-preview">@${esc(c.name)}</div></div>`;
    div.onclick = () => { switchTab('chats'); openChat(c.name); };
    box.appendChild(div); attachRipple(div);
  });
}

/* ─── 23. СПИСОК ЧАТОВ ─── */
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

  if (state.channels.length) {
    box.appendChild(el('div', 'section-header', '📢 Каналы'));
    state.channels.forEach(ch => box.appendChild(renderChannelItem(ch)));
  }
  if (activeGroups.length) {
    box.appendChild(el('div', 'section-header', state.showArchived ? 'Архив: группы' : 'Группы'));
    activeGroups.forEach(g => box.appendChild(renderGroupItem(g)));
  }
  if (activeContacts.length) {
    box.appendChild(el('div', 'section-header', state.showArchived ? 'Архив: личные' : 'Личные чаты'));
    activeContacts.forEach(u => box.appendChild(renderContactItem(u)));
  }
  if (!activeContacts.length && !activeGroups.length && !state.channels.length) {
    const empty = el('div', 'empty-state');
    empty.innerHTML = state.showArchived
      ? '<div class="big">📦</div>Архив пуст<br><br><button style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:14px;font-weight:600;" onclick="toggleArchiveView()">← Назад</button>'
      : '<div class="big">👋</div>Пока никого нет.<br>Нажми <b>＋</b> и добавь друга, бота или создай канал.';
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
function toggleArchiveView() { state.showArchived = !state.showArchived; renderChatList(); }
function renderGroupItem(g) {
  const div = el('div');
  const key = 'g:' + g.id, unread = state.unread[key] || 0;
  div.className = 'chat-item' + (state.currentGroup?.id === g.id ? ' active' : '') + (g.pinned ? ' pinned' : '');
  const avatar = g.avatar ? `<div class="avatar" style="background-image:url(${g.avatar})"></div>` : '<div class="avatar group">👥</div>';
  const word = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  div.innerHTML = `${avatar}<div class="chat-info"><div class="chat-name">${esc(g.name)} ${g.pinned ? '<span class="pin-mark">📌</span>' : ''}${g.muted ? '<span class="chat-mute-icon">🔕</span>' : ''}</div><div class="chat-preview">${g.memberCount} участник${word}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
  div.onclick = () => openGroupChat(g); attachRipple(div);
  return div;
}
function renderContactItem(u) {
  const div = el('div');
  const unread = state.unread[u.name] || 0;
  div.className = 'chat-item' + (state.currentChat === u.name ? ' active' : '') + (u.pinned ? ' pinned' : '') + (u.premium ? ' premium-user' : '');
  let avHtml;
  if (u.avatarVideo) avHtml = `<div class="avatar${u.isBot ? ' bot' : ''}${u.premium ? ' premium' : ''}"><video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${u.avatarVideo}"></video>${u.online ? '<span class="online-dot"></span>' : ''}</div>`;
  else {
    const style = u.avatar ? `background-image:url(${u.avatar})` : (u.isBot ? 'background:linear-gradient(135deg,#06b6d4,#0891b2)' : 'background:var(--accent)');
    const content = u.avatar ? '' : (u.isBot ? (u.emojiStatus || '🤖') : initials(u.displayName || u.name));
    avHtml = `<div class="avatar${u.isBot ? ' bot' : ''}${u.premium ? ' premium' : ''}" style="${style}">${content}${u.online ? '<span class="online-dot"></span>' : ''}</div>`;
  }
  const isTyping = !!state.typingUsers[u.name];
  const preview = isTyping ? '<span class="typing">печатает…</span>' : (unread > 0 ? 'новое сообщение' : (u.online ? (u.isBot ? 'бот онлайн' : 'в сети') : 'был(а) недавно'));
  div.innerHTML = `${avHtml}<div class="chat-info"><div class="chat-name">${u.blocked ? '🚫 ' : ''}${esc(u.displayName || u.name)}${u.isBot ? ' <span class="bot-mark">бот</span>' : ''}${u.emojiStatus && !u.isBot ? ' ' + u.emojiStatus : ''}${renderBadges(u)} ${u.pinned ? '<span class="pin-mark">📌</span>' : ''}${u.muted ? '<span class="chat-mute-icon">🔕</span>' : ''}</div><div class="chat-preview">${preview}</div></div><div class="chat-meta">${unread > 0 ? `<div class="chat-badge">${unread}</div>` : ''}</div>`;
  div.onclick = () => openChat(u.name); attachRipple(div);
  return div;
}
function filterContacts() { renderChatList(); }

function saveUnread() { jset(STORAGE.UNREAD, state.unread); }
function clearUnread(key) { if (state.unread[key]) { delete state.unread[key]; saveUnread(); updateTitle(); renderChatList(); } }

/* ─── 24. ОТКРЫТИЕ ЧАТОВ ─── */
function openChat(name) {
  state.currentChat = name; state.currentGroup = null; state.currentChannel = null; state.isSavedChat = false;
  const contact = state.contacts.find(c => c.name === name);
  state.isBotChat = !!contact?.isBot; state.currentBot = null;
  clearUnread(name);
  state.lastDateShown = ''; state.pinnedMessageId = null;
  $('pinned-bar')?.classList.remove('active');

  const display = contact?.displayName || name;
  const botMark = state.isBotChat ? ' <span class="bot-mark">бот</span>' : '';
  $('chat-top-name').innerHTML = esc(display) + botMark + ' ' + renderBadgesBig(contact || {});
  const ts = $('chat-top-status');
  if (ts) { ts.textContent = contact?.online ? (state.isBotChat ? 'бот онлайн' : 'в сети') : 'был(а) недавно'; ts.classList.remove('typing'); }

  const av = $('chat-avatar');
  if (av) {
    av.classList.toggle('premium', !!contact?.premium);
    if (contact?.avatarVideo) { av.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${contact.avatarVideo}"></video>`; av.style.backgroundImage = ''; av.classList.remove('group','saved','bot'); }
    else if (contact?.avatar) { av.innerHTML = ''; av.style.backgroundImage = `url(${contact.avatar})`; av.classList.remove('group','saved'); av.classList.toggle('bot', state.isBotChat); }
    else if (state.isBotChat) { av.innerHTML = (contact?.emojiStatus || '🤖'); av.style.backgroundImage = ''; av.style.background = ''; av.classList.add('bot'); av.classList.remove('group','saved'); }
    else { av.innerHTML = initials(display); av.style.backgroundImage = ''; av.style.background = 'var(--accent)'; av.classList.remove('group','saved','bot'); }
  }
  $('chat-actions').style.display = 'flex';
  $('callBtn1').style.display = state.isBotChat ? 'none' : 'block';
  $('callBtn2').style.display = state.isBotChat ? 'none' : 'block';
  $('chat-top-info').onclick = () => openContactProfile(name);

  if (state.isBotChat) api('find bot', { username: name }, res => { if (res?.ok && res.bot.commands.length > 0) renderBotCommandsHint(res.bot.commands); else removeBotCommandsHint(); });
  else removeBotCommandsHint();

  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load history', { withUser: name });
  setTimeout(() => api('mark read', { withUser: name }), 300);
  renderChatList(); updateTopStatusTyping(); bindScrollDown();
  closeStickersPanel(); applyChatWallpaper(); bindRipples($('chat-screen')); applyMuteLock();
}
function renderBotCommandsHint(commands) {
  removeBotCommandsHint();
  const inputArea = $('input-area'); if (!inputArea) return;
  const hint = el('div', 'bot-commands-hint'); hint.id = 'bot-commands-hint';
  commands.slice(0, 8).forEach(c => {
    const chip = el('button', 'bch-chip', c.trigger);
    chip.onclick = () => { $('msgInput').value = c.trigger; sendMsg(); };
    hint.appendChild(chip);
  });
  inputArea.parentNode.insertBefore(hint, inputArea); bindRipples(hint);
}
function removeBotCommandsHint() { $('bot-commands-hint')?.remove(); }

function openSavedChat() {
  state.currentChat = null; state.currentGroup = null; state.currentChannel = null;
  state.isSavedChat = true; state.isBotChat = false; state.currentBot = null;
  removeBotCommandsHint(); clearUnread('__saved__');
  state.lastDateShown = ''; state.pinnedMessageId = null;
  $('pinned-bar')?.classList.remove('active');
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые сообщения';
  const av = $('chat-avatar');
  if (av) { av.innerHTML = '⭐'; av.style.backgroundImage = ''; av.style.background = ''; av.classList.add('saved'); av.classList.remove('group','bot','premium'); }
  $('chat-actions').style.display = 'none';
  $('chat-top-info').onclick = null;
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load saved history');
  renderChatList(); bindScrollDown(); closeStickersPanel(); applyChatWallpaper(); applyMuteLock();
}

function openGroupChat(g) {
  state.currentGroup = g; state.currentChat = null; state.currentChannel = null;
  state.isSavedChat = false; state.isBotChat = false; state.currentBot = null;
  removeBotCommandsHint(); clearUnread('g:' + g.id);
  state.lastDateShown = ''; state.pinnedMessageId = g.pinnedMessageId || null;
  $('chat-top-name').textContent = g.name;
  const word = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  const ts = $('chat-top-status');
  if (ts) { ts.textContent = `${g.memberCount} участник${word}`; ts.classList.remove('typing'); }
  const av = $('chat-avatar');
  if (av) {
    av.classList.remove('premium');
    if (g.avatar) { av.innerHTML = ''; av.style.backgroundImage = `url(${g.avatar})`; av.classList.add('group'); av.classList.remove('saved','bot'); }
    else { av.innerHTML = '👥'; av.style.backgroundImage = ''; av.style.background = ''; av.classList.add('group'); av.classList.remove('saved','bot'); }
  }
  $('chat-actions').style.display = 'flex';
  $('callBtn1').style.display = 'none';
  $('callBtn2').style.display = 'none';
  $('chat-top-info').onclick = openGroupInfo;
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  api('load group history', { groupId: g.id });
  const pb = $('pinned-bar');
  if (pb) { if (state.pinnedMessageId) { pb.classList.add('active'); $('pinned-text').textContent = 'Закреплённое сообщение'; } else pb.classList.remove('active'); }
  renderChatList(); bindScrollDown(); closeStickersPanel(); applyChatWallpaper(); applyMuteLock();
}
function closeChat() {
  if (state.currentChat) api('typing', { to: state.currentChat, isTyping: false });
  if (state.currentGroup) api('group typing', { groupId: state.currentGroup.id, isTyping: false });
  clearTimeout(state.myTypingTimeout); state.myTypingTimeout = null;
  $('chat-screen').classList.remove('active');
  state.currentChat = null; state.currentGroup = null;
  state.isSavedChat = false; state.isBotChat = false; state.currentBot = null;
  if (state.isRecording) stopVoiceRecording(true);
  hideReactionMenu(); hideActionMenu(); cancelReply(); closeStickersPanel(); removeBotCommandsHint();
  renderChatList();
}

/* ─── 25. СКРОЛЛ ─── */
let scrollDownBound = false;
function bindScrollDown() {
  const box = $('messages'); if (!box || scrollDownBound) return;
  scrollDownBound = true;
  box.addEventListener('scroll', updateScrollDownBtn, { passive: true });
}
function updateScrollDownBtn() {
  const box = $('messages'), btn = $('scroll-down-btn'); if (!box || !btn) return;
  const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
  if (dist > 200) btn.classList.add('show');
  else { btn.classList.remove('show'); $('scroll-down-badge').style.display = 'none'; }
}
function scrollToBottom() {
  const box = $('messages'); if (!box) return;
  box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  $('scroll-down-badge').style.display = 'none';
}

/* ─── 26. УПОМИНАНИЯ / СПОЙЛЕР ─── */
function highlightMentions(text) {
  if (!text) return '';
  return esc(text).replace(/@([a-z0-9_]{3,20})/gi, (_, u) => `<span class="mention">@${u}</span>`);
}
function toggleSpoilerMode() {
  state.spoilerMode = !state.spoilerMode;
  $('spoilerBtn')?.classList.toggle('active', state.spoilerMode);
  $('msgInput')?.classList.toggle('spoiler-mode', state.spoilerMode);
  vib(15);
  toast(state.spoilerMode ? '👁 Спойлер включён' : '👁 Спойлер выключен');
}
function renderSpoilerText(html) {
  const span = el('span', 'spoiler-text');
  span.dataset.revealed = '0';
  span.innerHTML = html;
  span.onclick = e => { e.stopPropagation(); const r = span.dataset.revealed === '1'; span.dataset.revealed = r ? '0' : '1'; span.classList.toggle('revealed', !r); vib(10); };
  return span;
}

/* ─── 27. РЕНДЕР СООБЩЕНИЯ ─── */
function renderMessage(msg) {
  const box = $('messages'); if (!box) return;
  if (msg.time) {
    const d = new Date(msg.time), key = d.toDateString();
    if (key !== state.lastDateShown) {
      state.lastDateShown = key;
      const dd = el('div', 'date-divider');
      dd.innerHTML = `<span>${d.toDateString() === new Date().toDateString() ? 'Сегодня' : d.toDateString() === new Date(Date.now()-864e5).toDateString() ? 'Вчера' : d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' })}</span>`;
      box.appendChild(dd);
    }
  }
  const wrap = el('div', 'msg-wrap ' + (msg.self ? 'self' : 'other'));
  wrap.dataset.id = msg.id;
  if (msg.isGroup) wrap.dataset.group = '1';
  if (msg.from) wrap.dataset.from = msg.from;
  if (!msg.self && msg.from) { const c = state.contacts.find(x => x.name === msg.from); if (c?.premium) wrap.classList.add('from-premium'); }
  if (msg.isGroup && !msg.self && msg.senderName) wrap.appendChild(el('div', 'msg-sender', esc(msg.senderName)));

  const div = el('div', 'msg ' + (msg.self ? 'self' : 'other'));
  if (msg.system) {
    div.className = 'msg system'; div.innerHTML = esc(msg.text || '');
    wrap.appendChild(div); box.appendChild(wrap); box.scrollTop = box.scrollHeight; return;
  }
  if (msg.replyData && !msg.deleted) {
    const rb = el('div', 'reply-block');
    rb.onclick = e => { e.stopPropagation(); scrollToMessage(msg.replyData.id); };
    const replyName = msg.replyData.from === state.me.username ? 'Я' : displayName(msg.replyData.from);
    const replyText = msg.replyData.deleted ? 'Сообщение удалено' : (msg.replyData.text || (msg.replyData.image ? '📷 Фото' : (msg.replyData.voice ? '🎤 Голосовое' : '')));
    rb.innerHTML = `<div class="reply-name">${esc(replyName)}</div><div class="reply-text">${esc(replyText)}</div>`;
    div.appendChild(rb);
  }
  if (msg.deleted) { div.classList.add('deleted'); div.innerHTML += '<i>Сообщение удалено</i>'; }
  else {
    if (msg.sticker) {
      const isVideo = /\.(mp4|webm)(\?|$)/i.test(msg.sticker);
      if (isVideo) { const v = el('video', 'sticker-video'); Object.assign(v, { src: msg.sticker, autoplay: true, loop: true, muted: true, playsInline: true }); v.onclick = e => e.stopPropagation(); div.appendChild(v); }
      else { const img = el('img', 'sticker-img'); img.src = msg.sticker; img.onclick = e => e.stopPropagation(); div.appendChild(img); }
    } else if (msg.image) {
      const img = el('img', 'photo'); img.src = msg.image;
      img.onclick = e => { e.stopPropagation(); openLightbox(msg.image); };
      div.appendChild(img);
    }
    if (msg.videoCircle) {
      const vw = el('div', 'video-circle-wrap');
      const v = el('video', 'video-circle'); Object.assign(v, { src: msg.videoCircle, playsInline: true, loop: true });
      const ov = el('div', 'video-play-overlay', '▶');
      vw.append(v, ov);
      let playing = false;
      vw.onclick = e => {
        e.stopPropagation();
        if (playing) { v.pause(); playing = false; vw.classList.remove('playing'); }
        else { document.querySelectorAll('video').forEach(x => { if (x !== v) x.pause(); }); v.play().then(() => { playing = true; vw.classList.add('playing'); }).catch(() => {}); }
      };
      v.onended = () => { playing = false; vw.classList.remove('playing'); };
      div.appendChild(vw);
    }
    if (msg.voice) {
      const vw = el('div', 'voice-msg');
      const pb = el('button', 'voice-play', '▶');
      const wave = el('div', 'voice-wave');
      for (let i = 0; i < 30; i++) { const b = el('span'); b.style.height = (4 + Math.random()*16) + 'px'; wave.appendChild(b); }
      const durEl = el('span', 'voice-duration');
      const d = msg.voiceDuration || 0;
      durEl.textContent = Math.floor(d/60) + ':' + (d%60).toString().padStart(2, '0');
      vw.append(pb, wave, durEl); div.appendChild(vw);
      const audio = new Audio(msg.voice); audio.preload = 'metadata';
      let playing = false;
      pb.onclick = e => {
        e.stopPropagation();
        if (playing) { audio.pause(); audio.currentTime = 0; playing = false; pb.textContent = '▶'; vw.classList.remove('playing'); }
        else { document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); }); audio.play().then(() => { playing = true; pb.textContent = '⏸'; vw.classList.add('playing'); }).catch(() => {}); }
      };
      audio.onended = () => { playing = false; pb.textContent = '▶'; vw.classList.remove('playing'); };
    }
    if (msg.geo) { const gb = renderGeoBlock(msg.geo); if (gb) div.appendChild(gb); }
    if (msg.text) {
      if (msg.text.indexOf('🎁 Подарок: ') === 0) {
        let body = msg.text.slice(11), userMsg = null;
        const nl = body.indexOf('\n💬 ');
        if (nl !== -1) { userMsg = body.slice(nl+4); body = body.slice(0, nl); }
        const [emoji, ...rest] = body.split(' ');
        const name = rest.join(' ');
        const gd = el('div', 'gift-message-block');
        let html = `<div class="gift-emoji-big">${emoji}</div><div class="gift-name-big">${esc(name)}</div><div class="gift-label">🎁 ПОДАРОК</div>`;
        if (userMsg) html += `<div class="gift-user-msg">💬 ${esc(userMsg)}</div>`;
        gd.innerHTML = html;
        div.appendChild(gd);
      } else if (msg.spoiler) {
        const sp = el('span', 'msg-text');
        sp.appendChild(renderSpoilerText(highlightMentions(msg.text)));
        div.appendChild(sp);
      } else {
        const span = el('span', 'msg-text', highlightMentions(msg.text));
        div.appendChild(span);
      }
    }
  }
  const meta = el('span', 'meta');
  let mhtml = '';
  if (msg.edited) mhtml += '<span class="edited">изм. </span>';
  mhtml += msg.time ? fmtT(msg.time) : '';
  if (msg.self && !msg.isGroup) mhtml += ` <span class="check${msg.read ? ' read' : ''}">✓✓</span>`;
  meta.innerHTML = mhtml;
  div.appendChild(meta);

  let pressTimer = null;
  div.addEventListener('touchstart', e => { pressTimer = setTimeout(() => showReactionMenu(e, msg.id, wrap, !!msg.isGroup), 500); }, { passive: true });
  const cancel = () => { clearTimeout(pressTimer); };
  div.addEventListener('touchend', cancel); div.addEventListener('touchmove', cancel);
  div.addEventListener('mousedown', e => { pressTimer = setTimeout(() => showReactionMenu(e, msg.id, wrap, !!msg.isGroup), 500); });
  div.addEventListener('mouseup', cancel); div.addEventListener('mouseleave', cancel);
  div.addEventListener('contextmenu', e => { e.preventDefault(); showActionMenu(e, msg); });

  bindSwipeReply(div, wrap, msg);
  wrap.appendChild(div);
  renderReactionsInto(wrap, msg.reactions, !!msg.isGroup);
  box.appendChild(wrap); box.scrollTop = box.scrollHeight;
  if (msg.self) { wrap.classList.add('just-sent'); setTimeout(() => wrap.classList.remove('just-sent'), 600); }
}
function scrollToMessage(id) {
  const e = document.querySelector(`.msg-wrap[data-id="${id}"]`);
  if (!e) return;
  e.scrollIntoView({ behavior: 'smooth', block: 'center' });
  e.style.background = 'rgba(139, 127, 255, 0.2)';
  setTimeout(() => e.style.background = '', 1000);
}
function scrollToPinned() { if (state.pinnedMessageId) scrollToMessage(state.pinnedMessageId); }
function renderReactionsInto(wrap, reactions, isGroup) {
  wrap.querySelector('.reactions')?.remove();
  if (!reactions || !Object.keys(reactions).length) return;
  const bar = el('div', 'reactions');
  Object.entries(reactions).forEach(([emoji, users]) => {
    if (!users?.length) return;
    const chip = el('button', 'reaction-chip' + (users.includes(state.me.username) ? ' mine' : ''));
    chip.innerHTML = `${emoji} <span>${users.length}</span>`;
    chip.onclick = e => {
      e.stopPropagation();
      const mid = parseInt(wrap.dataset.id, 10);
      if (isGroup && state.currentGroup) api('group react', { groupId: state.currentGroup.id, messageId: mid, emoji });
      else api('react', { messageId: mid, emoji });
    };
    bar.appendChild(chip);
  });
  wrap.querySelector('.msg')?.appendChild(bar);
}
function showReactionMenu(e, messageId, wrap, isGroup) {
  state.activeReactionMsgId = messageId;
  state.activeReactionGroupId = isGroup && state.currentGroup ? state.currentGroup.id : null;
  const menu = $('reaction-menu'); if (!menu) return;
  const t = e.touches?.[0] || e;
  menu.classList.add('active');
  const r = menu.getBoundingClientRect(), w = r.width || 250, h = r.height || 60;
  menu.style.left = Math.min(Math.max(t.clientX - w/2, 10), window.innerWidth - w - 10) + 'px';
  menu.style.top = Math.max(t.clientY - h - 15, 10) + 'px';
}
function hideReactionMenu() { $('reaction-menu')?.classList.remove('active'); state.activeReactionMsgId = null; state.activeReactionGroupId = null; }
function applyReaction(emoji) {
  if (state.activeReactionMsgId == null) return;
  if (state.activeReactionGroupId) api('group react', { groupId: state.activeReactionGroupId, messageId: state.activeReactionMsgId, emoji });
  else api('react', { messageId: state.activeReactionMsgId, emoji });
  hideReactionMenu();
}
function showActionMenu(e, msg) {
  if (msg.deleted) return;
  state.activeMessage = msg;
  const menu = $('action-menu'); if (!menu) return;
  const t = e.touches?.[0] || e;
  const isMine = msg.from === state.me.username;
  $('action-edit').style.display = (isMine && !msg.voice && !msg.image && !msg.videoCircle && !msg.sticker && msg.text && !msg.geo) ? 'flex' : 'none';
  $('action-delete').style.display = isMine ? 'flex' : 'none';
  $('action-pin').style.display = msg.isGroup ? 'flex' : 'none';
  $('action-report').style.display = isMine ? 'none' : 'flex';
  menu.classList.add('active');
  const r = menu.getBoundingClientRect(), w = r.width || 200, h = r.height || 280;
  menu.style.left = Math.min(Math.max(t.clientX - w/2, 10), window.innerWidth - w - 10) + 'px';
  menu.style.top = Math.min(Math.max(t.clientY, 10), window.innerHeight - h - 10) + 'px';
  hideReactionMenu();
}
function hideActionMenu() { $('action-menu')?.classList.remove('active'); state.activeMessage = null; }
function actionReply() {
  if (!state.activeMessage) return;
  state.replyToMessage = state.activeMessage;
  const m = state.activeMessage;
  $('rp-name').textContent = m.self ? 'Я' : displayName(m.from);
  $('rp-msg').textContent = m.text || (m.sticker ? 'Стикер' : (m.image ? '📷 Фото' : (m.voice ? '🎤 Голосовое' : (m.videoCircle ? '🎥 Кружок' : (m.geo ? '📍 Геолокация' : '')))));
  $('reply-preview').classList.add('active');
  $('msgInput').focus(); hideActionMenu();
}
function cancelReply() { state.replyToMessage = null; $('reply-preview')?.classList.remove('active'); }
function actionCopy() { if (!state.activeMessage?.text) return hideActionMenu(); navigator.clipboard.writeText(state.activeMessage.text).catch(() => {}); toast('📋 Скопировано'); hideActionMenu(); }
function actionSave() { if (!state.activeMessage) return; api('save to saved', { originalMessageId: state.activeMessage.id, isGroup: !!state.activeMessage.isGroup }, res => { if (res?.ok) { if (state.isSavedChat) api('load saved history'); toast('⭐ Сохранено'); } }); hideActionMenu(); }
function actionEdit() { if (!state.activeMessage) return; state.editingMessageId = state.activeMessage.id; $('edit-message-text').value = state.activeMessage.text || ''; hideActionMenu(); openModal('edit-message-modal'); }
function doEditMessage() {
  const text = ($('edit-message-text')?.value || '').trim();
  if (!text || !state.editingMessageId) return;
  api('edit message', { messageId: state.editingMessageId, text, isGroup: !!state.currentGroup }, res => { if (res?.ok) closeModal('edit-message-modal'); state.editingMessageId = null; });
}
function actionDelete() {
  if (!state.activeMessage) return;
  const isGroup = !!state.currentGroup, isMine = state.activeMessage.from === state.me.username;
  if (!confirm(isGroup && isMine ? 'Удалить для всех?' : 'Удалить сообщение?')) return;
  api('delete message', { messageId: state.activeMessage.id, forAll: true, isGroup });
  hideActionMenu();
}
function actionPin() {
  if (!state.activeMessage || !state.currentGroup) return;
  api('pin message', { groupId: state.currentGroup.id, messageId: state.activeMessage.id }, () => {
    state.pinnedMessageId = state.activeMessage.id;
    $('pinned-bar').classList.add('active');
    $('pinned-text').textContent = 'Закреплённое сообщение';
    hideActionMenu();
  });
}
function actionReport() { if (!state.activeMessage) return; openReportModal(state.activeMessage.from, state.activeMessage.id, !!state.activeMessage.isGroup); }

document.addEventListener('click', e => {
  const rm = $('reaction-menu'); if (rm?.classList.contains('active') && !rm.contains(e.target)) hideReactionMenu();
  const am = $('action-menu'); if (am?.classList.contains('active') && !am.contains(e.target)) hideActionMenu();
});

/* ─── 28. СВАЙП-ОТВЕТ ─── */
function bindSwipeReply(msgDiv, wrap, msg) {
  if (msg.deleted || msg.system) return;
  const icon = el('div', 'swipe-reply-icon', '↩');
  wrap.appendChild(icon);
  let sx = 0, sy = 0, cx = 0, dragging = false, locked = false;
  const isSelf = msg.self;
  const start = (x, y) => { sx = x; sy = y; cx = 0; dragging = true; locked = false; wrap.classList.remove('swipe-ready'); };
  const move = (x, y) => {
    if (!dragging) return;
    const dx = x - sx, dy = y - sy;
    if (!locked) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { dragging = false; wrap.style.transform = ''; wrap.classList.remove('swiping','swipe-active','swipe-ready'); return; }
      if (Math.abs(dx) > 8) { locked = true; wrap.classList.add('swiping'); } else return;
    }
    let d = dx;
    if ((isSelf && d > 0) || (!isSelf && d < 0)) d = 0;
    if (Math.abs(d) > 90) d = d > 0 ? 90 : -90;
    cx = d;
    wrap.style.transform = `translateX(${d}px)`;
    if (Math.abs(d) > 5) wrap.classList.add('swipe-active');
    wrap.classList.toggle('swipe-ready', Math.abs(d) >= SWIPE_THRESHOLD);
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(cx) >= SWIPE_THRESHOLD) triggerReplyFromSwipe(msg);
    wrap.style.transform = ''; wrap.classList.remove('swiping','swipe-active','swipe-ready'); locked = false;
  };
  msgDiv.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  msgDiv.addEventListener('touchmove', e => { if (dragging && e.touches.length === 1) { move(e.touches[0].clientX, e.touches[0].clientY); if (locked) e.preventDefault(); } }, { passive: false });
  msgDiv.addEventListener('touchend', end); msgDiv.addEventListener('touchcancel', end);
  msgDiv.addEventListener('mousedown', e => { if (e.button === 0) start(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { if (dragging) move(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (dragging) end(); });
}
function triggerReplyFromSwipe(msg) {
  if (!msg) return;
  state.replyToMessage = { id: msg.id, from: msg.from, text: msg.text, image: msg.image, voice: msg.voice, videoCircle: msg.videoCircle, sticker: msg.sticker, self: msg.self, isGroup: msg.isGroup, geo: msg.geo };
  $('rp-name').textContent = msg.self ? 'Я' : displayName(msg.from);
  $('rp-msg').textContent = msg.text || (msg.sticker ? 'Стикер' : (msg.image ? '📷 Фото' : (msg.voice ? '🎤 Голосовое' : (msg.videoCircle ? '🎥 Кружок' : (msg.geo ? '📍 Геолокация' : '')))));
  $('reply-preview').classList.add('active');
  $('msgInput').focus(); vib(15);
}

/* ─── 29. ДВОЙНОЙ ТАП ❤️ ─── */
(function initDoubleTap() {
  let lastTap = 0, lastId = null;
  document.addEventListener('click', e => {
    const m = e.target.closest('.msg'); if (!m) return;
    const w = m.closest('.msg-wrap'); if (!w) return;
    const id = parseInt(w.dataset.id, 10), isGroup = w.dataset.group === '1', t = Date.now();
    if (lastId === id && t - lastTap < 300) {
      if (isGroup && state.currentGroup) api('group react', { groupId: state.currentGroup.id, messageId: id, emoji: '❤️' });
      else api('react', { messageId: id, emoji: '❤️' });
      const h = el('div', 'quick-react-heart', '❤️');
      w.style.position = 'relative'; w.appendChild(h);
      setTimeout(() => h.remove(), 1000);
      vib([30,20,30]);
      lastId = null; lastTap = 0; e.stopPropagation(); return;
    }
    lastId = id; lastTap = t;
  });
})();

/* ─── 30. ОТПРАВКА ─── */
function sendMsg() {
  const input = $('msgInput'); if (!input) return;
  const text = input.value.trim(); if (!text) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  const spoiler = !!state.spoilerMode, replyId = state.replyToMessage?.id || null;
  if (state.isSavedChat) api('private message', { to: state.me.username, text, spoiler });
  else if (state.currentChat) { api('private message', { to: state.currentChat, text, replyTo: replyId, spoiler }); api('typing', { to: state.currentChat, isTyping: false }); }
  else if (state.currentGroup) { api('group message', { groupId: state.currentGroup.id, text, replyTo: replyId, spoiler }); api('group typing', { groupId: state.currentGroup.id, isTyping: false }); }
  else return;
  input.value = ''; cancelReply();
  clearTimeout(state.myTypingTimeout); state.myTypingTimeout = null;
  if (state.spoilerMode) { state.spoilerMode = false; $('spoilerBtn').classList.remove('active'); input.classList.remove('spoiler-mode'); }
}
function onInputTyping() {
  if (state.currentChat) api('typing', { to: state.currentChat, isTyping: true });
  else if (state.currentGroup) api('group typing', { groupId: state.currentGroup.id, isTyping: true });
  else return;
  clearTimeout(state.myTypingTimeout);
  state.myTypingTimeout = setTimeout(() => {
    if (state.currentChat) api('typing', { to: state.currentChat, isTyping: false });
    else if (state.currentGroup) api('group typing', { groupId: state.currentGroup.id, isTyping: false });
    state.myTypingTimeout = null;
  }, 2000);
}
function updateTopStatusTyping() {
  if (state.currentGroup || state.isSavedChat) return;
  const el = $('chat-top-status'); if (!el || !state.currentChat) return;
  if (state.typingUsers[state.currentChat]) { el.textContent = 'печатает…'; el.classList.add('typing'); }
  else {
    const c = state.contacts.find(x => x.name === state.currentChat);
    el.textContent = state.isBotChat ? 'бот онлайн' : (c?.online ? 'в сети' : 'был(а) недавно');
    el.classList.remove('typing');
  }
}
function sendPhoto(ev) {
  const file = ev.target.files[0]; if (!file) return;
  if (state.me.mute) { toast('🔇 Ты в муте'); ev.target.value = ''; return; }
  const replyId = state.replyToMessage?.id || null;
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const max = 800; let w = img.width, h = img.height;
      if (w > h && w > max) { h = h * max / w; w = max; } else if (h > max) { w = w * max / h; h = max; }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL('image/jpeg', 0.75);
      if (state.isSavedChat) api('private message', { to: state.me.username, image: dataUrl });
      else if (state.currentChat) api('private message', { to: state.currentChat, image: dataUrl, replyTo: replyId });
      else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, image: dataUrl, replyTo: replyId });
      ev.target.value = ''; cancelReply();
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}
function getBestAudioMime() {
  const c = ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return c.find(m => MediaRecorder.isTypeSupported(m)) || '';
}
async function toggleVoiceRecording() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  if (state.isRecording) return stopVoiceRecording(true);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = []; state.currentAudioMime = getBestAudioMime();
    state.mediaRecorder = state.currentAudioMime ? new MediaRecorder(stream, { mimeType: state.currentAudioMime }) : new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.audioChunks.push(e.data); };
    state.mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      clearInterval(state.recordingTimer);
      const duration = Math.round((now() - state.recordingStartTime) / 1000);
      $('recording-bar')?.classList.remove('active');
      $('micBtnInput')?.classList.remove('recording');
      if (state.cancelledRecording) { state.cancelledRecording = false; state.audioChunks = []; state.isRecording = false; return; }
      if (!state.audioChunks.length || duration < 1) { state.isRecording = false; return; }
      const mime = state.currentAudioMime || state.mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(state.audioChunks, { type: mime });
      const r = new FileReader(); const replyId = state.replyToMessage?.id || null;
      r.onload = () => {
        if (state.isSavedChat) api('private message', { to: state.me.username, voice: r.result, voiceDuration: duration });
        else if (state.currentChat) api('private message', { to: state.currentChat, voice: r.result, voiceDuration: duration, replyTo: replyId });
        else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, voice: r.result, voiceDuration: duration, replyTo: replyId });
        cancelReply();
      };
      r.readAsDataURL(blob); state.isRecording = false;
    };
    state.mediaRecorder.start();
    state.isRecording = true; state.cancelledRecording = false; state.recordingStartTime = now();
    $('recording-bar')?.classList.add('active');
    $('micBtnInput')?.classList.add('recording');
    updateRecordingTimer();
    state.recordingTimer = setInterval(() => {
      const e = Math.round((now() - state.recordingStartTime) / 1000);
      updateRecordingTimer();
      if (e >= MAX_RECORDING_SEC) stopVoiceRecording(false);
    }, 200);
  } catch (err) { alert('Нет доступа к микрофону: ' + err.message); }
}
function stopVoiceRecording(cancel) {
  if (!state.isRecording) return;
  state.cancelledRecording = !!cancel;
  if (state.mediaRecorder?.state !== 'inactive') state.mediaRecorder.stop();
  state.isRecording = false;
  clearInterval(state.recordingTimer);
  $('recording-bar')?.classList.remove('active');
  $('micBtnInput')?.classList.remove('recording');
}
function updateRecordingTimer() {
  const e = Math.round((now() - state.recordingStartTime) / 1000);
  $('recording-time').textContent = Math.floor(e/60) + ':' + (e%60).toString().padStart(2, '0');
}
function getBestVideoMime() {
  const c = ['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return c.find(m => MediaRecorder.isTypeSupported(m)) || '';
}
async function startCircleRecording() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  try { state.circleStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user', width:{ideal:480}, height:{ideal:480} }, audio: true }); }
  catch (err) { return alert('Нет доступа к камере: ' + err.message); }
  const preview = $('circle-video-preview'); if (!preview) return;
  preview.srcObject = state.circleStream; preview.muted = true;
  $('circle-preview').classList.add('active');
  state.circleChunks = []; state.circleMime = getBestVideoMime();
  state.circleRecorder = state.circleMime ? new MediaRecorder(state.circleStream, { mimeType: state.circleMime }) : new MediaRecorder(state.circleStream);
  state.circleRecorder.ondataavailable = e => { if (e.data.size > 0) state.circleChunks.push(e.data); };
  state.circleRecorder.start(); state.circleStartTime = now(); updateCircleTimer();
  state.circleTimer = setInterval(() => {
    const e = Math.round((now() - state.circleStartTime) / 1000);
    updateCircleTimer();
    if (e >= MAX_CIRCLE_SEC) sendCircle();
  }, 200);
}
function updateCircleTimer() {
  const e = Math.round((now() - state.circleStartTime) / 1000);
  $('circle-timer').textContent = Math.floor(e/60) + ':' + (e%60).toString().padStart(2, '0');
}
function cancelCircle() { if (state.circleRecorder?.state !== 'inactive') state.circleRecorder?.stop(); cleanupCircle(); }
function sendCircle() {
  if (!state.circleRecorder) return;
  const duration = Math.round((now() - state.circleStartTime) / 1000);
  if (duration < 1) return cancelCircle();
  state.circleRecorder.addEventListener('stop', () => {
    if (!state.circleChunks.length) return cleanupCircle();
    const mime = state.circleMime || state.circleRecorder.mimeType || 'video/webm';
    const blob = new Blob(state.circleChunks, { type: mime });
    const r = new FileReader(); const replyId = state.replyToMessage?.id || null;
    r.onload = () => {
      if (state.isSavedChat) api('private message', { to: state.me.username, videoCircle: r.result, videoDuration: duration });
      else if (state.currentChat) api('private message', { to: state.currentChat, videoCircle: r.result, videoDuration: duration, replyTo: replyId });
      else if (state.currentGroup) api('group message', { groupId: state.currentGroup.id, videoCircle: r.result, videoDuration: duration, replyTo: replyId });
      cancelReply();
    };
    r.readAsDataURL(blob); cleanupCircle();
  }, { once: true });
  state.circleRecorder.stop();
}
function cleanupCircle() {
  clearInterval(state.circleTimer);
  if (state.circleStream) { state.circleStream.getTracks().forEach(t => t.stop()); state.circleStream = null; }
  $('circle-preview')?.classList.remove('active');
  if ($('circle-video-preview')) $('circle-video-preview').srcObject = null;
  state.circleRecorder = null; state.circleChunks = [];
}

/* ─── 31. СТИКЕРЫ ─── */
function pushStickerRecent(url) { state.stickerRecent = [url, ...state.stickerRecent.filter(x => x !== url)].slice(0, 30); jset(STORAGE.STICKERS, state.stickerRecent); }
function toggleStickersPanel() { const p = $('stickers-panel'); if (!p) return; if (p.classList.contains('active')) closeStickersPanel(); else openStickersPanel(); }
function openStickersPanel() {
  const p = $('stickers-panel'); if (!p) return;
  state.stickerRecent = jget(STORAGE.STICKERS, []) || [];
  p.classList.add('active');
  api('load stickers', res => { if (res?.ok) { state.stickersData = res.stickers || []; renderStickersContent(); } });
  renderStickersContent();
}
function closeStickersPanel() { $('stickers-panel')?.classList.remove('active'); }
function switchStickerTab(tab) { state.stickerCurrentTab = tab; document.querySelectorAll('.sticker-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab)); renderStickersContent(); }
function onStickerSearch() { state.stickerSearchQuery = ($('stickers-search')?.value || '').trim().toLowerCase(); renderStickersContent(); }
function renderStickersContent() {
  const box = $('stickers-content'); if (!box) return;
  const q = state.stickerSearchQuery;
  if (state.stickerCurrentTab === 'recent') {
    if (!state.stickerRecent.length) { box.innerHTML = '<div class="sticker-empty">🕐<br><br>Здесь будут стикеры,<br>которые ты недавно отправлял</div>'; return; }
    const filtered = state.stickerRecent.filter(u => !q || u.toLowerCase().includes(q));
    if (!filtered.length) { box.innerHTML = '<div class="sticker-empty">Ничего не найдено</div>'; return; }
    renderStickerGrid(box, filtered); return;
  }
  if (state.stickerCurrentTab === 'my') {
    let items = state.stickersData;
    if (q) items = items.filter(s => ((s.emoji||'').toLowerCase().includes(q)) || ((s.url||'').toLowerCase().includes(q)));
    box.innerHTML = '';
    const grid = el('div', 'sticker-grid');
    const add = el('button', 'sticker-add-btn', '+');
    add.onclick = () => { const c = confirm('OK — загрузить видео (MP4/WebM → GIF), Отмена — картинку'); $('stickerFileVideo')?.click(); if (!c) {} };
    add.onclick = () => { if (confirm('Загрузить видео (MP4/WebM → GIF)?')) $('stickerFileVideo')?.click(); else $('stickerFileImage')?.click(); };
    grid.appendChild(add);
    items.forEach(s => {
      const d = el('div', 'sticker-item');
      const isV = s.type === 'video';
      d.innerHTML = isV ? `<video src="${esc(s.url)}" autoplay loop muted playsinline></video><span class="sticker-type-badge">GIF</span>` : `<img src="${esc(s.url)}" alt="">`;
      d.innerHTML += `<button class="sticker-del" onclick="event.stopPropagation(); removeSticker(${s.id})">×</button>`;
      d.onclick = () => sendSticker(s.url, s.type);
      grid.appendChild(d);
    });
    box.appendChild(grid);
    if (!items.length) box.appendChild(el('div', 'sticker-empty', 'Пока нет своих стикеров. Нажми «+»'));
    return;
  }
  if (state.stickerCurrentTab === 'gif') {
    let items = BUILTIN_GIFS;
    if (q) items = items.filter(g => g.emoji.toLowerCase().includes(q));
    if (!items.length) { box.innerHTML = '<div class="sticker-empty">Ничего не найдено</div>'; return; }
    box.innerHTML = '';
    const grid = el('div', 'sticker-grid');
    const add = el('button', 'sticker-add-btn', '+');
    add.onclick = () => { $('gif-url-input').value = ''; $('gif-url-error').textContent = ''; openModal('gif-url-modal'); };
    grid.appendChild(add);
    items.forEach(g => {
      const d = el('div', 'sticker-item');
      const isMp4 = /\.(mp4|webm)(\?|$)/i.test(g.url);
      d.innerHTML = isMp4 ? `<video src="${esc(g.url)}" autoplay loop muted playsinline></video>` : `<img src="${esc(g.url)}" alt="">`;
      d.onclick = () => sendSticker(g.url, isMp4 ? 'video' : 'image');
      grid.appendChild(d);
    });
    box.appendChild(grid);
  }
}
function renderStickerGrid(box, urls) {
  box.innerHTML = '';
  const grid = el('div', 'sticker-grid');
  urls.forEach(url => {
    const d = el('div', 'sticker-item');
    const isMp4 = /\.(mp4|webm)(\?|$)/i.test(url);
    d.innerHTML = isMp4 ? `<video src="${esc(url)}" autoplay loop muted playsinline></video>` : `<img src="${esc(url)}" alt="">`;
    d.onclick = () => sendSticker(url, isMp4 ? 'video' : 'image');
    grid.appendChild(d);
  });
  box.appendChild(grid);
}
function sendSticker(url, type) {
  if (!url) return;
  if (state.me.mute) return toast('🔇 Ты в муте');
  let done = false;
  const cb = res => { if (done) return; done = true; if (res?.ok) { pushStickerRecent(url); closeStickersPanel(); } else alert(res?.error || 'Ошибка'); };
  if (state.isSavedChat) api('send sticker', { url, type, to: state.me.username }, cb);
  else if (state.currentChat) api('send sticker', { url, type, to: state.currentChat }, cb);
  else if (state.currentGroup) api('send sticker', { url, type, groupId: state.currentGroup.id }, cb);
}
function uploadSticker(ev, kind) {
  const file = ev.target.files[0]; if (!file) return;
  const isV = kind === 'video';
  const r = new FileReader();
  r.onload = e => {
    if (isV) {
      if (file.size / 1024 / 1024 > 4) return alert('Видео больше 4 МБ');
      api('add sticker', { data: e.target.result, type: 'video' }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); state.stickersData.unshift({ id: res.id, url: res.url, type: 'video', emoji: null, time: now() }); renderStickersContent(); });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const max = 512; let w = img.width, h = img.height;
      if (w > max || h > max) { if (w > h) { h = h * max / w; w = max; } else { w = w * max / h; h = max; } }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const isPng = /\.png$/i.test(file.name);
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9);
      api('add sticker', { data: dataUrl, type: 'image' }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); state.stickersData.unshift({ id: res.id, url: res.url, type: 'image', emoji: null, time: now() }); renderStickersContent(); });
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file); ev.target.value = '';
}
function removeSticker(id) { if (!confirm('Удалить стикер?')) return; api('delete sticker', { id }, res => { if (!res?.ok) return; state.stickersData = state.stickersData.filter(s => s.id !== id); renderStickersContent(); }); }
function submitGifUrl() {
  const url = ($('gif-url-input')?.value || '').trim(), err = $('gif-url-error');
  if (err) err.textContent = '';
  if (!url) { if (err) err.textContent = 'Введи ссылку'; return; }
  if (!/^https?:\/\//i.test(url)) { if (err) err.textContent = 'Ссылка должна начинаться с http(s)://'; return; }
  api('add sticker', { data: url, type: /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image' }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    state.stickersData.unshift({ id: res.id, url: res.url, type: res.type || 'image', emoji: null, time: now() });
    closeModal('gif-url-modal');
    if (state.stickerCurrentTab !== 'my') switchStickerTab('my'); else renderStickersContent();
  });
}

/* ─── 32. ГРУППЫ ─── */
function openCreateGroupModal() {
  if (!state.canCreateGroup) return alert('Ты уже создал группу. Максимум — одна.');
  if (!state.contacts.length) return alert('Сначала добавь контакты');
  state.createSelected.clear();
  $('group-name').value = ''; $('create-error').textContent = '';
  renderCreateMembers(); openModal('create-group-modal');
}
function renderCreateMembers() {
  const box = $('create-members'); if (!box) return;
  box.innerHTML = '';
  state.contacts.filter(c => !c.isBot).forEach(c => {
    const row = el('div', 'member-row' + (state.createSelected.has(c.name) ? ' selected' : ''));
    const style = c.avatar ? `background-image:url(${c.avatar})` : 'background:var(--accent)';
    const content = c.avatar ? '' : initials(c.displayName || c.name);
    row.innerHTML = `<div class="member-check">✓</div><div class="member-avatar" style="${style}">${content}</div><div class="member-name"><div>${esc(c.displayName || c.name)} ${renderBadges(c)}</div><div class="member-nick">@${esc(c.name)}</div></div>`;
    row.onclick = () => { state.createSelected.has(c.name) ? state.createSelected.delete(c.name) : state.createSelected.add(c.name); renderCreateMembers(); };
    box.appendChild(row);
  });
}
function doCreateGroup() {
  const name = ($('group-name')?.value || '').trim(), err = $('create-error');
  if (err) err.textContent = '';
  if (!name) { if (err) err.textContent = 'Введи название'; return; }
  if (!state.createSelected.size) { if (err) err.textContent = 'Выбери хотя бы одного'; return; }
  api('create group', { name, members: [...state.createSelected] }, res => { if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; } closeModal('create-group-modal'); toast('✓ Группа создана'); });
}
function openGroupInfo() {
  if (!state.currentGroup) return;
  const g = state.currentGroup;
  $('group-info-title').textContent = g.name;
  $('group-info-desc').textContent = g.description || '';
  const list = $('group-info-members'); if (list) {
    list.innerHTML = '';
    g.members.forEach(u => {
      const c = state.contacts.find(x => x.name === u);
      const dn = u === state.me.username ? `Я (@${state.me.username})` : `${c?.displayName || u} (@${u})`;
      const av = c?.avatar;
      const row = el('div', 'member-row');
      row.innerHTML = `<div class="member-avatar" style="${av ? `background-image:url(${av})` : 'background:var(--accent)'}">${av ? '' : initials(c?.displayName || u)}</div><div class="member-name">${esc(dn)} ${renderBadges(c || {})}</div>`;
      list.appendChild(row);
    });
  }
  const isOwner = g.creator === state.me.username;
  $('delete-group-btn').style.display = isOwner ? 'block' : 'none';
  $('edit-group-btn').style.display = isOwner ? 'block' : 'none';
  openModal('group-info-modal');
}
function openEditGroup() { if (!state.currentGroup) return; $('edit-group-name').value = state.currentGroup.name; $('edit-group-desc').value = state.currentGroup.description || ''; closeModal('group-info-modal'); openModal('edit-group-modal'); }
function doEditGroup() { if (!state.currentGroup) return; api('update group', { groupId: state.currentGroup.id, name: ($('edit-group-name')?.value || '').trim(), description: ($('edit-group-desc')?.value || '').trim() }, () => closeModal('edit-group-modal')); }
function openAddMembers() {
  closeModal('group-info-modal'); if (!state.currentGroup) return;
  state.addMembersSelected.clear(); $('add-members-error').textContent = '';
  const available = state.contacts.filter(c => !c.isBot && !state.currentGroup.members.includes(c.name));
  const box = $('add-members-list'); if (!box) return;
  box.innerHTML = '';
  if (!available.length) box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Все контакты уже в группе</div>';
  else available.forEach(c => {
    const row = el('div', 'member-row');
    const style = c.avatar ? `background-image:url(${c.avatar})` : 'background:var(--accent)';
    const content = c.avatar ? '' : initials(c.displayName || c.name);
    row.innerHTML = `<div class="member-check">✓</div><div class="member-avatar" style="${style}">${content}</div><div class="member-name"><div>${esc(c.displayName || c.name)} ${renderBadges(c)}</div><div class="member-nick">@${esc(c.name)}</div></div>`;
    row.onclick = () => { if (state.addMembersSelected.has(c.name)) state.addMembersSelected.delete(c.name); else state.addMembersSelected.add(c.name); row.classList.toggle('selected'); };
    box.appendChild(row);
  });
  openModal('add-members-modal');
}
function doAddMembers() {
  if (!state.currentGroup) return;
  const err = $('add-members-error'); if (err) err.textContent = '';
  if (!state.addMembersSelected.size) { if (err) err.textContent = 'Выбери хотя бы одного'; return; }
  api('add group members', { groupId: state.currentGroup.id, members: [...state.addMembersSelected] }, res => { if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; } closeModal('add-members-modal'); });
}
function confirmLeaveGroup() { if (!state.currentGroup) return; if (!confirm('Выйти из группы?')) return; api('leave group', { groupId: state.currentGroup.id }, () => { closeModal('group-info-modal'); closeChat(); }); }
function confirmDeleteGroup() { if (!state.currentGroup) return; if (!confirm('Удалить группу для ВСЕХ?')) return; api('delete group', { groupId: state.currentGroup.id }, res => { if (!res?.ok) return alert(res?.error || 'Не удалось'); closeModal('group-info-modal'); closeChat(); }); }

/* ─── 33. КАНАЛЫ ─── */
function openCreateChannelModal() {
  if (!state.canCreateChannel) return alert('Ты уже создал канал. Максимум — один.');
  $('channel-slug').value = ''; $('channel-name').value = ''; $('channel-desc').value = ''; $('create-channel-error').textContent = '';
  openModal('create-channel-modal');
}
function doCreateChannel() {
  const slug = ($('channel-slug')?.value || '').trim().toLowerCase().replace(/^@/, '');
  const name = ($('channel-name')?.value || '').trim();
  const description = ($('channel-desc')?.value || '').trim();
  const err = $('create-channel-error'); if (err) err.textContent = '';
  if (!slug) { if (err) err.textContent = 'Введи ID канала'; return; }
  if (!name) { if (err) err.textContent = 'Введи название'; return; }
  api('create channel', { slug, name, description }, res => { if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; } closeModal('create-channel-modal'); toast('📢 Канал создан!'); });
}
function openChannelChat(ch) {
  state.currentChannel = ch; state.currentChat = null; state.currentGroup = null;
  state.isSavedChat = false; state.isBotChat = false;
  removeBotCommandsHint();
  $('channel-top-name').innerHTML = esc(ch.name) + (ch.verified ? ' <span class="verified-badge big">✓</span>' : '');
  $('channel-top-status').textContent = `@${ch.slug} · ${ch.memberCount} подписчиков`;
  const av = $('channel-avatar');
  if (av) { if (ch.avatar) { av.style.backgroundImage = `url(${ch.avatar})`; av.textContent = ''; } else { av.style.backgroundImage = ''; av.textContent = '📢'; av.style.background = ''; } }
  $('channel-screen').style.display = 'flex';
  api('load channel posts', { channelId: ch.id }, res => {
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = '';
    if (!res?.ok) { box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Не удалось загрузить</div>'; return; }
    if (!res.posts.length) box.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:15px;">Пока нет публикаций</div>';
    else res.posts.forEach(p => renderChannelPost(p));
  });
  $('channel-input-area').style.display = ch.creator === state.me.username ? 'flex' : 'none';
}
function closeChannelChat() { $('channel-screen').style.display = 'none'; state.currentChannel = null; }
function renderChannelPost(p) {
  const box = $('channel-posts'); if (!box) return;
  const wrap = el('div');
  wrap.style.cssText = 'margin-bottom:18px;padding:14px;background:var(--bg-panel);border-radius:14px;border:1px solid rgba(255,255,255,0.05);';
  let html = '';
  if (p.from_user !== state.me.username) {
    const c = state.contacts.find(x => x.name === p.from_user);
    html += `<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 ${esc(displayName(p.from_user))} ${renderBadges(c || {})}</div>`;
  } else {
    const mb = renderBadges(state.me);
    if (mb) html += `<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 Я ${mb}</div>`;
  }
  if (p.image) html += `<img src="${p.image}" style="max-width:100%;border-radius:14px;margin-bottom:8px;display:block;">`;
  if (p.text) html += `<div style="font-size:15px;line-height:1.45;margin-bottom:8px;word-wrap:break-word;">${highlightMentions(p.text)}</div>`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="reaction-chip" onclick="socket.emit('view channel post', {postId:${p.id}}); openChannelComments(${p.id});">💬 ${p.commentCount || 0}</button><span style="font-size:11px;color:var(--text-muted);">👁 ${p.views || 0}</span><span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${fmtD(p.time)}</span></div>`;
  wrap.innerHTML = html;
  const rb = el('div', 'reactions');
  Object.entries(p.reactions || {}).forEach(([emoji, users]) => {
    if (!users?.length) return;
    const chip = el('button', 'reaction-chip' + (users.includes(state.me.username) ? ' mine' : ''));
    chip.innerHTML = `${emoji} <span>${users.length}</span>`;
    chip.onclick = e => { e.stopPropagation(); api('react channel post', { postId: p.id, emoji }); };
    rb.appendChild(chip);
  });
  wrap.appendChild(rb);
  wrap.addEventListener('contextmenu', e => { e.preventDefault(); const emoji = prompt('Реакция (❤️ 👍 😂 😮 😢 🔥)'); if (emoji) api('react channel post', { postId: p.id, emoji }); });
  box.appendChild(wrap);
}
function sendChannelPost() {
  if (!state.currentChannel) return;
  const text = ($('channel-post-input')?.value || '').trim(); if (!text) return;
  api('create channel post', { channelId: state.currentChannel.id, text }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); $('channel-post-input').value = ''; });
}
function openChannelInfo() {
  if (!state.currentChannel) return;
  const ch = state.currentChannel;
  $('channel-info-title').textContent = ch.name + (ch.verified ? ' ✓' : '');
  $('channel-info-desc').textContent = ch.description || '';
  $('channel-info-stats').innerHTML = `@${esc(ch.slug)}<br>${ch.memberCount} подписчиков`;
  const isOwner = ch.creator === state.me.username;
  $('channel-invite-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-edit-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-delete-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-leave-btn').style.display = isOwner ? 'none' : 'block';
  openModal('channel-info-modal');
}
function createChannelInvite() { if (!state.currentChannel) return; api('create channel invite', { channelId: state.currentChannel.id }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); state.currentInviteCode = res.code; $('channel-invite-code').textContent = res.code; closeModal('channel-info-modal'); openModal('channel-invite-result-modal'); }); }
function copyInviteCode() { if (!state.currentInviteCode) return; navigator.clipboard.writeText(state.currentInviteCode).then(() => toast('📋 Код скопирован')).catch(() => alert(state.currentInviteCode)); }
function openEditChannel() { if (!state.currentChannel) return; $('edit-channel-name').value = state.currentChannel.name; $('edit-channel-desc').value = state.currentChannel.description || ''; closeModal('channel-info-modal'); openModal('edit-channel-modal'); }
function doEditChannel() { if (!state.currentChannel) return; api('update channel', { channelId: state.currentChannel.id, name: ($('edit-channel-name')?.value || '').trim(), description: ($('edit-channel-desc')?.value || '').trim() }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); closeModal('edit-channel-modal'); toast('✓ Сохранено'); }); }
function confirmDeleteChannel() { if (!state.currentChannel) return; if (!confirm('Удалить канал для ВСЕХ?')) return; api('delete channel', { channelId: state.currentChannel.id }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); closeModal('channel-info-modal'); closeChannelChat(); }); }
function confirmLeaveChannel() { if (!state.currentChannel) return; if (!confirm('Отписаться от канала?')) return; api('unsubscribe channel', { channelId: state.currentChannel.id }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); closeModal('channel-info-modal'); closeChannelChat(); }); }
function openFindChannelModal() { $('find-channel-input').value = ''; $('find-channel-error').textContent = ''; openModal('find-channel-modal'); }
function doFindChannel() {
  const q = ($('find-channel-input')?.value || '').trim(), err = $('find-channel-error');
  if (err) err.textContent = '';
  if (!q) { if (err) err.textContent = 'Введи ID или код'; return; }
  const ev = /^[A-Z0-9]{8,12}$/i.test(q) ? 'resolve channel invite' : 'find channel by slug';
  const payload = ev === 'resolve channel invite' ? { code: q } : { slug: q };
  api(ev, payload, res => { if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; } closeModal('find-channel-modal'); showChannelFoundModal(res.channel); });
}
function showChannelFoundModal(ch) {
  const text = `📢 ${ch.name}\n@${ch.slug}${ch.verified ? ' ✓' : ''}\n\n${ch.description || ''}`;
  if (confirm(text + '\n\nПодписаться?')) api('subscribe channel', { channelId: ch.id }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); toast('✓ Подписан на канал'); });
}
function openChannelComments(postId) { state.currentChannelPostId = postId; $('channel-comment-input').value = ''; loadChannelComments(postId); openModal('channel-comments-modal'); }
function loadChannelComments(postId) {
  api('load channel comments', { postId }, res => {
    const box = $('channel-comments-list'); if (!box) return;
    if (!res?.ok || !res.comments?.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока нет комментариев</div>'; return; }
    box.innerHTML = '';
    res.comments.forEach(c => {
      const d = el('div');
      d.style.cssText = 'padding:10px 12px;background:var(--bg-input);border-radius:12px;margin-bottom:8px;';
      const cc = state.contacts.find(x => x.name === c.from_user);
      d.innerHTML = `<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:4px;">${esc(displayName(c.from_user))} ${renderBadges(cc || {})}</div><div style="font-size:14px;word-wrap:break-word;">${highlightMentions(c.text || '')}</div><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${fmtD(c.time)}</div>`;
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  });
}
function submitChannelComment() {
  if (!state.currentChannelPostId) return;
  const text = ($('channel-comment-input')?.value || '').trim(); if (!text) return;
  api('create channel comment', { postId: state.currentChannelPostId, text }, res => { if (!res?.ok) return alert(res?.error || 'Ошибка'); $('channel-comment-input').value = ''; });
}

/* ─── 34. ПОИСК / ГАЛЕРЕЯ / ОБОИ ─── */
function openSearchInChat() {
  if (!state.currentChat && !state.currentGroup) return;
  $('search-input').value = ''; $('search-results').innerHTML = '';
  openModal('search-modal');
  setTimeout(() => $('search-input')?.focus(), 100);
}
document.addEventListener('DOMContentLoaded', () => {
  const si = $('search-input'); if (!si) return;
  si.addEventListener('input', e => {
    const q = e.target.value.trim(), r = $('search-results');
    if (q.length < 2) { r.innerHTML = ''; return; }
    const params = state.currentGroup ? { query: q, groupId: state.currentGroup.id } : { query: q, withUser: state.currentChat };
    api('search messages', params, res => {
      if (!res?.ok || !res.results.length) { r.innerHTML = '<div style="text-align:center;color:#8b8b94;padding:20px;">Ничего не найдено</div>'; return; }
      r.innerHTML = '';
      res.results.forEach(m => {
        const d = el('div', 'search-result');
        d.innerHTML = `<div class="sr-from">${esc(displayName(m.from_user))}</div><div class="sr-text">${highlightMentions(m.text || '')}</div><div class="sr-time">${fmtD(m.time)}</div>`;
        d.onclick = () => { closeModal('search-modal'); scrollToMessage(m.id); };
        r.appendChild(d);
      });
    });
  });
});

function openGallery() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  state.galleryWaiting = true;
  $('gallery-content').innerHTML = ''; $('gallery-empty').style.display = 'none';
  openModal('gallery-modal');
  if (state.isSavedChat) api('load saved history');
  else if (state.currentChat) api('load history', { withUser: state.currentChat });
  else if (state.currentGroup) api('load group history', { groupId: state.currentGroup.id });
}
function fillGallery(messages) {
  const box = $('gallery-content'), empty = $('gallery-empty'); if (!box || !empty) return;
  box.innerHTML = '';
  const media = messages.filter(m => (m.image || m.video_circle) && !m.deleted && !m.sticker);
  if (!media.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  media.reverse().forEach(m => {
    if (m.image) { const img = el('img', 'gallery-item'); img.src = m.image; img.onclick = () => { closeModal('gallery-modal'); openLightbox(m.image); }; box.appendChild(img); }
    else if (m.video_circle) {
      const d = el('div', 'gallery-item video-item', '🎥');
      d.onclick = () => { closeModal('gallery-modal'); const v = document.querySelector(`.msg-wrap[data-id="${m.id}"] video`); if (v) { v.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => v.play().catch(() => {}), 500); } };
      box.appendChild(d);
    }
  });
}
function openLightbox(src) { $('lightbox-img').src = src; $('lightbox').classList.add('active'); }

function currentChatKey() { return state.currentGroup ? 'g:' + state.currentGroup.id : state.currentChat; }
function currentChatObj() { return state.currentGroup || state.contacts.find(c => c.name === state.currentChat); }
function openChatMenuV2() {
  const obj = currentChatObj();
  $('chat-menu-title').textContent = state.currentGroup ? state.currentGroup.name : (obj?.displayName || state.currentChat);
  $('chat-menu-mute').textContent = obj?.muted ? '🔔 Включить уведомления' : '🔕 Отключить уведомления';
  $('chat-menu-pin').textContent = obj?.pinned ? '📌 Открепить чат' : '📌 Закрепить чат';
  $('chat-menu-archive').textContent = obj?.archived ? '📤 Убрать из архива' : '📦 В архив';
  openModal('chat-menu-modal');
}
function chatMenuToggleMute() { const k = currentChatKey(); if (k) api('toggle mute', { chatKey: k }, () => closeModal('chat-menu-modal')); }
function chatMenuToggleArchive() { const k = currentChatKey(); if (k) api('toggle archive', { chatKey: k }, () => closeModal('chat-menu-modal')); }
function chatMenuTogglePin() { const k = currentChatKey(); if (k) api('toggle pin', { chatKey: k }, res => { closeModal('chat-menu-modal'); if (res?.ok) toast(res.pinned ? '📌 Чат закреплён' : '📍 Чат откреплён'); }); }
function openClearHistoryConfirm() { openModal('clear-history-modal'); }
function confirmClearHistory() {
  const withUser = state.currentChat;
  if (!withUser) { closeModal('clear-history-modal'); return toast('⚠️ Очистка доступна только в личных чатах'); }
  api('clear history', { withUser }, res => {
    closeModal('clear-history-modal');
    if (res?.ok) { toast('🧹 История очищена'); $('messages').innerHTML = ''; state.lastDateShown = ''; }
    else toast('❌ ' + (res?.error || 'Не удалось'));
  });
}

function getChatWallpaper(k) { return k ? state.chatWallpapers[k] : null; }
function setChatWallpaper(k, data) {
  if (!k) return;
  if (data) state.chatWallpapers[k] = data; else delete state.chatWallpapers[k];
  jset(STORAGE.WALLPAPERS, state.chatWallpapers);
  applyChatWallpaper();
}
function applyChatWallpaper() {
  const box = $('messages'); if (!box) return;
  const k = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  const wp = getChatWallpaper(k);
  if (wp) { box.style.backgroundImage = `url(${wp})`; box.style.backgroundSize = 'cover'; box.style.backgroundPosition = 'center'; box.classList.add('has-wallpaper'); }
  else { box.style.backgroundImage = ''; box.classList.remove('has-wallpaper'); }
}
function openWallpaperPicker() {
  const k = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  if (!k) return;
  $('wallpaper-modal')?.remove();
  const cur = getChatWallpaper(k);
  const m = el('div', 'modal active'); m.id = 'wallpaper-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px;';
  m.innerHTML = `<div class="modal-box" style="background:var(--bg-panel);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:24px;max-width:420px;width:100%;max-height:88vh;overflow-y:auto;">
    <h3 style="margin-bottom:18px;font-size:20px;text-align:center;font-weight:700;">🎨 Обои чата</h3>
    <div id="wallpaper-preview" style="width:100%;height:200px;border-radius:14px;background:var(--bg-input);${cur ? `background-image:url(${cur});background-size:cover;background-position:center;` : ''}margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;">${cur ? '' : 'Пока нет обоев'}</div>
    <button class="modal-primary" onclick="document.getElementById('wallpaper-file').click()" style="width:100%;padding:14px;margin-bottom:10px;border-radius:14px;background:var(--accent);color:#fff;font-size:15px;font-weight:600;border:none;cursor:pointer;">📷 Выбрать из галереи</button>
    <button class="modal-secondary" onclick="removeChatWallpaper()" style="width:100%;padding:14px;margin-bottom:10px;border-radius:14px;background:var(--bg-input);color:inherit;font-size:15px;font-weight:600;border:none;cursor:pointer;">🗑 Убрать обои</button>
    <button class="modal-secondary" onclick="document.getElementById('wallpaper-modal').remove()" style="width:100%;padding:14px;border-radius:14px;background:var(--bg-input);color:inherit;font-size:15px;font-weight:600;border:none;cursor:pointer;">Отмена</button>
    <input type="file" id="wallpaper-file" accept="image/*" style="display:none" /></div>`;
  document.body.appendChild(m);
  const wf = m.querySelector('#wallpaper-file');
  wf.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'), maxW = 1080;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL('image/jpeg', 0.7);
        const p = m.querySelector('#wallpaper-preview');
        if (p) { p.style.backgroundImage = `url(${dataUrl})`; p.style.backgroundSize = 'cover'; p.style.backgroundPosition = 'center'; p.textContent = ''; }
        setChatWallpaper(k, dataUrl); toast('🎨 Обои установлены'); vib(15);
        setTimeout(() => m.remove(), 500);
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  });
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}
function removeChatWallpaper() {
  const k = currentChatKey(); if (!k) return;
  setChatWallpaper(k, null); toast('🎨 Обои удалены'); vib(10);
  $('wallpaper-modal')?.remove();
}

/* ─── 35. ИСТОРИИ ─── */
function loadStories() { api('load stories', res => { if (res?.ok) { state.storiesUsers = res.users || []; renderStoriesBar(); } }); }
function renderStoriesBar() {
  const row = $('stories-row'); if (!row) return;
  row.innerHTML = '';
  const mine = state.storiesUsers.find(u => u.username === state.me.username);
  const mineHas = mine && mine.stories.length > 0;
  const mineAv = state.me.avatarVideo
    ? `<div class="story-ring-inner"><video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${state.me.avatarVideo}"></video></div>`
    : state.me.avatar
      ? `<div class="story-ring-inner" style="background-image:url(${state.me.avatar})"></div>`
      : `<div class="story-ring-inner">${initials(state.me.username || '?')}</div>`;
  const mineBubble = el('div', 'story-bubble');
  mineBubble.innerHTML = `<div class="story-ring mine ${mineHas ? 'has-story' : ''}${state.me.premium ? ' premium' : ''}">${mineAv}<div class="story-add-badge">+</div></div><div class="story-name">Моя</div>`;
  mineBubble.onclick = () => mineHas ? openStoryViewer(state.storiesUsers.indexOf(mine), 0) : openStoryAddModal();
  row.appendChild(mineBubble);
  state.storiesUsers.forEach((u, idx) => {
    if (u.username === state.me.username) return;
    const allViewed = u.stories.every(s => s.viewed);
    const avs = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
    const avc = u.avatar ? '' : initials(u.firstName || u.username);
    const dn = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.username;
    const b = el('div', 'story-bubble');
    b.innerHTML = `<div class="story-ring ${allViewed ? 'viewed' : ''}${u.premium && !allViewed ? ' premium' : ''}"><div class="story-ring-inner" style="${avs}">${avc}</div></div><div class="story-name">${esc(dn)}</div>`;
    b.onclick = () => openStoryViewer(idx, 0);
    row.appendChild(b);
  });
}
function openStoryAddModal() {
  $('story-file').value = ''; $('story-preview-wrap').style.display = 'none';
  $('story-caption-input').value = ''; $('story-add-error').textContent = '';
  const sb = $('story-submit-btn'); if (sb) { sb.disabled = true; sb.textContent = '📤 Опубликовать'; }
  window._storyImageData = null;
  openModal('story-add-modal');
}
function onStoryFileSelected(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      const max = 1080; let w = img.width, h = img.height;
      if (w > h && w > max) { h = h * max / w; w = max; } else if (h > max) { w = w * max / h; h = max; }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = c.toDataURL('image/jpeg', 0.8);
      window._storyImageData = dataUrl;
      $('story-preview-img').src = dataUrl; $('story-preview-wrap').style.display = 'block';
      $('story-submit-btn').disabled = false;
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(f);
}
function submitStory() {
  if (!window._storyImageData) return;
  const caption = ($('story-caption-input')?.value || '').trim();
  const err = $('story-add-error'); if (err) err.textContent = '';
  const sb = $('story-submit-btn'); if (sb) { sb.disabled = true; sb.textContent = 'Публикую…'; }
  api('post story', { image: window._storyImageData, caption }, res => {
    if (sb) { sb.textContent = '📤 Опубликовать'; sb.disabled = false; }
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('story-add-modal'); window._storyImageData = null; loadStories();
  });
}
function openStoryViewer(userIdx, storyIdx) {
  if (!state.storiesUsers[userIdx]?.stories[storyIdx]) return;
  state.currentStoryUserIdx = userIdx; state.currentStoryIdx = storyIdx;
  $('story-viewer').classList.add('active');
  renderCurrentStory(); startStoryTimer();
}
function renderCurrentStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return closeStoryViewer();
  const s = u.stories[state.currentStoryIdx]; if (!s) return closeStoryViewer();
  const bar = $('story-progress-bar');
  if (bar) {
    bar.innerHTML = '';
    u.stories.forEach((_, i) => {
      const seg = el('div', 'story-progress-segment' + (i < state.currentStoryIdx ? ' done' : ''));
      const fill = el('div', 'fill');
      if (i < state.currentStoryIdx) fill.style.width = '100%';
      seg.appendChild(fill); bar.appendChild(seg);
    });
  }
  const av = $('story-avatar');
  if (av) {
    if (u.avatarVideo) { av.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${u.avatarVideo}"></video>`; av.style.backgroundImage = ''; }
    else if (u.avatar) { av.innerHTML = ''; av.style.backgroundImage = `url(${u.avatar})`; }
    else { av.innerHTML = initials(u.firstName || u.username); av.style.backgroundImage = ''; av.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)'; }
    av.classList.toggle('premium', !!u.premium);
  }
  $('story-name').textContent = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.username;
  $('story-time').textContent = ago(s.time);
  $('story-image').src = s.image;
  const cap = $('story-caption');
  if (cap) { if (s.caption) { cap.textContent = s.caption; cap.classList.add('show'); } else cap.classList.remove('show'); }
  const isMine = u.username === state.me.username;
  $('story-delete-btn').style.display = isMine ? 'flex' : 'none';
  const vb = $('story-views-btn');
  if (isMine) { vb.style.display = 'flex'; api('get story views', { storyId: s.id }, res => { if (res?.ok) vb.textContent = '👁 ' + res.viewers.length; }); }
  else { vb.style.display = 'none'; if (!s.viewed) { s.viewed = true; api('view story', { storyId: s.id }); } }
}
function startStoryTimer() {
  stopStoryTimer();
  state.storyTimerStart = now();
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return;
  const seg = document.querySelectorAll('#story-progress-bar .story-progress-segment')[state.currentStoryIdx];
  const fill = seg?.querySelector('.fill');
  const tick = () => {
    const e = now() - state.storyTimerStart, pct = Math.min(100, (e / STORY_DURATION) * 100);
    if (fill) fill.style.width = pct + '%';
    if (e >= STORY_DURATION) return nextStory();
    state.storyTimer = requestAnimationFrame(tick);
  };
  state.storyTimer = requestAnimationFrame(tick);
}
function stopStoryTimer() { if (state.storyTimer) { cancelAnimationFrame(state.storyTimer); state.storyTimer = null; } }
function nextStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return closeStoryViewer();
  if (state.currentStoryIdx + 1 < u.stories.length) { state.currentStoryIdx++; renderCurrentStory(); startStoryTimer(); return; }
  let n = state.currentStoryUserIdx + 1;
  while (n < state.storiesUsers.length && state.storiesUsers[n].username === state.me.username) n++;
  if (n < state.storiesUsers.length) { state.currentStoryUserIdx = n; state.currentStoryIdx = 0; renderCurrentStory(); startStoryTimer(); }
  else closeStoryViewer();
}
function prevStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return;
  if (state.currentStoryIdx > 0) { state.currentStoryIdx--; renderCurrentStory(); startStoryTimer(); return; }
  let p = state.currentStoryUserIdx - 1;
  while (p >= 0 && state.storiesUsers[p].username === state.me.username) p--;
  if (p >= 0) { state.currentStoryUserIdx = p; state.currentStoryIdx = state.storiesUsers[p].stories.length - 1; }
  renderCurrentStory(); startStoryTimer();
}
function closeStoryViewer() { stopStoryTimer(); $('story-viewer').classList.remove('active'); renderStoriesBar(); }
function deleteCurrentStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return;
  const s = u.stories[state.currentStoryIdx]; if (!s) return;
  if (!confirm('Удалить эту историю?')) return;
  api('delete story', { storyId: s.id }, res => {
    if (!res?.ok) return alert(res?.error || 'Ошибка');
    u.stories.splice(state.currentStoryIdx, 1);
    if (!u.stories.length) state.storiesUsers.splice(state.currentStoryUserIdx, 1);
    if (!state.storiesUsers.length) return closeStoryViewer();
    if (state.currentStoryUserIdx >= state.storiesUsers.length) state.currentStoryUserIdx = state.storiesUsers.length - 1;
    if (state.currentStoryIdx >= state.storiesUsers[state.currentStoryUserIdx].stories.length) state.currentStoryIdx = 0;
    renderCurrentStory(); startStoryTimer();
  });
}
function openStoryViewers() {
  const u = state.storiesUsers[state.currentStoryUserIdx]; if (!u) return;
  const s = u.stories[state.currentStoryIdx]; if (!s) return;
  api('get story views', { storyId: s.id }, res => {
    const box = $('story-viewers-list'); if (!box) return;
    if (!res?.ok || !res.viewers?.length) box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока никто не смотрел</div>';
    else {
      box.innerHTML = '';
      res.viewers.forEach(v => {
        const c = state.contacts.find(x => x.name === v.viewer);
        const dn = c?.displayName || v.viewer, av = c?.avatar;
        const row = el('div', 'member-row');
        row.innerHTML = `<div class="member-avatar" style="${av ? `background-image:url(${av})` : 'background:var(--accent)'}">${av ? '' : initials(dn)}</div><div class="member-name">${esc(dn)} ${renderBadges(c || {})}<div style="font-size:12px;color:var(--text-muted);">${fmtD(v.time)}</div></div>`;
        box.appendChild(row);
      });
    }
    openModal('story-viewers-modal');
  });
}

/* ─── 36. ЗВОНКИ (WebRTC) ─── */
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 4,
};
function startCallTimer() {
  state.callStartTime = now();
  $('call-timer').textContent = '0:00';
  clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(() => {
    const e = Math.floor((now() - state.callStartTime) / 1000);
    $('call-timer').textContent = Math.floor(e/60) + ':' + (e%60).toString().padStart(2, '0');
  }, 1000);
}
function stopCallTimer() { clearInterval(state.callTimerInterval); state.callTimerInterval = null; $('call-timer').textContent = ''; }
async function toggleScreenShare() {
  if (!state.peerConnection || !state.localStream) return;
  const btn = $('screenBtn');
  if (!state.isScreenSharing) {
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      state.screenTrack = state.screenStream.getVideoTracks()[0];
      const sender = state.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(state.screenTrack);
      $('localVideo').srcObject = state.screenStream;
      state.isScreenSharing = true;
      if (btn) { btn.style.background = '#fff'; btn.style.color = '#000'; }
      state.screenTrack.onended = stopScreenShare;
    } catch (err) { alert('Не удалось: ' + err.message); }
  } else stopScreenShare();
}
async function stopScreenShare() {
  if (!state.isScreenSharing) return;
  try {
    state.screenStream?.getTracks().forEach(t => t.stop());
    state.screenStream = null; state.screenTrack = null; state.isScreenSharing = false;
    const btn = $('screenBtn'); if (btn) { btn.style.background = ''; btn.style.color = ''; }
    const cam = state.localStream?.getVideoTracks()[0];
    if (cam && state.peerConnection) {
      const sender = state.peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cam);
    }
    if ($('localVideo') && state.localStream) $('localVideo').srcObject = state.localStream;
  } catch {}
}
async function startCall(video) {
  if (!state.currentChat || state.callActive) return;
  if (state.isBotChat) return toast('🤖 Ботам нельзя звонить');
  if (state.me.mute) return toast('🔇 Ты в муте — звонки недоступны');
  const contact = state.contacts.find(c => c.name === state.currentChat);
  if (contact && !contact.online) return alert((contact.displayName || state.currentChat) + ' не в сети.');
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video }); }
  catch (err) { return alert('Нет доступа: ' + err.message); }
  state.callActive = true; state.micOn = true; state.camOn = !!video;
  showCallScreen(state.currentChat, contact, video, 'Вызов...');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  };
  const offer = await state.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer, video });
}
function showCallScreen(peerName, contact, video, statusText) {
  $('call-peer-name').innerHTML = esc(contact?.displayName || peerName) + ' ' + renderBadgesBig(contact || {});
  $('call-status').textContent = statusText;
  $('call-screen').classList.add('active');
  const lw = $('local-video-wrap');
  if (video && state.localStream) { lw.classList.add('active'); $('localVideo').srcObject = state.localStream; }
  else lw.classList.remove('active');
  const ba = $('call-avatar-big'), rw = $('remote-video-wrap');
  if (video) { rw.classList.remove('audio-only'); ba.style.display = 'none'; }
  else {
    rw.classList.add('audio-only'); ba.style.display = 'flex'; ba.classList.toggle('premium', !!contact?.premium);
    if (contact?.avatar) { ba.style.backgroundImage = `url(${contact.avatar})`; ba.textContent = ''; }
    else { ba.style.backgroundImage = ''; ba.textContent = initials(contact?.displayName || peerName); ba.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)'; }
  }
  updateCallButtons();
}
socket.on('incoming-call', data => {
  state.incomingFrom = data.from; state.incomingVideo = data.video; state.pendingOffer = data.offer;
  const c = state.contacts.find(x => x.name === data.from);
  $('incoming-name').innerHTML = esc(c?.displayName || data.from) + ' ' + renderBadgesBig(c || {});
  $('incoming-type').textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';
  const av = $('incoming-avatar');
  if (av) { av.classList.toggle('premium', !!c?.premium); if (c?.avatar) { av.style.backgroundImage = `url(${c.avatar})`; av.textContent = ''; } else { av.style.backgroundImage = ''; av.textContent = initials(c?.displayName || data.from); av.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)'; } }
  $('incoming-screen').classList.add('active');
  playPing(); vib();
});
function declineIncoming() {
  $('incoming-screen').classList.remove('active');
  if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom });
  state.pendingOffer = null; state.incomingFrom = null;
}
async function acceptIncoming() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;
  const from = state.incomingFrom, video = state.incomingVideo, offer = state.pendingOffer;
  state.pendingOffer = null; state.incomingFrom = null; state.currentChat = from;
  try { state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video }); }
  catch (err) { alert('Нет доступа: ' + err.message); socket.emit('end-call', { to: from }); return; }
  state.callActive = true; state.micOn = true; state.camOn = !!video;
  const c = state.contacts.find(x => x.name === from);
  showCallScreen(from, c, video, 'Соединение...');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(t => state.peerConnection.addTrack(t, state.localStream));
  state.peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate }); };
  state.peerConnection.ontrack = e => {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  };
  await state.peerConnection.setRemoteDescription(offer);
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer });
}
socket.on('call-answered', async data => {
  if (!state.peerConnection) return;
  await state.peerConnection.setRemoteDescription(data.answer);
  $('call-status').textContent = 'В разговоре';
  if (!state.callTimerInterval) startCallTimer();
});
socket.on('ice-candidate', async data => { try { await state.peerConnection?.addIceCandidate(data.candidate); } catch {} });
socket.on('call-ended', cleanupCall);
socket.on('call-failed', data => { alert('Не удалось: ' + data.reason); cleanupCall(); });
function cleanupCall() {
  state.callActive = false;
  stopCallTimer();
  if (state.isScreenSharing) stopScreenShare();
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  $('call-screen').classList.remove('active');
  $('incoming-screen').classList.remove('active');
  if ($('localVideo')) $('localVideo').srcObject = null;
  if ($('remoteVideo')) $('remoteVideo').srcObject = null;
  $('local-video-wrap')?.classList.remove('active');
}
function toggleMic() { const t = state.localStream?.getAudioTracks()[0]; if (!t) return; state.micOn = !state.micOn; t.enabled = state.micOn; updateCallButtons(); }
function toggleCamera() { const t = state.localStream?.getVideoTracks()[0]; if (!t) return; state.camOn = !state.camOn; t.enabled = state.camOn; updateCallButtons(); }
function updateCallButtons() {
  const mb = $('micBtn'), cb = $('camBtn');
  if (mb) { mb.textContent = state.micOn ? '🎤' : '🔇'; mb.classList.toggle('off', !state.micOn); }
  if (cb) { cb.textContent = state.camOn ? '📷' : '🚫'; cb.classList.toggle('off', !state.camOn); }
}
function hangUp() { if (state.currentChat) socket.emit('end-call', { to: state.currentChat }); cleanupCall(); }

/* ─── 37. ДОБАВИТЬ КОНТАКТ ─── */
function openAddContactModal() { $('add-display-name').value = ''; $('add-username').value = ''; $('add-error').textContent = ''; openModal('add-modal'); setTimeout(() => $('add-display-name')?.focus(), 150); }
function doAddContact() {
  ensureAuthorized(ok => { if (ok) doAddContactReal(); });
}
function ensureAuthorized(cb) {
  if (isLoggedInOnServer && state.me.username) { cb?.(true); return true; }
  const creds = jget(STORAGE.SESSION);
  if (creds?.sessionId) {
    api('login with session', { sessionId: creds.sessionId }, res => { if (res?.ok) { isLoggedInOnServer = true; state.me.username = res.username; cb?.(true); } else { forceShowAuth('Сессия истекла'); cb?.(false); } });
  } else { forceShowAuth('Войди заново'); cb?.(false); }
  return false;
}
function doAddContactReal() {
  const dnInput = $('add-display-name'), unInput = $('add-username'), err = $('add-error');
  if (!dnInput || !unInput) return;
  const displayName = dnInput.value.trim(), username = unInput.value.trim().toLowerCase();
  if (err) err.textContent = '';
  if (!displayName) { if (err) err.textContent = '⚠️ Введи имя'; dnInput.focus(); vib([30,20,30]); return; }
  if (!username) { if (err) err.textContent = '⚠️ Введи ник'; unInput.focus(); vib([30,20,30]); return; }
  if (username.length < 3) { if (err) err.textContent = '⚠️ Ник минимум 3 символа'; unInput.focus(); vib([30,20,30]); return; }
  if (username === state.me.username) { if (err) err.textContent = '⚠️ Это твой ник'; vib([30,20,30]); return; }
  if (err) err.innerHTML = '<span style="color:var(--accent);">⏳ Добавляю…</span>';
  api('add contact', { username, displayName }, res => {
    if (!res?.ok) {
      if (err) err.textContent = '❌ ' + (res?.error || 'Ошибка');
      if (res?.error?.includes('авторизован')) setTimeout(() => { closeModal('add-modal'); forceShowAuth('Сессия истекла'); }, 1500);
      vib([30,20,30]); return;
    }
    dnInput.value = ''; unInput.value = '';
    if (err) err.textContent = '';
    closeModal('add-modal'); toast('✓ ' + displayName + ' добавлен'); vib([50,30,50]);
  });
}

/* ─── 38. ПРОФИЛЬ КОНТАКТА ─── */
function openContactProfile(username) {
  api('get profile', { username }, data => {
    if (!data) return;
    state.contactProfileCurrent = data;
    const box = $('contact-profile-content'); if (!box) return;
    const isBotUser = !!data.isBot, isPremium = !!data.premium;
    const avStyle = data.avatar_video ? '' : data.avatar ? `background-image:url(${data.avatar})` : '';
    const avContent = data.avatar_video
      ? `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${data.avatar_video}"></video>`
      : data.avatar ? '' : (isBotUser ? (data.emojiStatus || '🤖') : initials(username));
    const badges = renderBadgesBig(data);
    const contact = state.contacts.find(c => c.name === username);
    const dn = (data.firstName || data.lastName) ? ((data.firstName || '') + ' ' + (data.lastName || '')).trim() : (contact?.displayName || username);
    const emojiStr = data.emojiStatus && !isBotUser ? ' ' + data.emojiStatus : '';
    const botMark = isBotUser ? ' <span class="bot-mark">бот</span>' : '';
    let extra = '';
    if (data.blockedByMe) extra = '<div style="color:#f87171;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вы заблокировали</div>';
    else if (data.blockedMe) extra = '<div style="color:#f87171;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вас заблокировали</div>';
    let punishments = '';
    if (state.me.isModerator && data.punishments?.length) {
      punishments = '<div class="profile-punishments"><div class="pp-title">🛡️ Активные наказания</div>';
      data.punishments.forEach(p => { punishments += `<div class="pp-row"><span class="pp-type">${PUNISH_LABELS[p.type] || p.type}</span><span class="pp-reason">${esc(p.reason || '')}</span><span class="pp-dur">${esc(p.duration_text)}</span></div>`; });
      punishments += '</div>';
    }
    let gifts = '';
    if (data.gifts?.length) {
      gifts = `<div class="profile-gifts"><div class="pg-title">🎁 Подарки (${data.gifts.length})</div><div class="pg-row">`;
      data.gifts.slice(0, 12).forEach(g => { const gift = state.giftsCatalog[g.gift_key]; if (gift) gifts += `<span class="pg-item" title="${esc(gift.name)}">${gift.emoji}</span>`; });
      gifts += '</div></div>';
    }
    let botCmds = '';
    if (isBotUser && data.botCommands?.length) {
      botCmds = '<div class="bot-commands-preview"><div class="bcp-title">🤖 Команды</div>';
      data.botCommands.slice(0, 10).forEach(c => { botCmds += `<div class="bcp-row"><span class="bcp-trigger">${esc(c.trigger)}</span>${esc(c.response.slice(0, 60))}</div>`; });
      botCmds += '</div>';
    }
    let bannerHtml = '';
    const hasBanner = (data.banner || data.banner_video) && !isBotUser;
    if (hasBanner) bannerHtml = `<div class="contact-banner${isPremium ? ' premium' : ''}">${data.banner_video ? `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover"><source src="${data.banner_video}"></video>` : `<img src="${data.banner}" alt="" />`}</div>`;
    const headerOpen = hasBanner ? '<div class="contact-profile-with-banner">' : '<div class="profile-header">';
    box.innerHTML = bannerHtml + headerOpen +
      `<div class="profile-avatar-big${isBotUser ? ' bot' : ''}${isPremium ? ' premium' : ''}" style="${avStyle}">${avContent}</div>
      <div class="profile-name${isPremium ? ' premium' : ''}">${esc(dn)}${emojiStr}${botMark} ${badges}</div>
      <div class="profile-nick">@${esc(username)}</div>
      <div class="profile-status ${data.online ? 'online' : ''}">${isBotUser ? 'всегда на связи' : (data.online ? 'в сети' : 'не в сети')}</div></div>
      ${data.bio ? `<div class="profile-bio">${esc(data.bio)}</div>` : ''}${punishments}${botCmds}${gifts}${extra}`;
    const blockBtn = $('block-action-btn');
    if (blockBtn) { blockBtn.textContent = data.blockedByMe ? '✅ Разблокировать' : '🚫 Блокировать'; blockBtn.style.display = isBotUser ? 'none' : ''; }
    const giftBtn = $('gift-to-contact-btn');
    if (giftBtn) giftBtn.style.display = (username !== state.me.username && !data.blockedByMe && !data.blockedMe && !isBotUser) ? 'block' : 'none';
    const badgeBtn = $('give-badge-to-contact-btn');
    if (badgeBtn) badgeBtn.style.display = (state.me.username === 'moroz' && username !== state.me.username && !isBotUser) ? 'block' : 'none';
    const reportBtn = $('report-contact-btn');
    if (reportBtn) { if (username !== state.me.username && !isBotUser) { reportBtn.style.display = 'block'; reportBtn.onclick = () => openReportModal(username, null, false); } else reportBtn.style.display = 'none'; }
    const modActions = $('mod-contact-actions');
    if (modActions) { if (state.me.isModerator && username !== state.me.username && !isBotUser) { modActions.style.display = 'block'; modActions.dataset.target = username; } else modActions.style.display = 'none'; }
    openModal('contact-profile-modal');
  });
}
function toggleBlockCurrent() {
  const u = state.contactProfileCurrent?.username; if (!u) return;
  if (state.contactProfileCurrent?.blockedByMe) api('unblock user', { username: u }, closeContactProfile);
  else api('block user', { username: u }, closeContactProfile);
}
function closeContactProfile() { closeModal('contact-profile-modal'); state.contactProfileCurrent = null; }

/* ─── 39. БЕЙДЖИ ─── */
let currentBadgeType = 'verified';
function openBadgeModal() { $('badge-username').value = ''; $('badge-error').textContent = ''; selectBadgeType('verified'); openModal('badge-modal'); }
function openBadgeModalForCurrent() {
  const u = state.contactProfileCurrent?.username; if (!u) return;
  closeModal('contact-profile-modal');
  $('badge-username').value = u; $('badge-error').textContent = ''; selectBadgeType('verified'); openModal('badge-modal');
}
function selectBadgeType(type) {
  currentBadgeType = type;
  document.querySelectorAll('.badge-option').forEach(el => el.classList.toggle('active', el.dataset.badge === type));
  $('badge-modal-title').textContent = { verified:'✓ Выдать галочку', hammer:'🔨 Выдать молоток', scam:'SCAM — Выдать скам', premium:'⭐ Выдать Azerta Premium' }[type] || '🏅 Выдать значок';
  vib(10);
}
function giveBadgeAction() {
  const username = ($('badge-username')?.value || '').trim().toLowerCase(), err = $('badge-error');
  if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник'; return; }
  const events = { verified:'verify', hammer:'give hammer', scam:'give scam', premium:'give premium' };
  api(events[currentBadgeType], { username }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('badge-modal');
    toast('✓ ' + { verified:'Галочка', hammer:'Молоток', scam:'Скам', premium:'⭐ Премиум' }[currentBadgeType] + ' выдан @' + res.username);
    vib([50,30,50]);
  });
}
function removeBadgeAction() {
  const username = ($('badge-username')?.value || '').trim().toLowerCase(), err = $('badge-error');
  if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник'; return; }
  const events = { verified:'unverify', hammer:'remove hammer', scam:'remove scam', premium:'remove premium' };
  api(events[currentBadgeType], { username }, res => {
    if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; }
    closeModal('badge-modal');
    toast('✓ ' + { verified:'Галочка', hammer:'Молоток', scam:'Скам', premium:'⭐ Премиум' }[currentBadgeType] + ' снят с @' + res.username);
  });
}
function doVerifyChannel() {
  const slug = ($('verify-channel-slug')?.value || '').trim().toLowerCase(), err = $('verify-channel-error');
  if (err) err.textContent = '';
  if (!slug) { if (err) err.textContent = 'Введи ID канала'; return; }
  api('verify channel', { slug }, res => { if (!res?.ok) { if (err) err.textContent = res?.error || 'Ошибка'; return; } closeModal('verify-channel-modal'); toast('✓ Галочка выдана каналу @' + res.slug); });
}

/* ─── 40. ЖАЛОБА В ПРОФИЛЕ ─── */
/* (уже включено в openContactProfile) */

/* ═══════════════════════════════════════════════════════════
   41. SOCKET LISTENERS
   ═══════════════════════════════════════════════════════════ */
socket.on('connect', async () => {
  setConnStatus('reconnecting', 'Azerta: проверяю связь…');
  setTimeout(hideConnStatus, 2000);
  state.reconnectAttempts = 0;
  if (autoLoginDone) return;
  const ok = await tryAutoLogin();
  if (!ok) { $('app').classList.remove('active'); $('auth').classList.add('active'); state.isLoggedIn = false; isLoggedInOnServer = false; }
  autoLoginDone = true;
});
socket.on('disconnect', () => setConnStatus('offline', 'Azerta: связь потеряна 😴'));
socket.on('connect_error', () => {
  state.reconnectAttempts++;
  const msgs = ['Azerta: пробую ещё раз… 🔄','Azerta: интернет уснул 💤','Azerta: слабый интернет 😔','Azerta: сервер далеко 🌍','Azerta: ещё чуть-чуть… 🐢'];
  setConnStatus('reconnecting', msgs[Math.min(state.reconnectAttempts - 1, msgs.length - 1)]);
});
socket.io.on('reconnect', () => {
  setConnStatus('connected', 'Azerta: снова с тобой ✨');
  state.reconnectAttempts = 0;
  setTimeout(hideConnStatus, 2500);
  if (state.isLoggedIn) loadStories();
});
socket.on('server toast', d => { if (d?.text) toast(d.text); });

function setConnStatus(type, text) {
  const el = $('conn-status'), t = $('conn-text'); if (!el || !t) return;
  el.classList.remove('connected','slow','offline','reconnecting');
  el.classList.add(type, 'show'); t.textContent = text;
}
function hideConnStatus() { $('conn-status')?.classList.remove('show'); }

socket.on('punishment issued', data => {
  const title = data.title || (data.type === 'ban' ? 'Ты забанен' : (data.type === 'mute' ? 'Ты в муте' : 'Предупреждение'));
  const emoji = data.emoji || '⚠️';
  const until = data.expires_at ? new Date(data.expires_at).toLocaleString('ru-RU') : 'навсегда';
  let modal = $('punishment-modal');
  if (!modal) { modal = el('div', 'modal'); modal.id = 'punishment-modal'; modal.innerHTML = '<div class="modal-box punishment-box"></div>'; document.body.appendChild(modal); }
  const box = modal.querySelector('.punishment-box');
  box.innerHTML = `<div class="punishment-emoji">${emoji}</div><h3>${esc(title)}</h3>${data.reason ? `<div class="modal-desc">Причина: ${esc(data.reason)}</div>` : ''}<div class="modal-desc">До: ${esc(until)}${data.duration_text ? ' (' + esc(data.duration_text) + ')' : ''}</div>${data.type === 'ban' ? '<button class="modal-danger" onclick="location.reload()">Понятно</button>' : '<button class="modal-primary" onclick="closeModal(\'punishment-modal\')">Понятно</button>'}`;
  modal.classList.add('active');
  if (data.type === 'mute') { state.me.mute = { reason: data.reason, expires_at: data.expires_at, duration_text: data.duration_text }; applyMuteLock(); }
  if (data.type === 'ban') setTimeout(() => { state.me.username = null; state.me.sessionId = null; isLoggedInOnServer = false; location.reload(); }, 4000);
});
socket.on('punishment lifted', data => { if (data.type === 'mute') { state.me.mute = null; applyMuteLock(); } toast('✅ Наказание снято: ' + (data.type || '')); });
socket.on('new report', () => { if (!state.me.isModerator) return; if (state.modPanelOpen && state.modTab === 'reports') loadModReports(); playPing(); vib([30,20,30]); });

socket.on('contacts', list => { state.contacts = list || []; jset(STORAGE.CONTACTS, state.contacts); renderChatList(); if (state.activeTab === 'contacts') renderContactsTab(); });
socket.on('groups', (list, meta) => { state.groups = list || []; if (meta?.canCreate !== undefined) state.canCreateGroup = meta.canCreate; jset(STORAGE.GROUPS, state.groups); renderChatList(); });
socket.on('channels', (list, meta) => { state.channels = list || []; if (meta?.canCreate !== undefined) state.canCreateChannel = meta.canCreate; renderChatList(); });

socket.on('history', data => {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (data.withUser !== state.currentChat) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = ''; state.lastDateShown = '';
  data.messages.forEach(m => renderMessage(fromServer(m, { isGroup: false })));
  box.scrollTop = box.scrollHeight;
});
socket.on('saved history', data => {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (!state.isSavedChat) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = ''; state.lastDateShown = '';
  data.messages.forEach(m => renderMessage(fromServer(m, { isGroup: false, forceSelf: true })));
  box.scrollTop = box.scrollHeight;
});
socket.on('group history', data => {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (state.currentGroup?.id !== data.groupId) return;
  const box = $('messages'); if (!box) return;
  box.innerHTML = ''; state.lastDateShown = '';
  data.messages.forEach(m => renderMessage(fromServer(m, { isGroup: true })));
  box.scrollTop = box.scrollHeight;
});

function fromServer(m, opts = {}) {
  return {
    id: m.id, from: m.from_user || m.sender, to: m.to_user,
    text: m.text, image: m.image, sticker: m.sticker,
    voice: m.voice, voiceDuration: m.voice_duration,
    videoCircle: m.video_circle, videoDuration: m.video_duration,
    geo: (m.geo_lat != null && m.geo_lng != null) ? { lat: m.geo_lat, lng: m.geo_lng, label: m.geo_label } : null,
    reactions: m.reactions || {}, time: m.time,
    self: opts.forceSelf ? true : (m.from_user || m.sender) === state.me.username,
    senderName: opts.isGroup ? displayName(m.from_user || m.sender) : undefined,
    isGroup: !!opts.isGroup,
    replyData: m.replyData,
    edited: !!m.edited, deleted: !!m.deleted, read: !!m.read_at,
    system: !!m.system, systemType: m.system_type,
    spoiler: !!m.spoiler,   // ✅ FIX: спойлеры теперь работают и в истории
  };
}

socket.on('history cleared', data => {
  $('messages').innerHTML = ''; state.lastDateShown = '';
  if (data?.by && data.by !== state.me.username) toast('🧹 ' + displayName(data.by) + ' очистил(а) историю');
});

socket.on('private message', data => {
  const isSavedMsg = data.from === state.me.username && data.to === state.me.username;
  if (data.self && state.currentChat === data.to && !isSavedMsg) {
    renderMessage({ id: data.id, from: state.me.username, to: data.to, text: data.text, image: data.image, sticker: data.sticker, voice: data.voice, voiceDuration: data.voiceDuration, videoCircle: data.videoCircle, videoDuration: data.videoDuration, geo: data.geo || null, reactions: data.reactions || {}, time: data.time, self: true, replyData: data.replyData, read: false, spoiler: !!data.spoiler });
  } else if (data.self && state.isSavedChat && isSavedMsg) {
    renderMessage({ id: data.id, from: state.me.username, to: state.me.username, text: data.text, image: data.image, sticker: data.sticker, voice: data.voice, voiceDuration: data.voiceDuration, videoCircle: data.videoCircle, videoDuration: data.videoDuration, geo: data.geo || null, reactions: data.reactions || {}, time: data.time, self: true, replyData: data.replyData, read: false, spoiler: !!data.spoiler });
  } else if (!data.self) {
    if (data.from === state.currentChat) {
      renderMessage({ id: data.id, from: data.from, to: state.me.username, text: data.text, image: data.image, sticker: data.sticker, voice: data.voice, voiceDuration: data.voiceDuration, videoCircle: data.videoCircle, videoDuration: data.videoDuration, geo: data.geo || null, reactions: data.reactions || {}, time: data.time, self: false, replyData: data.replyData, system: !!data.system, systemType: data.systemType, spoiler: !!data.spoiler });
      clearUnread(data.from);
      setTimeout(() => $('messages')?.scrollTo({ top: $('messages').scrollHeight, behavior: 'smooth' }), 50);
    } else {
      const c = state.contacts.find(x => x.name === data.from);
      if (!c?.muted && state.settings.notif_private != 0) { playPing(); vib(); }
      state.unread[data.from] = (state.unread[data.from] || 0) + 1;
      saveUnread(); renderChatList(); updateTitle();
      let preview = data.text || '';
      if (data.sticker) preview = '🖼 Стикер'; if (data.image) preview = '📷 Фото'; if (data.voice) preview = '🎤 Голосовое'; if (data.videoCircle) preview = '🎥 Кружок'; if (data.geo) preview = '📍 Геолокация';
      if (data.system) preview = data.text || 'Звонок';
      browserNotif((c?.isBot ? '🤖 ' : '') + displayName(data.from), preview);
    }
  }
});

socket.on('messages read', () => document.querySelectorAll('.msg.self .check').forEach(el => el.classList.add('read')));
socket.on('message edited', data => { const ts = document.querySelector(`.msg-wrap[data-id="${data.messageId}"] .msg-text`); if (ts) ts.innerHTML = highlightMentions(data.text); });
socket.on('message deleted', data => {
  const w = document.querySelector(`.msg-wrap[data-id="${data.messageId}"] .msg`);
  if (w) { w.classList.add('deleted'); w.innerHTML = '<i>Сообщение удалено</i>'; }
});
socket.on('message blocked', data => alert(data.reason));

socket.on('group message', data => {
  const g = state.groups.find(x => x.id === data.groupId);
  if (data.self && state.currentGroup?.id === data.groupId) {
    renderMessage({ id: data.id, from: data.from, text: data.text, image: data.image, sticker: data.sticker, voice: data.voice, voiceDuration: data.voiceDuration, videoCircle: data.videoCircle, videoDuration: data.videoDuration, geo: data.geo || null, reactions: data.reactions || {}, time: data.time, self: true, senderName: 'Я', isGroup: true, replyData: data.replyData, spoiler: !!data.spoiler });
  } else if (!data.self) {
    if (state.currentGroup?.id === data.groupId) {
      renderMessage({ id: data.id, from: data.from, text: data.text, image: data.image, sticker: data.sticker, voice: data.voice, voiceDuration: data.voiceDuration, videoCircle: data.videoCircle, videoDuration: data.videoDuration, geo: data.geo || null, reactions: data.reactions || {}, time: data.time, self: false, senderName: displayName(data.from), isGroup: true, replyData: data.replyData, spoiler: !!data.spoiler });
      clearUnread('g:' + data.groupId);
      setTimeout(() => $('messages')?.scrollTo({ top: $('messages').scrollHeight, behavior: 'smooth' }), 50);
    } else {
      if (!g?.muted && state.settings.notif_groups != 0) { playPing(); vib(); }
      state.unread['g:' + data.groupId] = (state.unread['g:' + data.groupId] || 0) + 1;
      saveUnread(); renderChatList(); updateTitle();
      let preview = data.text || '';
      if (data.sticker) preview = '🖼 Стикер'; if (data.image) preview = '📷 Фото'; if (data.voice) preview = '🎤 Голосовое'; if (data.videoCircle) preview = '🎥 Кружок'; if (data.geo) preview = '📍 Геолокация';
      browserNotif((g?.name || 'Группа') + ' — ' + displayName(data.from), preview);
    }
  }
});

socket.on('reaction updated', data => {
  const w = document.querySelector(`.msg-wrap[data-id="${data.messageId}"]:not([data-group])`);
  if (w) renderReactionsInto(w, data.reactions, false);
});
socket.on('group reaction updated', data => {
  if (state.currentGroup?.id !== data.groupId) return;
  const w = document.querySelector(`.msg-wrap[data-id="${data.messageId}"][data-group="1"]`);
  if (w) renderReactionsInto(w, data.reactions, true);
});

socket.on('typing', data => {
  if (data.isTyping) {
    state.typingUsers[data.from] = now();
    clearTimeout(state.typingTimeouts[data.from]);
    state.typingTimeouts[data.from] = setTimeout(() => { delete state.typingUsers[data.from]; delete state.typingTimeouts[data.from]; renderChatList(); updateTopStatusTyping(); }, 4000);
  } else {
    delete state.typingUsers[data.from];
    clearTimeout(state.typingTimeouts[data.from]);
    delete state.typingTimeouts[data.from];
  }
  renderChatList(); updateTopStatusTyping();
});
socket.on('group typing', data => {
  if (state.currentGroup?.id !== data.groupId) return;
  const el = $('chat-top-status'); if (!el) return;
  if (data.isTyping) {
    el.textContent = displayName(data.from) + ' печатает…';
    el.classList.add('typing');
    clearTimeout(window._gtt);
    window._gtt = setTimeout(() => {
      const w = state.currentGroup.memberCount === 1 ? '' : (state.currentGroup.memberCount < 5 ? 'а' : 'ов');
      el.textContent = `${state.currentGroup.memberCount} участник${w}`; el.classList.remove('typing');
    }, 3000);
  }
});

socket.on('group deleted', data => {
  if (state.currentGroup?.id === data.groupId) { closeModal('group-info-modal'); closeChat(); }
  state.groups = state.groups.filter(g => g.id !== data.groupId);
  delete state.unread['g:' + data.groupId];
  saveUnread(); updateTitle(); renderChatList();
});
socket.on('channel deleted', data => { if (state.currentChannel?.id === data.channelId) closeChannelChat(); });
socket.on('channel post new', () => {
  if (!state.currentChannel) return;
  api('load channel posts', { channelId: state.currentChannel.id }, res => {
    if (!res?.ok) return;
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = ''; res.posts.forEach(p => renderChannelPost(p));
  });
});
socket.on('channel post deleted', () => {
  if (!state.currentChannel) return;
  api('load channel posts', { channelId: state.currentChannel.id }, res => {
    if (!res?.ok) return;
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = ''; res.posts.forEach(p => renderChannelPost(p));
  });
});
socket.on('channel post reaction', () => {
  if (!state.currentChannel) return;
  api('load channel posts', { channelId: state.currentChannel.id }, res => {
    if (!res?.ok) return;
    const box = $('channel-posts'); if (!box) return;
    box.innerHTML = ''; res.posts.forEach(p => renderChannelPost(p));
  });
});
socket.on('channel comment new', data => {
  const ccm = $('channel-comments-modal');
  if (ccm?.classList.contains('active') && state.currentChannelPostId === data.postId) loadChannelComments(data.postId);
});

socket.on('story new', () => loadStories());
socket.on('story deleted', data => {
  state.storiesUsers.forEach(u => u.stories = u.stories.filter(s => s.id !== data.storyId));
  state.storiesUsers = state.storiesUsers.filter(u => u.stories.length > 0);
  renderStoriesBar();
  const sv = $('story-viewer');
  if (sv?.classList.contains('active')) {
    if (!state.storiesUsers[state.currentStoryUserIdx]) return closeStoryViewer();
    renderCurrentStory(); startStoryTimer();
  }
});

socket.on('settings', s => {
  state.settings = s || {};
  if (state.settings.stars !== undefined) state.me.stars = Number(state.settings.stars);
  jset(STORAGE.SETTINGS, state.settings);
  applyLocalSettings();
  if ($('settings-screen')?.classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});
socket.on('stars updated', data => {
  state.me.stars = Number(data?.stars || 0);
  if ($('gifts-catalog-balance')) $('gifts-catalog-balance').textContent = state.me.stars;
  if ($('settings-screen')?.classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});
socket.on('me updated', data => {
  const keys = { premium:'premium', verified:'verified', hammer:'hammer', scam:'scam' };
  Object.entries(keys).forEach(([k, f]) => { if (data[k] !== undefined) state.me[f] = !!data[k]; });
  ['avatar','banner','bio','firstName','lastName','birthday','emojiStatus','avatarVideo','bannerVideo'].forEach(k => { if (data[k] !== undefined) state.me[k === 'avatarVideo' ? 'avatarVideo' : k === 'bannerVideo' ? 'bannerVideo' : k] = data[k]; });
  if (data.avatar_video !== undefined) state.me.avatarVideo = data.avatar_video;
  if (data.banner_video !== undefined) state.me.bannerVideo = data.banner_video;
  updateVerifyButton(); updateMyAvatarBtn(); renderChatList(); renderStoriesBar();
  if (state.activeTab === 'settings') renderSettingsTab();
});
socket.on('friend updated', data => {
  if (!data?.username) return;
  const c = state.contacts.find(x => x.name === data.username);
  if (!c) return;
  ['premium','verified','hammer','scam'].forEach(k => { if (data[k] !== undefined) c[k] = !!data[k]; });
  ['avatar','banner','avatarVideo','bannerVideo'].forEach(k => { if (data[k] !== undefined) c[k] = data[k]; });
  if (data.avatar_video !== undefined) c.avatarVideo = data.avatar_video;
  if (data.banner_video !== undefined) c.bannerVideo = data.banner_video;
  jset(STORAGE.CONTACTS, state.contacts);
  renderChatList();
  if (state.activeTab === 'contacts') renderContactsTab();
  if (state.currentChat === data.username) {
    $('chat-top-name').innerHTML = esc(c.displayName || c.name) + ' ' + renderBadgesBig(c);
    $('chat-avatar')?.classList.toggle('premium', !!c.premium);
  }
});

socket.on('mentioned', data => {
  playPing(); vib([40,30,40]);
  const fromName = displayName(data.from);
  toast(data.groupId ? `📣 ${fromName} упомянул(а) тебя в «${data.groupName || 'группе'}»` : `📣 ${fromName} упомянул(а) тебя`);
  browserNotif('📣 Упоминание от ' + fromName, data.text || '');
});
socket.on('achievement unlocked', data => {
  playPing(); vib([50,30,50]);
  const card = el('div');
  card.style.cssText = 'position:fixed;top:calc(70px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%) translateY(-20px);background:var(--bg-panel);border:1px solid var(--accent);border-radius:18px;padding:16px 22px;display:flex;align-items:center;gap:14px;z-index:99999;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(139,127,255,0.35);opacity:0;transition:all 0.4s cubic-bezier(0.34,1.4,0.64,1);max-width:calc(100vw - 40px);';
  card.innerHTML = `<div style="font-size:36px;line-height:1;">${data.emoji || '🏆'}</div><div><div style="font-size:11px;color:var(--accent);font-weight:700;letter-spacing:1px;">🏆 ДОСТИЖЕНИЕ</div><div style="font-size:15px;font-weight:700;margin-top:2px;">${esc(data.name || '')}</div><div style="font-size:12px;color:var(--text-muted);">+5 ⭐</div></div>`;
  document.body.appendChild(card);
  requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { card.style.opacity = '0'; card.style.transform = 'translateX(-50%) translateY(-20px)'; setTimeout(() => card.remove(), 400); }, 3200);
});

socket.on('gift received', payload => {
  const gift = state.giftsCatalog[payload.gift_key || payload.giftKey];
  const from = payload.from_user || payload.from;
  const fromName = state.contacts.find(c => c.name === from)?.displayName || from;
  if (gift) {
    let msg = `🎁 ${fromName} подарил: ${gift.emoji} ${gift.name}!`;
    if (payload.gift_message) msg += '\n💬 ' + payload.gift_message;
    toast(msg); playPing(); vib();
  } else {
    toast(`🎁 ${fromName} подарил подарок!`);
    api('get gifts catalog', r => { if (r?.ok) state.giftsCatalog = r.catalog || {}; });
  }
});
socket.on('my gifts updated', () => { if ($('my-gifts-modal')?.classList.contains('active')) openMyGifts(); });

socket.on('session terminated', () => { alert('Сеанс завершён'); localStorage.removeItem(STORAGE.SESSION); location.reload(); });
socket.on('account deleted', () => { localStorage.clear(); location.reload(); });

/* ═══════════════════════════════════════════════════════════
   42. ИНИЦИАЛИЗАЦИЯ
   ═══════════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  try {
    state.unread = jget(STORAGE.UNREAD, {}) || {};
    initNotifications();
    showChatListSkeleton();

    const cc = jget(STORAGE.CONTACTS); if (cc) state.contacts = cc;
    const gc = jget(STORAGE.GROUPS); if (gc) state.groups = gc;
    const sc = jget(STORAGE.SETTINGS); if (sc) { state.settings = sc; applyLocalSettings(); }
    state.stickerRecent = jget(STORAGE.STICKERS, []) || [];
    state.chatWallpapers = jget(STORAGE.WALLPAPERS, {}) || {};

    bindRipples();

    const addUser = new URLSearchParams(location.search).get('add');
    if (addUser) {
      setTimeout(() => {
        if (confirm('Добавить @' + addUser + ' в контакты?')) {
          api('add contact', { username: addUser.toLowerCase(), displayName: addUser }, res => { if (res?.ok) toast('✓ Контакт добавлен'); else alert(res?.error || 'Ошибка'); });
        }
        history.replaceState({}, '', location.pathname);
      }, 1500);
    }

    const creds = jget(STORAGE.SESSION);
    if (!creds?.sessionId) { hideSplash(); $('auth')?.classList.add('active'); }
  } catch (e) {
    console.error('Init error:', e); hideSplash(); $('auth')?.classList.add('active');
  }
});

/* ─── 43. SKELETON ─── */
function showChatListSkeleton() {
  const box = $('chat-list'); if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const d = el('div', 'skeleton-chat-item');
    d.innerHTML = '<div class="skeleton sk-avatar"></div><div class="sk-info"><div class="skeleton sk-line long"></div><div class="skeleton sk-line short"></div></div>';
    box.appendChild(d);
  }
}

/* ─── 44. ESC ─── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active')); hideReactionMenu(); hideActionMenu(); }
});

/* ─── 45. РАЗНОЕ (мелочи, которые нужны для совместимости) ─── */
function filterContacts() { renderChatList(); }
function openAchievements_() { /* заглушка */ }
function renderCallsTab() { $('calls-list') && ($('calls-list').innerHTML = ''); }
function openSearchInChat_() { openSearchInChat(); }

/* Привязка кнопок, у которых onclick="..." в HTML */
window.togglePassword = togglePassword;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.switchAuthScreen = switchAuthScreen;
window.regNext = regNext;
window.regBack = regBack;
window.onRegUsernameInput = onRegUsernameInput;
window.onRegPasswordInput = onRegPasswordInput;
window.onRegPassword2Input = onRegPassword2Input;
window.tryPasscode = tryPasscode;
window.enableNotifications = enableNotifications;
window.switchTab = switchTab;
window.openProfile = openProfile;
window.saveProfile = saveProfile;
window.openAddContactModal = openAddContactModal;
window.doAddContact = doAddContact;
window.openContactProfile = openContactProfile;
window.closeContactProfile = closeContactProfile;
window.toggleBlockCurrent = toggleBlockCurrent;
window.showMyQr = showMyQr;
window.copyQrLink = copyQrLink;
window.addFromQr = addFromQr;
window.openSessions = openSessions;
window.terminateSession = terminateSession;
window.terminateAllOthers = terminateAllOthers;
window.openBlockedList = openBlockedList;
window.unblockUser = unblockUser;
window.openPasscodeModal = openPasscodeModal;
window.savePasscode = savePasscode;
window.removePasscode = removePasscode;
window.toggleSetting = toggleSetting;
window.changeTheme = changeTheme;
window.changeFontSize = changeFontSize;
window.changeLastSeen = changeLastSeen;
window.changeGeoVisibility = changeGeoVisibility;
window.openColorPicker = openColorPicker;
window.showCacheSize = showCacheSize;
window.clearCache = clearCache;
window.logout = logout;
window.confirmDeleteAccount = confirmDeleteAccount;
window.openStarsHistory = openStarsHistory;
window.openGiftsCatalog = openGiftsCatalog;
window.openGiftMessageModal = openGiftMessageModal;
window.confirmSendGift = confirmSendGift;
window.openMyGifts = openMyGifts;
window.sellGift = sellGift;
window.openGiftModal = openGiftModal;
window.redeemGiftCode = redeemGiftCode;
window.openGiftAdminModal = openGiftAdminModal;
window.loadGiftCodes = loadGiftCodes;
window.generateGiftCode = generateGiftCode;
window.copyText = copyText;
window.openAchievements = openAchievements;
window.openStats = openStats;
window.openModPanel = openModPanel;
window.closeModPanel = closeModPanel;
window.switchModTab = switchModTab;
window.handleReportAction = handleReportAction;
window.openPunishDurationModal = openPunishDurationModal;
window.modBanFromProfile = modBanFromProfile;
window.modMuteFromProfile = modMuteFromProfile;
window.modWarnFromProfile = modWarnFromProfile;
window.submitModBan = submitModBan;
window.submitReport = submitReport;
window.openReportModal = openReportModal;
window.openBadgeModal = openBadgeModal;
window.openBadgeModalForCurrent = openBadgeModalForCurrent;
window.selectBadgeType = selectBadgeType;
window.giveBadgeAction = giveBadgeAction;
window.removeBadgeAction = removeBadgeAction;
window.doVerifyChannel = doVerifyChannel;
window.openCreateBotModal = openCreateBotModal;
window.addBotCommandRow = addBotCommandRow;
window.uploadBotAvatar = uploadBotAvatar;
window.doCreateBot = doCreateBot;
window.openMyBots = openMyBots;
window.openEditBot = openEditBot;
window.doUpdateBot = doUpdateBot;
window.confirmDeleteBot = confirmDeleteBot;
window.openFindBotModal = openFindBotModal;
window.doFindBot = doFindBot;
window.addFoundBot = addFoundBot;
window.addEditBotCommandRow = addEditBotCommandRow;
window.openBotControl = openBotControl;
window.switchBotControlTab = switchBotControlTab;
window.addBotOperator = addBotOperator;
window.removeBotOperator = removeBotOperator;
window.openBotChat = openBotChat;
window.closeBotChat = closeBotChat;
window.sendBotMessage = sendBotMessage;
window.cancelBotReply = cancelBotReply;
window.openBotGiftPicker = openBotGiftPicker;
window.sendBotGift = sendBotGift;
window.openCreateGroupModal = openCreateGroupModal;
window.doCreateGroup = doCreateGroup;
window.openGroupInfo = openGroupInfo;
window.openEditGroup = openEditGroup;
window.doEditGroup = doEditGroup;
window.openAddMembers = openAddMembers;
window.doAddMembers = doAddMembers;
window.confirmLeaveGroup = confirmLeaveGroup;
window.confirmDeleteGroup = confirmDeleteGroup;
window.openCreateChannelModal = openCreateChannelModal;
window.doCreateChannel = doCreateChannel;
window.openChannelChat = openChannelChat;
window.closeChannelChat = closeChannelChat;
window.sendChannelPost = sendChannelPost;
window.openChannelInfo = openChannelInfo;
window.createChannelInvite = createChannelInvite;
window.copyInviteCode = copyInviteCode;
window.openEditChannel = openEditChannel;
window.doEditChannel = doEditChannel;
window.confirmDeleteChannel = confirmDeleteChannel;
window.confirmLeaveChannel = confirmLeaveChannel;
window.openFindChannelModal = openFindChannelModal;
window.doFindChannel = doFindChannel;
window.openChannelComments = openChannelComments;
window.submitChannelComment = submitChannelComment;
window.openSearchInChat = openSearchInChat;
window.openGallery = openGallery;
window.openChatMenuV2 = openChatMenuV2;
window.chatMenuToggleMute = chatMenuToggleMute;
window.chatMenuToggleArchive = chatMenuToggleArchive;
window.chatMenuTogglePin = chatMenuTogglePin;
window.openClearHistoryConfirm = openClearHistoryConfirm;
window.confirmClearHistory = confirmClearHistory;
window.openWallpaperPicker = openWallpaperPicker;
window.removeChatWallpaper = removeChatWallpaper;
window.openStoryAddModal = openStoryAddModal;
window.onStoryFileSelected = onStoryFileSelected;
window.submitStory = submitStory;
window.openStoryViewer = openStoryViewer;
window.nextStory = nextStory;
window.prevStory = prevStory;
window.closeStoryViewer = closeStoryViewer;
window.deleteCurrentStory = deleteCurrentStory;
window.openStoryViewers = openStoryViewers;
window.startCall = startCall;
window.declineIncoming = declineIncoming;
window.acceptIncoming = acceptIncoming;
window.toggleMic = toggleMic;
window.toggleCamera = toggleCamera;
window.hangUp = hangUp;
window.toggleScreenShare = toggleScreenShare;
window.sendMsg = sendMsg;
window.onInputTyping = onInputTyping;
window.sendPhoto = sendPhoto;
window.toggleVoiceRecording = toggleVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.startCircleRecording = startCircleRecording;
window.cancelCircle = cancelCircle;
window.sendCircle = sendCircle;
window.toggleStickersPanel = toggleStickersPanel;
window.switchStickerTab = switchStickerTab;
window.onStickerSearch = onStickerSearch;
window.uploadSticker = uploadSticker;
window.removeSticker = removeSticker;
window.submitGifUrl = submitGifUrl;
window.toggleSpoilerMode = toggleSpoilerMode;
window.actionReply = actionReply;
window.cancelReply = cancelReply;
window.actionCopy = actionCopy;
window.actionSave = actionSave;
window.actionEdit = actionEdit;
window.doEditMessage = doEditMessage;
window.actionDelete = actionDelete;
window.actionPin = actionPin;
window.actionReport = actionReport;
window.applyReaction = applyReaction;
window.scrollToBottom = scrollToBottom;
window.scrollToPinned = scrollToPinned;
window.hideReactionMenu = hideReactionMenu;
window.hideActionMenu = hideActionMenu;
window.openSavedChat = openSavedChat;
window.closeChat = closeChat;
window.sendGeo = sendGeo;
window.toggleArchiveView = toggleArchiveView;
window.toggleBlockCurrent = toggleBlockCurrent;
window.sendSticker = sendSticker;
window.openModBanUserModal = openModBanUserModal;
window.openBotGiftPicker = openBotGiftPicker;
window.openLightbox = openLightbox;
window.openModal = openModal;
window.closeModal = closeModal;
window.pickAvatarMedia = pickAvatarMedia;
window.pickBannerMedia = pickBannerMedia;
window.removeMyBanner = removeMyBanner;
window.showBotInfoModal = showBotInfoModal;
window.copyQrLink = copyQrLink;
window.updateMyAvatarBtn = updateMyAvatarBtn;
window.ensureAuthorized = ensureAuthorized;
window.doAddContactReal = doAddContactReal;
window.showCacheSize = showCacheSize;
window.hideSplash = hideSplash;
window.toast = toast;
window.state = state;
window.socket = socket;

console.log('%c✅ Azerta v13.7 — Client загружен', 'color:#4ade80;font-weight:bold;font-size:14px');
console.log('%cИсправлено: незакрытый IIFE, двойной openContactProfile, wrapAvatarRenderer, спойлеры в истории, дубли и мёртвый код', 'color:#8b7fff');
console.log('%cГотово', 'color:#4ade80');
