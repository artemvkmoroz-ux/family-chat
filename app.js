'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AURORA v10.2 — Client (полная поддержка ✓ 🔨 💀)
   ═══════════════════════════════════════════════════════════ */

// Глобальная переменная для открытого профиля контакта
var contactProfileCurrent = null;

// 🔧 NEW: текущий выбранный тип значка в badge-modal
var currentBadgeType = 'verified';

const state = {
  me: { username: null, avatar: null, verified: false, bio: '', firstName: '', lastName: '', birthday: '', emoji: '', stars: 0, sessionId: null, hammer: false, scam: false },
  contacts: [], groups: [], channels: [], unread: {}, typingUsers: {}, blockedList: [], giftsCatalog: {},
  currentChat: null, currentGroup: null, currentChannel: null, isSavedChat: false,
  activeTab: 'chats', showArchived: false, settings: {},
  authMode: 'login', regStep: 1, regUsernameAvailable: false, regUsernameCheckTimer: null,
  replyToMessage: null, editingMessageId: null, pinnedMessageId: null,
  activeReactionMsgId: null, activeReactionGroupId: null, activeMessage: null,
  qrFoundUser: null, currentGiftTarget: null,
  currentChannelPostId: null, currentInviteCode: null,
  stickersData: [], stickerRecent: [], stickerCurrentTab: 'recent', stickerSearchQuery: '',
  storiesUsers: [], currentStoryUserIdx: 0, currentStoryIdx: 0, storyTimer: null, storyTimerStart: 0,
  peerConnection: null, localStream: null, callActive: false, micOn: true, camOn: true,
  pendingOffer: null, incomingFrom: null, incomingVideo: false,
  callTimerInterval: null, callStartTime: 0,
  screenStream: null, screenTrack: null, isScreenSharing: false,
  mediaRecorder: null, audioChunks: [], isRecording: false, cancelledRecording: false,
  recordingStartTime: 0, recordingTimer: null, currentAudioMime: '',
  circleStream: null, circleRecorder: null, circleChunks: [], circleTimer: null,
  circleStartTime: 0, circleMime: '',
  lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  galleryWaiting: false, notificationsAllowed: false, reconnectAttempts: 0,
  titleFlashInterval: null, myTypingTimeout: null, typingTimeouts: {},
  createSelected: new Set(), addMembersSelected: new Set(),
  currentColorTarget: null, toastTimeout: null, bootTimeoutId: null, isLoggedIn: false,
  chatWallpapers: {},
};

const STORAGE = {
  SESSION: 'aurora-session', UNREAD: 'aurora-unread',
  CONTACTS_CACHE: 'aurora-contacts-cache', GROUPS_CACHE: 'aurora-groups-cache',
  RECENT_STICKERS: 'aurora-recent-stickers', SETTINGS: 'aurora-settings-cache',
  WALLPAPERS: 'aurora-wallpapers',
};

const STORY_DURATION = 5000;
const SWIPE_THRESHOLD = 60;
const MAX_RECORDING_SEC = 60;
const MAX_CIRCLE_SEC = 30;

const BUILTIN_GIFS = [
  { emoji: '😀', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
  { emoji: '😍', url: 'https://media.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif' },
  { emoji: '😂', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif' },
  { emoji: '😎', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { emoji: '👍', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { emoji: '❤️', url: 'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif' },
  { emoji: '🔥', url: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif' },
  { emoji: '🎉', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
  { emoji: '🤔', url: 'https://media.giphy.com/media/3o7aCSPqXE5C6T8tBC/giphy.gif' },
  { emoji: '😢', url: 'https://media.giphy.com/media/d2lcHJTG5Tscg/giphy.gif' },
  { emoji: '🙈', url: 'https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif' },
  { emoji: '🚀', url: 'https://media.giphy.com/media/3o7TKu8av7E0e1dFS0/giphy.gif' },
  { emoji: '🐱', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { emoji: '🐶', url: 'https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif' },
  { emoji: '🍕', url: 'https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif' },
  { emoji: '👏', url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif' },
];

// ─── УТИЛИТЫ ───
function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  if (p.length >= 2 && p[0] && p[1]) return (p[0][0] + p[1][0]).toUpperCase();
  return String(name || '?').slice(0, 2).toUpperCase();
}

function now() { return Date.now(); }

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(d) {
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function timeAgo(ms) {
  const diff = now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч назад';
  return Math.floor(h / 24) + ' дн назад';
}

function displayNameForUser(username) {
  if (username === state.me.username) return 'Я';
  const c = state.contacts.find(function (c) { return c.name === username; });
  return c && c.displayName ? c.displayName : username;
}

// 🔧 NEW: Рендер значков (✓ 🔨 💀) — может быть несколько одновременно
function renderBadges(user) {
  if (!user) return '';
  let html = '';
  if (user.verified) html += '<span class="verified-badge" title="Верифицирован">✓</span>';
  if (user.hammer) html += '<span class="hammer-badge" title="Модератор">🔨</span>';
  if (user.scam) html += '<span class="scam-badge" title="Мошенник">💀</span>';
  return html;
}

// 🔧 NEW: Рендер значков увеличенного размера (для профиля)
function renderBadgesBig(user) {
  if (!user) return '';
  let html = '';
  if (user.verified) html += '<span class="verified-badge big" title="Верифицирован">✓</span>';
  if (user.hammer) html += '<span class="hammer-badge big" title="Модератор">🔨</span>';
  if (user.scam) html += '<span class="scam-badge big" title="Мошенник">💀</span>';
  return html;
}

function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : null);
  } catch (e) { return fallback !== undefined ? fallback : null; }
}

function vibrate(ms) {
  if (state.settings.vibration === 0 || state.settings.vibration === '0') return;
  if ('vibrate' in navigator) {
    try { navigator.vibrate(ms || [10, 20, 10]); } catch (e) {}
  }
}

// ─── TOGGLE PASSWORD ───
function togglePassword(inputId) {
  const input = $(inputId);
  if (!input) return;
  const btn = input.parentElement.querySelector('.auth-toggle-password');
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) { btn.textContent = '🙈'; btn.classList.add('showing'); }
  } else {
    input.type = 'password';
    if (btn) { btn.textContent = '👁'; btn.classList.remove('showing'); }
  }
  vibrate(10);
}

// ─── SPINNER НА КНОПКАХ ───
function showBtnSpinner(btnId, text) {
  const btn = $(btnId);
  if (!btn) return;
  const textEl = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  if (textEl && text) textEl.textContent = text;
  if (spinner) spinner.style.display = 'inline-flex';
  btn.disabled = true;
}
function hideBtnSpinner(btnId, text) {
  const btn = $(btnId);
  if (!btn) return;
  const textEl = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  if (textEl && text) textEl.textContent = text;
  if (spinner) spinner.style.display = 'none';
  btn.disabled = false;
}

// ─── RIPPLE ───
document.addEventListener('touchstart', function (e) {
  const btn = e.target.closest('.auth-btn-primary, .modal-primary, .modal-secondary, .modal-danger, .nav-btn, .create-menu-btn, .settings-item');
  if (!btn) return;
  btn.style.transform = 'scale(0.97)';
}, { passive: true });
document.addEventListener('touchend', function (e) {
  const btn = e.target.closest('.auth-btn-primary, .modal-primary, .modal-secondary, .modal-danger, .nav-btn, .create-menu-btn, .settings-item');
  if (!btn) return;
  setTimeout(function () { btn.style.transform = ''; }, 100);
}, { passive: true });

// ─── SPLASH ───
const splashStart = now();
let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const sp = $('splash-screen');
  if (sp && !sp.classList.contains('hide')) {
    sp.classList.add('hide');
    setTimeout(function () { if (sp.parentNode) sp.remove(); }, 500);
  }
}
setTimeout(hideSplash, 2000);
setTimeout(hideSplash, 3000);

// ─── ГЛОБАЛЬНЫЕ ОШИБКИ ───
function showErrorScreen(text) {
  console.error('❌ Aurora error:', text);
  const screen = $('error-screen');
  const textEl = $('error-text');
  if (screen && textEl) {
    textEl.textContent = text;
    screen.classList.add('active');
  }
}
window.addEventListener('error', function (e) {
  showErrorScreen(e.message + '\n' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
  showErrorScreen('Promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// ─── SOCKET ───
const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
});

// ─── MODAL HELPERS ───
function openModal(id) { const m = $(id); if (m) m.classList.add('active'); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove('active'); }

document.querySelectorAll('.modal').forEach(function (m) {
  m.addEventListener('click', function (e) {
    if (e.target === m) {
      m.classList.remove('active');
      if (m.id === 'contact-profile-modal') {
        contactProfileCurrent = null;
        state.contactProfileCurrent = null;
      }
    }
  });
});

function closeContactProfile() {
  closeModal('contact-profile-modal');
  contactProfileCurrent = null;
  state.contactProfileCurrent = null;
}

// ─── TOAST ───
function showToast(text) {
  let toast = $('aurora-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'aurora-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  requestAnimationFrame(function () { toast.classList.add('show'); });
  if (state.toastTimeout) clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(function () { toast.classList.remove('show'); }, 3000);
}

// ─── CONNECTION STATUS ───
function setConnStatus(type, text) {
  const el = $('conn-status');
  const textEl = $('conn-text');
  if (!el || !textEl) return;
  el.classList.remove('connected', 'slow', 'offline', 'reconnecting');
  el.classList.add(type, 'show');
  textEl.textContent = text;
}
function hideConnStatus() {
  const el = $('conn-status');
  if (el) el.classList.remove('show');
}

// ─── АНИМАЦИЯ ВХОДА ───
function playLoginTransition(username, firstName, isAutoLogin) {
  state.isLoggedIn = true;
  if (state.bootTimeoutId) { clearTimeout(state.bootTimeoutId); state.bootTimeoutId = null; }
  const authEl = $('auth');
  const appEl = $('app');
  const flashEl = $('welcome-flash');
  const toastEl = $('welcome-toast');
  hideSplash();
  const bootEl = $('boot-timeout'); if (bootEl) bootEl.classList.remove('active');
  const passEl = $('passcode-screen'); if (passEl) passEl.classList.remove('active');

  if (authEl && authEl.classList.contains('active')) {
    authEl.classList.add('auth-exit');
    setTimeout(function () {
      authEl.classList.remove('active');
      authEl.classList.remove('auth-exit');
    }, 450);
  } else if (authEl) { authEl.classList.remove('active'); }

  if (appEl) {
    appEl.classList.add('active');
    appEl.classList.remove('app-enter');
    void appEl.offsetWidth;
    appEl.classList.add('app-enter');
    setTimeout(function () { appEl.classList.remove('app-enter'); }, 700);
  }
  if (flashEl) {
    flashEl.classList.remove('active');
    void flashEl.offsetWidth;
    flashEl.classList.add('active');
    setTimeout(function () { flashEl.classList.remove('active'); }, 1000);
  }
  if (!isAutoLogin && toastEl) {
    const displayName = (firstName && firstName.trim()) || username || 'друг';
    const emoji = toastEl.querySelector('.wt-emoji');
    const nameEl = toastEl.querySelector('.wt-name');
    const subEl = toastEl.querySelector('.wt-sub');
    if (nameEl) nameEl.textContent = 'Привет, ' + displayName + '!';
    if (subEl) subEl.textContent = 'С возвращением в Aurora';
    if (emoji) {
      const emojis = ['👋', '🌌', '✨', '🚀', '💫'];
      emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    }
    toastEl.classList.remove('active');
    void toastEl.offsetWidth;
    toastEl.classList.add('active');
    setTimeout(function () { toastEl.classList.remove('active'); }, 2200);
  }
  setTimeout(function () {
    updateMyAvatarBtn();
    updateVerifyButton();
    updateVerifyChannelButton();
    loadStories();
    renderChatList();
    renderStoriesBar();
    applyChatWallpaper();
  }, 200);
}

// ─── AUTH SCREENS ───
function switchAuthScreen(screen) {
  document.querySelectorAll('.auth-screen').forEach(function (s) { s.classList.remove('active'); });
  if (screen === 'login') {
    $('auth-login-screen').classList.add('active');
    state.authMode = 'login';
    state.regStep = 1;
  } else {
    $('auth-register-screen').classList.add('active');
    state.authMode = 'register';
    state.regStep = 1;
    regShowStep(1);
  }
  vibrate(10);
}

function regShowStep(step) {
  state.regStep = step;
  document.querySelectorAll('.reg-progress-seg').forEach(function (seg) {
    const s = Number(seg.dataset.step);
    seg.classList.toggle('active', s === step);
    seg.classList.toggle('done', s < step);
  });
  const backBtn = $('reg-back-btn');
  if (backBtn) backBtn.classList.toggle('show', step > 1);
  document.querySelectorAll('.reg-step-card').forEach(function (el) {
    const s = Number(el.dataset.step);
    if (s === step) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  setTimeout(function () {
    if (step === 1) { const el = $('reg-username'); if (el) el.focus(); }
    else if (step === 2) { const el = $('reg-displayname'); if (el) el.focus(); }
    else if (step === 3) { const el = $('reg-password'); if (el) el.focus(); }
  }, 200);
  vibrate(10);
}

function regNext(step) {
  if (step === 1) {
    if (!state.regUsernameAvailable) return;
    regShowStep(2);
  } else if (step === 2) {
    const dn = $('reg-displayname').value.trim();
    if (!dn) { $('reg-error-2').textContent = 'Введи имя'; return; }
    $('reg-error-2').textContent = '';
    regShowStep(3);
  }
}
function regBack() {
  if (state.regStep > 1) regShowStep(state.regStep - 1);
  vibrate(10);
}

function onRegUsernameInput() {
  const input = $('reg-username');
  const wrap = $('reg-username-wrap');
  const status = $('reg-username-status');
  const hint = $('reg-username-hint');
  const nextBtn = $('reg-next-1');
  const v = input.value.trim().toLowerCase();
  input.value = v;
  wrap.classList.remove('error', 'success', 'focus');
  status.textContent = '';
  hint.classList.remove('error', 'success');
  nextBtn.disabled = true;
  state.regUsernameAvailable = false;
  if (!v) { hint.textContent = 'Минимум 3 символа'; return; }
  if (v.length < 3) { hint.textContent = 'Минимум 3 символа'; hint.classList.add('error'); return; }
  if (v.length > 20) { hint.textContent = 'Максимум 20 символов'; hint.classList.add('error'); return; }
  if (!/^[a-z0-9_]+$/.test(v)) {
    hint.textContent = 'Только латиница, цифры и _';
    hint.classList.add('error');
    wrap.classList.add('error');
    return;
  }
  hint.textContent = 'Проверяю...';
  status.textContent = '⏳';
  if (state.regUsernameCheckTimer) clearTimeout(state.regUsernameCheckTimer);
  state.regUsernameCheckTimer = setTimeout(function () {
    socket.emit('check username', { username: v }, function (res) {
      if (!res || res.ok !== true) {
        hint.textContent = 'Ошибка проверки';
        hint.classList.add('error');
        return;
      }
      if (res.available) {
        wrap.classList.add('success');
        status.textContent = '✅';
        hint.textContent = 'Свободен!';
        hint.classList.add('success');
        nextBtn.disabled = false;
        state.regUsernameAvailable = true;
        vibrate(15);
      } else {
        wrap.classList.add('error');
        status.textContent = '❌';
        const reasons = { taken: 'Этот ник занят', short: 'Слишком короткий', long: 'Слишком длинный', chars: 'Только латиница, цифры и _', empty: 'Введи ник' };
        hint.textContent = reasons[res.reason] || 'Недоступен';
        hint.classList.add('error');
        nextBtn.disabled = true;
        state.regUsernameAvailable = false;
        vibrate([30, 20, 30]);
      }
    });
  }, 350);
}

function onRegPasswordInput() {
  const p = $('reg-password').value;
  const bar = $('reg-strength-bar');
  const label = $('reg-strength-label');
  bar.classList.remove('weak', 'medium', 'strong');
  if (!p) {
    label.textContent = 'Введи пароль';
    label.style.color = '';
    bar.style.width = '0';
    onRegPassword2Input();
    return;
  }
  let score = 0;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  if (p.length < 8) { bar.classList.add('weak'); label.textContent = 'Слишком короткий (мин. 8)'; label.style.color = '#ef4444'; }
  else if (score <= 2) { bar.classList.add('weak'); label.textContent = 'Слабый — добавь цифры или заглавные'; label.style.color = '#ef4444'; }
  else if (score === 3) { bar.classList.add('medium'); label.textContent = 'Средний'; label.style.color = '#fbbf24'; }
  else { bar.classList.add('strong'); label.textContent = 'Сильный 💪'; label.style.color = '#22c55e'; }
  onRegPassword2Input();
}

function onRegPassword2Input() {
  const p = $('reg-password').value;
  const p2 = $('reg-password2').value;
  const hint = $('reg-password2-hint');
  if (!p2) { hint.textContent = ''; hint.classList.remove('success', 'error'); }
  else if (p === p2) { hint.textContent = '✓ Совпадают'; hint.classList.add('success'); hint.classList.remove('error'); }
  else { hint.textContent = 'Пароли не совпадают'; hint.classList.add('error'); hint.classList.remove('success'); }
  updateRegSubmit();
}

function updateRegSubmit() {
  const btn = $('reg-submit');
  if (!btn) return;
  const p = $('reg-password').value;
  const p2 = $('reg-password2').value;
  const dn = $('reg-displayname').value.trim();
  const valid = p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p) && p === p2 && dn && state.regUsernameAvailable;
  btn.disabled = !valid;
}

function doRegister() {
  const username = $('reg-username').value.trim().toLowerCase();
  const displayName = $('reg-displayname').value.trim();
  const password = $('reg-password').value;
  const errEl = $('reg-error-3');
  errEl.textContent = '';
  showBtnSpinner('reg-submit', 'Создаю…');
  socket.emit('register', { username: username, password: password, displayName: displayName }, function (res) {
    hideBtnSpinner('reg-submit', 'Создать аккаунт');
    if (!res || !res.ok) {
      errEl.textContent = res && res.error ? res.error : 'Ошибка регистрации';
      vibrate([30, 20, 30]);
      return;
    }
    saveJson(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
    showToast('🎉 Добро пожаловать! +' + res.bonus + ' ⭐');
    vibrate([50, 30, 50]);
  });
}

function doLogin() {
  const username = $('login-username').value.trim().toLowerCase();
  const password = $('login-password').value;
  const errEl = $('login-error');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Заполни все поля'; vibrate([30, 20, 30]); return; }
  showBtnSpinner('login-btn', 'Вхожу…');
  const existing = loadJson(STORAGE.SESSION);
  socket.emit('login', {
    username: username,
    password: password,
    device: (navigator.userAgent || '').slice(0, 40),
    sessionId: existing ? existing.sessionId : null
  }, function (res) {
    hideBtnSpinner('login-btn', 'Войти');
    if (!res || !res.ok) {
      errEl.textContent = res && res.error ? res.error : 'Ошибка входа';
      vibrate([30, 20, 30]);
      return;
    }
    saveJson(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
    onLoggedIn(res, false);
  });
}

function onLoggedIn(res, isAutoLogin) {
  state.me.username = res.username;
  state.me.avatar = res.avatar || null;
  state.me.verified = !!res.verified;
  state.me.hammer = !!res.hammer;
  state.me.scam = !!res.scam;
  state.me.bio = res.bio || '';
  state.me.firstName = res.firstName || '';
  state.me.lastName = res.lastName || '';
  state.me.birthday = res.birthday || '';
  state.me.emoji = res.emojiStatus || '';
  state.me.sessionId = res.sessionId;
  state.me.stars = Number(res.stars || 0);
  state.chatWallpapers = loadJson(STORAGE.WALLPAPERS, {}) || {};
  playLoginTransition(res.username, res.firstName, !!isAutoLogin);
  setTimeout(function () {
    socket.emit('get gifts catalog', function (r) {
      if (r && r.ok) state.giftsCatalog = r.catalog || {};
    });
  }, 200);
}

function tryPasscode() {
  const passcode = $('passcode-input').value;
  const errEl = $('passcode-error');
  errEl.textContent = '';
  socket.emit('check passcode', { passcode: passcode }, function (res) {
    if (!res || !res.ok) { errEl.textContent = 'Неверный код'; vibrate([30, 20, 30]); return; }
    $('passcode-screen').classList.remove('active');
    playLoginTransition(state.me.username, state.me.firstName, true);
  });
}
document.addEventListener('keydown', function (e) {
  const p = $('passcode-input');
  if (e.key === 'Enter' && p && document.activeElement === p) tryPasscode();
});

// ─── АВАРИЙНЫЙ ТАЙМАУТ ───
function startBootTimeout() {
  if (state.bootTimeoutId) clearTimeout(state.bootTimeoutId);
  state.bootTimeoutId = setTimeout(function () {
    if (!state.isLoggedIn && !$('app').classList.contains('active')) {
      const bootEl = $('boot-timeout');
      if (bootEl) bootEl.classList.add('active');
    }
  }, 8000);
}

function forceShowLogin() {
  const bootEl = $('boot-timeout');
  if (bootEl) bootEl.classList.remove('active');
  localStorage.removeItem(STORAGE.SESSION);
  $('app').classList.remove('active');
  $('auth').classList.add('active');
  state.isLoggedIn = false;
}

// ─── SOCKET CONNECT ───
let autoLoginDone = false;

async function tryAutoLogin() {
  const creds = loadJson(STORAGE.SESSION);
  if (!creds || !creds.sessionId) return false;
  return new Promise(function (resolve) {
    let resolved = false;
    const timeoutId = setTimeout(function () {
      if (resolved) return;
      resolved = true;
      resolve(false);
    }, 6000);
    socket.emit('login with session', { sessionId: creds.sessionId }, function (res) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (!res || !res.ok) {
        localStorage.removeItem(STORAGE.SESSION);
        resolve(false);
        return;
      }
      saveJson(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
      state.me.username = res.username;
      state.me.avatar = res.avatar || null;
      state.me.verified = !!res.verified;
      state.me.hammer = !!res.hammer;
      state.me.scam = !!res.scam;
      state.me.bio = res.bio || '';
      state.me.firstName = res.firstName || '';
      state.me.lastName = res.lastName || '';
      state.me.birthday = res.birthday || '';
      state.me.emoji = res.emojiStatus || '';
      state.me.sessionId = res.sessionId;
      state.me.stars = Number(res.stars || 0);
      state.chatWallpapers = loadJson(STORAGE.WALLPAPERS, {}) || {};
      socket.emit('get gifts catalog', function (r) {
        if (r && r.ok) state.giftsCatalog = r.catalog || {};
      });
      socket.emit('has passcode', function (has) {
        if (has) {
          $('passcode-screen').classList.add('active');
        } else {
          playLoginTransition(res.username, res.firstName, true);
        }
      });
      resolve(true);
    });
  });
}

socket.on('connect', async function () {
  setConnStatus('reconnecting', 'Aurora: проверяю связь…');
  setTimeout(hideConnStatus, 2000);
  state.reconnectAttempts = 0;
  if (autoLoginDone) return;
  const ok = await tryAutoLogin();
  if (!ok) $('auth').classList.add('active');
  autoLoginDone = true;
});

socket.on('disconnect', function () {
  setConnStatus('offline', 'Aurora: связь потеряна 😴');
});

socket.on('connect_error', function () {
  state.reconnectAttempts++;
  const msgs = [
    'Aurora: пробую ещё раз… 🔄',
    'Aurora: интернет уснул 💤',
    'Aurora: слабый интернет 😔',
    'Aurora: сервер далеко 🌍',
    'Aurora: ещё чуть-чуть… 🐢'
  ];
  setConnStatus('reconnecting', msgs[Math.min(state.reconnectAttempts - 1, msgs.length - 1)]);
});

socket.io.on('reconnect', function () {
  setConnStatus('connected', 'Aurora: снова с тобой ✨');
  state.reconnectAttempts = 0;
  setTimeout(hideConnStatus, 2500);
  if (state.isLoggedIn) loadStories();
});

// ─── УВЕДОМЛЕНИЯ ───
function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') state.notificationsAllowed = true;
  else if (Notification.permission === 'default') {
    const b = $('notif-banner');
    if (b) setTimeout(function () { b.classList.add('active'); }, 1500);
  }
}

async function enableNotifications() {
  $('notif-banner').classList.remove('active');
  if (!('Notification' in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      state.notificationsAllowed = true;
      new Notification('Aurora', { body: 'Уведомления включены! 🎉' });
    }
  } catch (e) {}
}

function playPing() {
  if (state.settings.sound === 0 || state.settings.sound === '0') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function showBrowserNotification(from, text) {
  if (!state.notificationsAllowed) return;
  try {
    const n = new Notification(from, { body: text });
    n.onclick = function () { window.focus(); n.close(); };
  } catch (e) {}
}

// ─── TITLE ───
function updateTitle() {
  const total = Object.values(state.unread).reduce(function (a, b) { return a + b; }, 0);
  if (total > 0) {
    if (!state.titleFlashInterval) {
      let on = true;
      state.titleFlashInterval = setInterval(function () {
        document.title = on ? '(' + total + ') Aurora' : 'Aurora';
        on = !on;
      }, 1000);
    }
  } else {
    if (state.titleFlashInterval) {
      clearInterval(state.titleFlashInterval);
      state.titleFlashInterval = null;
    }
    document.title = 'Aurora';
  }
  const navBadge = $('nav-badge-chats');
  if (navBadge) {
    if (total > 0 && state.activeTab !== 'chats') {
      navBadge.textContent = total > 99 ? '99+' : total;
      navBadge.style.display = 'block';
    } else {
      navBadge.style.display = 'none';
    }
  }
}

// ─── SETTINGS ───
function applyLocalSettings() {
  const s = state.settings;
  if (s.theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  if (s.animations === 0 || s.animations === '0') document.body.classList.add('no-anim');
  else document.body.classList.remove('no-anim');
  if (s.premium === 0 || s.premium === '0') document.body.classList.remove('premium');
  else document.body.classList.add('premium');
  const sizes = { small: '13px', medium: '15px', large: '17px' };
  document.documentElement.style.setProperty('--font-size', sizes[s.font_size] || '15px');
  if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);
}

socket.on('settings', function (s) {
  state.settings = s || {};
  if (state.settings.stars !== undefined) state.me.stars = Number(state.settings.stars);
  saveJson(STORAGE.SETTINGS, state.settings);
  applyLocalSettings();
  if ($('settings-screen').classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});

socket.on('stars updated', function (data) {
  state.me.stars = Number((data && data.stars) || 0);
  const b = $('gifts-catalog-balance');
  if (b) b.textContent = state.me.stars;
  if ($('settings-screen').classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});

// ─── TABS ───
const TAB_TITLES = { chats: 'Aurora', calls: 'Звонки', contacts: 'Контакты', settings: 'Настройки' };

function switchTab(tab) {
  state.activeTab = tab;
  const app = $('app');
  app.dataset.tab = tab;
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const h2 = document.querySelector('#main-header h2');
  if (h2) h2.textContent = TAB_TITLES[tab] || 'Aurora';
  document.querySelectorAll('.app-tab').forEach(function (t) { t.classList.remove('active'); });
  if (tab === 'chats') {
    const sw = $('search-wrap');
    if (sw) sw.style.display = '';
    renderChatList();
    renderStoriesBar();
  } else {
    const tabEl = $('tab-' + tab);
    if (tabEl) tabEl.classList.add('active');
    const sw = $('search-wrap');
    if (sw) sw.style.display = 'none';
    if (tab === 'calls') renderCallsTab();
    else if (tab === 'contacts') renderContactsTab();
    else if (tab === 'settings') renderSettingsTab();
  }
  if (tab === 'chats') {
    const b = $('nav-badge-chats');
    if (b) b.style.display = 'none';
  }
}

function renderCallsTab() {
  const box = $('calls-list');
  if (box) box.innerHTML = '';
}

// ─── SETTINGS SCREEN ───
function openSettings() {
  $('settings-screen').classList.add('active');
  renderSettings();
}

function closeSettings() {
  $('settings-screen').classList.remove('active');
  renderChatList();
}

function renderSettingsTab() {
  const box = $('tab-settings-content');
  if (!box) return;
  const orig = $('settings-content');
  if (orig) {
    renderSettings();
    box.innerHTML = orig.innerHTML;
  }
}

function renderSettings() {
  const box = $('settings-content');
  if (!box) return;
  const me = state.me;
  const s = state.settings;
  const displayName = (me.firstName || me.lastName)
    ? (me.firstName + ' ' + me.lastName).trim()
    : '@' + me.username;
  const emojiStr = me.emoji ? ' ' + me.emoji : '';
  const tick = renderBadges(me);
  const isAdmin = me.username === 'moroz';
  const avatarStyle = me.avatar ? 'background-image:url(' + me.avatar + ')' : '';
  const avatarContent = me.avatar ? '' : initials(me.username);
  let html = '';

  html += '<div class="stars-balance" onclick="openStarsHistory()"><span class="star-icon">⭐</span><div class="stars-info"><div class="stars-count">' + me.stars + (isAdmin ? '∞' : '') + '</div><div class="stars-label">звёзды · нажми для истории</div></div><div class="si-arrow" style="color:var(--text-muted);font-size:16px;">›</div></div>';

  html += '<div class="settings-profile-card" onclick="openProfile()"><div class="avatar" style="' + avatarStyle + '">' + avatarContent + '</div><div class="info"><div class="name">' + escapeHtml(displayName) + emojiStr + tick + '</div><div class="sub">@' + escapeHtml(me.username) + '</div></div><div class="si-arrow">›</div></div>';

  html += '<div class="settings-section"><div class="settings-section-title">Мой QR-код</div><div class="settings-item" onclick="showMyQr()"><div class="si-icon">📱</div><div class="si-text">Показать QR-код</div><div class="si-arrow">›</div></div></div>';

  html += '<div class="settings-section"><div class="settings-section-title">Подарки и премиум</div>';
  html += '<div class="settings-item" onclick="openMyGifts()"><div class="si-icon">🎁</div><div class="si-text">Мои подарки</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="openGiftModal()"><div class="si-icon">💳</div><div class="si-text">Активировать премиум по коду</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="toggleSetting(\'premium\')"><div class="si-icon">✨</div><div class="si-text">Премиум-дизайн</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.premium != 0 ? 'checked' : '') + ' onchange="toggleSetting(\'premium\')" /><span class="slider"></span></label></div>';
  if (isAdmin) html += '<div class="settings-item" onclick="openGiftAdminModal()"><div class="si-icon">🔑</div><div class="si-text">Управление кодами</div><div class="si-arrow">›</div></div>';
  html += '</div>';

  html += '<div class="settings-section"><div class="settings-section-title">Уведомления и звуки</div>';
  html += '<div class="settings-item" onclick="toggleSetting(\'sound\')"><div class="si-icon">🔔</div><div class="si-text">Звук</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.sound == 1 ? 'checked' : '') + ' onchange="toggleSetting(\'sound\')" /><span class="slider"></span></label></div>';
  html += '<div class="settings-item" onclick="toggleSetting(\'vibration\')"><div class="si-icon">📳</div><div class="si-text">Вибрация</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.vibration == 1 ? 'checked' : '') + ' onchange="toggleSetting(\'vibration\')" /><span class="slider"></span></label></div>';
  html += '<div class="settings-item" onclick="toggleSetting(\'notif_private\')"><div class="si-icon">💬</div><div class="si-text">Личные чаты</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.notif_private == 1 ? 'checked' : '') + ' onchange="toggleSetting(\'notif_private\')" /><span class="slider"></span></label></div>';
  html += '<div class="settings-item" onclick="toggleSetting(\'notif_groups\')"><div class="si-icon">👥</div><div class="si-text">Группы</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.notif_groups == 1 ? 'checked' : '') + ' onchange="toggleSetting(\'notif_groups\')" /><span class="slider"></span></label></div>';
  html += '</div>';

  html += '<div class="settings-section"><div class="settings-section-title">Конфиденциальность</div>';
  html += '<div class="settings-item" onclick="openPasscodeModal()"><div class="si-icon">🔐</div><div class="si-text">Код-пароль</div><div class="si-value">' + (s.passcode ? 'Включён' : 'Выключен') + '</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="changeLastSeen()"><div class="si-icon">👁</div><div class="si-text">Последнее посещение</div><div class="si-value">' + lastSeenLabel() + '</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="openBlockedList()"><div class="si-icon">🚫</div><div class="si-text">Заблокированные</div><div class="si-value">' + state.blockedList.length + '</div><div class="si-arrow">›</div></div>';
  html += '</div>';

  html += '<div class="settings-section"><div class="settings-section-title">Устройства</div><div class="settings-item" onclick="openSessions()"><div class="si-icon">📱</div><div class="si-text">Активные сеансы</div><div class="si-arrow">›</div></div></div>';

  html += '<div class="settings-section"><div class="settings-section-title">Данные и память</div><div class="settings-item"><div class="si-icon">💾</div><div class="si-text">Размер кэша</div><div class="si-value" id="cache-size">…</div></div><div class="settings-item" onclick="clearCache()"><div class="si-icon">🧹</div><div class="si-text">Очистить кэш</div><div class="si-arrow">›</div></div></div>';

  html += '<div class="settings-section"><div class="settings-section-title">Энергосбережение</div><div class="settings-item" onclick="toggleSetting(\'animations\')"><div class="si-icon">⚡</div><div class="si-text">Отключить анимации</div><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (s.animations == 0 ? 'checked' : '') + ' onchange="toggleSetting(\'animations\')" /><span class="slider"></span></label></div></div>';

  html += '<div class="settings-section"><div class="settings-section-title">Оформление</div>';
  html += '<div class="settings-item" onclick="changeTheme()"><div class="si-icon">🎨</div><div class="si-text">Тема</div><div class="si-value">' + (s.theme === 'light' ? 'Светлая' : 'Тёмная') + '</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="changeFontSize()"><div class="si-icon">📏</div><div class="si-text">Размер текста</div><div class="si-value">' + fontLabel() + '</div><div class="si-arrow">›</div></div>';
  html += '<div class="settings-item" onclick="openColorPicker(\'accent_color\')"><div class="si-icon">🎯</div><div class="si-text">Акцентный цвет</div><div class="si-value" style="color:' + (s.accent_color || '#a855f7') + ';font-size:20px;">●</div><div class="si-arrow">›</div></div>';
  html += '</div>';

  html += '<div class="settings-section"><div class="settings-section-title">Аккаунт</div><div class="settings-item" onclick="logout()"><div class="si-icon">🚪</div><div class="si-text">Выйти</div><div class="si-arrow">›</div></div><div class="settings-item danger" onclick="openModal(\'delete-account-modal\')"><div class="si-icon">🗑</div><div class="si-text">Удалить аккаунт</div><div class="si-arrow">›</div></div></div>';

  html += '<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:12px;">🌌 Aurora v10.2<br><br>Сделано с ❤️</div>';

  box.innerHTML = html;
  setTimeout(showCacheSize, 100);
}

function lastSeenLabel() { return { everyone: 'Все', contacts: 'Контакты', nobody: 'Никто' }[state.settings.last_seen_visibility] || 'Все'; }
function fontLabel() { return { small: 'Маленький', medium: 'Средний', large: 'Большой' }[state.settings.font_size] || 'Средний'; }

function toggleSetting(key) {
  const cur = state.settings[key];
  const newVal = (cur == 1 || cur === '1') ? 0 : 1;
  socket.emit('update settings', { key: key, value: newVal }, function () {
    state.settings[key] = newVal;
    applyLocalSettings();
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeTheme() {
  const next = state.settings.theme === 'light' ? 'dark' : 'light';
  socket.emit('update settings', { key: 'theme', value: next }, function () {
    state.settings.theme = next;
    applyLocalSettings();
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeFontSize() {
  const order = ['small', 'medium', 'large'];
  const next = order[(order.indexOf(state.settings.font_size || 'medium') + 1) % order.length];
  socket.emit('update settings', { key: 'font_size', value: next }, function () {
    state.settings.font_size = next;
    applyLocalSettings();
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function changeLastSeen() {
  const options = ['everyone', 'contacts', 'nobody'];
  const cur = state.settings.last_seen_visibility || 'everyone';
  const next = options[(options.indexOf(cur) + 1) % options.length];
  socket.emit('set last seen visibility', { value: next }, function () {
    state.settings.last_seen_visibility = next;
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

function openColorPicker(target) {
  state.currentColorTarget = target;
  const colors = ['#a855f7','#ec4899','#6d28d9','#fbbf24','#22c55e','#06b6d4','#ef4444','#f97316','#8b5cf6','#14b8a6','#f43f5e','#3b82f6'];
  const grid = $('color-grid');
  grid.innerHTML = '';
  colors.forEach(function (c) {
    const dot = document.createElement('div');
    dot.className = 'color-dot';
    dot.style.background = c;
    if (state.settings[target] === c) dot.classList.add('active');
    dot.onclick = function () {
      socket.emit('update settings', { key: target, value: c }, function () {
        state.settings[target] = c;
        applyLocalSettings();
        closeModal('color-modal');
        renderSettings();
        if (state.activeTab === 'settings') renderSettingsTab();
      });
    };
    grid.appendChild(dot);
  });
  $('color-modal-title').textContent = 'Акцентный цвет';
  openModal('color-modal');
}

function openPasscodeModal() {
  $('passcode-new').value = '';
  $('passcode-confirm').value = '';
  $('passcode-error-modal').textContent = '';
  openModal('passcode-setup-modal');
}
function savePasscode() {
  const p1 = $('passcode-new').value;
  const p2 = $('passcode-confirm').value;
  const errEl = $('passcode-error-modal');
  errEl.textContent = '';
  if (p1.length < 4) { errEl.textContent = 'Минимум 4 символа'; return; }
  if (p1 !== p2) { errEl.textContent = 'Коды не совпадают'; return; }
  socket.emit('set passcode', { passcode: p1 }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    state.settings.passcode = 'set';
    closeModal('passcode-setup-modal');
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}
function removePasscode() {
  socket.emit('set passcode', { passcode: '' }, function () {
    state.settings.passcode = null;
    closeModal('passcode-setup-modal');
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

function openSessions() {
  socket.emit('get sessions', function (sessions) {
    const box = $('settings-content');
    let html = '<div class="settings-section-title">Активные сеансы</div>';
    if (!sessions || sessions.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Нет активных сессий</div>';
    } else {
      sessions.forEach(function (s) {
        const isCurrent = s.id === state.me.sessionId;
        const date = new Date(Number(s.last_active)).toLocaleString('ru-RU');
        html += '<div class="session-item"><div class="device">' + escapeHtml(s.device || 'Web') + (isCurrent ? ' <span style="color:#22c55e">— это устройство</span>' : '') + '</div>';
        html += '<div class="meta">Активность: ' + date + '</div>';
        if (!isCurrent) html += '<button onclick="terminateSession(\'' + s.id + '\')">Завершить</button>';
        html += '</div>';
      });
    }
    html += '<button class="modal-danger" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:var(--radius-md);" onclick="terminateAllOthers()">Завершить все другие</button>';
    html += '<button class="modal-secondary" style="margin:8px 16px;width:calc(100% - 32px);padding:14px;border-radius:var(--radius-md);" onclick="renderSettings()">Назад</button>';
    box.innerHTML = html;
  });
}
function terminateSession(sid) {
  if (!confirm('Завершить сеанс?')) return;
  socket.emit('terminate session', { sessionId: sid }, function () { openSessions(); });
}
function terminateAllOthers() {
  if (!confirm('Завершить все другие сеансы?')) return;
  socket.emit('delete all other sessions', function () { openSessions(); });
}

function openBlockedList() {
  socket.emit('get blocked', function (list) {
    state.blockedList = list || [];
    const box = $('settings-content');
    let html = '<div class="settings-section-title">Заблокированные (' + state.blockedList.length + ')</div>';
    if (state.blockedList.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Список пуст</div>';
    } else {
      state.blockedList.forEach(function (u) {
        html += '<div class="session-item"><div class="device">@' + escapeHtml(u) + '</div><button onclick="unblockUser(\'' + u + '\')">Разблокировать</button></div>';
      });
    }
    html += '<button class="modal-secondary" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:var(--radius-md);" onclick="renderSettings()">Назад</button>';
    box.innerHTML = html;
  });
}
function unblockUser(u) {
  socket.emit('unblock user', { username: u }, function () { openBlockedList(); });
}

function showCacheSize() {
  const el = $('cache-size');
  if (!el) return;
  let size = 0;
  try {
    for (const k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
        size += (localStorage[k].length + k.length) * 2;
      }
    }
  } catch (e) {}
  el.textContent = (size / 1024).toFixed(1) + ' КБ';
}
function clearCache() {
  if (!confirm('Очистить кэш?')) return;
  const session = localStorage.getItem(STORAGE.SESSION);
  const unread = localStorage.getItem(STORAGE.UNREAD);
  const wallpapers = localStorage.getItem(STORAGE.WALLPAPERS);
  localStorage.clear();
  if (session) localStorage.setItem(STORAGE.SESSION, session);
  if (unread) localStorage.setItem(STORAGE.UNREAD, unread);
  if (wallpapers) localStorage.setItem(STORAGE.WALLPAPERS, wallpapers);
  alert('Кэш очищен');
  showCacheSize();
}
function logout() {
  if (!confirm('Выйти из аккаунта?')) return;
  localStorage.removeItem(STORAGE.SESSION);
  localStorage.removeItem(STORAGE.UNREAD);
  localStorage.removeItem(STORAGE.CONTACTS_CACHE);
  localStorage.removeItem(STORAGE.GROUPS_CACHE);
  location.reload();
}
function confirmDeleteAccount() {
  const pass = $('delete-account-pass').value;
  const errEl = $('delete-account-error');
  errEl.textContent = '';
  if (!pass) { errEl.textContent = 'Введи пароль'; return; }
  socket.emit('delete account', { password: pass }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Не удалось'; return; }
    localStorage.clear();
    location.reload();
  });
}

// ─── ПРОФИЛЬ ───
function openProfile() {
  $('profile-username').textContent = '@' + (state.me.username || '');
  $('my-first-name').value = state.me.firstName || '';
  $('my-last-name').value = state.me.lastName || '';
  $('my-bio').value = state.me.bio || '';
  $('my-birthday').value = state.me.birthday || '';
  $('my-emoji').value = state.me.emoji || '';
  updateVerifyButton();
  updateVerifyChannelButton();
  openModal('profile-modal');
}

function saveProfile() {
  const firstName = $('my-first-name').value.trim();
  const lastName = $('my-last-name').value.trim();
  const bio = $('my-bio').value.trim();
  const birthday = $('my-birthday').value;
  const emojiStatus = $('my-emoji').value.trim();
  socket.emit('update profile', { firstName: firstName, lastName: lastName, bio: bio, birthday: birthday, emojiStatus: emojiStatus }, function (res) {
    if (res && res.ok) {
      state.me.firstName = firstName;
      state.me.lastName = lastName;
      state.me.bio = bio;
      state.me.birthday = birthday;
      state.me.emoji = emojiStatus;
      closeModal('profile-modal');
      renderChatList();
      showToast('✓ Профиль сохранён');
    }
  });
}

function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      state.me.avatar = canvas.toDataURL('image/jpeg', 0.8);
      socket.emit('set avatar', { avatar: state.me.avatar });
      updateMyAvatarBtn();
      closeModal('profile-modal');
      renderStoriesBar();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function updateMyAvatarBtn() {
  const btn = $('my-avatar-btn');
  if (!btn) return;
  if (state.me.avatar) btn.innerHTML = '<img src="' + state.me.avatar + '" alt="">';
  else btn.textContent = '👤';
}

function updateVerifyButton() {
  const btn = $('verify-btn');
  if (!btn) return;
  if (state.me.username === 'moroz') {
    btn.style.display = 'block';
    btn.onclick = function () { openBadgeModal(); };
  } else {
    btn.style.display = 'none';
  }
}

function updateVerifyChannelButton() {
  const btn = $('verify-channel-btn');
  if (!btn) return;
  if (state.me.username === 'moroz') {
    btn.style.display = 'block';
    btn.onclick = function () {
      $('verify-channel-slug').value = '';
      $('verify-channel-error').textContent = '';
      openModal('verify-channel-modal');
    };
  } else {
    btn.style.display = 'none';
  }
}

// 🔧 NEW: Открыть модалку выдачи значка
function openBadgeModal() {
  $('badge-username').value = '';
  $('badge-error').textContent = '';
  selectBadgeType('verified');
  openModal('badge-modal');
}

// 🔧 NEW: Открыть модалку выдачи значка из профиля контакта
function openBadgeModalForCurrent() {
  const u = (contactProfileCurrent && contactProfileCurrent.username) || (state.contactProfileCurrent && state.contactProfileCurrent.username);
  if (!u) return;
  closeModal('contact-profile-modal');
  $('badge-username').value = u;
  $('badge-error').textContent = '';
  selectBadgeType('verified');
  openModal('badge-modal');
}

// 🔧 NEW: Выбор типа значка в модалке
function selectBadgeType(type) {
  currentBadgeType = type;
  document.querySelectorAll('.badge-option').forEach(function (el) {
    el.classList.toggle('active', el.dataset.badge === type);
  });
  const titles = { verified: '✓ Выдать галочку', hammer: '🔨 Выдать молоток', scam: '💀 Выдать скам' };
  const titleEl = $('badge-modal-title');
  if (titleEl) titleEl.textContent = titles[type] || '🏅 Выдать значок';
  vibrate(10);
}

// 🔧 NEW: Выдать значок
function giveBadgeAction() {
  const username = $('badge-username').value.trim().toLowerCase();
  const errEl = $('badge-error');
  errEl.textContent = '';
  if (!username) { errEl.textContent = 'Введи ник'; return; }

  const events = { verified: 'verify', hammer: 'give hammer', scam: 'give scam' };
  const event = events[currentBadgeType];
  if (!event) { errEl.textContent = 'Неизвестный значок'; return; }

  socket.emit(event, { username: username }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('badge-modal');
    const names = { verified: 'Галочка', hammer: 'Молоток', scam: 'Скам' };
    showToast('✓ ' + names[currentBadgeType] + ' выдан @' + res.username);
  });
}

// 🔧 NEW: Снять значок
function removeBadgeAction() {
  const username = $('badge-username').value.trim().toLowerCase();
  const errEl = $('badge-error');
  errEl.textContent = '';
  if (!username) { errEl.textContent = 'Введи ник'; return; }

  const events = { verified: 'unverify', hammer: 'remove hammer', scam: 'remove scam' };
  const event = events[currentBadgeType];
  if (!event) { errEl.textContent = 'Неизвестный значок'; return; }

  socket.emit(event, { username: username }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('badge-modal');
    const names = { verified: 'Галочка', hammer: 'Молоток', scam: 'Скам' };
    showToast('✓ ' + names[currentBadgeType] + ' снят с @' + res.username);
  });
}

function doVerifyChannel() {
  const slug = $('verify-channel-slug').value.trim().toLowerCase();
  const errEl = $('verify-channel-error');
  errEl.textContent = '';
  if (!slug) { errEl.textContent = 'Введи ID канала'; return; }
  socket.emit('verify channel', { slug: slug }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('verify-channel-modal');
    showToast('✓ Галочка выдана каналу @' + res.slug);
  });
}

socket.on('me updated', function (data) {
  if (data.verified !== undefined) state.me.verified = !!data.verified;
  if (data.hammer !== undefined) state.me.hammer = !!data.hammer;
  if (data.scam !== undefined) state.me.scam = !!data.scam;
  if (data.avatar) state.me.avatar = data.avatar;
  if (data.bio !== undefined) state.me.bio = data.bio;
  if (data.firstName !== undefined) state.me.firstName = data.firstName;
  if (data.lastName !== undefined) state.me.lastName = data.lastName;
  if (data.birthday !== undefined) state.me.birthday = data.birthday;
  if (data.emojiStatus !== undefined) state.me.emoji = data.emojiStatus;
  updateVerifyButton();
  updateMyAvatarBtn();
  renderChatList();
  renderStoriesBar();
  if (state.activeTab === 'settings') renderSettingsTab();
});

// ─── КОНТАКТЫ ───
function doAddContact() {
  const displayName = $('add-display-name').value.trim();
  const username = $('add-username').value.trim().toLowerCase();
  const errEl = $('add-error');
  errEl.textContent = '';
  socket.emit('add contact', { username: username, displayName: displayName }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    $('add-display-name').value = '';
    $('add-username').value = '';
    closeModal('add-modal');
    showToast('✓ Контакт добавлен');
  });
}

function renderContactsTab() {
  const box = $('contacts-list');
  if (!box) return;
  const searchEl = $('contacts-search');
  const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
  const list = state.contacts.filter(function (c) {
    if (!q) return true;
    return (c.displayName || '').toLowerCase().indexOf(q) !== -1 || c.name.toLowerCase().indexOf(q) !== -1;
  });
  box.innerHTML = '';
  if (list.length === 0) {
    box.innerHTML = '<div class="tab-empty"><div class="big">👥</div>' + (q ? 'Ничего не найдено' : 'Пока нет контактов') + '</div>';
    return;
  }
  list.forEach(function (c) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    const avStyle = c.avatar ? 'background-image:url(' + c.avatar + ')' : 'background:var(--accent)';
    const avContent = c.avatar ? '' : initials(c.displayName || c.name);
    const badges = renderBadges(c);
    const online = c.online ? '<span class="online-dot"></span>' : '';
    div.innerHTML = '<div class="avatar" style="' + avStyle + '">' + avContent + online + '</div>' +
      '<div class="chat-info"><div class="chat-name">' + escapeHtml(c.displayName || c.name) + badges + '</div>' +
      '<div class="chat-preview">@' + escapeHtml(c.name) + '</div></div>';
    div.onclick = function () { switchTab('chats'); openChat(c.name); };
    box.appendChild(div);
  });
}

function openContactProfile(username) {
  socket.emit('get profile', { username: username }, function (data) {
    if (!data) return;
    state.contactProfileCurrent = data;
    contactProfileCurrent = data;
    const box = $('contact-profile-content');
    const avStyle = data.avatar ? 'background-image:url(' + data.avatar + ')' : '';
    const avContent = data.avatar ? '' : initials(username);
    const badges = renderBadgesBig(data);
    const contact = state.contacts.find(function (c) { return c.name === username; });
    const displayName = (data.firstName || data.lastName)
      ? ((data.firstName || '') + ' ' + (data.lastName || '')).trim()
      : ((contact && contact.displayName) || username);
    const emojiStr = data.emojiStatus ? ' ' + data.emojiStatus : '';
    let extra = '';
    if (data.blockedByMe) extra = '<div style="color:#ef4444;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вы заблокировали</div>';
    else if (data.blockedMe) extra = '<div style="color:#ef4444;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вас заблокировали</div>';
    let giftsHtml = '';
    if (data.gifts && data.gifts.length > 0) {
      giftsHtml = '<div class="profile-gifts"><div class="pg-title">🎁 Подарки (' + data.gifts.length + ')</div><div class="pg-row">';
      data.gifts.slice(0, 12).forEach(function (g) {
        const gift = state.giftsCatalog[g.gift_key];
        if (gift) giftsHtml += '<span class="pg-item" title="' + gift.name + '">' + gift.emoji + '</span>';
      });
      giftsHtml += '</div></div>';
    }
    box.innerHTML = '<div class="profile-header">' +
      '<div class="profile-avatar-big" style="' + avStyle + '">' + avContent + '</div>' +
      '<div class="profile-name">' + escapeHtml(displayName) + emojiStr + ' ' + badges + '</div>' +
      '<div class="profile-nick">@' + escapeHtml(username) + '</div>' +
      '<div class="profile-status ' + (data.online ? 'online' : '') + '">' + (data.online ? 'в сети' : 'не в сети') + '</div>' +
      '</div>' +
      (data.bio ? '<div class="profile-bio">' + escapeHtml(data.bio) + '</div>' : '') +
      giftsHtml + extra;
    const blockBtn = $('block-action-btn');
    blockBtn.textContent = data.blockedByMe ? '✅ Разблокировать' : '🚫 Блокировать';
    const giftBtn = $('gift-to-contact-btn');
    if (username !== state.me.username && !data.blockedByMe && !data.blockedMe) {
      giftBtn.style.display = 'block';
    } else {
      giftBtn.style.display = 'none';
    }
    // 🔧 NEW: кнопка управления значками (только для moroz)
    const badgeBtn = $('give-badge-to-contact-btn');
    if (badgeBtn) {
      if (state.me.username === 'moroz' && username !== state.me.username) {
        badgeBtn.style.display = 'block';
      } else {
        badgeBtn.style.display = 'none';
      }
    }
    openModal('contact-profile-modal');
  });
}

function toggleBlockCurrent() {
  if (!contactProfileCurrent && !state.contactProfileCurrent) return;
  const u = (contactProfileCurrent && contactProfileCurrent.username) || (state.contactProfileCurrent && state.contactProfileCurrent.username);
  const blockedByMe = (contactProfileCurrent && contactProfileCurrent.blockedByMe) || (state.contactProfileCurrent && state.contactProfileCurrent.blockedByMe);
  if (blockedByMe) {
    socket.emit('unblock user', { username: u }, function () { closeContactProfile(); });
  } else {
    socket.emit('block user', { username: u }, function () { closeContactProfile(); });
  }
}

function showMyQr() {
  const container = $('qr-display');
  container.innerHTML = '';
  const link = window.location.origin + '/?add=' + state.me.username;
  const img = document.createElement('img');
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
  img.alt = 'QR';
  img.onerror = function () {
    container.innerHTML = '<div style="color:#000;text-align:center;font-size:12px;word-break:break-all;">' + escapeHtml(link) + '</div>';
  };
  container.appendChild(img);
  openModal('my-qr-modal');
}

function copyQrLink() {
  const link = window.location.origin + '/?add=' + state.me.username;
  navigator.clipboard.writeText(link).then(function () { showToast('📋 Скопировано'); }).catch(function () { alert(link); });
}

function addFromQr() {
  if (!state.qrFoundUser) return;
  const username = state.qrFoundUser.username;
  const displayName = (state.qrFoundUser.firstName || state.qrFoundUser.lastName)
    ? ((state.qrFoundUser.firstName || '') + ' ' + (state.qrFoundUser.lastName || '')).trim()
    : username;
  socket.emit('add contact', { username: username, displayName: displayName }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('qr-found-modal');
    state.qrFoundUser = null;
    showToast('✓ Контакт добавлен');
  });
}

socket.on('contacts', function (list) {
  state.contacts = list || [];
  saveJson(STORAGE.CONTACTS_CACHE, state.contacts);
  renderChatList();
  if (state.activeTab === 'contacts') renderContactsTab();
});

socket.on('groups', function (list, meta) {
  state.groups = list || [];
  if (meta && meta.canCreate !== undefined) state.canCreateGroup = meta.canCreate;
  saveJson(STORAGE.GROUPS_CACHE, state.groups);
  renderChatList();
});

socket.on('channels', function (list, meta) {
  state.channels = list || [];
  if (meta && meta.canCreate !== undefined) state.canCreateChannel = meta.canCreate;
  renderChatList();
});

function saveUnread() { saveJson(STORAGE.UNREAD, state.unread); }
function loadUnread() { state.unread = loadJson(STORAGE.UNREAD, {}) || {}; }
function clearUnread(key) {
  if (state.unread[key]) {
    delete state.unread[key];
    saveUnread();
    updateTitle();
    renderChatList();
  }
}

// ─── ОБОИ ЧАТА ───
function getChatWallpaper(chatKey) {
  if (!chatKey) return null;
  return state.chatWallpapers[chatKey] || null;
}

function setChatWallpaper(chatKey, dataUrl) {
  if (!chatKey) return;
  if (dataUrl) {
    state.chatWallpapers[chatKey] = dataUrl;
  } else {
    delete state.chatWallpapers[chatKey];
  }
  saveJson(STORAGE.WALLPAPERS, state.chatWallpapers);
  applyChatWallpaper();
}

function applyChatWallpaper() {
  const box = $('messages');
  if (!box) return;
  const chatKey = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  const wp = getChatWallpaper(chatKey);
  if (wp) {
    box.style.backgroundImage = 'url(' + wp + ')';
    box.style.backgroundSize = 'cover';
    box.style.backgroundPosition = 'center';
    box.classList.add('has-wallpaper');
  } else {
    box.style.backgroundImage = '';
    box.style.backgroundSize = '';
    box.style.backgroundPosition = '';
    box.classList.remove('has-wallpaper');
  }
}

function openWallpaperPicker() {
  const chatKey = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  if (!chatKey) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const maxW = 1080;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setChatWallpaper(chatKey, dataUrl);
        showToast('🎨 Обои установлены');
        vibrate(15);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function removeChatWallpaper() {
  const chatKey = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  if (!chatKey) return;
  setChatWallpaper(chatKey, null);
  showToast('🎨 Обои удалены');
  vibrate(10);
}

// ─── CHAT LIST ───
function renderChatList() {
  const box = $('chat-list');
  if (!box) return;
  box.innerHTML = '';

  const savedItem = document.createElement('div');
  savedItem.className = 'chat-item' + (state.isSavedChat ? ' active' : '');
  const savedUnread = state.unread['__saved__'] || 0;
  const savedBadge = savedUnread > 0 ? '<div class="chat-badge">' + savedUnread + '</div>' : '';
  savedItem.innerHTML = '<div class="avatar saved">⭐</div>' +
    '<div class="chat-info">' +
      '<div class="chat-name">Избранное</div>' +
      '<div class="chat-preview">Сохранённые сообщения</div>' +
    '</div>' +
    '<div class="chat-meta">' + savedBadge + '</div>';
  savedItem.onclick = function () { openSavedChat(); };
  box.appendChild(savedItem);

  const activeContacts = state.contacts.filter(function (c) { return state.showArchived ? c.archived : !c.archived; });
  const activeGroups = state.groups.filter(function (g) { return state.showArchived ? g.archived : !g.archived; });

  if (state.channels.length > 0) {
    const h = document.createElement('div');
    h.className = 'section-header';
    h.textContent = '📢 Каналы';
    box.appendChild(h);
    state.channels.forEach(function (ch) { box.appendChild(renderChannelItem(ch)); });
  }
  if (activeGroups.length > 0) {
    const h = document.createElement('div');
    h.className = 'section-header';
    h.textContent = state.showArchived ? 'Архив: группы' : 'Группы';
    box.appendChild(h);
    activeGroups.forEach(function (g) { box.appendChild(renderGroupItem(g)); });
  }
  if (activeContacts.length > 0) {
    const h = document.createElement('div');
    h.className = 'section-header';
    h.textContent = state.showArchived ? 'Архив: личные' : 'Личные чаты';
    box.appendChild(h);
    activeContacts.forEach(function (u) { box.appendChild(renderContactItem(u)); });
  }
  if (activeContacts.length === 0 && activeGroups.length === 0 && state.channels.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (state.showArchived) {
      empty.innerHTML = '<div class="big">📦</div>Архив пуст<br><br>' +
        '<button style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:var(--radius-md);font-weight:600;" onclick="toggleArchiveView()">← Назад</button>';
    } else {
      empty.innerHTML = '<div class="big">👋</div>Пока никого нет.<br>Нажми <b>＋</b> и добавь друга или создай канал.';
    }
    box.appendChild(empty);
  }
}

function renderChannelItem(ch) {
  const div = document.createElement('div');
  div.className = 'chat-item';
  const avatar = ch.avatar
    ? '<div class="avatar channel" style="background-image:url(' + ch.avatar + ')"></div>'
    : '<div class="avatar channel">📢</div>';
  const tick = ch.verified ? '<span class="verified-badge">✓</span>' : '';
  div.innerHTML = avatar +
    '<div class="chat-info">' +
      '<div class="chat-name">' + escapeHtml(ch.name) + tick + '</div>' +
      '<div class="chat-preview">@' + escapeHtml(ch.slug) + ' · ' + ch.memberCount + ' подп.</div>' +
    '</div>';
  div.onclick = function () { openChannelChat(ch); };
  return div;
}

function toggleArchiveView() {
  state.showArchived = !state.showArchived;
  renderChatList();
}

function renderGroupItem(g) {
  const div = document.createElement('div');
  const key = 'g:' + g.id;
  const unreadCount = state.unread[key] || 0;
  div.className = 'chat-item' + (state.currentGroup && state.currentGroup.id === g.id ? ' active' : '');
  const avatar = g.avatar
    ? '<div class="avatar" style="background-image:url(' + g.avatar + ')"></div>'
    : '<div class="avatar group">👥</div>';
  const badge = unreadCount > 0 ? '<div class="chat-badge">' + unreadCount + '</div>' : '';
  const muteIcon = g.muted ? '<span class="chat-mute-icon">🔕</span>' : '';
  const memberWord = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  div.innerHTML = avatar +
    '<div class="chat-info">' +
      '<div class="chat-name">' + escapeHtml(g.name) + ' ' + muteIcon + '</div>' +
      '<div class="chat-preview">' + g.memberCount + ' участник' + memberWord + '</div>' +
    '</div>' +
    '<div class="chat-meta">' + badge + '</div>';
  div.onclick = function () { openGroupChat(g); };
  return div;
}

function renderContactItem(u) {
  const div = document.createElement('div');
  const unreadCount = state.unread[u.name] || 0;
  div.className = 'chat-item' + (state.currentChat === u.name ? ' active' : '');
  const onlineDot = u.online ? '<span class="online-dot"></span>' : '';
  const style = u.avatar ? 'background-image:url(' + u.avatar + ')' : 'background:var(--accent)';
  const content = u.avatar ? '' : initials(u.displayName || u.name);
  const badge = unreadCount > 0 ? '<div class="chat-badge">' + unreadCount + '</div>' : '';
  const badges = renderBadges(u);
  const muteIcon = u.muted ? '<span class="chat-mute-icon">🔕</span>' : '';
  const blockIcon = u.blocked ? '🚫 ' : '';
  const emojiStr = u.emojiStatus ? ' ' + u.emojiStatus : '';
  const isTyping = !!state.typingUsers[u.name];
  const preview = isTyping
    ? '<span class="typing">печатает<span class="typing-dots"><span></span><span></span><span></span></span></span>'
    : (unreadCount > 0 ? 'новое сообщение' : (u.online ? 'в сети' : 'был(а) недавно'));
  div.innerHTML = '<div class="avatar" style="' + style + '">' + content + onlineDot + '</div>' +
    '<div class="chat-info">' +
      '<div class="chat-name">' + blockIcon + escapeHtml(u.displayName || u.name) + emojiStr + badges + ' ' + muteIcon + '</div>' +
      '<div class="chat-preview">' + preview + '</div>' +
    '</div>' +
    '<div class="chat-meta">' + badge + '</div>';
  div.onclick = function () { openChat(u.name); };
  return div;
}

function filterContacts() { renderChatList(); }

// ─── ЧАТ ───
function openChat(name) {
  state.currentChat = name;
  state.currentGroup = null;
  state.currentChannel = null;
  state.isSavedChat = false;
  clearUnread(name);
  state.lastDateShown = '';
  state.pinnedMessageId = null;
  $('pinned-bar').classList.remove('active');
  const contact = state.contacts.find(function (c) { return c.name === name; });
  const badges = renderBadgesBig(contact || {});
  const displayName = (contact && contact.displayName) || name;
  $('chat-top-name').innerHTML = escapeHtml(displayName) + ' ' + badges;
  $('chat-top-status').textContent = contact && contact.online ? 'в сети' : 'был(а) недавно';
  $('chat-top-status').classList.remove('typing');
  const av = $('chat-avatar');
  if (contact && contact.avatar) {
    av.style.backgroundImage = 'url(' + contact.avatar + ')';
    av.textContent = '';
    av.classList.remove('group', 'saved');
  } else {
    av.style.backgroundImage = '';
    av.textContent = initials(displayName);
    av.style.background = 'var(--accent)';
    av.classList.remove('group', 'saved');
  }
  $('chat-actions').style.display = 'flex';
  $('callBtn1').style.display = 'block';
  $('callBtn2').style.display = 'block';
  $('chat-top-info').onclick = function () { openContactProfile(name); };
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  socket.emit('load history', { withUser: name });
  setTimeout(function () { socket.emit('mark read', { withUser: name }); }, 300);
  renderChatList();
  updateTopStatusTyping();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
}

function openSavedChat() {
  state.currentChat = null;
  state.currentGroup = null;
  state.currentChannel = null;
  state.isSavedChat = true;
  clearUnread('__saved__');
  state.lastDateShown = '';
  state.pinnedMessageId = null;
  $('pinned-bar').classList.remove('active');
  $('chat-top-name').innerHTML = '⭐ Избранное';
  $('chat-top-status').textContent = 'Сохранённые сообщения';
  const av = $('chat-avatar');
  av.style.backgroundImage = '';
  av.textContent = '⭐';
  av.style.background = '';
  av.classList.add('saved');
  av.classList.remove('group');
  $('chat-actions').style.display = 'none';
  $('chat-top-info').onclick = null;
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  socket.emit('load saved history');
  renderChatList();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
}

function openGroupChat(g) {
  state.currentGroup = g;
  state.currentChat = null;
  state.currentChannel = null;
  state.isSavedChat = false;
  clearUnread('g:' + g.id);
  state.lastDateShown = '';
  state.pinnedMessageId = g.pinnedMessageId || null;
  $('chat-top-name').textContent = g.name;
  const memberWord = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  $('chat-top-status').textContent = g.memberCount + ' участник' + memberWord;
  $('chat-top-status').classList.remove('typing');
  const av = $('chat-avatar');
  if (g.avatar) {
    av.style.backgroundImage = 'url(' + g.avatar + ')';
    av.textContent = '';
    av.classList.add('group');
    av.classList.remove('saved');
  } else {
    av.style.backgroundImage = '';
    av.textContent = '👥';
    av.style.background = '';
    av.classList.add('group');
    av.classList.remove('saved');
  }
  $('chat-actions').style.display = 'flex';
  $('callBtn1').style.display = 'none';
  $('callBtn2').style.display = 'none';
  $('chat-top-info').onclick = function () { openGroupInfo(); };
  $('messages').innerHTML = '';
  $('chat-screen').classList.add('active');
  socket.emit('load group history', { groupId: g.id });
  if (state.pinnedMessageId) {
    $('pinned-bar').classList.add('active');
    $('pinned-text').textContent = 'Закреплённое сообщение';
  } else {
    $('pinned-bar').classList.remove('active');
  }
  renderChatList();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
}

function closeChat() {
  if (state.currentChat) socket.emit('typing', { to: state.currentChat, isTyping: false });
  if (state.currentGroup) socket.emit('group typing', { groupId: state.currentGroup.id, isTyping: false });
  if (state.myTypingTimeout) { clearTimeout(state.myTypingTimeout); state.myTypingTimeout = null; }
  $('chat-screen').classList.remove('active');
  state.currentChat = null;
  state.currentGroup = null;
  state.isSavedChat = false;
  if (state.isRecording) stopVoiceRecording(true);
  hideReactionMenu();
  hideActionMenu();
  cancelReply();
  closeStickersPanel();
  renderChatList();
}

// ─── SCROLL ───
var scrollDownBound = false;
function bindScrollDown() {
  const box = $('messages');
  if (!box || scrollDownBound) return;
  scrollDownBound = true;
  box.addEventListener('scroll', updateScrollDownBtn, { passive: true });
}
function updateScrollDownBtn() {
  const box = $('messages');
  const btn = $('scroll-down-btn');
  if (!box || !btn) return;
  const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
  if (dist > 200) btn.classList.add('show');
  else {
    btn.classList.remove('show');
    const badge = $('scroll-down-badge');
    if (badge) badge.style.display = 'none';
  }
}
function scrollToBottom() {
  const box = $('messages');
  if (!box) return;
  box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  const badge = $('scroll-down-badge');
  if (badge) badge.style.display = 'none';
}
function bumpScrollDownBadge() {
  const box = $('messages');
  const btn = $('scroll-down-btn');
  const badge = $('scroll-down-badge');
  if (!box || !btn || !badge) return;
  const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
  if (dist > 200) {
    const cur = parseInt(badge.textContent || '0', 10) || 0;
    badge.textContent = cur + 1;
    badge.style.display = 'inline-block';
    btn.classList.add('show');
  }
}

// ─── SWIPE REPLY ───
function bindSwipeReply(msgDiv, wrap, msg) {
  if (msg.deleted) return;
  const icon = document.createElement('div');
  icon.className = 'swipe-reply-icon';
  icon.textContent = '↩';
  wrap.appendChild(icon);
  let startX = 0, startY = 0, currentX = 0, isDragging = false, locked = false;
  const isSelf = msg.self;
  function onStart(x, y) { startX = x; startY = y; currentX = 0; isDragging = true; locked = false; wrap.classList.remove('swipe-ready'); }
  function onMove(x, y) {
    if (!isDragging) return;
    const dx = x - startX, dy = y - startY;
    if (!locked) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        isDragging = false;
        wrap.style.transform = '';
        wrap.classList.remove('swiping', 'swipe-active', 'swipe-ready');
        return;
      }
      if (Math.abs(dx) > 8) { locked = true; wrap.classList.add('swiping'); }
      else return;
    }
    let d = dx;
    if (isSelf && d > 0) d = 0;
    if (!isSelf && d < 0) d = 0;
    const max = 90;
    if (Math.abs(d) > max) d = (d > 0 ? max : -max);
    currentX = d;
    wrap.style.transform = 'translateX(' + d + 'px)';
    if (Math.abs(d) > 5) wrap.classList.add('swipe-active');
    if (Math.abs(d) >= SWIPE_THRESHOLD) wrap.classList.add('swipe-ready');
    else wrap.classList.remove('swipe-ready');
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (Math.abs(currentX) >= SWIPE_THRESHOLD) triggerReplyFromSwipe(msg);
    wrap.style.transform = '';
    wrap.classList.remove('swiping', 'swipe-active', 'swipe-ready');
    locked = false;
  }
  msgDiv.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    onStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  msgDiv.addEventListener('touchmove', function (e) {
    if (!isDragging || e.touches.length !== 1) return;
    onMove(e.touches[0].clientX, e.touches[0].clientY);
    if (locked) { try { e.preventDefault(); } catch (err) {} }
  }, { passive: false });
  msgDiv.addEventListener('touchend', onEnd);
  msgDiv.addEventListener('touchcancel', onEnd);
  msgDiv.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    onStart(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    onMove(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', function () {
    if (!isDragging) return;
    onEnd();
  });
}

function triggerReplyFromSwipe(msg) {
  if (!msg) return;
  state.replyToMessage = {
    id: msg.id, from: msg.from, text: msg.text, image: msg.image,
    voice: msg.voice, videoCircle: msg.videoCircle, sticker: msg.sticker,
    self: msg.self, isGroup: msg.isGroup
  };
  const name = msg.self ? 'Я' : displayNameForUser(msg.from);
  const preview = msg.text || (msg.sticker ? 'Стикер' : (msg.image ? '📷 Фото' : (msg.voice ? '🎤 Голосовое' : (msg.videoCircle ? '🎥 Кружок' : ''))));
  $('rp-name').textContent = name;
  $('rp-msg').textContent = preview;
  $('reply-preview').classList.add('active');
  $('msgInput').focus();
  if (state.settings.vibration != 0 && 'vibrate' in navigator) {
    try { navigator.vibrate(15); } catch (e) {}
  }
}

// ─── RENDER MESSAGE ───
function renderMessage(msg) {
  const box = $('messages');
  if (!box) return;
  if (msg.time) {
    const d = new Date(msg.time);
    const dateKey = d.toDateString();
    if (dateKey !== state.lastDateShown) {
      state.lastDateShown = dateKey;
      const div = document.createElement('div');
      div.className = 'date-divider';
      div.innerHTML = '<span>' + formatDateLabel(d) + '</span>';
      box.appendChild(div);
    }
  }
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (msg.self ? 'self' : 'other');
  wrap.dataset.id = msg.id;
  if (msg.isGroup) wrap.dataset.group = '1';
  if (msg.from) wrap.dataset.from = msg.from;
  if (msg.isGroup && !msg.self && msg.senderName) {
    const se = document.createElement('div');
    se.className = 'msg-sender';
    se.textContent = msg.senderName;
    wrap.appendChild(se);
  }
  const div = document.createElement('div');
  div.className = 'msg ' + (msg.self ? 'self' : 'other');
  if (msg.replyData && !msg.deleted) {
    const rb = document.createElement('div');
    rb.className = 'reply-block';
    rb.onclick = function (e) { e.stopPropagation(); scrollToMessage(msg.replyData.id); };
    const replyName = msg.replyData.from === state.me.username ? 'Я' : displayNameForUser(msg.replyData.from);
    const replyText = msg.replyData.deleted
      ? 'Сообщение удалено'
      : (msg.replyData.text || (msg.replyData.image ? '📷 Фото' : (msg.replyData.voice ? '🎤 Голосовое' : '')));
    rb.innerHTML = '<div class="reply-name">' + escapeHtml(replyName) + '</div>' +
      '<div class="reply-text">' + escapeHtml(replyText) + '</div>';
    div.appendChild(rb);
  }
  if (msg.deleted) {
    div.classList.add('deleted');
    div.innerHTML += '<i>Сообщение удалено</i>';
  } else {
    if (msg.sticker) {
      const isVideoSticker = /\.(mp4|webm)(\?|$)/i.test(msg.sticker);
      if (isVideoSticker) {
        const v = document.createElement('video');
        v.className = 'sticker-video';
        v.src = msg.sticker;
        v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
        v.onclick = function (e) { e.stopPropagation(); };
        div.appendChild(v);
      } else {
        const s = document.createElement('img');
        s.className = 'sticker-img';
        s.src = msg.sticker;
        s.onclick = function (e) { e.stopPropagation(); };
        div.appendChild(s);
      }
    } else if (msg.image) {
      const img = document.createElement('img');
      img.className = 'photo';
      img.src = msg.image;
      img.onclick = function (e) { e.stopPropagation(); openLightbox(msg.image); };
      div.appendChild(img);
    }
    if (msg.videoCircle) {
      const vwrap = document.createElement('div');
      vwrap.className = 'video-circle-wrap';
      const vid = document.createElement('video');
      vid.className = 'video-circle';
      vid.src = msg.videoCircle;
      vid.playsInline = true; vid.loop = true;
      const overlay = document.createElement('div');
      overlay.className = 'video-play-overlay';
      overlay.textContent = '▶';
      vwrap.appendChild(vid);
      vwrap.appendChild(overlay);
      div.appendChild(vwrap);
      let playing = false;
      vwrap.onclick = function (e) {
        e.stopPropagation();
        if (playing) { vid.pause(); playing = false; vwrap.classList.remove('playing'); }
        else {
          document.querySelectorAll('video').forEach(function (v) { if (v !== vid) v.pause(); });
          vid.play().then(function () { playing = true; vwrap.classList.add('playing'); }).catch(function () {});
        }
      };
      vid.onended = function () { playing = false; vwrap.classList.remove('playing'); };
    }
    if (msg.voice) {
      const vw = document.createElement('div');
      vw.className = 'voice-msg';
      const pb = document.createElement('button');
      pb.className = 'voice-play';
      pb.textContent = '▶';
      const wave = document.createElement('div');
      wave.className = 'voice-wave';
      for (let i = 0; i < 30; i++) {
        const b = document.createElement('span');
        b.style.height = (4 + Math.random() * 16) + 'px';
        wave.appendChild(b);
      }
      const dur = document.createElement('span');
      dur.className = 'voice-duration';
      const d = msg.voiceDuration || 0;
      dur.textContent = Math.floor(d / 60) + ':' + (d % 60).toString().padStart(2, '0');
      vw.appendChild(pb);
      vw.appendChild(wave);
      vw.appendChild(dur);
      div.appendChild(vw);
      const audio = new Audio();
      audio.src = msg.voice;
      audio.preload = 'metadata';
      let playing = false;
      pb.onclick = function (e) {
        e.stopPropagation();
        if (playing) {
          audio.pause(); audio.currentTime = 0;
          playing = false; pb.textContent = '▶'; vw.classList.remove('playing');
        } else {
          document.querySelectorAll('audio').forEach(function (a) { if (a !== audio) a.pause(); });
          audio.play().then(function () {
            playing = true; pb.textContent = '⏸'; vw.classList.add('playing');
          }).catch(function () { audio.load(); audio.play().catch(function () {}); });
        }
      };
      audio.onended = function () { playing = false; pb.textContent = '▶'; vw.classList.remove('playing'); };
    }
    if (msg.text) {
      if (msg.text.indexOf('🎁 Подарок: ') === 0) {
        const parts = msg.text.replace('🎁 Подарок: ', '').split(' ');
        const emoji = parts[0];
        const name = parts.slice(1).join(' ');
        const giftDiv = document.createElement('div');
        giftDiv.className = 'gift-message-block';
        giftDiv.innerHTML = '<div class="gift-emoji-big">' + emoji + '</div>' +
          '<div class="gift-name-big">' + escapeHtml(name) + '</div>' +
          '<div class="gift-label">🎁 ПОДАРОК</div>';
        div.appendChild(giftDiv);
      } else {
        const span = document.createElement('span');
        span.className = 'msg-text';
        span.textContent = msg.text;
        div.appendChild(span);
      }
    }
  }
  const meta = document.createElement('span');
  meta.className = 'meta';
  const t = msg.time ? formatTime(msg.time) : '';
  let metaHTML = '';
  if (msg.edited) metaHTML += '<span class="edited">изм. </span>';
  metaHTML += t;
  if (msg.self && !msg.isGroup) metaHTML += ' <span class="check' + (msg.read ? ' read' : '') + '">✓✓</span>';
  meta.innerHTML = metaHTML;
  div.appendChild(meta);
  let pressTimer = null;
  function startPress(e) { pressTimer = setTimeout(function () { showReactionMenu(e, msg.id, wrap, !!msg.isGroup); }, 500); }
  function cancelPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }
  div.addEventListener('touchstart', startPress, { passive: true });
  div.addEventListener('touchend', cancelPress);
  div.addEventListener('touchmove', cancelPress);
  div.addEventListener('mousedown', startPress);
  div.addEventListener('mouseup', cancelPress);
  div.addEventListener('mouseleave', cancelPress);
  div.addEventListener('contextmenu', function (e) { e.preventDefault(); showActionMenu(e, msg); });
  bindSwipeReply(div, wrap, msg);
  wrap.appendChild(div);
  renderReactionsInto(wrap, msg.reactions, !!msg.isGroup);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

// ═══════════════════════════════════════════════════════════
// ⚠️ КОНЕЦ ЧАСТИ 1/4
// Дальше: Часть 2/4 — начнётся с "function scrollToMessage(id)..."
// ═══════════════════════════════════════════════════════════
function scrollToMessage(id) {
  const el = document.querySelector('.msg-wrap[data-id="' + id + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'background 0.3s';
    el.style.background = 'rgba(168, 85, 247, 0.2)';
    setTimeout(function () { el.style.background = ''; }, 1000);
  }
}
function scrollToPinned() { if (state.pinnedMessageId) scrollToMessage(state.pinnedMessageId); }

function renderReactionsInto(wrap, reactions, isGroup) {
  const ex = wrap.querySelector('.reactions');
  if (ex) ex.remove();
  if (!reactions || Object.keys(reactions).length === 0) return;
  const bar = document.createElement('div');
  bar.className = 'reactions';
  Object.entries(reactions).forEach(function (entry) {
    const emoji = entry[0], users = entry[1];
    if (!users || users.length === 0) return;
    const chip = document.createElement('button');
    chip.className = 'reaction-chip' + (users.indexOf(state.me.username) !== -1 ? ' mine' : '');
    chip.innerHTML = emoji + ' <span>' + users.length + '</span>';
    chip.onclick = function (e) {
      e.stopPropagation();
      const mid = parseInt(wrap.dataset.id, 10);
      if (isGroup && state.currentGroup) {
        socket.emit('group react', { groupId: state.currentGroup.id, messageId: mid, emoji: emoji });
      } else {
        socket.emit('react', { messageId: mid, emoji: emoji });
      }
    };
    bar.appendChild(chip);
  });
  const msgEl = wrap.querySelector('.msg');
  if (msgEl) msgEl.appendChild(bar);
}

// ─── REACTION / ACTION MENUS ───
function showReactionMenu(e, messageId, wrap, isGroup) {
  state.activeReactionMsgId = messageId;
  state.activeReactionGroupId = isGroup && state.currentGroup ? state.currentGroup.id : null;
  const menu = $('reaction-menu');
  const touch = (e.touches && e.touches[0]) || e;
  let x = touch.clientX, y = touch.clientY;
  menu.classList.add('active');
  const rect = menu.getBoundingClientRect();
  const w = rect.width || 250, h = rect.height || 60;
  x = Math.min(Math.max(x - w / 2, 10), window.innerWidth - w - 10);
  y = Math.max(y - h - 15, 10);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}
function hideReactionMenu() {
  $('reaction-menu').classList.remove('active');
  state.activeReactionMsgId = null;
  state.activeReactionGroupId = null;
}
function applyReaction(emoji) {
  if (state.activeReactionMsgId == null) return;
  if (state.activeReactionGroupId) {
    socket.emit('group react', { groupId: state.activeReactionGroupId, messageId: state.activeReactionMsgId, emoji: emoji });
  } else {
    socket.emit('react', { messageId: state.activeReactionMsgId, emoji: emoji });
  }
  hideReactionMenu();
}
function showActionMenu(e, msg) {
  if (msg.deleted) return;
  state.activeMessage = msg;
  const menu = $('action-menu');
  const touch = (e.touches && e.touches[0]) || e;
  let x = touch.clientX, y = touch.clientY;
  const isMine = msg.from === state.me.username;
  $('action-edit').style.display = (isMine && !msg.voice && !msg.image && !msg.videoCircle && !msg.sticker && msg.text) ? 'flex' : 'none';
  $('action-delete').style.display = isMine ? 'flex' : 'none';
  $('action-pin').style.display = msg.isGroup ? 'flex' : 'none';
  menu.classList.add('active');
  const rect = menu.getBoundingClientRect();
  const w = rect.width || 200, h = rect.height || 250;
  x = Math.min(Math.max(x - w / 2, 10), window.innerWidth - w - 10);
  y = Math.min(Math.max(y, 10), window.innerHeight - h - 10);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  hideReactionMenu();
}
function hideActionMenu() {
  $('action-menu').classList.remove('active');
  state.activeMessage = null;
}
function actionReply() {
  if (!state.activeMessage) return;
  state.replyToMessage = state.activeMessage;
  const name = state.activeMessage.self ? 'Я' : displayNameForUser(state.activeMessage.from);
  const preview = state.activeMessage.text
    || (state.activeMessage.sticker ? 'Стикер'
      : (state.activeMessage.image ? '📷 Фото'
        : (state.activeMessage.voice ? '🎤 Голосовое'
          : (state.activeMessage.videoCircle ? '🎥 Кружок' : ''))));
  $('rp-name').textContent = name;
  $('rp-msg').textContent = preview;
  $('reply-preview').classList.add('active');
  $('msgInput').focus();
  hideActionMenu();
}
function cancelReply() {
  state.replyToMessage = null;
  $('reply-preview').classList.remove('active');
}
function actionCopy() {
  if (!state.activeMessage || !state.activeMessage.text) { hideActionMenu(); return; }
  navigator.clipboard.writeText(state.activeMessage.text).catch(function () {});
  showToast('📋 Скопировано');
  hideActionMenu();
}
function actionSave() {
  if (!state.activeMessage) return;
  socket.emit('save to saved', { originalMessageId: state.activeMessage.id, isGroup: !!state.activeMessage.isGroup }, function (res) {
    if (res && res.ok) {
      if (state.isSavedChat) socket.emit('load saved history');
      showToast('⭐ Сохранено в Избранное');
    }
  });
  hideActionMenu();
}
function actionEdit() {
  if (!state.activeMessage) return;
  state.editingMessageId = state.activeMessage.id;
  $('edit-message-text').value = state.activeMessage.text || '';
  hideActionMenu();
  openModal('edit-message-modal');
}
function doEditMessage() {
  const text = $('edit-message-text').value.trim();
  if (!text || !state.editingMessageId) return;
  const isGroup = !!state.currentGroup;
  socket.emit('edit message', { messageId: state.editingMessageId, text: text, isGroup: isGroup }, function (res) {
    if (res && res.ok) closeModal('edit-message-modal');
    state.editingMessageId = null;
  });
}
function actionDelete() {
  if (!state.activeMessage) return;
  const isGroup = !!state.currentGroup;
  const isMine = state.activeMessage.from === state.me.username;
  if (!confirm(isGroup && isMine ? 'Удалить для всех?' : 'Удалить сообщение?')) return;
  socket.emit('delete message', { messageId: state.activeMessage.id, forAll: true, isGroup: isGroup }, function () {});
  hideActionMenu();
}
function actionPin() {
  if (!state.activeMessage || !state.currentGroup) return;
  socket.emit('pin message', { groupId: state.currentGroup.id, messageId: state.activeMessage.id }, function () {
    state.pinnedMessageId = state.activeMessage.id;
    $('pinned-bar').classList.add('active');
    $('pinned-text').textContent = 'Закреплённое сообщение';
    hideActionMenu();
  });
}
document.addEventListener('click', function (e) {
  const rm = $('reaction-menu');
  if (rm.classList.contains('active') && !rm.contains(e.target)) hideReactionMenu();
  const am = $('action-menu');
  if (am.classList.contains('active') && !am.contains(e.target)) hideActionMenu();
});

// ─── SEND ───
function sendMsg() {
  const input = $('msgInput');
  const text = input.value.trim();
  if (!text) return;
  const replyId = state.replyToMessage ? state.replyToMessage.id : null;
  if (state.isSavedChat) socket.emit('private message', { to: state.me.username, text: text });
  else if (state.currentChat) {
    socket.emit('private message', { to: state.currentChat, text: text, replyTo: replyId });
    socket.emit('typing', { to: state.currentChat, isTyping: false });
  } else if (state.currentGroup) {
    socket.emit('group message', { groupId: state.currentGroup.id, text: text, replyTo: replyId });
    socket.emit('group typing', { groupId: state.currentGroup.id, isTyping: false });
  } else return;
  input.value = '';
  cancelReply();
  if (state.myTypingTimeout) { clearTimeout(state.myTypingTimeout); state.myTypingTimeout = null; }
}
function onInputTyping() {
  if (state.currentChat) socket.emit('typing', { to: state.currentChat, isTyping: true });
  else if (state.currentGroup) socket.emit('group typing', { groupId: state.currentGroup.id, isTyping: true });
  else return;
  if (state.myTypingTimeout) clearTimeout(state.myTypingTimeout);
  state.myTypingTimeout = setTimeout(function () {
    if (state.currentChat) socket.emit('typing', { to: state.currentChat, isTyping: false });
    else if (state.currentGroup) socket.emit('group typing', { groupId: state.currentGroup.id, isTyping: false });
    state.myTypingTimeout = null;
  }, 2000);
}
function updateTopStatusTyping() {
  if (state.currentGroup || state.isSavedChat) return;
  const el = $('chat-top-status');
  if (!el || !state.currentChat) return;
  if (state.typingUsers[state.currentChat]) {
    el.textContent = 'печатает…';
    el.classList.add('typing');
  } else {
    const contact = state.contacts.find(function (c) { return c.name === state.currentChat; });
    el.textContent = contact && contact.online ? 'в сети' : 'был(а) недавно';
    el.classList.remove('typing');
  }
}

// ─── PHOTO / VOICE / CIRCLE ───
function sendPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const replyId = state.replyToMessage ? state.replyToMessage.id : null;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const maxSize = 800;
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize; }
      else if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      if (state.isSavedChat) socket.emit('private message', { to: state.me.username, image: dataUrl });
      else if (state.currentChat) socket.emit('private message', { to: state.currentChat, image: dataUrl, replyTo: replyId });
      else if (state.currentGroup) socket.emit('group message', { groupId: state.currentGroup.id, image: dataUrl, replyTo: replyId });
      event.target.value = '';
      cancelReply();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function getBestAudioMime() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (let i = 0; i < candidates.length; i++) {
    if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
  }
  return '';
}

async function toggleVoiceRecording() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  if (state.isRecording) { stopVoiceRecording(true); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.currentAudioMime = getBestAudioMime();
    state.mediaRecorder = state.currentAudioMime
      ? new MediaRecorder(stream, { mimeType: state.currentAudioMime })
      : new MediaRecorder(stream);
    state.mediaRecorder.ondataavailable = function (e) {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };
    state.mediaRecorder.onstop = async function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      clearInterval(state.recordingTimer);
      const duration = Math.round((now() - state.recordingStartTime) / 1000);
      $('recording-bar').classList.remove('active');
      $('micBtnInput').classList.remove('recording');
      if (state.cancelledRecording) {
        state.cancelledRecording = false;
        state.audioChunks = [];
        state.isRecording = false;
        return;
      }
      if (state.audioChunks.length === 0 || duration < 1) {
        state.isRecording = false;
        return;
      }
      const mime = state.currentAudioMime || state.mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(state.audioChunks, { type: mime });
      const reader = new FileReader();
      const replyId = state.replyToMessage ? state.replyToMessage.id : null;
      reader.onload = function () {
        if (state.isSavedChat) socket.emit('private message', { to: state.me.username, voice: reader.result, voiceDuration: duration });
        else if (state.currentChat) socket.emit('private message', { to: state.currentChat, voice: reader.result, voiceDuration: duration, replyTo: replyId });
        else if (state.currentGroup) socket.emit('group message', { groupId: state.currentGroup.id, voice: reader.result, voiceDuration: duration, replyTo: replyId });
        cancelReply();
      };
      reader.readAsDataURL(blob);
      state.isRecording = false;
    };
    state.mediaRecorder.start();
    state.isRecording = true;
    state.cancelledRecording = false;
    state.recordingStartTime = now();
    $('recording-bar').classList.add('active');
    $('micBtnInput').classList.add('recording');
    updateRecordingTimer();
    state.recordingTimer = setInterval(function () {
      const elapsed = Math.round((now() - state.recordingStartTime) / 1000);
      updateRecordingTimer();
      if (elapsed >= MAX_RECORDING_SEC) stopVoiceRecording(false);
    }, 200);
  } catch (err) {
    alert('Нет доступа к микрофону: ' + err.message);
  }
}
function stopVoiceRecording(cancel) {
  if (!state.isRecording) return;
  state.cancelledRecording = !!cancel;
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') state.mediaRecorder.stop();
  state.isRecording = false;
  clearInterval(state.recordingTimer);
  $('recording-bar').classList.remove('active');
  $('micBtnInput').classList.remove('recording');
}
function updateRecordingTimer() {
  const elapsed = Math.round((now() - state.recordingStartTime) / 1000);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  $('recording-time').textContent = m + ':' + s.toString().padStart(2, '0');
}

function getBestVideoMime() {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  for (let i = 0; i < candidates.length; i++) {
    if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
  }
  return '';
}
async function startCircleRecording() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  try {
    state.circleStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      audio: true
    });
  } catch (err) {
    alert('Нет доступа к камере: ' + err.message);
    return;
  }
  const preview = $('circle-video-preview');
  preview.srcObject = state.circleStream;
  preview.muted = true;
  $('circle-preview').classList.add('active');
  state.circleChunks = [];
  state.circleMime = getBestVideoMime();
  state.circleRecorder = state.circleMime
    ? new MediaRecorder(state.circleStream, { mimeType: state.circleMime })
    : new MediaRecorder(state.circleStream);
  state.circleRecorder.ondataavailable = function (e) {
    if (e.data.size > 0) state.circleChunks.push(e.data);
  };
  state.circleRecorder.start();
  state.circleStartTime = now();
  updateCircleTimer();
  state.circleTimer = setInterval(function () {
    const elapsed = Math.round((now() - state.circleStartTime) / 1000);
    updateCircleTimer();
    if (elapsed >= MAX_CIRCLE_SEC) sendCircle();
  }, 200);
}
function updateCircleTimer() {
  const elapsed = Math.round((now() - state.circleStartTime) / 1000);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  $('circle-timer').textContent = m + ':' + s.toString().padStart(2, '0');
}
function cancelCircle() {
  if (state.circleRecorder && state.circleRecorder.state !== 'inactive') state.circleRecorder.stop();
  cleanupCircle();
}
function sendCircle() {
  if (!state.circleRecorder) return;
  const duration = Math.round((now() - state.circleStartTime) / 1000);
  if (duration < 1) { cancelCircle(); return; }
  const onStop = function () {
    if (state.circleChunks.length === 0) { cleanupCircle(); return; }
    const mime = state.circleMime || state.circleRecorder.mimeType || 'video/webm';
    const blob = new Blob(state.circleChunks, { type: mime });
    const reader = new FileReader();
    const replyId = state.replyToMessage ? state.replyToMessage.id : null;
    reader.onload = function () {
      if (state.isSavedChat) socket.emit('private message', { to: state.me.username, videoCircle: reader.result, videoDuration: duration });
      else if (state.currentChat) socket.emit('private message', { to: state.currentChat, videoCircle: reader.result, videoDuration: duration, replyTo: replyId });
      else if (state.currentGroup) socket.emit('group message', { groupId: state.currentGroup.id, videoCircle: reader.result, videoDuration: duration, replyTo: replyId });
      cancelReply();
    };
    reader.readAsDataURL(blob);
    cleanupCircle();
  };
  state.circleRecorder.addEventListener('stop', onStop, { once: true });
  state.circleRecorder.stop();
}
function cleanupCircle() {
  clearInterval(state.circleTimer);
  if (state.circleStream) { state.circleStream.getTracks().forEach(function (t) { t.stop(); }); state.circleStream = null; }
  $('circle-preview').classList.remove('active');
  $('circle-video-preview').srcObject = null;
  state.circleRecorder = null;
  state.circleChunks = [];
}

// ─── STICKERS ───
function loadStickerRecent() { state.stickerRecent = loadJson(STORAGE.RECENT_STICKERS, []) || []; }
function saveStickerRecent() { saveJson(STORAGE.RECENT_STICKERS, state.stickerRecent.slice(0, 30)); }
function pushStickerRecent(url) {
  state.stickerRecent = state.stickerRecent.filter(function (x) { return x !== url; });
  state.stickerRecent.unshift(url);
  saveStickerRecent();
}
function toggleStickersPanel() {
  const p = $('stickers-panel');
  if (!p) return;
  if (p.classList.contains('active')) closeStickersPanel();
  else openStickersPanel();
}
function openStickersPanel() {
  const p = $('stickers-panel');
  if (!p) return;
  loadStickerRecent();
  p.classList.add('active');
  socket.emit('load stickers', function (res) {
    if (res && res.ok) {
      state.stickersData = res.stickers || [];
      renderStickersContent();
    }
  });
  renderStickersContent();
}
function closeStickersPanel() {
  const p = $('stickers-panel');
  if (p) p.classList.remove('active');
}
function switchStickerTab(tab) {
  state.stickerCurrentTab = tab;
  document.querySelectorAll('.sticker-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === tab); });
  renderStickersContent();
}
function onStickerSearch() {
  const el = $('stickers-search');
  state.stickerSearchQuery = (el ? el.value : '').trim().toLowerCase();
  renderStickersContent();
}
function renderStickersContent() {
  const box = $('stickers-content');
  if (!box) return;
  const q = state.stickerSearchQuery;
  if (state.stickerCurrentTab === 'recent') {
    if (state.stickerRecent.length === 0) {
      box.innerHTML = '<div class="sticker-empty">🕐<br><br>Здесь будут стикеры,<br>которые ты недавно отправлял</div>';
      return;
    }
    const filtered = state.stickerRecent.filter(function (u) { return !q || u.toLowerCase().indexOf(q) !== -1; });
    if (filtered.length === 0) { box.innerHTML = '<div class="sticker-empty">Ничего не найдено</div>'; return; }
    renderStickerGrid(box, filtered);
    return;
  }
  if (state.stickerCurrentTab === 'my') {
    let items = state.stickersData;
    if (q) {
      items = items.filter(function (s) {
        return ((s.emoji || '').toLowerCase().indexOf(q) !== -1) || ((s.url || '').toLowerCase().indexOf(q) !== -1);
      });
    }
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sticker-grid';
    const addBtn = document.createElement('button');
    addBtn.className = 'sticker-add-btn';
    addBtn.textContent = '+';
    addBtn.onclick = function () {
      const choice = confirm('OK — загрузить видео (MP4/WebM → GIF), Отмена — загрузить картинку');
      if (choice) $('stickerFileVideo').click();
      else $('stickerFileImage').click();
    };
    grid.appendChild(addBtn);
    items.forEach(function (s) {
      const div = document.createElement('div');
      div.className = 'sticker-item';
      const isVideo = s.type === 'video';
      const media = isVideo
        ? '<video src="' + escapeHtml(s.url) + '" autoplay loop muted playsinline></video>'
        : '<img src="' + escapeHtml(s.url) + '" alt="">';
      const badge = isVideo ? '<span class="sticker-type-badge">GIF</span>' : '';
      div.innerHTML = media + badge + '<button class="sticker-del" onclick="event.stopPropagation(); removeSticker(' + s.id + ')">×</button>';
      div.onclick = function () { sendSticker(s.url, s.type); };
      grid.appendChild(div);
    });
    box.appendChild(grid);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sticker-empty';
      empty.textContent = 'Пока нет своих стикеров. Нажми «+»';
      box.appendChild(empty);
    }
    return;
  }
  if (state.stickerCurrentTab === 'gif') {
    let items = BUILTIN_GIFS;
    if (q) items = items.filter(function (g) { return g.emoji.toLowerCase().indexOf(q) !== -1; });
    if (items.length === 0) { box.innerHTML = '<div class="sticker-empty">Ничего не найдено</div>'; return; }
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sticker-grid';
    const addBtn = document.createElement('button');
    addBtn.className = 'sticker-add-btn';
    addBtn.textContent = '+';
    addBtn.onclick = function () {
      $('gif-url-input').value = '';
      $('gif-url-error').textContent = '';
      openModal('gif-url-modal');
    };
    grid.appendChild(addBtn);
    items.forEach(function (g) {
      const div = document.createElement('div');
      div.className = 'sticker-item';
      const isMp4 = /\.(mp4|webm)(\?|$)/i.test(g.url);
      div.innerHTML = isMp4
        ? '<video src="' + escapeHtml(g.url) + '" autoplay loop muted playsinline></video>'
        : '<img src="' + escapeHtml(g.url) + '" alt="">';
      div.onclick = function () { sendSticker(g.url, isMp4 ? 'video' : 'image'); };
      grid.appendChild(div);
    });
    box.appendChild(grid);
  }
}
function renderStickerGrid(box, urls) {
  box.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'sticker-grid';
  urls.forEach(function (url) {
    const div = document.createElement('div');
    div.className = 'sticker-item';
    const isMp4 = /\.(mp4|webm)(\?|$)/i.test(url);
    div.innerHTML = isMp4
      ? '<video src="' + escapeHtml(url) + '" autoplay loop muted playsinline></video>'
      : '<img src="' + escapeHtml(url) + '" alt="">';
    div.onclick = function () { sendSticker(url, isMp4 ? 'video' : 'image'); };
    grid.appendChild(div);
  });
  box.appendChild(grid);
}
function sendSticker(url, type) {
  if (!url) return;
  let done = false;
  const cb = function (res) {
    if (done) return;
    done = true;
    if (res && res.ok) { pushStickerRecent(url); closeStickersPanel(); }
    else alert((res && res.error) || 'Ошибка');
  };
  if (state.isSavedChat) socket.emit('send sticker', { url: url, type: type, to: state.me.username }, cb);
  else if (state.currentChat) socket.emit('send sticker', { url: url, type: type, to: state.currentChat }, cb);
  else if (state.currentGroup) socket.emit('send sticker', { url: url, type: type, groupId: state.currentGroup.id }, cb);
}
function uploadSticker(event, kind) {
  const file = event.target.files[0];
  if (!file) return;
  const isVideo = kind === 'video';
  const reader = new FileReader();
  reader.onload = function (e) {
    if (isVideo) {
      if (file.size / 1024 / 1024 > 4) { alert('Видео больше 4 МБ'); return; }
      socket.emit('add sticker', { data: e.target.result, type: 'video' }, function (res) {
        if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
        state.stickersData.unshift({ id: res.id, url: res.url, type: 'video', emoji: null, time: now() });
        renderStickersContent();
      });
      return;
    }
    const img = new Image();
    img.onload = function () {
      const maxSize = 512;
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = h * maxSize / w; w = maxSize; }
        else { w = w * maxSize / h; h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const isPng = /\.png$/i.test(file.name);
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.9);
      socket.emit('add sticker', { data: dataUrl, type: 'image' }, function (res) {
        if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
        state.stickersData.unshift({ id: res.id, url: res.url, type: 'image', emoji: null, time: now() });
        renderStickersContent();
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function removeSticker(id) {
  if (!confirm('Удалить стикер?')) return;
  socket.emit('delete sticker', { id: id }, function (res) {
    if (!res || !res.ok) return;
    state.stickersData = state.stickersData.filter(function (s) { return s.id !== id; });
    renderStickersContent();
  });
}
function submitGifUrl() {
  const url = $('gif-url-input').value.trim();
  const errEl = $('gif-url-error');
  errEl.textContent = '';
  if (!url) { errEl.textContent = 'Введи ссылку'; return; }
  if (!/^https?:\/\//i.test(url)) { errEl.textContent = 'Ссылка должна начинаться с http:// или https://'; return; }
  socket.emit('add sticker', { data: url, type: /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image' }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    state.stickersData.unshift({ id: res.id, url: res.url, type: res.type || 'image', emoji: null, time: now() });
    closeModal('gif-url-modal');
    if (state.stickerCurrentTab !== 'my') switchStickerTab('my');
    else renderStickersContent();
  });
}

// ─── STORIES ───
function loadStories() {
  socket.emit('load stories', function (res) {
    if (!res || !res.ok) return;
    state.storiesUsers = res.users || [];
    renderStoriesBar();
  });
}
function renderStoriesBar() {
  const row = $('stories-row');
  if (!row) return;
  row.innerHTML = '';
  const mine = state.storiesUsers.find(function (u) { return u.username === state.me.username; });
  const mineHasStory = mine && mine.stories.length > 0;
  const mineBubble = document.createElement('div');
  mineBubble.className = 'story-bubble';
  const av = state.me.avatar ? 'background-image:url(' + state.me.avatar + ')' : '';
  const avContent = state.me.avatar ? '' : initials(state.me.username || '?');
  mineBubble.innerHTML = '<div class="story-ring mine ' + (mineHasStory ? 'has-story' : '') + '">' +
    '<div class="story-ring-inner" style="' + av + '">' + avContent + '</div>' +
    '<div class="story-add-badge">+</div></div>' +
    '<div class="story-name">Моя</div>';
  mineBubble.onclick = function () {
    if (mineHasStory) {
      const idx = state.storiesUsers.indexOf(mine);
      openStoryViewer(idx, 0);
    } else openStoryAddModal();
  };
  row.appendChild(mineBubble);
  state.storiesUsers.forEach(function (u, idx) {
    if (u.username === state.me.username) return;
    const bubble = document.createElement('div');
    bubble.className = 'story-bubble';
    const allViewed = u.stories.every(function (s) { return s.viewed; });
    const avs = u.avatar ? 'background-image:url(' + u.avatar + ')' : 'background:var(--accent)';
    const avc = u.avatar ? '' : initials(u.firstName || u.username);
    const displayName = (u.firstName || u.lastName)
      ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim()
      : u.username;
    bubble.innerHTML = '<div class="story-ring ' + (allViewed ? 'viewed' : '') + '">' +
      '<div class="story-ring-inner" style="' + avs + '">' + avc + '</div></div>' +
      '<div class="story-name">' + escapeHtml(displayName) + '</div>';
    bubble.onclick = function () { openStoryViewer(idx, 0); };
    row.appendChild(bubble);
  });
}
function openStoryAddModal() {
  $('story-file').value = '';
  $('story-preview-wrap').style.display = 'none';
  $('story-caption-input').value = '';
  $('story-add-error').textContent = '';
  $('story-submit-btn').disabled = true;
  $('story-submit-btn').textContent = '📤 Опубликовать';
  window._storyImageData = null;
  openModal('story-add-modal');
}
function onStoryFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const maxSize = 1080;
      let w = img.width, h = img.height;
      if (w > h && w > maxSize) { h = h * maxSize / w; w = maxSize; }
      else if (h > maxSize) { w = w * maxSize / h; h = maxSize; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      window._storyImageData = dataUrl;
      $('story-preview-img').src = dataUrl;
      $('story-preview-wrap').style.display = 'block';
      $('story-submit-btn').disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function submitStory() {
  if (!window._storyImageData) return;
  const caption = $('story-caption-input').value.trim();
  const errEl = $('story-add-error');
  errEl.textContent = '';
  $('story-submit-btn').disabled = true;
  $('story-submit-btn').textContent = 'Публикую…';
  socket.emit('post story', { image: window._storyImageData, caption: caption }, function (res) {
    $('story-submit-btn').textContent = '📤 Опубликовать';
    $('story-submit-btn').disabled = false;
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('story-add-modal');
    window._storyImageData = null;
    loadStories();
  });
}
function openStoryViewer(userIdx, storyIdx) {
  if (!state.storiesUsers[userIdx] || !state.storiesUsers[userIdx].stories[storyIdx]) return;
  state.currentStoryUserIdx = userIdx;
  state.currentStoryIdx = storyIdx;
  $('story-viewer').classList.add('active');
  renderCurrentStory();
  startStoryTimer();
}
function renderCurrentStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return closeStoryViewer();
  const s = u.stories[state.currentStoryIdx];
  if (!s) return closeStoryViewer();
  const bar = $('story-progress-bar');
  bar.innerHTML = '';
  u.stories.forEach(function (_, i) {
    const seg = document.createElement('div');
    seg.className = 'story-progress-segment' + (i < state.currentStoryIdx ? ' done' : '');
    const fill = document.createElement('div');
    fill.className = 'fill';
    if (i < state.currentStoryIdx) fill.style.width = '100%';
    seg.appendChild(fill);
    bar.appendChild(seg);
  });
  const av = $('story-avatar');
  if (u.avatar) { av.style.backgroundImage = 'url(' + u.avatar + ')'; av.textContent = ''; }
  else {
    av.style.backgroundImage = '';
    av.textContent = initials(u.firstName || u.username);
    av.style.background = 'linear-gradient(135deg,#6d28d9,#a855f7)';
  }
  const displayName = (u.firstName || u.lastName)
    ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim()
    : u.username;
  $('story-name').textContent = displayName;
  $('story-time').textContent = timeAgo(s.time);
  $('story-image').src = s.image;
  const cap = $('story-caption');
  if (s.caption) { cap.textContent = s.caption; cap.classList.add('show'); }
  else cap.classList.remove('show');
  const isMine = u.username === state.me.username;
  const delBtn = $('story-delete-btn');
  const viewsBtn = $('story-views-btn');
  if (isMine) {
    delBtn.style.display = 'flex';
    viewsBtn.style.display = 'flex';
    socket.emit('get story views', { storyId: s.id }, function (res) {
      if (res && res.ok) viewsBtn.textContent = '👁 ' + res.viewers.length;
    });
  } else {
    delBtn.style.display = 'none';
    viewsBtn.style.display = 'none';
    if (!s.viewed) { s.viewed = true; socket.emit('view story', { storyId: s.id }); }
  }
}
function startStoryTimer() {
  stopStoryTimer();
  state.storyTimerStart = now();
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return;
  const seg = document.querySelectorAll('#story-progress-bar .story-progress-segment')[state.currentStoryIdx];
  const fill = seg ? seg.querySelector('.fill') : null;
  const tick = function () {
    const elapsed = now() - state.storyTimerStart;
    const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
    if (fill) fill.style.width = pct + '%';
    if (elapsed >= STORY_DURATION) { nextStory(); return; }
    state.storyTimer = requestAnimationFrame(tick);
  };
  state.storyTimer = requestAnimationFrame(tick);
}
function stopStoryTimer() { if (state.storyTimer) { cancelAnimationFrame(state.storyTimer); state.storyTimer = null; } }
function nextStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return closeStoryViewer();
  if (state.currentStoryIdx + 1 < u.stories.length) {
    state.currentStoryIdx++;
    renderCurrentStory();
    startStoryTimer();
  } else {
    let nextUserIdx = state.currentStoryUserIdx + 1;
    while (nextUserIdx < state.storiesUsers.length && state.storiesUsers[nextUserIdx].username === state.me.username) nextUserIdx++;
    if (nextUserIdx < state.storiesUsers.length) {
      state.currentStoryUserIdx = nextUserIdx;
      state.currentStoryIdx = 0;
      renderCurrentStory();
      startStoryTimer();
    } else closeStoryViewer();
  }
}
function prevStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return;
  if (state.currentStoryIdx > 0) {
    state.currentStoryIdx--;
    renderCurrentStory();
    startStoryTimer();
  } else {
    let prevUserIdx = state.currentStoryUserIdx - 1;
    while (prevUserIdx >= 0 && state.storiesUsers[prevUserIdx].username === state.me.username) prevUserIdx--;
    if (prevUserIdx >= 0) {
      state.currentStoryUserIdx = prevUserIdx;
      state.currentStoryIdx = state.storiesUsers[prevUserIdx].stories.length - 1;
      renderCurrentStory();
      startStoryTimer();
    } else {
      renderCurrentStory();
      startStoryTimer();
    }
  }
}
function closeStoryViewer() {
  stopStoryTimer();
  $('story-viewer').classList.remove('active');
  renderStoriesBar();
}
function deleteCurrentStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return;
  const s = u.stories[state.currentStoryIdx];
  if (!s) return;
  if (!confirm('Удалить эту историю?')) return;
  socket.emit('delete story', { storyId: s.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    u.stories.splice(state.currentStoryIdx, 1);
    if (u.stories.length === 0) state.storiesUsers.splice(state.currentStoryUserIdx, 1);
    if (state.storiesUsers.length === 0) return closeStoryViewer();
    if (state.currentStoryUserIdx >= state.storiesUsers.length) state.currentStoryUserIdx = state.storiesUsers.length - 1;
    if (state.currentStoryIdx >= state.storiesUsers[state.currentStoryUserIdx].stories.length) state.currentStoryIdx = 0;
    renderCurrentStory();
    startStoryTimer();
  });
}
function openStoryViewers() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return;
  const s = u.stories[state.currentStoryIdx];
  if (!s) return;
  socket.emit('get story views', { storyId: s.id }, function (res) {
    const box = $('story-viewers-list');
    if (!res || !res.ok || !res.viewers || res.viewers.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока никто не смотрел</div>';
    } else {
      box.innerHTML = '';
      res.viewers.forEach(function (v) {
        const c = state.contacts.find(function (x) { return x.name === v.viewer; });
        const displayName = (c && c.displayName) || v.viewer;
        const av = c && c.avatar;
        const badges = renderBadges(c || {});
        const row = document.createElement('div');
        row.className = 'member-row';
        row.innerHTML = '<div class="member-avatar" style="' + (av ? 'background-image:url(' + av + ')' : 'background:var(--accent)') + '">' + (av ? '' : initials(displayName)) + '</div>' +
          '<div class="member-name">' + escapeHtml(displayName) + ' ' + badges +
          '<div style="font-size:12px;color:var(--text-muted);">' + new Date(v.time).toLocaleString('ru-RU') + '</div></div>';
        box.appendChild(row);
      });
    }
    openModal('story-viewers-modal');
  });
}

// ─── GROUPS ───
function openCreateGroupModal() {
  if (!state.canCreateGroup) { alert('Ты уже создал группу. Максимум — одна.'); return; }
  if (state.contacts.length === 0) { alert('Сначала добавь контакты'); return; }
  state.createSelected.clear();
  $('group-name').value = '';
  $('create-error').textContent = '';
  renderCreateMembers();
  openModal('create-group-modal');
}
function renderCreateMembers() {
  const box = $('create-members');
  box.innerHTML = '';
  state.contacts.forEach(function (c) {
    const row = document.createElement('div');
    row.className = 'member-row' + (state.createSelected.has(c.name) ? ' selected' : '');
    const style = c.avatar ? 'background-image:url(' + c.avatar + ')' : 'background:var(--accent)';
    const content = c.avatar ? '' : initials(c.displayName || c.name);
    const badges = renderBadges(c);
    row.innerHTML = '<div class="member-check">✓</div>' +
      '<div class="member-avatar" style="' + style + '">' + content + '</div>' +
      '<div class="member-name"><div>' + escapeHtml(c.displayName || c.name) + ' ' + badges + '</div>' +
      '<div class="member-nick">@' + escapeHtml(c.name) + '</div></div>';
    row.onclick = function () {
      if (state.createSelected.has(c.name)) state.createSelected.delete(c.name);
      else state.createSelected.add(c.name);
      renderCreateMembers();
    };
    box.appendChild(row);
  });
}
function doCreateGroup() {
  const name = $('group-name').value.trim();
  const errEl = $('create-error');
  errEl.textContent = '';
  if (!name) { errEl.textContent = 'Введи название'; return; }
  if (state.createSelected.size === 0) { errEl.textContent = 'Выбери хотя бы одного'; return; }
  socket.emit('create group', { name: name, members: Array.from(state.createSelected) }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('create-group-modal');
    showToast('✓ Группа создана');
  });
}
function openGroupInfo() {
  if (!state.currentGroup) return;
  const g = state.currentGroup;
  $('group-info-title').textContent = g.name;
  $('group-info-desc').textContent = g.description || '';
  const list = $('group-info-members');
  list.innerHTML = '';
  g.members.forEach(function (u) {
    const c = state.contacts.find(function (c) { return c.name === u; });
    const displayName = u === state.me.username ? 'Я (@' + state.me.username + ')' : ((c && c.displayName || u) + ' (@' + u + ')');
    const av = c && c.avatar;
    const badges = renderBadges(c || {});
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = '<div class="member-avatar" style="' + (av ? 'background-image:url(' + av + ')' : 'background:var(--accent)') + '">' + (av ? '' : initials(c && c.displayName || u)) + '</div>' +
      '<div class="member-name">' + escapeHtml(displayName) + ' ' + badges + '</div>';
    list.appendChild(row);
  });
  const delBtn = $('delete-group-btn');
  const editBtn = $('edit-group-btn');
  if (g.creator === state.me.username) { delBtn.style.display = 'block'; editBtn.style.display = 'block'; }
  else { delBtn.style.display = 'none'; editBtn.style.display = 'none'; }
  openModal('group-info-modal');
}
function openEditGroup() {
  if (!state.currentGroup) return;
  $('edit-group-name').value = state.currentGroup.name;
  $('edit-group-desc').value = state.currentGroup.description || '';
  closeModal('group-info-modal');
  openModal('edit-group-modal');
}
function doEditGroup() {
  if (!state.currentGroup) return;
  const name = $('edit-group-name').value.trim();
  const description = $('edit-group-desc').value.trim();
  socket.emit('update group', { groupId: state.currentGroup.id, name: name, description: description }, function () {
    closeModal('edit-group-modal');
  });
}
function openAddMembers() {
  closeModal('group-info-modal');
  if (!state.currentGroup) return;
  state.addMembersSelected.clear();
  $('add-members-error').textContent = '';
  const available = state.contacts.filter(function (c) { return state.currentGroup.members.indexOf(c.name) === -1; });
  const box = $('add-members-list');
  box.innerHTML = '';
  if (available.length === 0) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:#7f91a4;">Все контакты уже в группе</div>';
  } else {
    available.forEach(function (c) {
      const row = document.createElement('div');
      row.className = 'member-row';
      const style = c.avatar ? 'background-image:url(' + c.avatar + ')' : 'background:var(--accent)';
      const content = c.avatar ? '' : initials(c.displayName || c.name);
      const badges = renderBadges(c);
      row.innerHTML = '<div class="member-check">✓</div>' +
        '<div class="member-avatar" style="' + style + '">' + content + '</div>' +
        '<div class="member-name"><div>' + escapeHtml(c.displayName || c.name) + ' ' + badges + '</div>' +
        '<div class="member-nick">@' + escapeHtml(c.name) + '</div></div>';
      row.onclick = function () {
        if (state.addMembersSelected.has(c.name)) state.addMembersSelected.delete(c.name);
        else state.addMembersSelected.add(c.name);
        row.classList.toggle('selected');
      };
      box.appendChild(row);
    });
  }
  openModal('add-members-modal');
}
function doAddMembers() {
  if (!state.currentGroup) return;
  const errEl = $('add-members-error');
  errEl.textContent = '';
  if (state.addMembersSelected.size === 0) { errEl.textContent = 'Выбери хотя бы одного'; return; }
  socket.emit('add group members', { groupId: state.currentGroup.id, members: Array.from(state.addMembersSelected) }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('add-members-modal');
  });
}
function confirmLeaveGroup() {
  if (!state.currentGroup) return;
  if (!confirm('Выйти из группы?')) return;
  socket.emit('leave group', { groupId: state.currentGroup.id }, function () {
    closeModal('group-info-modal');
    closeChat();
  });
}
function confirmDeleteGroup() {
  if (!state.currentGroup) return;
  if (!confirm('Удалить группу для ВСЕХ?')) return;
  socket.emit('delete group', { groupId: state.currentGroup.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Не удалось'); return; }
    closeModal('group-info-modal');
    closeChat();
  });
}

// ═══════════════════════════════════════════════════════════
// ⚠️ КОНЕЦ ЧАСТИ 2/4
// Дальше: Часть 3/4 — начнётся с "// ─── CHANNELS ───"
// ═══════════════════════════════════════════════════════════
// ─── CHANNELS ───
function openCreateChannelModal() {
  if (!state.canCreateChannel) { alert('Ты уже создал канал. Максимум — один.'); return; }
  $('channel-slug').value = '';
  $('channel-name').value = '';
  $('channel-desc').value = '';
  $('create-channel-error').textContent = '';
  openModal('create-channel-modal');
}
function doCreateChannel() {
  const slug = $('channel-slug').value.trim().toLowerCase().replace(/^@/, '');
  const name = $('channel-name').value.trim();
  const description = $('channel-desc').value.trim();
  const errEl = $('create-channel-error');
  errEl.textContent = '';
  if (!slug) { errEl.textContent = 'Введи ID канала'; return; }
  if (!name) { errEl.textContent = 'Введи название'; return; }
  socket.emit('create channel', { slug: slug, name: name, description: description }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('create-channel-modal');
    showToast('📢 Канал создан!');
  });
}
function openChannelChat(ch) {
  state.currentChannel = ch;
  state.currentChat = null;
  state.currentGroup = null;
  state.isSavedChat = false;
  $('channel-top-name').innerHTML = escapeHtml(ch.name) + (ch.verified ? ' <span class="verified-badge big">✓</span>' : '');
  $('channel-top-status').textContent = '@' + ch.slug + ' · ' + ch.memberCount + ' подписчиков';
  const av = $('channel-avatar');
  if (ch.avatar) { av.style.backgroundImage = 'url(' + ch.avatar + ')'; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = '📢'; av.style.background = ''; }
  $('channel-screen').style.display = 'flex';
  socket.emit('load channel posts', { channelId: ch.id }, function (res) {
    const box = $('channel-posts');
    box.innerHTML = '';
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Не удалось загрузить</div>';
      return;
    }
    if (res.posts.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:15px;">Пока нет публикаций</div>';
    } else res.posts.forEach(function (p) { renderChannelPost(p); });
  });
  if (ch.creator === state.me.username) $('channel-input-area').style.display = 'flex';
  else $('channel-input-area').style.display = 'none';
}
function closeChannelChat() {
  $('channel-screen').style.display = 'none';
  state.currentChannel = null;
}
function renderChannelPost(p) {
  const box = $('channel-posts');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:18px;padding:14px;background:var(--bg-panel);border-radius:var(--radius-md);border:var(--glass-border);';
  let html = '';
  if (p.from_user !== state.me.username) {
    // 🔧 NEW: значки автора поста
    const authorContact = state.contacts.find(function (c) { return c.name === p.from_user; });
    const authorBadges = renderBadges(authorContact || {});
    html += '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 ' + escapeHtml(displayNameForUser(p.from_user)) + ' ' + authorBadges + '</div>';
  } else {
    const myBadges = renderBadges(state.me);
    if (myBadges) {
      html += '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 Я ' + myBadges + '</div>';
    }
  }
  if (p.image) html += '<img src="' + p.image + '" style="max-width:100%;border-radius:var(--radius-md);margin-bottom:8px;display:block;">';
  if (p.text) html += '<div style="font-size:15px;line-height:1.45;margin-bottom:8px;word-wrap:break-word;">' + escapeHtml(p.text) + '</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
    '<button class="reaction-chip" onclick="socket.emit(\'view channel post\', {postId:' + p.id + '}); openChannelComments(' + p.id + ');">💬 ' + (p.commentCount || 0) + '</button>' +
    '<span style="font-size:11px;color:var(--text-muted);">👁 ' + (p.views || 0) + '</span>' +
    '<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">' + new Date(p.time).toLocaleString('ru-RU') + '</span>' +
    '</div>';
  wrap.innerHTML = html;
  const reactionsBar = document.createElement('div');
  reactionsBar.className = 'reactions';
  Object.entries(p.reactions || {}).forEach(function (entry) {
    const emoji = entry[0], users = entry[1];
    if (!users || users.length === 0) return;
    const chip = document.createElement('button');
    chip.className = 'reaction-chip' + (users.indexOf(state.me.username) !== -1 ? ' mine' : '');
    chip.innerHTML = emoji + ' <span>' + users.length + '</span>';
    chip.onclick = function (e) { e.stopPropagation(); socket.emit('react channel post', { postId: p.id, emoji: emoji }); };
    reactionsBar.appendChild(chip);
  });
  wrap.appendChild(reactionsBar);
  wrap.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    const emoji = prompt('Реакция (❤️ 👍 😂 😮 😢 🔥)');
    if (!emoji) return;
    socket.emit('react channel post', { postId: p.id, emoji: emoji });
  });
  box.appendChild(wrap);
}
function sendChannelPost() {
  if (!state.currentChannel) return;
  const input = $('channel-post-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('create channel post', { channelId: state.currentChannel.id, text: text }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    input.value = '';
  });
}
function openChannelInfo() {
  if (!state.currentChannel) return;
  const ch = state.currentChannel;
  $('channel-info-title').textContent = ch.name + (ch.verified ? ' ✓' : '');
  $('channel-info-desc').textContent = ch.description || '';
  $('channel-info-stats').innerHTML = '@' + escapeHtml(ch.slug) + '<br>' + ch.memberCount + ' подписчиков';
  const isOwner = ch.creator === state.me.username;
  $('channel-invite-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-edit-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-delete-btn').style.display = isOwner ? 'block' : 'none';
  $('channel-leave-btn').style.display = isOwner ? 'none' : 'block';
  openModal('channel-info-modal');
}
function createChannelInvite() {
  if (!state.currentChannel) return;
  socket.emit('create channel invite', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    state.currentInviteCode = res.code;
    $('channel-invite-code').textContent = res.code;
    closeModal('channel-info-modal');
    openModal('channel-invite-result-modal');
  });
}
function copyInviteCode() {
  if (!state.currentInviteCode) return;
  navigator.clipboard.writeText(state.currentInviteCode).then(function () { showToast('📋 Код скопирован'); }).catch(function () { alert(state.currentInviteCode); });
}
function openEditChannel() {
  if (!state.currentChannel) return;
  $('edit-channel-name').value = state.currentChannel.name;
  $('edit-channel-desc').value = state.currentChannel.description || '';
  closeModal('channel-info-modal');
  openModal('edit-channel-modal');
}
function doEditChannel() {
  if (!state.currentChannel) return;
  const name = $('edit-channel-name').value.trim();
  const description = $('edit-channel-desc').value.trim();
  socket.emit('update channel', { channelId: state.currentChannel.id, name: name, description: description }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('edit-channel-modal');
    showToast('✓ Сохранено');
  });
}
function confirmDeleteChannel() {
  if (!state.currentChannel) return;
  if (!confirm('Удалить канал для ВСЕХ?')) return;
  socket.emit('delete channel', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('channel-info-modal');
    closeChannelChat();
  });
}
function confirmLeaveChannel() {
  if (!state.currentChannel) return;
  if (!confirm('Отписаться от канала?')) return;
  socket.emit('unsubscribe channel', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('channel-info-modal');
    closeChannelChat();
  });
}
function openFindChannelModal() {
  $('find-channel-input').value = '';
  $('find-channel-error').textContent = '';
  openModal('find-channel-modal');
}
function doFindChannel() {
  const q = $('find-channel-input').value.trim();
  const errEl = $('find-channel-error');
  errEl.textContent = '';
  if (!q) { errEl.textContent = 'Введи ID или код'; return; }
  if (/^[A-Z0-9]{8,12}$/i.test(q)) {
    socket.emit('resolve channel invite', { code: q }, function (res) {
      if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
      closeModal('find-channel-modal');
      showChannelFoundModal(res.channel);
    });
  } else {
    socket.emit('find channel by slug', { slug: q }, function (res) {
      if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
      closeModal('find-channel-modal');
      showChannelFoundModal(res.channel);
    });
  }
}
function showChannelFoundModal(ch) {
  const text = '📢 ' + ch.name + '\n@' + ch.slug + (ch.verified ? ' ✓' : '') + '\n\n' + (ch.description || '');
  if (confirm(text + '\n\nПодписаться?')) {
    socket.emit('subscribe channel', { channelId: ch.id }, function (res) {
      if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
      showToast('✓ Подписан на канал');
    });
  }
}
function openChannelComments(postId) {
  state.currentChannelPostId = postId;
  $('channel-comment-input').value = '';
  loadChannelComments(postId);
  openModal('channel-comments-modal');
}
function loadChannelComments(postId) {
  socket.emit('load channel comments', { postId: postId }, function (res) {
    const box = $('channel-comments-list');
    if (!res || !res.ok || !res.comments || res.comments.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока нет комментариев</div>';
      return;
    }
    box.innerHTML = '';
    res.comments.forEach(function (c) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:10px 12px;background:var(--bg-input-inner);border-radius:var(--radius-md);margin-bottom:8px;';
      // 🔧 NEW: значки автора комментария
      const cContact = state.contacts.find(function (x) { return x.name === c.from_user; });
      const cBadges = renderBadges(cContact || {});
      div.innerHTML = '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:4px;">' + escapeHtml(displayNameForUser(c.from_user)) + ' ' + cBadges + '</div>' +
        '<div style="font-size:14px;word-wrap:break-word;">' + escapeHtml(c.text || '') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + new Date(c.time).toLocaleString('ru-RU') + '</div>';
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}
function submitChannelComment() {
  if (!state.currentChannelPostId) return;
  const input = $('channel-comment-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('create channel comment', { postId: state.currentChannelPostId, text: text }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    input.value = '';
  });
}

// ─── SEARCH / GALLERY ───
function openSearchInChat() {
  if (!state.currentChat && !state.currentGroup) return;
  $('search-input').value = '';
  $('search-results').innerHTML = '';
  openModal('search-modal');
  setTimeout(function () { $('search-input').focus(); }, 100);
}

document.addEventListener('DOMContentLoaded', function () {
  const si = $('search-input');
  if (si) {
    si.addEventListener('input', function (e) {
      const q = e.target.value.trim();
      const results = $('search-results');
      if (q.length < 2) { results.innerHTML = ''; return; }
      const params = state.currentGroup
        ? { query: q, groupId: state.currentGroup.id }
        : { query: q, withUser: state.currentChat };
      socket.emit('search messages', params, function (res) {
        if (!res || !res.ok || res.results.length === 0) {
          results.innerHTML = '<div style="text-align:center;color:#7f91a4;padding:20px;">Ничего не найдено</div>';
          return;
        }
        results.innerHTML = '';
        res.results.forEach(function (m) {
          const div = document.createElement('div');
          div.className = 'search-result';
          const from = displayNameForUser(m.from_user);
          const time = new Date(m.time).toLocaleString('ru-RU');
          div.innerHTML = '<div class="sr-from">' + escapeHtml(from) + '</div>' +
            '<div class="sr-text">' + escapeHtml(m.text || '') + '</div>' +
            '<div class="sr-time">' + time + '</div>';
          div.onclick = function () { closeModal('search-modal'); scrollToMessage(m.id); };
          results.appendChild(div);
        });
      });
    });
  }
});

function openGallery() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) return;
  state.galleryWaiting = true;
  $('gallery-content').innerHTML = '';
  $('gallery-empty').style.display = 'none';
  openModal('gallery-modal');
  if (state.isSavedChat) socket.emit('load saved history');
  else if (state.currentChat) socket.emit('load history', { withUser: state.currentChat });
  else if (state.currentGroup) socket.emit('load group history', { groupId: state.currentGroup.id });
}
function fillGallery(messages) {
  const box = $('gallery-content');
  const emptyEl = $('gallery-empty');
  box.innerHTML = '';
  const media = messages.filter(function (m) { return (m.image || m.video_circle) && !m.deleted && !m.sticker; });
  if (media.length === 0) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  media.reverse().forEach(function (m) {
    if (m.image) {
      const img = document.createElement('img');
      img.className = 'gallery-item';
      img.src = m.image;
      img.onclick = function () { closeModal('gallery-modal'); openLightbox(m.image); };
      box.appendChild(img);
    } else if (m.video_circle) {
      const div = document.createElement('div');
      div.className = 'gallery-item video-item';
      div.textContent = '🎥';
      div.onclick = function () {
        closeModal('gallery-modal');
        const vid = document.querySelector('.msg-wrap[data-id="' + m.id + '"] video');
        if (vid) {
          vid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () { vid.play().catch(function () {}); }, 500);
        }
      };
      box.appendChild(div);
    }
  });
}
function openLightbox(src) {
  $('lightbox-img').src = src;
  $('lightbox').classList.add('active');
}

// ─── CHAT MENU ───
function currentChatKey() {
  return state.currentGroup ? 'g:' + state.currentGroup.id : state.currentChat;
}
function currentChatObj() {
  if (state.currentGroup) return state.currentGroup;
  return state.contacts.find(function (c) { return c.name === state.currentChat; });
}
function openChatMenuV2() {
  const obj = currentChatObj();
  const isMuted = obj && obj.muted;
  const isArchived = obj && obj.archived;
  const title = state.currentGroup ? state.currentGroup.name : ((obj && obj.displayName) || state.currentChat);
  $('chat-menu-title').textContent = title;
  $('chat-menu-mute').textContent = isMuted ? '🔔 Включить уведомления' : '🔕 Отключить уведомления';
  $('chat-menu-archive').textContent = isArchived ? '📤 Убрать из архива' : '📦 В архив';
  openModal('chat-menu-modal');
}
function chatMenuToggleMute() {
  const key = currentChatKey();
  if (!key) return;
  socket.emit('toggle mute', { chatKey: key }, function () { closeModal('chat-menu-modal'); });
}
function chatMenuToggleArchive() {
  const key = currentChatKey();
  if (!key) return;
  socket.emit('toggle archive', { chatKey: key }, function () { closeModal('chat-menu-modal'); });
}

// ─── STARS / GIFTS / CODES ───
function openStarsHistory() {
  socket.emit('get stars', function (res) {
    if (!res || !res.ok) return;
    state.me.stars = res.stars;
    const box = $('stars-history-list');
    if (!res.transactions || res.transactions.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Пока нет операций</div>';
    } else {
      const labels = { welcome: '🎉 Бонус за регистрацию', premium_activated: '✨ Активация премиума' };
      box.innerHTML = '';
      res.transactions.forEach(function (t) {
        let label = t.reason;
        if (labels[t.reason]) label = labels[t.reason];
        else if (t.reason.indexOf('gift_sent:') === 0) label = '🎁 Подарок для @' + t.reason.replace('gift_sent:', '');
        else if (t.reason.indexOf('gift_sold:') === 0) {
          const gk = t.reason.replace('gift_sold:', '');
          const g = state.giftsCatalog[gk];
          label = '💸 Продажа ' + (g ? g.emoji + ' ' + g.name : gk);
        }
        const sign = t.amount > 0 ? '+' : '';
        const color = t.amount > 0 ? '#22c55e' : '#ef4444';
        const div = document.createElement('div');
        div.className = 'session-item';
        div.innerHTML = '<div class="device">' + label + '</div>' +
          '<div class="meta" style="color:' + color + ';font-weight:700;font-size:14px;">' + sign + t.amount + ' ⭐</div>' +
          '<div class="meta">' + new Date(t.time).toLocaleString('ru-RU') + '</div>';
        box.appendChild(div);
      });
    }
    openModal('stars-history-modal');
  });
}

function openGiftsCatalog(username) {
  if (!username) {
    username = (contactProfileCurrent && contactProfileCurrent.username) || (state.contactProfileCurrent && state.contactProfileCurrent.username);
  }
  if (!username) return;
  if (username === state.me.username) { alert('Себе дарить нельзя 🐎'); return; }
  state.currentGiftTarget = username;
  const contact = state.contacts.find(function (c) { return c.name === username; });
  const displayName = (contact && contact.displayName) || username;
  $('gifts-catalog-target').textContent = 'Кому: ' + displayName;
  $('gifts-catalog-balance').textContent = state.me.stars;
  $('gifts-catalog-error').textContent = '';
  closeModal('contact-profile-modal');
  const grid = $('gifts-grid');
  grid.innerHTML = '';
  const entries = Object.entries(state.giftsCatalog);
  if (entries.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">Каталог пуст</div>';
  } else {
    entries.forEach(function (entry) {
      const key = entry[0], gift = entry[1];
      const affordable = state.me.stars >= gift.price;
      const div = document.createElement('div');
      div.className = 'gift-card ' + (affordable ? 'affordable' : 'unaffordable');
      div.innerHTML = '<span class="gift-emoji">' + gift.emoji + '</span>' +
        '<span class="gift-name">' + gift.name + '</span>' +
        '<span class="gift-price">' + gift.price + ' ⭐</span>';
      if (affordable) div.onclick = function () { sendGift(key); };
      grid.appendChild(div);
    });
  }
  openModal('gifts-catalog-modal');
}

function sendGift(giftKey) {
  const gift = state.giftsCatalog[giftKey];
  if (!gift) return;
  if (!confirm('Подарить ' + gift.emoji + ' ' + gift.name + ' за ' + gift.price + ' ⭐?')) return;
  const errEl = $('gifts-catalog-error');
  errEl.textContent = '';
  socket.emit('send gift', { to: state.currentGiftTarget, giftKey: giftKey }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('gifts-catalog-modal');
    showToast('🎁 Подарок отправлен! -' + gift.price + ' ⭐');
  });
}

function openMyGifts() {
  socket.emit('get my gifts', function (res) {
    const box = $('my-gifts-list');
    if (!res || !res.ok || !res.gifts || res.gifts.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Пока нет подарков 🎁</div>';
    } else {
      box.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'my-gifts-grid';
      res.gifts.forEach(function (g) {
        const gift = state.giftsCatalog[g.gift_key];
        if (!gift) return;
        const card = document.createElement('div');
        card.className = 'my-gift-card';
        const contact = state.contacts.find(function (c) { return c.name === g.from_user; });
        const fromName = (contact && contact.displayName) || g.from_user;
        const refund = Math.floor(gift.price / 2);
        card.innerHTML = '<span class="gift-emoji">' + gift.emoji + '</span>' +
          '<span class="gift-name" style="font-size:11px;font-weight:600;">' + gift.name + '</span>' +
          '<span class="gift-from">от @' + escapeHtml(fromName) + '</span>' +
          '<button class="gift-sell" onclick="sellGift(' + g.id + ')">💸 ' + refund + '⭐</button>';
        grid.appendChild(card);
      });
      box.appendChild(grid);
    }
    openModal('my-gifts-modal');
  });
}

function sellGift(giftId) {
  if (!confirm('Продать подарок за 50% цены?')) return;
  socket.emit('sell gift', { giftId: giftId }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    showToast('💸 Продано! +' + res.returned + ' ⭐');
    openMyGifts();
  });
}

socket.on('gift received', function (payload) {
  const gift = state.giftsCatalog[payload.gift_key];
  const contact = state.contacts.find(function (c) { return c.name === payload.from_user; });
  const fromName = (contact && contact.displayName) || payload.from_user;
  if (gift) showToast('🎁 ' + fromName + ' подарил: ' + gift.emoji + ' ' + gift.name + '!');
});

socket.on('my gifts updated', function () {
  if ($('my-gifts-modal').classList.contains('active')) openMyGifts();
});

function openGiftModal() {
  $('gift-code-input').value = '';
  $('gift-error').textContent = '';
  openModal('gift-modal');
}

function redeemGiftCode() {
  const code = $('gift-code-input').value.trim().toUpperCase();
  const errEl = $('gift-error');
  errEl.textContent = '';
  if (!code) { errEl.textContent = 'Введи код'; return; }
  socket.emit('redeem gift code', { code: code }, function (res) {
    if (!res || !res.ok) { errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('gift-modal');
    showToast('🎉 Премиум активирован! +' + (res.bonus || 25) + ' ⭐');
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

function openGiftAdminModal() {
  if (state.me.username !== 'moroz') return;
  $('gift-codes-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>';
  openModal('gift-admin-modal');
  loadGiftCodes();
}

function loadGiftCodes() {
  socket.emit('list gift codes', function (res) {
    const box = $('gift-codes-list');
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Нет доступа</div>';
      return;
    }
    if (res.codes.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Пока нет кодов</div>';
      return;
    }
    box.innerHTML = '';
    res.codes.forEach(function (c) {
      const div = document.createElement('div');
      div.className = 'gift-code-item';
      const status = c.used_by
        ? '<span class="status used">✓ ' + escapeHtml(c.used_by) + '</span>'
        : '<span class="status">свободен</span>';
      div.innerHTML = '<span class="code" onclick="copyText(\'' + c.code + '\')">' + escapeHtml(c.code) + '</span>' + status;
      box.appendChild(div);
    });
  });
}

function generateGiftCode() {
  socket.emit('generate gift code', function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    alert('🎁 Код создан:\n\n' + res.code + '\n\nСкопируй и отправь другу.');
    loadGiftCodes();
  });
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(function () { showToast('📋 Скопировано'); }).catch(function () {});
}

// ─── CALLS ───
var RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ],
  iceCandidatePoolSize: 4
};

function startCallTimer() {
  state.callStartTime = now();
  const el = $('call-timer');
  if (el) el.textContent = '0:00';
  if (state.callTimerInterval) clearInterval(state.callTimerInterval);
  state.callTimerInterval = setInterval(function () {
    const elapsed = Math.floor((now() - state.callStartTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    if (el) el.textContent = m + ':' + s.toString().padStart(2, '0');
  }, 1000);
}
function stopCallTimer() {
  if (state.callTimerInterval) { clearInterval(state.callTimerInterval); state.callTimerInterval = null; }
  const el = $('call-timer');
  if (el) el.textContent = '';
}

async function toggleScreenShare() {
  const btn = $('screenBtn');
  if (!state.peerConnection || !state.localStream) return;
  if (!state.isScreenSharing) {
    try {
      state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      state.screenTrack = state.screenStream.getVideoTracks()[0];
      const sender = state.peerConnection.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(state.screenTrack);
      const lv = $('localVideo');
      if (lv) lv.srcObject = state.screenStream;
      state.isScreenSharing = true;
      if (btn) { btn.style.background = '#fff'; btn.style.color = '#000'; }
      state.screenTrack.onended = function () { stopScreenShare(); };
    } catch (err) { alert('Не удалось: ' + err.message); }
  } else stopScreenShare();
}

async function stopScreenShare() {
  if (!state.isScreenSharing) return;
  try {
    if (state.screenStream) { state.screenStream.getTracks().forEach(function (t) { t.stop(); }); state.screenStream = null; }
    state.screenTrack = null;
    state.isScreenSharing = false;
    const btn = $('screenBtn');
    if (btn) { btn.style.background = ''; btn.style.color = ''; }
    const camTrack = state.localStream ? state.localStream.getVideoTracks()[0] : null;
    if (camTrack && state.peerConnection) {
      const sender = state.peerConnection.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
      if (sender) await sender.replaceTrack(camTrack);
    }
    const lv = $('localVideo');
    if (lv && state.localStream) lv.srcObject = state.localStream;
  } catch (e) {}
}

async function startCall(video) {
  if (!state.currentChat || state.callActive) return;
  const contact = state.contacts.find(function (c) { return c.name === state.currentChat; });
  if (contact && !contact.online) { alert((contact.displayName || state.currentChat) + ' не в сети.'); return; }
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
  } catch (err) {
    alert('Нет доступа: ' + err.message);
    return;
  }
  state.callActive = true;
  state.micOn = true;
  state.camOn = !!video;
  showCallScreen(state.currentChat, contact, video, 'Вызов...');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(function (t) { state.peerConnection.addTrack(t, state.localStream); });
  state.peerConnection.onicecandidate = function (e) {
    if (e.candidate) socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate });
  };
  state.peerConnection.ontrack = function (e) {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  };
  const offer = await state.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer: offer, video: video });
}

function showCallScreen(peerName, contact, video, statusText) {
  // 🔧 NEW: значки собеседника в звонке
  const badges = renderBadgesBig(contact || {});
  const displayName = (contact && contact.displayName) || peerName;
  $('call-peer-name').innerHTML = escapeHtml(displayName) + ' ' + badges;
  $('call-status').textContent = statusText;
  $('call-screen').classList.add('active');
  const lw = $('local-video-wrap');
  if (video && state.localStream) {
    lw.classList.add('active');
    $('localVideo').srcObject = state.localStream;
  } else lw.classList.remove('active');
  const ba = $('call-avatar-big');
  const rw = $('remote-video-wrap');
  if (video) {
    rw.classList.remove('audio-only');
    ba.style.display = 'none';
  } else {
    rw.classList.add('audio-only');
    ba.style.display = 'flex';
    if (contact && contact.avatar) {
      ba.style.backgroundImage = 'url(' + contact.avatar + ')';
      ba.textContent = '';
    } else {
      ba.style.backgroundImage = '';
      ba.textContent = initials(displayName);
      ba.style.background = 'linear-gradient(135deg,#6d28d9,#a855f7)';
    }
  }
  updateCallButtons();
}

socket.on('incoming-call', function (data) {
  state.incomingFrom = data.from;
  state.incomingVideo = data.video;
  state.pendingOffer = data.offer;
  const contact = state.contacts.find(function (c) { return c.name === data.from; });
  const displayName = (contact && contact.displayName) || data.from;
  // 🔧 NEW: значки звонящего
  const badges = renderBadgesBig(contact || {});
  $('incoming-name').innerHTML = escapeHtml(displayName) + ' ' + badges;
  $('incoming-type').textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';
  const av = $('incoming-avatar');
  if (contact && contact.avatar) {
    av.style.backgroundImage = 'url(' + contact.avatar + ')';
    av.textContent = '';
  } else {
    av.style.backgroundImage = '';
    av.textContent = initials(displayName);
    av.style.background = 'linear-gradient(135deg,#6d28d9,#a855f7)';
  }
  $('incoming-screen').classList.add('active');
  playPing();
  vibrate();
});

function declineIncoming() {
  $('incoming-screen').classList.remove('active');
  if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom });
  state.pendingOffer = null;
  state.incomingFrom = null;
}

async function acceptIncoming() {
  $('incoming-screen').classList.remove('active');
  if (!state.pendingOffer || !state.incomingFrom) return;
  const from = state.incomingFrom;
  const video = state.incomingVideo;
  const offer = state.pendingOffer;
  state.pendingOffer = null;
  state.incomingFrom = null;
  state.currentChat = from;
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
  } catch (err) {
    alert('Нет доступа: ' + err.message);
    socket.emit('end-call', { to: from });
    return;
  }
  state.callActive = true;
  state.micOn = true;
  state.camOn = !!video;
  const contact = state.contacts.find(function (c) { return c.name === from; });
  showCallScreen(from, contact, video, 'Соединение...');
  state.peerConnection = new RTCPeerConnection(RTC_CONFIG);
  state.localStream.getTracks().forEach(function (t) { state.peerConnection.addTrack(t, state.localStream); });
  state.peerConnection.onicecandidate = function (e) {
    if (e.candidate) socket.emit('ice-candidate', { to: from, candidate: e.candidate });
  };
  state.peerConnection.ontrack = function (e) {
    $('remoteVideo').srcObject = e.streams[0];
    $('remote-video-wrap').classList.remove('audio-only');
    $('call-avatar-big').style.display = 'none';
    $('call-status').textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  };
  await state.peerConnection.setRemoteDescription(offer);
  const answer = await state.peerConnection.createAnswer();
  await state.peerConnection.setLocalDescription(answer);
  socket.emit('answer-call', { to: from, answer: answer });
}

socket.on('call-answered', async function (data) {
  if (state.peerConnection) {
    await state.peerConnection.setRemoteDescription(data.answer);
    $('call-status').textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  }
});

socket.on('ice-candidate', async function (data) {
  if (state.peerConnection) {
    try { await state.peerConnection.addIceCandidate(data.candidate); } catch (e) {}
  }
});

socket.on('call-ended', function () { cleanupCall(); });
socket.on('call-failed', function (data) {
  alert('Не удалось: ' + data.reason);
  cleanupCall();
});

function cleanupCall() {
  state.callActive = false;
  stopCallTimer();
  if (state.isScreenSharing) stopScreenShare();
  if (state.peerConnection) { state.peerConnection.close(); state.peerConnection = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(function (t) { t.stop(); }); state.localStream = null; }
  $('call-screen').classList.remove('active');
  $('incoming-screen').classList.remove('active');
  $('localVideo').srcObject = null;
  $('remoteVideo').srcObject = null;
  $('local-video-wrap').classList.remove('active');
}

function toggleMic() {
  if (!state.localStream) return;
  const t = state.localStream.getAudioTracks()[0];
  if (!t) return;
  state.micOn = !state.micOn;
  t.enabled = state.micOn;
  updateCallButtons();
}
function toggleCamera() {
  if (!state.localStream) return;
  const t = state.localStream.getVideoTracks()[0];
  if (!t) return;
  state.camOn = !state.camOn;
  t.enabled = state.camOn;
  updateCallButtons();
}
function updateCallButtons() {
  const mb = $('micBtn');
  const cb = $('camBtn');
  if (mb) { mb.textContent = state.micOn ? '🎤' : '🔇'; mb.classList.toggle('off', !state.micOn); }
  if (cb) { cb.textContent = state.camOn ? '📷' : '🚫'; cb.classList.toggle('off', !state.camOn); }
}
function hangUp() {
  if (state.currentChat) socket.emit('end-call', { to: state.currentChat });
  cleanupCall();
}

// ═══════════════════════════════════════════════════════════
// ⚠️ КОНЕЦ ЧАСТИ 3/4
// Дальше: Часть 4/4 — начнётся с "// ─── SOCKET EVENTS — MESSAGES ───"
// ═══════════════════════════════════════════════════════════
// ─── SOCKET EVENTS — MESSAGES ───
socket.on('history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (data.withUser !== state.currentChat) return;
  const box = $('messages');
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user, to: m.to_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      reactions: m.reactions || {}, time: m.time,
      self: m.from_user === state.me.username,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted, read: !!m.read_at
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('saved history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (!state.isSavedChat) return;
  const box = $('messages');
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user, to: m.to_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      reactions: m.reactions || {}, time: m.time, self: true,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('group history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (!state.currentGroup || state.currentGroup.id !== data.groupId) return;
  const box = $('messages');
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      reactions: m.reactions || {}, time: m.time,
      self: m.from_user === state.me.username,
      senderName: displayNameForUser(m.from_user),
      isGroup: true,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('private message', function (data) {
  const isSavedMsg = data.from === state.me.username && data.to === state.me.username;
  if (data.self && state.currentChat === data.to && !isSavedMsg) {
    renderMessage({
      id: data.id, from: state.me.username, to: data.to,
      text: data.text, image: data.image, sticker: data.sticker,
      voice: data.voice, voiceDuration: data.voiceDuration,
      videoCircle: data.videoCircle, videoDuration: data.videoDuration,
      reactions: data.reactions || {}, time: data.time,
      self: true, replyData: data.replyData, read: false
    });
  } else if (data.self && state.isSavedChat && isSavedMsg) {
    renderMessage({
      id: data.id, from: state.me.username, to: state.me.username,
      text: data.text, image: data.image, sticker: data.sticker,
      voice: data.voice, voiceDuration: data.voiceDuration,
      videoCircle: data.videoCircle, videoDuration: data.videoDuration,
      reactions: data.reactions || {}, time: data.time,
      self: true, replyData: data.replyData, read: false
    });
  } else if (!data.self) {
    if (data.from === state.currentChat) {
      renderMessage({
        id: data.id, from: data.from, to: state.me.username,
        text: data.text, image: data.image, sticker: data.sticker,
        voice: data.voice, voiceDuration: data.voiceDuration,
        videoCircle: data.videoCircle, videoDuration: data.videoDuration,
        reactions: data.reactions || {}, time: data.time,
        self: false, replyData: data.replyData
      });
      clearUnread(data.from);
      // 🔧 smooth scroll
      setTimeout(function () {
        const box = $('messages');
        if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      }, 50);
    } else {
      const c = state.contacts.find(function (x) { return x.name === data.from; });
      if (!c || !c.muted) {
        if (state.settings.notif_private != 0) { playPing(); vibrate(); }
      }
      state.unread[data.from] = (state.unread[data.from] || 0) + 1;
      saveUnread();
      renderChatList();
      updateTitle();
      let preview = data.text || '';
      if (data.sticker) preview = '🖼 Стикер';
      if (data.image) preview = '📷 Фото';
      if (data.voice) preview = '🎤 Голосовое';
      if (data.videoCircle) preview = '🎥 Кружок';
      showBrowserNotification(displayNameForUser(data.from), preview);
    }
  }
});

socket.on('messages read', function () {
  document.querySelectorAll('.msg.self .check').forEach(function (el) {
    if (!el.classList.contains('read')) el.classList.add('read');
  });
});

socket.on('message edited', function (data) {
  const wrap = document.querySelector('.msg-wrap[data-id="' + data.messageId + '"]');
  if (!wrap) return;
  const ts = wrap.querySelector('.msg .msg-text');
  if (ts) ts.textContent = data.text;
});

socket.on('message deleted', function (data) {
  const wrap = document.querySelector('.msg-wrap[data-id="' + data.messageId + '"]');
  if (!wrap) return;
  const msgEl = wrap.querySelector('.msg');
  msgEl.classList.add('deleted');
  msgEl.innerHTML = '<i>Сообщение удалено</i>';
});

socket.on('message blocked', function (data) { alert(data.reason); });

socket.on('group message', function (data) {
  const g = state.groups.find(function (g) { return g.id === data.groupId; });
  if (data.self && state.currentGroup && state.currentGroup.id === data.groupId) {
    renderMessage({
      id: data.id, from: data.from,
      text: data.text, image: data.image, sticker: data.sticker,
      voice: data.voice, voiceDuration: data.voiceDuration,
      videoCircle: data.videoCircle, videoDuration: data.videoDuration,
      reactions: data.reactions || {}, time: data.time,
      self: true, senderName: 'Я', isGroup: true, replyData: data.replyData
    });
  } else if (!data.self) {
    if (state.currentGroup && state.currentGroup.id === data.groupId) {
      renderMessage({
        id: data.id, from: data.from,
        text: data.text, image: data.image, sticker: data.sticker,
        voice: data.voice, voiceDuration: data.voiceDuration,
        videoCircle: data.videoCircle, videoDuration: data.videoDuration,
        reactions: data.reactions || {}, time: data.time,
        self: false, senderName: displayNameForUser(data.from), isGroup: true, replyData: data.replyData
      });
      clearUnread('g:' + data.groupId);
      // 🔧 smooth scroll
      setTimeout(function () {
        const box = $('messages');
        if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
      }, 50);
    } else {
      if (!g || !g.muted) {
        if (state.settings.notif_groups != 0) { playPing(); vibrate(); }
      }
      state.unread['g:' + data.groupId] = (state.unread['g:' + data.groupId] || 0) + 1;
      saveUnread();
      renderChatList();
      updateTitle();
      let preview = data.text || '';
      if (data.sticker) preview = '🖼 Стикер';
      if (data.image) preview = '📷 Фото';
      if (data.voice) preview = '🎤 Голосовое';
      if (data.videoCircle) preview = '🎥 Кружок';
      showBrowserNotification((g && g.name || 'Группа') + ' — ' + displayNameForUser(data.from), preview);
    }
  }
});

socket.on('reaction updated', function (data) {
  const wrap = document.querySelector('.msg-wrap[data-id="' + data.messageId + '"]:not([data-group])');
  if (wrap) renderReactionsInto(wrap, data.reactions, false);
});

socket.on('group reaction updated', function (data) {
  if (!state.currentGroup || state.currentGroup.id !== data.groupId) return;
  const wrap = document.querySelector('.msg-wrap[data-id="' + data.messageId + '"][data-group="1"]');
  if (wrap) renderReactionsInto(wrap, data.reactions, true);
});

socket.on('typing', function (data) {
  if (data.isTyping) {
    state.typingUsers[data.from] = now();
    if (state.typingTimeouts[data.from]) clearTimeout(state.typingTimeouts[data.from]);
    state.typingTimeouts[data.from] = setTimeout(function () {
      delete state.typingUsers[data.from];
      delete state.typingTimeouts[data.from];
      renderChatList();
      updateTopStatusTyping();
    }, 4000);
  } else {
    delete state.typingUsers[data.from];
    if (state.typingTimeouts[data.from]) {
      clearTimeout(state.typingTimeouts[data.from]);
      delete state.typingTimeouts[data.from];
    }
  }
  renderChatList();
  updateTopStatusTyping();
});

socket.on('group typing', function (data) {
  if (!state.currentGroup || state.currentGroup.id !== data.groupId) return;
  const el = $('chat-top-status');
  if (data.isTyping) {
    el.textContent = displayNameForUser(data.from) + ' печатает…';
    el.classList.add('typing');
    clearTimeout(window._gtt);
    window._gtt = setTimeout(function () {
      const memberWord = state.currentGroup.memberCount === 1 ? '' : (state.currentGroup.memberCount < 5 ? 'а' : 'ов');
      el.textContent = state.currentGroup.memberCount + ' участник' + memberWord;
      el.classList.remove('typing');
    }, 3000);
  }
});

socket.on('group deleted', function (data) {
  if (state.currentGroup && state.currentGroup.id === data.groupId) {
    closeModal('group-info-modal');
    closeChat();
  }
  state.groups = state.groups.filter(function (g) { return g.id !== data.groupId; });
  delete state.unread['g:' + data.groupId];
  saveUnread();
  updateTitle();
  renderChatList();
});

socket.on('channel deleted', function (data) {
  if (state.currentChannel && state.currentChannel.id === data.channelId) closeChannelChat();
});

socket.on('channel post new', function (p) {
  if (state.currentChannel && state.currentChannel.id === p.channelId) {
    socket.emit('load channel posts', { channelId: state.currentChannel.id }, function (res) {
      if (!res || !res.ok) return;
      const box = $('channel-posts');
      box.innerHTML = '';
      res.posts.forEach(function (x) { renderChannelPost(x); });
    });
  }
});

socket.on('channel post deleted', function () {
  if (!state.currentChannel) return;
  socket.emit('load channel posts', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) return;
    const box = $('channel-posts');
    box.innerHTML = '';
    res.posts.forEach(function (p) { renderChannelPost(p); });
  });
});

socket.on('channel post reaction', function () {
  if (!state.currentChannel) return;
  socket.emit('load channel posts', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) return;
    const box = $('channel-posts');
    box.innerHTML = '';
    res.posts.forEach(function (p) { renderChannelPost(p); });
  });
});

socket.on('channel comment new', function (data) {
  if ($('channel-comments-modal').classList.contains('active') && state.currentChannelPostId === data.postId) {
    loadChannelComments(data.postId);
  }
});

socket.on('story new', function () { loadStories(); });

socket.on('story deleted', function (data) {
  state.storiesUsers.forEach(function (u) {
    u.stories = u.stories.filter(function (s) { return s.id !== data.storyId; });
  });
  state.storiesUsers = state.storiesUsers.filter(function (u) { return u.stories.length > 0; });
  renderStoriesBar();
  if ($('story-viewer').classList.contains('active')) {
    if (!state.storiesUsers[state.currentStoryUserIdx]) return closeStoryViewer();
    renderCurrentStory();
    startStoryTimer();
  }
});

socket.on('session terminated', function () {
  alert('Сеанс завершён');
  localStorage.removeItem(STORAGE.SESSION);
  location.reload();
});

socket.on('account deleted', function () {
  localStorage.clear();
  location.reload();
});

// 🔧 NEW: обновление значка друга в реальном времени
socket.on('friend updated', function (data) {
  if (!data || !data.username) return;
  const c = state.contacts.find(function (x) { return x.name === data.username; });
  if (c) {
    if (data.verified !== undefined) c.verified = !!data.verified;
    if (data.hammer !== undefined) c.hammer = !!data.hammer;
    if (data.scam !== undefined) c.scam = !!data.scam;
    if (data.avatar !== undefined) c.avatar = data.avatar;
    saveJson(STORAGE.CONTACTS_CACHE, state.contacts);
    renderChatList();
    if (state.activeTab === 'contacts') renderContactsTab();
    if (state.currentChat === data.username) {
      // обновляем шапку чата
      const badges = renderBadgesBig(c);
      const displayName = c.displayName || c.name;
      const nameEl = $('chat-top-name');
      if (nameEl) nameEl.innerHTML = escapeHtml(displayName) + ' ' + badges;
    }
  }
});

// ─── ИНИЦИАЛИЗАЦИЯ ───
window.addEventListener('load', function () {
  loadUnread();
  initNotifications();
  const cc = loadJson(STORAGE.CONTACTS_CACHE);
  if (cc) state.contacts = cc;
  const gc = loadJson(STORAGE.GROUPS_CACHE);
  if (gc) state.groups = gc;
  const sc = loadJson(STORAGE.SETTINGS);
  if (sc) {
    state.settings = sc;
    applyLocalSettings();
  }
  state.stickerRecent = loadJson(STORAGE.RECENT_STICKERS, []) || [];
  state.chatWallpapers = loadJson(STORAGE.WALLPAPERS, {}) || {};

  const params = new URLSearchParams(window.location.search);
  const addUser = params.get('add');
  if (addUser) {
    setTimeout(function () {
      if (confirm('Добавить @' + addUser + ' в контакты?')) {
        socket.emit('add contact', { username: addUser.toLowerCase(), displayName: addUser }, function (res) {
          if (res && res.ok) showToast('✓ Контакт добавлен');
          else alert((res && res.error) || 'Ошибка');
        });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }, 1500);
  }

  startBootTimeout();
  const creds = loadJson(STORAGE.SESSION);
  if (!creds || !creds.sessionId) {
    hideSplash();
    $('auth').classList.add('active');
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(function (m) { m.classList.remove('active'); });
    hideReactionMenu();
    hideActionMenu();
  }
});

console.log('✅ Aurora v10.2 — значки ✓ 🔨 💀 — загружена');

// ═══════════════════════════════════════════════════════════
// 🎬 TELEGRAM-STYLE ANIMATIONS
// ═══════════════════════════════════════════════════════════

// ─── ДВОЙНОЙ ТАП = БЫСТРАЯ РЕАКЦИЯ ❤️ ───
(function initDoubleTap() {
  let lastTap = 0;
  let lastMsgId = null;

  document.addEventListener('click', function (e) {
    const msgEl = e.target.closest('.msg');
    if (!msgEl) return;
    const wrap = msgEl.closest('.msg-wrap');
    if (!wrap) return;
    const msgId = parseInt(wrap.dataset.id, 10);
    const isGroup = wrap.dataset.group === '1';

    const t = Date.now();
    if (lastMsgId === msgId && (t - lastTap) < 300) {
      if (isGroup && state.currentGroup) {
        socket.emit('group react', { groupId: state.currentGroup.id, messageId: msgId, emoji: '❤️' });
      } else {
        socket.emit('react', { messageId: msgId, emoji: '❤️' });
      }
      const heart = document.createElement('div');
      heart.className = 'quick-react-heart';
      heart.textContent = '❤️';
      wrap.style.position = 'relative';
      wrap.appendChild(heart);
      setTimeout(function () { if (heart.parentNode) heart.remove(); }, 1000);

      vibrate([30, 20, 30]);
      lastMsgId = null;
      lastTap = 0;
      e.stopPropagation();
      return;
    }
    lastMsgId = msgId;
    lastTap = t;
  });
})();

// ─── АНИМАЦИЯ ОТПРАВКИ СООБЩЕНИЯ ───
var _origRenderMessage = renderMessage;
renderMessage = function (msg) {
  _origRenderMessage(msg);
  if (msg.self) {
    const box = document.getElementById('messages');
    const last = box.lastElementChild;
    if (last && last.dataset.id == msg.id) {
      last.classList.add('just-sent');
      setTimeout(function () { last.classList.remove('just-sent'); }, 600);
    }
  }
};

// ─── ПРЕВЬЮ СТИКЕРА (долгий тап) ───
(function initStickerPreview() {
  let pressTimer = null;
  let previewEl = null;

  function showPreview(img) {
    if (previewEl) previewEl.remove();
    previewEl = document.createElement('div');
    previewEl.className = 'sticker-preview';

    let clone;
    if (img.tagName === 'VIDEO') {
      clone = document.createElement('video');
      clone.src = img.src;
      clone.autoplay = true;
      clone.loop = true;
      clone.muted = true;
      clone.playsInline = true;
    } else {
      clone = document.createElement('img');
      clone.src = img.src;
    }
    previewEl.appendChild(clone);
    document.body.appendChild(previewEl);

    requestAnimationFrame(function () { previewEl.classList.add('active'); });
    vibrate(20);
  }

  function hidePreview() {
    if (previewEl) {
      previewEl.classList.remove('active');
      const el = previewEl;
      previewEl = null;
      setTimeout(function () {
        if (el && el.parentNode) el.remove();
      }, 300);
    }
  }

  document.addEventListener('touchstart', function (e) {
    const stickerItem = e.target.closest('.sticker-item');
    if (!stickerItem) return;
    const img = stickerItem.querySelector('img, video');
    if (!img) return;
    pressTimer = setTimeout(function () { showPreview(img); }, 400);
  }, { passive: true });

  document.addEventListener('touchend', function () {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    hidePreview();
  });

  document.addEventListener('touchmove', function () {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    hidePreview();
  });

  document.addEventListener('mousedown', function (e) {
    const stickerItem = e.target.closest('.sticker-item');
    if (!stickerItem) return;
    const img = stickerItem.querySelector('img, video');
    if (!img) return;
    pressTimer = setTimeout(function () { showPreview(img); }, 400);
  });

  document.addEventListener('mouseup', function () {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    hidePreview();
  });
})();

// ─── ПЛАВНАЯ ОТПРАВКА СТИКЕРА ───
var _origSendSticker = sendSticker;
sendSticker = function (url, type) {
  if (!url) return;
  const panel = document.getElementById('stickers-panel');
  if (panel) {
    panel.style.transform = 'translateY(20px)';
    panel.style.opacity = '0.8';
    setTimeout(function () {
      panel.style.transform = '';
      panel.style.opacity = '';
    }, 200);
  }
  _origSendSticker(url, type);
};

// ─── BADGE PULSE ───
function updateBadgePulse() {
  document.querySelectorAll('.chat-badge').forEach(function (badge) {
    if (!badge.classList.contains('pulse')) {
      badge.classList.add('pulse');
    }
  });
}

const badgeObserver = new MutationObserver(function () {
  updateBadgePulse();
});
badgeObserver.observe(document.body, { childList: true, subtree: true });

// ─── ПЛАВНОЕ ПОЯВЛЕНИЕ ПАНЕЛИ СТИКЕРОВ ───
var _origOpenStickers = openStickersPanel;
openStickersPanel = function () {
  _origOpenStickers();
  const panel = document.getElementById('stickers-panel');
  if (panel) {
    panel.style.transform = 'translateY(100%)';
    requestAnimationFrame(function () {
      panel.style.transition = 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)';
      panel.style.transform = 'translateY(0)';
    });
  }
};

// ─── ВИБРАЦИЯ ПРИ ОТПРАВКЕ ───
var _origSendMsg = sendMsg;
sendMsg = function () {
  const input = document.getElementById('msgInput');
  const wasEmpty = !input.value.trim();
  _origSendMsg();
  if (!wasEmpty) vibrate(15);
};

console.log('🎬 Telegram-style animations loaded');
console.log('✓ Aurora v10.2 — ГОТОВО. Значки: ✓ 🔨 💀 (только moroz)');
