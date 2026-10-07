'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v13.6 — Client
   ✓ ⭐ Premium + бейджи + баннеры
   ✓ 🎨 ТГ-стиль настроек
   ✓ 🤖 Боты, достижения, подарки
   ✓ 📍 Геолокация
   ✓ 🚨 Жалобы
   ✓ 🛡️ Модерация: панель, баны, муты, логи
   ═══════════════════════════════════════════════════════════ */

var contactProfileCurrent = null;
var currentBadgeType = 'verified';
var isLoggedInOnServer = false;

const state = {
  me: {
    username: null, avatar: null, banner: null,
    premium: false, verified: false, bio: '',
    firstName: '', lastName: '', birthday: '', emoji: '',
    stars: 0, sessionId: null, hammer: false, scam: false,
    isModerator: false, mute: null
  },
  contacts: [], groups: [], channels: [],
  unread: {}, typingUsers: {}, blockedList: [], giftsCatalog: {},
  currentChat: null, currentGroup: null, currentChannel: null,
  isSavedChat: false, isBotChat: false, currentBot: null,
  activeTab: 'chats', showArchived: false, settings: {},
  authMode: 'login', regStep: 1,
  regUsernameAvailable: false, regUsernameCheckTimer: null,
  replyToMessage: null, editingMessageId: null, pinnedMessageId: null,
  activeReactionMsgId: null, activeReactionGroupId: null, activeMessage: null,
  qrFoundUser: null, currentGiftTarget: null, currentGiftKey: null,
  currentChannelPostId: null, currentInviteCode: null,
  stickersData: [], stickerRecent: [], stickerCurrentTab: 'recent', stickerSearchQuery: '',
  storiesUsers: [], currentStoryUserIdx: 0, currentStoryIdx: 0,
  storyTimer: null, storyTimerStart: 0,
  peerConnection: null, localStream: null, callActive: false,
  micOn: true, camOn: true,
  pendingOffer: null, incomingFrom: null, incomingVideo: false,
  callTimerInterval: null, callStartTime: 0,
  screenStream: null, screenTrack: null, isScreenSharing: false,
  mediaRecorder: null, audioChunks: [], isRecording: false,
  cancelledRecording: false, recordingStartTime: 0, recordingTimer: null,
  currentAudioMime: '',
  circleStream: null, circleRecorder: null, circleChunks: [],
  circleTimer: null, circleStartTime: 0, circleMime: '',
  lastDateShown: '', canCreateGroup: true, canCreateChannel: true,
  galleryWaiting: false, notificationsAllowed: false, reconnectAttempts: 0,
  titleFlashInterval: null, myTypingTimeout: null, typingTimeouts: {},
  createSelected: new Set(), addMembersSelected: new Set(),
  currentColorTarget: null, toastTimeout: null, isLoggedIn: false,
  chatWallpapers: {}, contactProfileCurrent: null,
  myBots: [], editingBotUsername: null, tempBotAvatar: null,
  tempBanner: null,
  modPanelOpen: false,
  modTab: 'reports',
  modReportsFilter: 'new',
  modReports: [],
  modPunishments: [],
  modLogs: [],
  modStats: {},
  reportTarget: null,
  reportTargetMessageId: null,
  reportIsGroup: false,
  geoVisibility: 'contacts',
};

const STORAGE = {
  SESSION: 'aurora-session',
  UNREAD: 'aurora-unread',
  CONTACTS_CACHE: 'aurora-contacts-cache',
  GROUPS_CACHE: 'aurora-groups-cache',
  RECENT_STICKERS: 'aurora-recent-stickers',
  SETTINGS: 'aurora-settings-cache',
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

const REPORT_REASONS = {
  spam:   '🚫 Спам',
  abuse:  '🤬 Оскорбления',
  nsfw:   '🔞 18+',
  scam:   '💀 Мошенничество',
  ads:    '📢 Реклама',
  other:  '❓ Другое',
};

const PUNISH_LABELS = {
  ban: '🚫 Бан',
  mute: '🔇 Мут',
  warn: '⚠️ Предупреждение',
};

/* ─── УТИЛИТЫ ─── */
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

function formatDuration(expiresAt) {
  if (!expiresAt) return 'навсегда';
  const ms = expiresAt - now();
  if (ms <= 0) return 'истёк';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return d + ' д ' + (h % 24) + ' ч';
  if (h > 0) return h + ' ч ' + (m % 60) + ' мин';
  return m + ' мин';
}

function displayNameForUser(username) {
  if (username === state.me.username) return 'Я';
  const c = state.contacts.find(function (c) { return c.name === username; });
  return c && c.displayName ? c.displayName : username;
}

/* ─── БЕЙДЖИ ─── */
function renderBadges(user) {
  if (!user) return '';
  let html = '';
  if (user.premium) html += '<span class="premium-badge" title="Azerta Premium">⭐</span>';
  if (user.verified) html += '<span class="verified-badge" title="Верифицирован">✓</span>';
  if (user.hammer) html += '<span class="hammer-badge" title="Модератор">🔨</span>';
  if (user.scam) html += '<span class="scam-badge" title="Мошенник">SCAM</span>';
  return html;
}

function renderBadgesBig(user) {
  if (!user) return '';
  let html = '';
  if (user.premium) html += '<span class="premium-badge big" title="Azerta Premium">⭐</span>';
  if (user.verified) html += '<span class="verified-badge big" title="Верифицирован">✓</span>';
  if (user.hammer) html += '<span class="hammer-badge big" title="Модератор">🔨</span>';
  if (user.scam) html += '<span class="scam-badge big" title="Мошенник">SCAM</span>';
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

/* ─── RIPPLE ─── */
function attachRipple(el) {
  if (!el || el.dataset.rippleBound) return;
  el.dataset.rippleBound = '1';
  el.classList.add('ripple-container');
  el.addEventListener('pointerdown', function (e) {
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    el.appendChild(ripple);
    setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 700);
  });
}

function bindRipples(root) {
  const sel = '.auth-btn-primary, .modal-primary, .modal-secondary, .modal-danger, .create-menu-btn, .nav-btn, .settings-item, .settings-tg-row, .chat-item, .back-btn, .icon-btn, #burger, #send-btn, .attach, .mic, .camera, .reaction-chip, .action-item, .my-bot-card, .bch-chip, .mod-tab, .report-reason-btn, .punish-duration-btn';
  (root || document).querySelectorAll(sel).forEach(attachRipple);
}

/* ─── SKELETON ─── */
function showChatListSkeleton() {
  const box = $('chat-list');
  if (!box) return;
  box.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('div');
    d.className = 'skeleton-chat-item';
    d.innerHTML = '<div class="skeleton sk-avatar"></div>' +
      '<div class="sk-info"><div class="skeleton sk-line long"></div><div class="skeleton sk-line short"></div></div>';
    box.appendChild(d);
  }
}

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

function showErrorScreen(text) {
  console.error('❌ Azerta error:', text);
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

const socket = io({
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
});

function openModal(id) { const m = $(id); if (m) m.classList.add('active'); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove('active'); }

document.querySelectorAll('.modal').forEach(function (m) {
  m.addEventListener('click', function (e) {
    if (e.target === m) {
      m.classList.remove('active');
    }
  });
});

function closeContactProfile() {
  closeModal('contact-profile-modal');
  contactProfileCurrent = null;
  state.contactProfileCurrent = null;
}

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

function playLoginTransition(username, firstName, isAutoLogin) {
  state.isLoggedIn = true;
  isLoggedInOnServer = true;
  const authEl = $('auth');
  const appEl = $('app');
  const flashEl = $('welcome-flash');
  const toastEl = $('welcome-toast');
  hideSplash();
  const passEl = $('passcode-screen'); if (passEl) passEl.classList.remove('active');

  if (authEl && authEl.classList.contains('active')) {
    authEl.classList.add('auth-exit');
    setTimeout(function () {
      authEl.classList.remove('active');
      authEl.classList.remove('auth-exit');
    }, 450);
  } else if (authEl) authEl.classList.remove('active');

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
    if (subEl) subEl.textContent = 'С возвращением в Azerta';
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
    bindRipples();
    applyMuteLock();
  }, 200);
}

function forceShowAuth(message) {
  console.warn('🔒 Принудительный выход:', message || '');
  isLoggedInOnServer = false;
  state.isLoggedIn = false;
  state.me.username = null;
  state.me.sessionId = null;
  const appEl = $('app'); if (appEl) appEl.classList.remove('active');
  const chatEl = $('chat-screen'); if (chatEl) chatEl.classList.remove('active');
  const authEl = $('auth'); if (authEl) {
    authEl.classList.remove('auth-exit');
    authEl.classList.add('active');
  }
  const passEl = $('passcode-screen'); if (passEl) passEl.classList.remove('active');
  hideSplash();
  showToast('⚠️ ' + (message || 'Войди заново'));
}

/* ─── АВТОРИЗАЦИЯ ─── */
function switchAuthScreen(screen) {
  document.querySelectorAll('.auth-screen').forEach(function (s) { s.classList.remove('active'); });
  if (screen === 'login') {
    const el = $('auth-login-screen');
    if (el) el.classList.add('active');
    state.authMode = 'login';
    state.regStep = 1;
  } else {
    const el = $('auth-register-screen');
    if (el) el.classList.add('active');
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
    if (s === step) el.classList.add('active');
    else el.classList.remove('active');
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
    const dnEl = $('reg-displayname');
    const dn = dnEl ? dnEl.value.trim() : '';
    if (!dn) { const e = $('reg-error-2'); if (e) e.textContent = 'Введи имя'; return; }
    const e = $('reg-error-2'); if (e) e.textContent = '';
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
  if (!input || !wrap || !status || !hint || !nextBtn) return;
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
  const pEl = $('reg-password');
  if (!pEl) return;
  const p = pEl.value;
  const bar = $('reg-strength-bar');
  const label = $('reg-strength-label');
  if (!bar || !label) return;
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
  if (p.length < 8) { bar.classList.add('weak'); label.textContent = 'Слишком короткий (мин. 8)'; label.style.color = '#f87171'; }
  else if (score <= 2) { bar.classList.add('weak'); label.textContent = 'Слабый — добавь цифры или заглавные'; label.style.color = '#f87171'; }
  else if (score === 3) { bar.classList.add('medium'); label.textContent = 'Средний'; label.style.color = '#fbbf24'; }
  else { bar.classList.add('strong'); label.textContent = 'Сильный 💪'; label.style.color = '#4ade80'; }
  onRegPassword2Input();
}

function onRegPassword2Input() {
  const pEl = $('reg-password');
  const p2El = $('reg-password2');
  const hint = $('reg-password2-hint');
  if (!pEl || !p2El || !hint) return;
  const p = pEl.value;
  const p2 = p2El.value;
  if (!p2) { hint.textContent = ''; hint.classList.remove('success', 'error'); }
  else if (p === p2) { hint.textContent = '✓ Совпадают'; hint.classList.add('success'); hint.classList.remove('error'); }
  else { hint.textContent = 'Пароли не совпадают'; hint.classList.add('error'); hint.classList.remove('success'); }
  updateRegSubmit();
}

function updateRegSubmit() {
  const btn = $('reg-submit');
  if (!btn) return;
  const pEl = $('reg-password');
  const p2El = $('reg-password2');
  const dnEl = $('reg-displayname');
  if (!pEl || !p2El || !dnEl) return;
  const p = pEl.value;
  const p2 = p2El.value;
  const dn = dnEl.value.trim();
  const valid = p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p) && p === p2 && dn && state.regUsernameAvailable;
  btn.disabled = !valid;
}

function doRegister() {
  const username = ($('reg-username') || {}).value || '';
  const displayName = ($('reg-displayname') || {}).value || '';
  const password = ($('reg-password') || {}).value || '';
  const errEl = $('reg-error-3');
  if (errEl) errEl.textContent = '';
  showBtnSpinner('reg-submit', 'Создаю…');
  socket.emit('register', { username: username.trim().toLowerCase(), password: password, displayName: displayName.trim() }, function (res) {
    hideBtnSpinner('reg-submit', 'Создать аккаунт');
    if (!res || !res.ok) {
      if (errEl) errEl.textContent = res && res.error ? res.error : 'Ошибка регистрации';
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
  const username = ($('login-username') || {}).value || '';
  const password = ($('login-password') || {}).value || '';
  const errEl = $('login-error');
  if (errEl) errEl.textContent = '';
  if (!username || !password) {
    if (errEl) errEl.textContent = 'Заполни все поля';
    vibrate([30, 20, 30]);
    return;
  }
  showBtnSpinner('login-btn', 'Вхожу…');
  const existing = loadJson(STORAGE.SESSION);
  socket.emit('login', {
    username: username.trim().toLowerCase(),
    password: password,
    device: (navigator.userAgent || '').slice(0, 40),
    sessionId: existing ? existing.sessionId : null
  }, function (res) {
    hideBtnSpinner('login-btn', 'Войти');
    if (!res || !res.ok) {
      if (res && res.banned) {
        showBanScreen(res.ban);
        return;
      }
      if (errEl) errEl.textContent = res && res.error ? res.error : 'Ошибка входа';
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
  state.me.banner = res.banner || null;
  state.me.premium = !!res.premium;
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
  state.me.isModerator = !!res.is_moderator;
  state.me.mute = res.mute || null;
  state.chatWallpapers = loadJson(STORAGE.WALLPAPERS, {}) || {};
  playLoginTransition(res.username, res.firstName, !!isAutoLogin);
  setTimeout(function () {
    socket.emit('get gifts catalog', function (r) {
      if (r && r.ok) state.giftsCatalog = r.catalog || {};
    });
  }, 200);
}

function showBanScreen(ban) {
  hideSplash();
  const app = $('app'); if (app) app.classList.remove('active');
  const auth = $('auth'); if (auth) auth.classList.remove('active');
  let screen = $('ban-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'ban-screen';
    document.body.appendChild(screen);
  }
  const until = ban.expires_at
    ? new Date(ban.expires_at).toLocaleString('ru-RU')
    : 'никогда (навсегда)';
  screen.innerHTML =
    '<div class="ban-screen-inner">' +
      '<div class="ban-emoji">🚫</div>' +
      '<h2>Ты забанен</h2>' +
      '<div class="ban-reason">' +
        '<div class="ban-label">Причина:</div>' +
        '<div class="ban-value">' + escapeHtml(ban.reason || 'Не указана') + '</div>' +
      '</div>' +
      '<div class="ban-until">' +
        '<div class="ban-label">До:</div>' +
        '<div class="ban-value">' + escapeHtml(until) + '</div>' +
        '<div class="ban-sub">(' + escapeHtml(ban.duration_text || 'навсегда') + ')</div>' +
      '</div>' +
      '<button class="modal-secondary" onclick="location.reload()">🔄 Проверить снова</button>' +
    '</div>';
  screen.classList.add('active');
}

function applyMuteLock() {
  const mute = state.me.mute;
  const input = $('msgInput');
  const sendBtn = $('send-btn');
  const mic = $('micBtnInput');
  const circle = $('circleBtn');
  const attach = document.querySelector('#input-area .attach');
  const cam = document.querySelector('#input-area .camera');
  if (!mute) {
    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (mic) mic.disabled = false;
    if (circle) circle.disabled = false;
    if (attach) attach.disabled = false;
    if (cam) cam.disabled = false;
    const existing = $('mute-banner');
    if (existing) existing.remove();
    return;
  }
  const until = mute.expires_at
    ? new Date(mute.expires_at).toLocaleString('ru-RU')
    : '';
  if (input) { input.disabled = true; input.placeholder = '🔇 Ты в муте'; }
  if (sendBtn) sendBtn.disabled = true;
  if (mic) mic.disabled = true;
  if (circle) circle.disabled = true;
  if (attach) attach.disabled = true;
  if (cam) cam.disabled = true;
  let banner = $('mute-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mute-banner';
    const inputArea = $('input-area');
    if (inputArea && inputArea.parentNode) {
      inputArea.parentNode.insertBefore(banner, inputArea);
    }
  }
  banner.innerHTML =
    '🔇 Ты в муте' +
    (mute.reason ? ' · ' + escapeHtml(mute.reason) : '') +
    (until ? ' · до ' + escapeHtml(until) : '');
}

function tryPasscode() {
  const passcodeEl = $('passcode-input');
  const errEl = $('passcode-error');
  if (!passcodeEl) return;
  const passcode = passcodeEl.value;
  if (errEl) errEl.textContent = '';
  socket.emit('check passcode', { passcode: passcode }, function (res) {
    if (!res || !res.ok) {
      if (errEl) errEl.textContent = 'Неверный код';
      vibrate([30, 20, 30]);
      return;
    }
    const p = $('passcode-screen'); if (p) p.classList.remove('active');
    playLoginTransition(state.me.username, state.me.firstName, true);
  });
}
document.addEventListener('keydown', function (e) {
  const p = $('passcode-input');
  if (e.key === 'Enter' && p && document.activeElement === p) tryPasscode();
});

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
    }, 8000);
    socket.emit('login with session', { sessionId: creds.sessionId }, function (res) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (!res || !res.ok) {
        if (res && res.banned) {
          showBanScreen(res.ban);
          resolve(true);
          return;
        }
        localStorage.removeItem(STORAGE.SESSION);
        forceShowAuth('Сессия истекла — войди заново');
        resolve(false);
        return;
      }
      saveJson(STORAGE.SESSION, { username: res.username, sessionId: res.sessionId });
      state.me.username = res.username;
      state.me.avatar = res.avatar || null;
      state.me.banner = res.banner || null;
      state.me.premium = !!res.premium;
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
      state.me.isModerator = !!res.is_moderator;
      state.me.mute = res.mute || null;
      state.chatWallpapers = loadJson(STORAGE.WALLPAPERS, {}) || {};
      socket.emit('get gifts catalog', function (r) {
        if (r && r.ok) state.giftsCatalog = r.catalog || {};
      });
      socket.emit('has passcode', function (has) {
        if (has) {
          const el = $('passcode-screen'); if (el) el.classList.add('active');
        } else {
          playLoginTransition(res.username, res.firstName, true);
        }
      });
      resolve(true);
    });
  });
}

socket.on('connect', async function () {
  setConnStatus('reconnecting', 'Azerta: проверяю связь…');
  setTimeout(hideConnStatus, 2000);
  state.reconnectAttempts = 0;
  if (autoLoginDone) return;
  const ok = await tryAutoLogin();
  if (!ok) {
    const app = $('app'); if (app) app.classList.remove('active');
    const auth = $('auth'); if (auth) auth.classList.add('active');
    state.isLoggedIn = false;
    isLoggedInOnServer = false;
  }
  autoLoginDone = true;
});

socket.on('disconnect', function () {
  setConnStatus('offline', 'Azerta: связь потеряна 😴');
});

socket.on('connect_error', function () {
  state.reconnectAttempts++;
  const msgs = [
    'Azerta: пробую ещё раз… 🔄',
    'Azerta: интернет уснул 💤',
    'Azerta: слабый интернет 😔',
    'Azerta: сервер далеко 🌍',
    'Azerta: ещё чуть-чуть… 🐢'
  ];
  setConnStatus('reconnecting', msgs[Math.min(state.reconnectAttempts - 1, msgs.length - 1)]);
});

socket.io.on('reconnect', function () {
  setConnStatus('connected', 'Azerta: снова с тобой ✨');
  state.reconnectAttempts = 0;
  setTimeout(hideConnStatus, 2500);
  if (state.isLoggedIn) loadStories();
});

socket.on('server toast', function (data) {
  if (data && data.text) showToast(data.text);
});

socket.on('punishment issued', function (data) {
  const title = data.title || (data.type === 'ban' ? 'Ты забанен' : (data.type === 'mute' ? 'Ты в муте' : 'Предупреждение'));
  const emoji = data.emoji || '⚠️';
  const until = data.expires_at
    ? new Date(data.expires_at).toLocaleString('ru-RU')
    : 'навсегда';
  let modal = $('punishment-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'punishment-modal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-box punishment-box"></div>';
    document.body.appendChild(modal);
  }
  const box = modal.querySelector('.punishment-box');
  box.innerHTML =
    '<div class="punishment-emoji">' + emoji + '</div>' +
    '<h3>' + escapeHtml(title) + '</h3>' +
    (data.reason ? '<div class="modal-desc">Причина: ' + escapeHtml(data.reason) + '</div>' : '') +
    '<div class="modal-desc">До: ' + escapeHtml(until) + (data.duration_text ? ' (' + escapeHtml(data.duration_text) + ')' : '') + '</div>' +
    (data.type === 'ban'
      ? '<button class="modal-danger" onclick="location.reload()">Понятно</button>'
      : '<button class="modal-primary" onclick="closeModal(\'punishment-modal\')">Понятно</button>');
  modal.classList.add('active');

  if (data.type === 'mute') {
    state.me.mute = {
      reason: data.reason,
      expires_at: data.expires_at,
      duration_text: data.duration_text
    };
    applyMuteLock();
  }
  if (data.type === 'ban') {
    setTimeout(function () {
      state.me.username = null;
      state.me.sessionId = null;
      isLoggedInOnServer = false;
      location.reload();
    }, 4000);
  }
});

socket.on('punishment lifted', function (data) {
  if (data.type === 'mute') {
    state.me.mute = null;
    applyMuteLock();
  }
  showToast('✅ Наказание снято: ' + (data.type || ''));
});

socket.on('new report', function (data) {
  if (!state.me.isModerator) return;
  if (state.modPanelOpen) {
    if (state.modTab === 'reports') loadModReports();
  }
  playPing();
  vibrate([30, 20, 30]);
});

/* ─── УВЕДОМЛЕНИЯ ─── */
function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') state.notificationsAllowed = true;
  else if (Notification.permission === 'default') {
    const b = $('notif-banner');
    if (b) setTimeout(function () { b.classList.add('active'); }, 1500);
  }
}

async function enableNotifications() {
  const b = $('notif-banner');
  if (b) b.classList.remove('active');
  if (!('Notification' in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      state.notificationsAllowed = true;
      new Notification('Azerta', { body: 'Уведомления включены! 🎉' });
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

function updateTitle() {
  const total = Object.values(state.unread).reduce(function (a, b) { return a + b; }, 0);
  if (total > 0) {
    if (!state.titleFlashInterval) {
      let on = true;
      state.titleFlashInterval = setInterval(function () {
        document.title = on ? '(' + total + ') Azerta' : 'Azerta';
        on = !on;
      }, 1000);
    }
  } else {
    if (state.titleFlashInterval) {
      clearInterval(state.titleFlashInterval);
      state.titleFlashInterval = null;
    }
    document.title = 'Azerta';
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

function applyLocalSettings() {
  const s = state.settings;
  if (s.theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  if (s.animations === 0 || s.animations === '0') document.body.classList.add('no-anim');
  else document.body.classList.remove('no-anim');
  const sizes = { small: '13px', medium: '15px', large: '17px' };
  document.documentElement.style.setProperty('--font-size', sizes[s.font_size] || '15px');
  if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);
}

/* ─── ВКЛАДКИ ─── */
const TAB_TITLES = { chats: 'Azerta', calls: 'Звонки', contacts: 'Контакты', settings: 'Настройки' };

function switchTab(tab) {
  state.activeTab = tab;
  const app = $('app');
  if (!app) return;
  app.dataset.tab = tab;
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const h2 = document.querySelector('#main-header h2');
  if (h2) h2.textContent = TAB_TITLES[tab] || 'Azerta';
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

/* ─── НАСТРОЙКИ ─── */
function openSettings() {
  const el = $('settings-screen');
  if (el) el.classList.add('active');
  renderSettings();
  bindRipples($('settings-screen'));
}

function closeSettings() {
  const el = $('settings-screen');
  if (el) el.classList.remove('active');
  renderChatList();
}

function renderSettingsTab() {
  const box = $('tab-settings-content');
  if (!box) return;
  const orig = $('settings-content');
  if (orig) {
    renderSettings();
    box.innerHTML = orig.innerHTML;
    bindRipples(box);
  }
}

function renderTgRow(opts) {
  const type = opts.type || 'arrow';
  const danger = opts.type === 'danger' ? ' danger' : '';
  const disabled = opts.type === 'disabled' ? ' disabled' : '';
  const onClick = opts.onClick ? ' onclick="' + opts.onClick + '"' : '';

  let rightHtml = '';
  if (type === 'switch') {
    rightHtml = '<label class="tg-row-switch" onclick="event.stopPropagation()">' +
      '<input type="checkbox" ' + (opts.checked ? 'checked' : '') +
      ' onchange="' + (opts.onToggle || '') + '" />' +
      '<span class="slider"></span></label>';
  } else if (type === 'color') {
    rightHtml = '<span class="tg-row-color-dot" style="background:' + (opts.color || '#8b7fff') + ';"></span>' +
      '<span class="tg-row-arrow">›</span>';
  } else if (type === 'arrow') {
    if (opts.value !== undefined && opts.value !== null && opts.value !== '') {
      rightHtml += '<span class="tg-row-value">' + escapeHtml(String(opts.value)) + '</span>';
    }
    rightHtml += '<span class="tg-row-arrow">›</span>';
  } else if (type === 'value') {
    rightHtml = '<span class="tg-row-value">' + escapeHtml(String(opts.value || '')) + '</span>';
  }

  return '<div class="settings-tg-row' + danger + disabled + '"' + onClick + '>' +
    '<span class="tg-row-icon">' + (opts.icon || '') + '</span>' +
    '<span class="tg-row-text">' + escapeHtml(opts.text || '') + '</span>' +
    rightHtml +
    '</div>';
}

function renderSettings() {
  const box = $('settings-content');
  if (!box) return;
  const me = state.me;
  const s = state.settings;
  const isAdmin = me.username === 'moroz';
  const isPremium = !!me.premium;

  const displayName = (me.firstName || me.lastName)
    ? (me.firstName + ' ' + (me.lastName || '')).trim()
    : '@' + me.username;
  const emojiStr = me.emoji ? ' ' + me.emoji : '';
  const tick = renderBadges(me);
  const hasBanner = !!me.banner;
  const bannerStyle = hasBanner ? 'background-image:url(' + me.banner + ')' : '';
  const avatarStyle = me.avatar ? 'background-image:url(' + me.avatar + ')' : '';
  const avatarContent = me.avatar ? '' : initials(me.username);

  const profileCardHtml =
    '<div class="settings-profile-card-tg' + (hasBanner ? '' : ' no-banner') + (isPremium ? ' premium' : '') + '" onclick="openProfile()">' +
      '<div class="tg-banner" style="' + bannerStyle + '"></div>' +
      '<div class="tg-banner-overlay"></div>' +
      (hasBanner ? '' : '<span class="tg-no-banner-hint">+ Сменить баннер</span>') +
      '<div class="tg-profile-row">' +
        '<div class="tg-profile-avatar" style="' + avatarStyle + '">' + avatarContent + '</div>' +
        '<div class="tg-profile-info">' +
          '<div class="tg-profile-name' + (isPremium ? ' premium' : '') + '">' + escapeHtml(displayName) + emojiStr + ' ' + tick + '</div>' +
          '<div class="tg-profile-username">@' + escapeHtml(me.username) + '</div>' +
          '<div class="tg-profile-status"><span class="dot"></span>' + (isPremium ? 'Premium активен' : 'в сети') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  const starsHtml =
    '<div class="settings-stars-row" onclick="openStarsHistory()">' +
      '<span class="stars-icon">⭐</span>' +
      '<div class="stars-info">' +
        '<div class="stars-count">' + me.stars + (isAdmin ? '∞' : '') + '</div>' +
        '<div class="stars-label">звёзды · нажми для истории</div>' +
      '</div>' +
      '<span class="stars-arrow">›</span>' +
    '</div>';

  let modSection = '';
  if (me.isModerator) {
    const pending = state.modStats.new_reports || 0;
    modSection =
      '<div class="settings-tg-section">' +
        '<div class="settings-tg-section-title">🛡️ Модерация</div>' +
        '<div class="settings-tg-group">' +
          renderTgRow({
            icon: '🚨', text: 'Панель модератора',
            value: pending > 0 ? pending + ' новых' : '',
            onClick: 'openModPanel()'
          }) +
        '</div>' +
      '</div>';
  }

  const botsSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">🤖 Боты</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🤖', text: 'Мои боты', value: state.myBots.length + '/3', onClick: 'openMyBots()' }) +
        renderTgRow({ icon: '➕', text: 'Создать бота', onClick: 'openCreateBotModal()' }) +
        renderTgRow({ icon: '🔍', text: 'Найти бота', onClick: 'openFindBotModal()' }) +
      '</div>' +
    '</div>';

  const progressSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">📈 Прогресс</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🏆', text: 'Достижения', onClick: 'openAchievements()' }) +
        renderTgRow({ icon: '📊', text: 'Статистика', onClick: 'openStats()' }) +
      '</div>' +
    '</div>';

  let giftsGroup = '';
  giftsGroup += renderTgRow({ icon: '🎁', text: 'Мои подарки', onClick: 'openMyGifts()' });
  giftsGroup += renderTgRow({ icon: '💳', text: 'Активировать премиум по коду', onClick: 'openGiftModal()' });
  if (isAdmin) {
    giftsGroup += renderTgRow({ icon: '🔑', text: 'Управление кодами', onClick: 'openGiftAdminModal()' });
  }
  const giftsSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">🎁 Подарки</div>' +
      '<div class="settings-tg-group">' + giftsGroup + '</div>' +
    '</div>';

  const notifSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">🔔 Уведомления и звуки</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🔔', text: 'Звук', type: 'switch', checked: s.sound == 1, onToggle: 'toggleSetting(\'sound\')', onClick: 'toggleSetting(\'sound\')' }) +
        renderTgRow({ icon: '📳', text: 'Вибрация', type: 'switch', checked: s.vibration == 1, onToggle: 'toggleSetting(\'vibration\')', onClick: 'toggleSetting(\'vibration\')' }) +
        renderTgRow({ icon: '💬', text: 'Личные чаты', type: 'switch', checked: s.notif_private == 1, onToggle: 'toggleSetting(\'notif_private\')', onClick: 'toggleSetting(\'notif_private\')' }) +
        renderTgRow({ icon: '👥', text: 'Группы', type: 'switch', checked: s.notif_groups == 1, onToggle: 'toggleSetting(\'notif_groups\')', onClick: 'toggleSetting(\'notif_groups\')' }) +
      '</div>' +
    '</div>';

  const privacySection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">🔒 Конфиденциальность</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🔐', text: 'Код-пароль', value: s.passcode ? 'Включён' : 'Выключен', onClick: 'openPasscodeModal()' }) +
        renderTgRow({ icon: '👁', text: 'Последнее посещение', value: lastSeenLabel(), onClick: 'changeLastSeen()' }) +
        renderTgRow({ icon: '📍', text: 'Кто видит геолокацию', value: geoVisibilityLabel(), onClick: 'changeGeoVisibility()' }) +
        renderTgRow({ icon: '🚫', text: 'Заблокированные', value: state.blockedList.length, onClick: 'openBlockedList()' }) +
      '</div>' +
    '</div>';

  const devicesSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">📱 Устройства</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '📱', text: 'Активные сеансы', onClick: 'openSessions()' }) +
      '</div>' +
    '</div>';

  const dataSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">💾 Данные и память</div>' +
      '<div class="settings-tg-group">' +
        '<div class="settings-tg-row" onclick="showCacheSize()">' +
          '<span class="tg-row-icon">💾</span>' +
          '<span class="tg-row-text">Размер кэша</span>' +
          '<span class="tg-row-value" id="cache-size">…</span>' +
        '</div>' +
        renderTgRow({ icon: '🧹', text: 'Очистить кэш', onClick: 'clearCache()' }) +
      '</div>' +
    '</div>';

  const appearanceSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-section-title">🎨 Оформление</div>' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🎨', text: 'Тема', value: s.theme === 'light' ? 'Светлая' : 'Тёмная', onClick: 'changeTheme()' }) +
        renderTgRow({ icon: '📏', text: 'Размер текста', value: fontLabel(), onClick: 'changeFontSize()' }) +
        renderTgRow({ icon: '🎯', text: 'Акцентный цвет', type: 'color', color: s.accent_color || '#8b7fff', onClick: 'openColorPicker(\'accent_color\')' }) +
        renderTgRow({ icon: '⚡', text: 'Отключить анимации', type: 'switch', checked: s.animations == 0, onToggle: 'toggleSetting(\'animations\')', onClick: 'toggleSetting(\'animations\')' }) +
      '</div>' +
    '</div>';

  const qrSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '📱', text: 'Мой QR-код', onClick: 'showMyQr()' }) +
      '</div>' +
    '</div>';

  const accountSection =
    '<div class="settings-tg-section">' +
      '<div class="settings-tg-group">' +
        renderTgRow({ icon: '🚪', text: 'Выйти', type: 'danger', onClick: 'logout()' }) +
        renderTgRow({ icon: '🗑', text: 'Удалить аккаунт', type: 'danger', onClick: 'openModal(\'delete-account-modal\')' }) +
      '</div>' +
    '</div>';

  let html = '';
  html += profileCardHtml;
  html += starsHtml;
  html += modSection;
  html += botsSection;
  html += progressSection;
  html += giftsSection;
  html += notifSection;
  html += privacySection;
  html += devicesSection;
  html += dataSection;
  html += appearanceSection;
  html += qrSection;
  html += accountSection;
  html += '<div style="padding:30px 20px 10px;text-align:center;color:var(--text-muted);font-size:12px;">🌌 Azerta v13.6<br><br>Сделано с ❤️</div>';

  box.innerHTML = html;

  setTimeout(showCacheSize, 100);
  bindRipples(box);

  socket.emit('get my bots', function (res) {
    if (res && res.ok) {
      state.myBots = res.bots || [];
      const valueEls = box.querySelectorAll('.settings-tg-row');
      valueEls.forEach(el => {
        const textEl = el.querySelector('.tg-row-text');
        const valEl = el.querySelector('.tg-row-value');
        if (textEl && textEl.textContent === 'Мои боты' && valEl) {
          valEl.textContent = state.myBots.length + '/3';
        }
      });
    }
  });

  if (state.me.isModerator) {
    socket.emit('mod panel stats', function (res) {
      if (res && res.ok) {
        state.modStats = res.stats || {};
      }
    });
  }
}

function lastSeenLabel() { return { everyone: 'Все', contacts: 'Контакты', nobody: 'Никто' }[state.settings.last_seen_visibility] || 'Все'; }
function geoVisibilityLabel() {
  const v = state.settings.geo_visibility || 'contacts';
  return { everyone: 'Все', contacts: 'Контакты', nobody: 'Никто' }[v] || 'Контакты';
}
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
function changeGeoVisibility() {
  const options = ['everyone', 'contacts', 'nobody'];
  const cur = state.settings.geo_visibility || 'contacts';
  const next = options[(options.indexOf(cur) + 1) % options.length];
  socket.emit('update settings', { key: 'geo_visibility', value: next }, function () {
    state.settings.geo_visibility = next;
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

function openColorPicker(target) {
  state.currentColorTarget = target;
  const colors = ['#8b7fff','#ec4899','#6d5eff','#fbbf24','#22c55e','#06b6d4','#ef4444','#f97316','#a78bfa','#14b8a6','#f43f5e','#3b82f6'];
  const grid = $('color-grid');
  if (!grid) return;
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
  const title = $('color-modal-title');
  if (title) title.textContent = 'Акцентный цвет';
  openModal('color-modal');
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
  const passEl = $('delete-account-pass');
  const errEl = $('delete-account-error');
  if (!passEl) return;
  const pass = passEl.value;
  if (errEl) errEl.textContent = '';
  if (!pass) { if (errEl) errEl.textContent = 'Введи пароль'; return; }
  socket.emit('delete account', { password: pass }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Не удалось'; return; }
    localStorage.clear();
    location.reload();
  });
}

/* ─── ПРОФИЛЬ ─── */
function openProfile() {
  const un = $('profile-username'); if (un) un.textContent = '@' + (state.me.username || '');
  const fn = $('my-first-name'); if (fn) fn.value = state.me.firstName || '';
  const ln = $('my-last-name'); if (ln) ln.value = state.me.lastName || '';
  const bio = $('my-bio'); if (bio) bio.value = state.me.bio || '';
  const bd = $('my-birthday'); if (bd) bd.value = state.me.birthday || '';
  const em = $('my-emoji'); if (em) em.value = state.me.emoji || '';

  const bannerPreview = $('profile-banner-preview');
  const bannerImg = $('profile-banner-img');
  if (state.me.banner && bannerPreview && bannerImg) {
    bannerImg.src = state.me.banner;
    bannerPreview.style.display = 'block';
    bannerPreview.classList.remove('removing');
  } else if (bannerPreview) {
    if (bannerImg) bannerImg.src = '';
    bannerPreview.style.display = 'none';
  }

  updateVerifyButton();
  updateVerifyChannelButton();
  openModal('profile-modal');
}

function uploadBanner(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('⚠️ Только изображения');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const targetW = 1200;
      const targetH = 400;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (targetW - w) / 2;
      const y = (targetH - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      if (dataUrl.length > 2000000) {
        showToast('⚠️ Баннер слишком большой. Выбери картинку поменьше.');
        return;
      }
      const bannerPreview = $('profile-banner-preview');
      const bannerImg = $('profile-banner-img');
      if (bannerImg) bannerImg.src = dataUrl;
      if (bannerPreview) {
        bannerPreview.style.display = 'block';
        bannerPreview.classList.remove('removing');
      }
      socket.emit('set banner', { banner: dataUrl }, function (res) {
        if (res && res.ok) {
          state.me.banner = dataUrl;
          showToast('🎨 Баннер установлен');
          vibrate([50, 30, 50]);
        } else {
          showToast('❌ ' + ((res && res.error) || 'Ошибка'));
          if (!state.me.banner && bannerPreview) bannerPreview.style.display = 'none';
        }
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function removeMyBanner(event) {
  if (event) event.stopPropagation();
  if (!state.me.banner) return;
  if (!confirm('Убрать баннер?')) return;
  const bannerPreview = $('profile-banner-preview');
  if (bannerPreview) bannerPreview.classList.add('removing');
  socket.emit('remove banner', function (res) {
    if (res && res.ok) {
      state.me.banner = null;
      setTimeout(function () {
        if (bannerPreview) {
          bannerPreview.style.display = 'none';
          bannerPreview.classList.remove('removing');
        }
      }, 400);
      showToast('🎨 Баннер убран');
      vibrate(15);
    } else {
      if (bannerPreview) bannerPreview.classList.remove('removing');
      showToast('❌ Не удалось убрать');
    }
  });
}

function saveProfile() {
  const fn = $('my-first-name');
  const ln = $('my-last-name');
  const bio = $('my-bio');
  const bd = $('my-birthday');
  const em = $('my-emoji');
  const firstName = fn ? fn.value.trim() : '';
  const lastName = ln ? ln.value.trim() : '';
  const bioVal = bio ? bio.value.trim() : '';
  const birthday = bd ? bd.value : '';
  const emojiStatus = em ? em.value.trim() : '';
  socket.emit('update profile', { firstName: firstName, lastName: lastName, bio: bioVal, birthday: birthday, emojiStatus: emojiStatus }, function (res) {
    if (res && res.ok) {
      state.me.firstName = firstName;
      state.me.lastName = lastName;
      state.me.bio = bioVal;
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
  if (state.me.avatar) {
    btn.innerHTML = '<img src="' + state.me.avatar + '" alt="">';
  } else {
    btn.textContent = '👤';
  }
  if (state.me.premium) {
    btn.style.boxShadow = '0 0 0 2px var(--gold), 0 0 12px rgba(251, 191, 36, 0.5)';
  } else {
    btn.style.boxShadow = '';
  }
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
      const slug = $('verify-channel-slug'); if (slug) slug.value = '';
      const err = $('verify-channel-error'); if (err) err.textContent = '';
      openModal('verify-channel-modal');
    };
  } else {
    btn.style.display = 'none';
  }
}

function openBadgeModal() {
  const u = $('badge-username'); if (u) u.value = '';
  const e = $('badge-error'); if (e) e.textContent = '';
  selectBadgeType('verified');
  openModal('badge-modal');
}

function openBadgeModalForCurrent() {
  const u = (contactProfileCurrent && contactProfileCurrent.username) || (state.contactProfileCurrent && state.contactProfileCurrent.username);
  if (!u) return;
  closeModal('contact-profile-modal');
  const inp = $('badge-username'); if (inp) inp.value = u;
  const e = $('badge-error'); if (e) e.textContent = '';
  selectBadgeType('verified');
  openModal('badge-modal');
}

function selectBadgeType(type) {
  currentBadgeType = type;
  document.querySelectorAll('.badge-option').forEach(function (el) {
    el.classList.toggle('active', el.dataset.badge === type);
  });
  const titles = {
    verified: '✓ Выдать галочку',
    hammer: '🔨 Выдать молоток',
    scam: 'SCAM — Выдать скам',
    premium: '⭐ Выдать Azerta Premium'
  };
  const titleEl = $('badge-modal-title');
  if (titleEl) titleEl.textContent = titles[type] || '🏅 Выдать значок';
  vibrate(10);
}

function giveBadgeAction() {
  const u = $('badge-username'); if (!u) return;
  const username = u.value.trim().toLowerCase();
  const errEl = $('badge-error');
  if (errEl) errEl.textContent = '';
  if (!username) { if (errEl) errEl.textContent = 'Введи ник'; return; }
  const events = { verified: 'verify', hammer: 'give hammer', scam: 'give scam', premium: 'give premium' };
  const event = events[currentBadgeType];
  if (!event) { if (errEl) errEl.textContent = 'Неизвестный значок'; return; }
  socket.emit(event, { username: username }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('badge-modal');
    const names = { verified: 'Галочка', hammer: 'Молоток', scam: 'Скам', premium: '⭐ Премиум' };
    showToast('✓ ' + names[currentBadgeType] + ' выдан @' + res.username);
    vibrate([50, 30, 50]);
  });
}

function removeBadgeAction() {
  const u = $('badge-username'); if (!u) return;
  const username = u.value.trim().toLowerCase();
  const errEl = $('badge-error');
  if (errEl) errEl.textContent = '';
  if (!username) { if (errEl) errEl.textContent = 'Введи ник'; return; }
  const events = { verified: 'unverify', hammer: 'remove hammer', scam: 'remove scam', premium: 'remove premium' };
  const event = events[currentBadgeType];
  if (!event) { if (errEl) errEl.textContent = 'Неизвестный значок'; return; }
  socket.emit(event, { username: username }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('badge-modal');
    const names = { verified: 'Галочка', hammer: 'Молоток', scam: 'Скам', premium: '⭐ Премиум' };
    showToast('✓ ' + names[currentBadgeType] + ' снят с @' + res.username);
  });
}

function doVerifyChannel() {
  const s = $('verify-channel-slug'); if (!s) return;
  const slug = s.value.trim().toLowerCase();
  const errEl = $('verify-channel-error');
  if (errEl) errEl.textContent = '';
  if (!slug) { if (errEl) errEl.textContent = 'Введи ID канала'; return; }
  socket.emit('verify channel', { slug: slug }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('verify-channel-modal');
    showToast('✓ Галочка выдана каналу @' + res.slug);
  });
}

function ensureAuthorized(callback) {
  if (!isLoggedInOnServer || !state.me.username) {
    const creds = loadJson(STORAGE.SESSION);
    if (creds && creds.sessionId) {
      socket.emit('login with session', { sessionId: creds.sessionId }, function (res) {
        if (res && res.ok) {
          isLoggedInOnServer = true;
          state.me.username = res.username;
          if (callback) callback(true);
        } else {
          forceShowAuth('Сессия истекла');
          if (callback) callback(false);
        }
      });
    } else {
      forceShowAuth('Войди заново');
      if (callback) callback(false);
    }
    return false;
  }
  if (callback) callback(true);
  return true;
}

/* ─── ДОБАВЛЕНИЕ КОНТАКТА ─── */
function openAddContactModal() {
  const n = $('add-display-name'); if (n) n.value = '';
  const u = $('add-username'); if (u) u.value = '';
  const e = $('add-error'); if (e) e.textContent = '';
  openModal('add-modal');
  setTimeout(function () {
    const el = $('add-display-name');
    if (el) el.focus();
  }, 150);
}

function doAddContact() {
  ensureAuthorized(function (ok) {
    if (!ok) return;
    doAddContactReal();
  });
}

function doAddContactReal() {
  const nameInput = $('add-display-name');
  const userInput = $('add-username');
  const errEl = $('add-error');
  if (!nameInput || !userInput) return;

  const displayName = nameInput.value.trim();
  const username = userInput.value.trim().toLowerCase();

  if (errEl) errEl.textContent = '';

  if (!displayName) { if (errEl) errEl.textContent = '⚠️ Введи имя'; nameInput.focus(); vibrate([30, 20, 30]); return; }
  if (!username) { if (errEl) errEl.textContent = '⚠️ Введи ник'; userInput.focus(); vibrate([30, 20, 30]); return; }
  if (username.length < 3) { if (errEl) errEl.textContent = '⚠️ Ник минимум 3 символа'; userInput.focus(); vibrate([30, 20, 30]); return; }
  if (username === state.me.username) { if (errEl) errEl.textContent = '⚠️ Это твой ник'; vibrate([30, 20, 30]); return; }

  if (errEl) errEl.innerHTML = '<span style="color:var(--accent);">⏳ Добавляю…</span>';

  socket.emit('add contact', { username: username, displayName: displayName }, function (res) {
    if (!res || !res.ok) {
      if (errEl) errEl.textContent = '❌ ' + ((res && res.error) || 'Ошибка');
      if (res && res.error && res.error.indexOf('авторизован') !== -1) {
        setTimeout(function () {
          closeModal('add-modal');
          forceShowAuth('Сессия истекла');
        }, 1500);
      }
      vibrate([30, 20, 30]);
      return;
    }
    nameInput.value = '';
    userInput.value = '';
    if (errEl) errEl.textContent = '';
    closeModal('add-modal');
    showToast('✓ ' + displayName + ' добавлен');
    vibrate([50, 30, 50]);
  });
}

document.addEventListener('keydown', function (e) {
  const am = $('add-modal');
  if (e.key === 'Enter' && am && am.classList.contains('active')) {
    const active = document.activeElement;
    if (active && (active.id === 'add-display-name' || active.id === 'add-username')) {
      e.preventDefault();
      doAddContact();
    }
  }
});

/* ─── ПРОФИЛЬ КОНТАКТА ─── */
function openContactProfile(username) {
  socket.emit('get profile', { username: username }, function (data) {
    if (!data) return;
    state.contactProfileCurrent = data;
    contactProfileCurrent = data;
    const box = $('contact-profile-content');
    if (!box) return;
    const isBotUser = !!data.isBot;
    const isPremium = !!data.premium;
    const avStyle = data.avatar ? 'background-image:url(' + data.avatar + ')' : '';
    const avContent = data.avatar ? '' : (isBotUser ? (data.emojiStatus || '🤖') : initials(username));
    const badges = renderBadgesBig(data);
    const contact = state.contacts.find(function (c) { return c.name === username; });
    const displayName = (data.firstName || data.lastName)
      ? ((data.firstName || '') + ' ' + (data.lastName || '')).trim()
      : ((contact && contact.displayName) || username);
    const emojiStr = data.emojiStatus && !isBotUser ? ' ' + data.emojiStatus : '';
    const botMark = isBotUser ? ' <span class="bot-mark">бот</span>' : '';

    let extra = '';
    if (data.blockedByMe) extra = '<div style="color:#f87171;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вы заблокировали</div>';
    else if (data.blockedMe) extra = '<div style="color:#f87171;font-size:13px;margin-bottom:8px;text-align:center;">🚫 Вас заблокировали</div>';

    let modPunishments = '';
    if (state.me.isModerator && data.punishments && data.punishments.length > 0) {
      modPunishments = '<div class="profile-punishments"><div class="pp-title">🛡️ Активные наказания</div>';
      data.punishments.forEach(function (p) {
        modPunishments += '<div class="pp-row">' +
          '<span class="pp-type">' + (PUNISH_LABELS[p.type] || p.type) + '</span>' +
          '<span class="pp-reason">' + escapeHtml(p.reason || '') + '</span>' +
          '<span class="pp-dur">' + escapeHtml(p.duration_text) + '</span>' +
          '</div>';
      });
      modPunishments += '</div>';
    }

    let giftsHtml = '';
    if (data.gifts && data.gifts.length > 0) {
      giftsHtml = '<div class="profile-gifts"><div class="pg-title">🎁 Подарки (' + data.gifts.length + ')</div><div class="pg-row">';
      data.gifts.slice(0, 12).forEach(function (g) {
        const gift = state.giftsCatalog[g.gift_key];
        if (gift) giftsHtml += '<span class="pg-item" title="' + escapeHtml(gift.name) + '">' + gift.emoji + '</span>';
      });
      giftsHtml += '</div></div>';
    }

    let botCmdsHtml = '';
    if (isBotUser && data.botCommands && data.botCommands.length > 0) {
      botCmdsHtml = '<div class="bot-commands-preview"><div class="bcp-title">🤖 Команды</div>';
      data.botCommands.slice(0, 10).forEach(function (c) {
        botCmdsHtml += '<div class="bcp-row"><span class="bcp-trigger">' + escapeHtml(c.trigger) + '</span>' + escapeHtml(c.response.slice(0, 60)) + '</div>';
      });
      botCmdsHtml += '</div>';
    }

    let bannerHtml = '';
    const hasBanner = !!data.banner && !isBotUser;
    if (hasBanner) {
      bannerHtml = '<div class="contact-banner' + (isPremium ? ' premium' : '') + '"><img src="' + data.banner + '" alt="" /></div>';
    }

    const profileHeaderOpen = hasBanner
      ? '<div class="contact-profile-with-banner">'
      : '<div class="profile-header">';

    box.innerHTML = bannerHtml +
      profileHeaderOpen +
      '<div class="profile-avatar-big' + (isBotUser ? ' bot' : '') + (isPremium ? ' premium' : '') + '" style="' + avStyle + '">' + avContent + '</div>' +
      '<div class="profile-name' + (isPremium ? ' premium' : '') + '">' + escapeHtml(displayName) + emojiStr + botMark + ' ' + badges + '</div>' +
      '<div class="profile-nick">@' + escapeHtml(username) + '</div>' +
      '<div class="profile-status ' + (data.online ? 'online' : '') + '">' + (isBotUser ? 'всегда на связи' : (data.online ? 'в сети' : 'не в сети')) + '</div>' +
      '</div>' +
      (data.bio ? '<div class="profile-bio">' + escapeHtml(data.bio) + '</div>' : '') +
      modPunishments +
      botCmdsHtml +
      giftsHtml + extra;

    const blockBtn = $('block-action-btn');
    if (blockBtn) {
      blockBtn.textContent = data.blockedByMe ? '✅ Разблокировать' : '🚫 Блокировать';
      blockBtn.style.display = isBotUser ? 'none' : '';
    }

    const giftBtn = $('gift-to-contact-btn');
    if (giftBtn) {
      if (username !== state.me.username && !data.blockedByMe && !data.blockedMe && !isBotUser) {
        giftBtn.style.display = 'block';
      } else {
        giftBtn.style.display = 'none';
      }
    }

    const badgeBtn = $('give-badge-to-contact-btn');
    if (badgeBtn) {
      if (state.me.username === 'moroz' && username !== state.me.username && !isBotUser) {
        badgeBtn.style.display = 'block';
      } else {
        badgeBtn.style.display = 'none';
      }
    }

    const reportBtn = $('report-contact-btn');
    if (reportBtn) {
      if (username !== state.me.username && !isBotUser) {
        reportBtn.style.display = 'block';
        reportBtn.onclick = function () { openReportModal(username, null, false); };
      } else {
        reportBtn.style.display = 'none';
      }
    }

    const modActions = $('mod-contact-actions');
    if (modActions) {
      if (state.me.isModerator && username !== state.me.username && !isBotUser) {
        modActions.style.display = 'block';
        modActions.dataset.target = username;
      } else {
        modActions.style.display = 'none';
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

/* ─── QR ─── */
function showMyQr() {
  const container = $('qr-display');
  if (!container) return;
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

/* ─── СЕССИИ ─── */
function openSessions() {
  socket.emit('get sessions', function (sessions) {
    const box = $('settings-content');
    if (!box) return;
    let html = '<div class="settings-tg-section-title">Активные сеансы</div>';
    if (!sessions || sessions.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Нет активных сессий</div>';
    } else {
      sessions.forEach(function (s) {
        const isCurrent = s.id === state.me.sessionId;
        const date = new Date(Number(s.last_active)).toLocaleString('ru-RU');
        html += '<div class="session-item"><div class="device">' + escapeHtml(s.device || 'Web') + (isCurrent ? ' <span style="color:#4ade80">— это устройство</span>' : '') + '</div>';
        html += '<div class="meta">Активность: ' + date + '</div>';
        if (!isCurrent) html += '<button onclick="terminateSession(\'' + s.id + '\')">Завершить</button>';
        html += '</div>';
      });
    }
    html += '<button class="modal-danger" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="terminateAllOthers()">Завершить все другие</button>';
    html += '<button class="modal-secondary" style="margin:8px 16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="renderSettings()">Назад</button>';
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

/* ─── ЗАБЛОКИРОВАННЫЕ ─── */
function openBlockedList() {
  socket.emit('get blocked', function (list) {
    state.blockedList = list || [];
    const box = $('settings-content');
    if (!box) return;
    let html = '<div class="settings-tg-section-title">Заблокированные (' + state.blockedList.length + ')</div>';
    if (state.blockedList.length === 0) {
      html += '<div style="text-align:center;padding:40px;color:var(--text-muted);">Список пуст</div>';
    } else {
      state.blockedList.forEach(function (u) {
        html += '<div class="session-item"><div class="device">@' + escapeHtml(u) + '</div><button onclick="unblockUser(\'' + u + '\')">Разблокировать</button></div>';
      });
    }
    html += '<button class="modal-secondary" style="margin:16px;width:calc(100% - 32px);padding:14px;border-radius:14px;" onclick="renderSettings()">Назад</button>';
    box.innerHTML = html;
  });
}
function unblockUser(u) {
  socket.emit('unblock user', { username: u }, function () { openBlockedList(); });
}

/* ─── PASSCODE ─── */
function openPasscodeModal() {
  const p1 = $('passcode-new'); if (p1) p1.value = '';
  const p2 = $('passcode-confirm'); if (p2) p2.value = '';
  const e = $('passcode-error-modal'); if (e) e.textContent = '';
  openModal('passcode-setup-modal');
}
function savePasscode() {
  const p1El = $('passcode-new');
  const p2El = $('passcode-confirm');
  const errEl = $('passcode-error-modal');
  if (!p1El || !p2El) return;
  const p1 = p1El.value;
  const p2 = p2El.value;
  if (errEl) errEl.textContent = '';
  if (p1.length < 4) { if (errEl) errEl.textContent = 'Минимум 4 символа'; return; }
  if (p1 !== p2) { if (errEl) errEl.textContent = 'Коды не совпадают'; return; }
  socket.emit('set passcode', { passcode: p1 }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
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

/* ═══════════════════════════════════════════════════════════
   📍 ГЕОЛОКАЦИЯ
   ═══════════════════════════════════════════════════════════ */
function sendGeo() {
  if (!state.currentChat && !state.currentGroup && !state.isSavedChat) {
    showToast('⚠️ Открой чат');
    return;
  }
  if (!navigator.geolocation) {
    showToast('⚠️ Геолокация недоступна');
    return;
  }
  showToast('📍 Определяю позицию…');
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = Number(pos.coords.latitude.toFixed(6));
      const lng = Number(pos.coords.longitude.toFixed(6));
      const replyId = state.replyToMessage ? state.replyToMessage.id : null;
      const payload = { lat, lng, replyTo: replyId };
      if (state.isSavedChat) payload.to = state.me.username;
      else if (state.currentChat) payload.to = state.currentChat;
      else if (state.currentGroup) payload.groupId = state.currentGroup.id;
      socket.emit('send geo', payload, function (res) {
        if (!res || !res.ok) {
          showToast('❌ ' + ((res && res.error) || 'Ошибка'));
          return;
        }
        cancelReply();
        showToast('📍 Геолокация отправлена');
        vibrate(15);
      });
    },
    function (err) {
      let msg = 'Не удалось получить позицию';
      if (err.code === 1) msg = '🚫 Доступ к геолокации запрещён';
      else if (err.code === 2) msg = '📡 Позиция недоступна';
      else if (err.code === 3) msg = '⏱ Таймаут';
      showToast(msg);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function renderGeoBlock(geo) {
  if (!geo || geo.lat == null || geo.lng == null) return null;
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  const label = geo.label || null;
  const staticMapUrl = 'https://staticmap.openstreetmap.de/staticmap.php?center=' +
    lat + ',' + lng + '&zoom=15&size=400x260&maptype=mapnik&markers=' +
    lat + ',' + lng + ',red-pushpin';
  const mapsLink = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=16/' + lat + '/' + lng;

  const wrap = document.createElement('div');
  wrap.className = 'geo-block';
  wrap.onclick = function (e) {
    e.stopPropagation();
    window.open(mapsLink, '_blank');
  };
  wrap.innerHTML =
    '<div class="geo-img" style="background-image:url(' + staticMapUrl + ')"></div>' +
    '<div class="geo-info">' +
      '<div class="geo-label">📍 ' + (label ? escapeHtml(label) : 'Моя геолокация') + '</div>' +
      '<div class="geo-coords">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</div>' +
      '<div class="geo-open">Открыть в картах →</div>' +
    '</div>';
  return wrap;
}

/* ═══════════════════════════════════════════════════════════
   🚨 ЖАЛОБЫ
   ═══════════════════════════════════════════════════════════ */
function openReportModal(targetUser, messageId, isGroup) {
  state.reportTarget = targetUser || null;
  state.reportTargetMessageId = messageId || null;
  state.reportIsGroup = !!isGroup;

  const box = $('report-reasons');
  if (box) {
    box.innerHTML = '';
    Object.entries(REPORT_REASONS).forEach(function (entry) {
      const key = entry[0], label = entry[1];
      const btn = document.createElement('button');
      btn.className = 'report-reason-btn';
      btn.dataset.reason = key;
      btn.textContent = label;
      btn.onclick = function () {
        document.querySelectorAll('.report-reason-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cw = $('report-comment-wrap');
        if (cw) cw.style.display = key === 'other' ? 'block' : 'none';
      };
      box.appendChild(btn);
    });
  }

  const target = $('report-target-info');
  if (target) {
    if (state.reportTarget) {
      target.textContent = 'На: @' + state.reportTarget;
    } else if (state.reportTargetMessageId) {
      target.textContent = 'На сообщение #' + state.reportTargetMessageId;
    }
  }

  const comment = $('report-comment');
  if (comment) comment.value = '';
  const err = $('report-error');
  if (err) err.textContent = '';
  const cw = $('report-comment-wrap');
  if (cw) cw.style.display = 'none';

  hideActionMenu();
  openModal('report-modal');
}

function submitReport() {
  const active = document.querySelector('.report-reason-btn.active');
  const err = $('report-error');
  if (err) err.textContent = '';
  if (!active) { if (err) err.textContent = 'Выбери причину'; return; }
  const reason = active.dataset.reason;
  const commentEl = $('report-comment');
  const comment = commentEl ? commentEl.value.trim() : '';
  if (reason === 'other' && !comment) { if (err) err.textContent = 'Опиши причину'; return; }

  socket.emit('report', {
    targetUser: state.reportTarget,
    targetMessageId: state.reportTargetMessageId,
    targetIsGroup: state.reportIsGroup,
    reason: reason,
    comment: comment || null
  }, function (res) {
    if (!res || !res.ok) { if (err) err.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('report-modal');
    showToast('🚨 Жалоба отправлена модераторам');
    vibrate([50, 30, 50]);
  });
}

/* ═══════════════════════════════════════════════════════════
   🛡️ ПАНЕЛЬ МОДЕРАТОРА
   ═══════════════════════════════════════════════════════════ */
function openModPanel() {
  if (!state.me.isModerator) {
    showToast('⚠️ Только для модераторов');
    return;
  }
  state.modPanelOpen = true;
  state.modTab = 'reports';
  switchModTab('reports');
  openModal('mod-panel-modal');
  refreshModStats();
}

function closeModPanel() {
  state.modPanelOpen = false;
  closeModal('mod-panel-modal');
}

function switchModTab(tab) {
  state.modTab = tab;
  document.querySelectorAll('.mod-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.mod-section').forEach(function (s) {
    s.classList.toggle('active', s.dataset.tab === tab);
  });
  if (tab === 'reports') loadModReports();
  else if (tab === 'punishments') loadModPunishments();
  else if (tab === 'logs') loadModLogs();
}

function refreshModStats() {
  socket.emit('mod panel stats', function (res) {
    if (res && res.ok) {
      state.modStats = res.stats || {};
      updateModStatsUI();
    }
  });
}

function updateModStatsUI() {
  const s = state.modStats;
  const el1 = $('mod-stat-new'); if (el1) el1.textContent = s.new_reports || 0;
  const el2 = $('mod-stat-resolved'); if (el2) el2.textContent = s.resolved_reports || 0;
  const el3 = $('mod-stat-bans'); if (el3) el3.textContent = s.active_bans || 0;
  const el4 = $('mod-stat-mutes'); if (el4) el4.textContent = s.active_mutes || 0;
}

function loadModReports() {
  socket.emit('get reports', { status: state.modReportsFilter }, function (res) {
    if (!res || !res.ok) return;
    state.modReports = res.reports || [];
    renderModReports();
  });
}

function renderModReports() {
  const box = $('mod-reports-list');
  if (!box) return;
  box.innerHTML = '';
  if (state.modReports.length === 0) {
    box.innerHTML = '<div class="mod-empty">Жалоб нет 🎉</div>';
    return;
  }
  state.modReports.forEach(function (rep) {
    const card = document.createElement('div');
    card.className = 'mod-report-card';
    const reasonLabel = REPORT_REASONS[rep.reason] || rep.reason;
    const statusClass = rep.status === 'new' ? 'new' : 'resolved';
    let msgPreview = '';
    if (rep.target_message_text) {
      msgPreview = '<div class="mrc-msg">💬 ' + escapeHtml(rep.target_message_text.slice(0, 120)) + '</div>';
    } else if (rep.target_message_image) {
      msgPreview = '<div class="mrc-msg">📷 Фото</div>';
    } else if (rep.target_message_voice) {
      msgPreview = '<div class="mrc-msg">🎤 Голосовое</div>';
    } else if (rep.target_message_geo) {
      msgPreview = '<div class="mrc-msg">📍 Геолокация</div>';
    }
    card.innerHTML =
      '<div class="mrc-head">' +
        '<span class="mrc-status ' + statusClass + '">' + (rep.status === 'new' ? '🆕' : '✓') + '</span>' +
        '<span class="mrc-reason">' + escapeHtml(reasonLabel) + '</span>' +
        '<span class="mrc-time">' + timeAgo(rep.time) + '</span>' +
      '</div>' +
      '<div class="mrc-row"><b>От:</b> @' + escapeHtml(rep.reporter) + '</div>' +
      '<div class="mrc-row"><b>На:</b> @' + escapeHtml(rep.target_user || '—') + '</div>' +
      msgPreview +
      (rep.comment ? '<div class="mrc-comment">💬 ' + escapeHtml(rep.comment) + '</div>' : '') +
      (rep.action_taken && rep.action_taken !== 'ignore'
        ? '<div class="mrc-action">Мера: ' + (PUNISH_LABELS[rep.action_taken] || rep.action_taken) + '</div>'
        : '');
    if (rep.status === 'new') {
      const actions = document.createElement('div');
      actions.className = 'mrc-actions';
      actions.innerHTML =
        '<button class="mrc-btn danger" data-action="ban">🚫 Бан</button>' +
        '<button class="mrc-btn warn" data-action="mute">🔇 Мут</button>' +
        '<button class="mrc-btn" data-action="warn">⚠️ Warn</button>' +
        '<button class="mrc-btn ghost" data-action="ignore">❌ Игнор</button>';
      actions.querySelectorAll('.mrc-btn').forEach(function (btn) {
        btn.onclick = function () {
          handleReportAction(rep.id, btn.dataset.action);
        };
      });
      card.appendChild(actions);
    }
    box.appendChild(card);
  });
}

function handleReportAction(reportId, action) {
  if (action === 'ignore') {
    socket.emit('resolve report', { reportId, action: 'ignore' }, function (res) {
      if (res && res.ok) { showToast('✓ Жалоба проигнорирована'); loadModReports(); refreshModStats(); }
      else showToast('❌ ' + ((res && res.error) || 'Ошибка'));
    });
    return;
  }
  if (action === 'warn') {
    const reason = prompt('Причина предупреждения:');
    if (reason === null) return;
    socket.emit('resolve report', { reportId, action: 'warn', reason }, function (res) {
      if (res && res.ok) { showToast('⚠️ Предупреждение выдано'); loadModReports(); refreshModStats(); }
      else showToast('❌ ' + ((res && res.error) || 'Ошибка'));
    });
    return;
  }
  if (action === 'ban' || action === 'mute') {
    openPunishDurationModal(reportId, action);
  }
}

function openPunishDurationModal(reportId, action) {
  const modal = $('punish-duration-modal');
  const title = $('punish-duration-title');
  const options = $('punish-duration-options');
  if (!modal || !options) return;

  if (title) title.textContent = action === 'ban' ? '🚫 Забанить на:' : '🔇 Замутить на:';
  const durations = action === 'ban'
    ? [['1h', '1 час'], ['24h', '24 часа'], ['7d', '7 дней'], ['30d', '30 дней'], ['forever', 'Навсегда']]
    : [['5m', '5 минут'], ['1h', '1 час'], ['24h', '24 часа'], ['7d', '7 дней']];

  options.innerHTML = '';
  durations.forEach(function (d) {
    const key = d[0], label = d[1];
    const btn = document.createElement('button');
    btn.className = 'punish-duration-btn' + (key === 'forever' ? ' danger' : '');
    btn.textContent = label;
    btn.onclick = function () {
      const reason = prompt('Причина (необязательно):') || null;
      closeModal('punish-duration-modal');
      socket.emit('resolve report', { reportId, action, duration: key, reason }, function (res) {
        if (res && res.ok) {
          showToast('✓ ' + (action === 'ban' ? 'Забанен' : 'Замучен') + ' на ' + label);
          loadModReports(); refreshModStats();
        } else {
          showToast('❌ ' + ((res && res.error) || 'Ошибка'));
        }
      });
    };
    options.appendChild(btn);
  });
  openModal('punish-duration-modal');
}

function loadModPunishments() {
  socket.emit('get punishments', { active: true }, function (res) {
    if (!res || !res.ok) return;
    state.modPunishments = res.punishments || [];
    renderModPunishments();
  });
}

function renderModPunishments() {
  const box = $('mod-punishments-list');
  if (!box) return;
  box.innerHTML = '';
  if (state.modPunishments.length === 0) {
    box.innerHTML = '<div class="mod-empty">Активных наказаний нет ✅</div>';
    return;
  }
  state.modPunishments.forEach(function (p) {
    const card = document.createElement('div');
    card.className = 'mod-punish-card';
    card.innerHTML =
      '<div class="mpc-head">' +
        '<span class="mpc-type">' + (PUNISH_LABELS[p.type] || p.type) + '</span>' +
        '<span class="mpc-dur">' + escapeHtml(p.duration_text) + '</span>' +
      '</div>' +
      '<div class="mpc-row"><b>@</b>' + escapeHtml(p.username) + '</div>' +
      (p.reason ? '<div class="mpc-reason">💬 ' + escapeHtml(p.reason) + '</div>' : '') +
      '<div class="mpc-meta">Выдал: @' + escapeHtml(p.issued_by) + ' · ' + timeAgo(p.issued_at) + '</div>' +
      '<button class="mrc-btn ghost" data-lift="' + p.id + '">✅ Снять</button>';
    const liftBtn = card.querySelector('[data-lift]');
    if (liftBtn) {
      liftBtn.onclick = function () {
        if (!confirm('Снять наказание с @' + p.username + '?')) return;
        socket.emit('lift punishment', { punishmentId: p.id }, function (res) {
          if (res && res.ok) { showToast('✅ Снято'); loadModPunishments(); refreshModStats(); }
          else showToast('❌ ' + ((res && res.error) || 'Ошибка'));
        });
      };
    }
    box.appendChild(card);
  });
}

function loadModLogs() {
  socket.emit('get mod logs', { limit: 200 }, function (res) {
    if (!res || !res.ok) return;
    state.modLogs = res.logs || [];
    renderModLogs();
  });
}

function renderModLogs() {
  const box = $('mod-logs-list');
  if (!box) return;
  box.innerHTML = '';
  if (state.modLogs.length === 0) {
    box.innerHTML = '<div class="mod-empty">Логов нет</div>';
    return;
  }
  state.modLogs.forEach(function (log) {
    const row = document.createElement('div');
    row.className = 'mod-log-row';
    const actionLabel = {
      ban: '🚫 Бан', unban: '✅ Разбан',
      mute: '🔇 Мут', unmute: '✅ Размут',
      warn: '⚠️ Warn',
      ignore: '❌ Игнор',
      resolve: '✓ Решено'
    }[log.action] || log.action;
    row.innerHTML =
      '<div class="mlr-head">' +
        '<span class="mlr-action">' + actionLabel + '</span>' +
        '<span class="mlr-time">' + new Date(log.time).toLocaleString('ru-RU') + '</span>' +
      '</div>' +
      '<div class="mlr-row">Модератор: <b>@' + escapeHtml(log.moderator) + '</b></div>' +
      (log.target_user ? '<div class="mlr-row">Цель: @' + escapeHtml(log.target_user) + '</div>' : '') +
      (log.details ? '<div class="mlr-details">' + escapeHtml(log.details) + '</div>' : '');
    box.appendChild(row);
  });
}

function modBanFromProfile() {
  const el = $('mod-contact-actions');
  const username = el && el.dataset.target;
  if (!username) return;
  openModBanUserModal(username, 'ban');
}
function modMuteFromProfile() {
  const el = $('mod-contact-actions');
  const username = el && el.dataset.target;
  if (!username) return;
  openModBanUserModal(username, 'mute');
}
function modWarnFromProfile() {
  const el = $('mod-contact-actions');
  const username = el && el.dataset.target;
  if (!username) return;
  const reason = prompt('Причина предупреждения для @' + username + ':');
  if (reason === null) return;
  socket.emit('warn user', { username, reason }, function (res) {
    if (res && res.ok) showToast('⚠️ Предупреждение выдано');
    else showToast('❌ ' + ((res && res.error) || 'Ошибка'));
  });
}

function openModBanUserModal(username, type) {
  const modal = $('mod-ban-user-modal');
  if (!modal) return;
  const target = $('mod-ban-target'); if (target) target.textContent = '@' + username;
  const title = $('mod-ban-title'); if (title) title.textContent = type === 'ban' ? '🚫 Забанить' : '🔇 Замутить';
  const un = $('mod-ban-username'); if (un) un.value = username;
  const tp = $('mod-ban-type'); if (tp) tp.value = type;
  const err = $('mod-ban-error'); if (err) err.textContent = '';

  const options = $('mod-ban-durations');
  if (!options) return;
  options.innerHTML = '';
  const durations = type === 'ban'
    ? [['1h', '1 час'], ['24h', '24 часа'], ['7d', '7 дней'], ['30d', '30 дней'], ['forever', 'Навсегда']]
    : [['5m', '5 минут'], ['1h', '1 час'], ['24h', '24 часа'], ['7d', '7 дней']];
  durations.forEach(function (d, i) {
    const btn = document.createElement('button');
    btn.className = 'punish-duration-btn' + (i === 0 ? ' active' : '') + (d[0] === 'forever' ? ' danger' : '');
    btn.dataset.dur = d[0];
    btn.textContent = d[1];
    btn.onclick = function () {
      options.querySelectorAll('.punish-duration-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    options.appendChild(btn);
  });

  openModal('mod-ban-user-modal');
}

function submitModBan() {
  const un = $('mod-ban-username');
  const tp = $('mod-ban-type');
  const durEl = document.querySelector('#mod-ban-durations .punish-duration-btn.active');
  const reasonEl = $('mod-ban-reason');
  const err = $('mod-ban-error');
  if (!un || !tp) return;
  const username = un.value.trim().toLowerCase();
  const type = tp.value;
  const reason = reasonEl ? reasonEl.value.trim() || null : null;
  if (err) err.textContent = '';
  if (!username) { if (err) err.textContent = 'Введи ник'; return; }
  if (!durEl) { if (err) err.textContent = 'Выбери срок'; return; }
  const duration = durEl.dataset.dur;
  const event = type === 'ban' ? 'ban user' : 'mute user';
  socket.emit(event, { username, duration, reason }, function (res) {
    if (!res || !res.ok) { if (err) err.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('mod-ban-user-modal');
    showToast('✓ Готово');
    refreshModStats();
    if (state.modPanelOpen && state.modTab === 'punishments') loadModPunishments();
  });
}

/* ─── ЗВЁЗДЫ / ПОДАРКИ ─── */
function openStarsHistory() {
  socket.emit('get stars', function (res) {
    if (!res || !res.ok) return;
    state.me.stars = res.stars;
    const box = $('stars-history-list');
    if (!box) return;
    if (!res.transactions || res.transactions.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Пока нет операций</div>';
    } else {
      const labels = { welcome: '🎉 Бонус за регистрацию', premium_activated: '⭐ Активация премиума' };
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
        else if (t.reason.indexOf('achievement:') === 0) label = '🏆 Достижение: ' + t.reason.replace('achievement:', '');
        const sign = t.amount > 0 ? '+' : '';
        const color = t.amount > 0 ? '#4ade80' : '#f87171';
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
    username = state.currentGiftTarget ||
               (contactProfileCurrent && contactProfileCurrent.username) ||
               (state.contactProfileCurrent && state.contactProfileCurrent.username);
  }
  if (!username) { showToast('⚠️ Не удалось определить получателя'); return; }
  if (username === state.me.username) { showToast('Себе дарить нельзя 🐎'); return; }

  state.currentGiftTarget = username;

  const contact = state.contacts.find(function (c) { return c.name === username; });
  const displayName = (contact && contact.displayName) || username;
  const tgt = $('gifts-catalog-target'); if (tgt) tgt.textContent = 'Кому: ' + displayName;
  const bal = $('gifts-catalog-balance'); if (bal) bal.textContent = state.me.stars;
  const err = $('gifts-catalog-error'); if (err) err.textContent = '';

  const grid = $('gifts-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.giftsCatalog);
  if (entries.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);">Загрузка каталога...</div>';
    socket.emit('get gifts catalog', function (r) {
      if (r && r.ok) {
        state.giftsCatalog = r.catalog || {};
        openGiftsCatalog(username);
      } else {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#f87171;">Не удалось загрузить каталог</div>';
      }
    });
    openModal('gifts-catalog-modal');
    closeModal('contact-profile-modal');
    return;
  }
  entries.forEach(function (entry) {
    const key = entry[0], gift = entry[1];
    const affordable = state.me.stars >= gift.price;
    const div = document.createElement('div');
    div.className = 'gift-card ' + (affordable ? 'affordable' : 'unaffordable');
    div.innerHTML = '<span class="gift-emoji">' + gift.emoji + '</span>' +
      '<span class="gift-name">' + escapeHtml(gift.name) + '</span>' +
      '<span class="gift-price">' + gift.price + ' ⭐</span>';
    if (affordable) div.onclick = function () { openGiftMessageModal(key); };
    grid.appendChild(div);
  });
  openModal('gifts-catalog-modal');
  closeModal('contact-profile-modal');
}

function openGiftMessageModal(giftKey) {
  const gift = state.giftsCatalog[giftKey];
  if (!gift) return;
  const to = state.currentGiftTarget;
  if (!to) { showToast('⚠️ Не выбран получатель'); return; }
  state.currentGiftKey = giftKey;
  const contact = state.contacts.find(function (c) { return c.name === to; });
  const displayName = (contact && contact.displayName) || to;
  const tgt = $('gift-message-target'); if (tgt) tgt.textContent = 'Кому: ' + displayName;
  const prev = $('gift-message-preview'); if (prev) prev.textContent = gift.emoji;
  const price = $('gift-message-price'); if (price) price.textContent = gift.price;
  const inp = $('gift-message-input'); if (inp) inp.value = '';
  const err = $('gift-message-error'); if (err) err.textContent = '';
  closeModal('gifts-catalog-modal');
  openModal('gift-message-modal');
}

function confirmSendGift() {
  const giftKey = state.currentGiftKey;
  const gift = state.giftsCatalog[giftKey];
  if (!gift) { showToast('⚠️ Подарок не найден'); return; }
  const to = state.currentGiftTarget;
  if (!to) { showToast('⚠️ Не выбран получатель'); return; }
  const inp = $('gift-message-input');
  const message = inp ? inp.value.trim() : '';
  const errEl = $('gift-message-error');
  if (errEl) errEl.textContent = '';
  socket.emit('send gift', { to: to, giftKey: giftKey, message: message || null }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка при отправке'; return; }
    closeModal('gift-message-modal');
    showToast('🎁 Подарок отправлен! -' + gift.price + ' ⭐');
    state.currentGiftTarget = null;
    state.currentGiftKey = null;
  });
}

function openMyGifts() {
  socket.emit('get my gifts', function (res) {
    const box = $('my-gifts-list');
    if (!box) return;
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
          '<span class="gift-name" style="font-size:11px;font-weight:600;">' + escapeHtml(gift.name) + '</span>' +
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

function openGiftModal() {
  const i = $('gift-code-input'); if (i) i.value = '';
  const e = $('gift-error'); if (e) e.textContent = '';
  openModal('gift-modal');
}

function redeemGiftCode() {
  const inp = $('gift-code-input');
  if (!inp) return;
  const code = inp.value.trim().toUpperCase();
  const errEl = $('gift-error');
  if (errEl) errEl.textContent = '';
  if (!code) { if (errEl) errEl.textContent = 'Введи код'; return; }
  socket.emit('redeem gift code', { code: code }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('gift-modal');
    showToast('⭐ Премиум активирован! +' + (res.bonus || 25) + ' ⭐');
    renderSettings();
    if (state.activeTab === 'settings') renderSettingsTab();
  });
}

function openGiftAdminModal() {
  if (state.me.username !== 'moroz') return;
  const box = $('gift-codes-list');
  if (box) box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>';
  openModal('gift-admin-modal');
  loadGiftCodes();
}

function loadGiftCodes() {
  socket.emit('list gift codes', function (res) {
    const box = $('gift-codes-list');
    if (!box) return;
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">Нет доступа</div>';
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

/* ─── ДОСТИЖЕНИЯ / СТАТИСТИКА ─── */
function openAchievements() {
  const box = $('achievements-content');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Загрузка…</div>';
  openModal('achievements-modal');
  socket.emit('get achievements', function (res) {
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">Не удалось загрузить</div>';
      return;
    }
    box.innerHTML = '';
    const unlockedCount = res.achievements.filter(function (a) { return a.unlocked; }).length;
    const total = res.achievements.length;
    const summary = document.createElement('div');
    summary.style.cssText = 'text-align:center;padding:12px 0 18px;color:var(--text-muted);font-size:13px;';
    summary.innerHTML = 'Разблокировано: <b style="color:var(--accent);">' + unlockedCount + '</b> / ' + total;
    box.appendChild(summary);
    res.achievements.forEach(function (a) {
      const card = document.createElement('div');
      card.className = 'achievement-card ' + (a.unlocked ? 'unlocked' : 'locked');
      const pct = Math.min(100, Math.round((a.current / a.target) * 100));
      card.innerHTML = '<div class="achievement-emoji">' + a.emoji + '</div>' +
        '<div class="achievement-info">' +
          '<div class="achievement-name">' + escapeHtml(a.name) + '</div>' +
          '<div class="achievement-desc">' + escapeHtml(a.desc) + '</div>' +
          '<div class="achievement-progress-bar"><div class="achievement-progress-fill" style="width:' + pct + '%;"></div></div>' +
          '<div class="achievement-progress-text">' + Math.min(a.current, a.target) + ' / ' + a.target + '</div>' +
        '</div>' +
        (a.unlocked ? '<div class="achievement-unlocked-badge">✓</div>' : '');
      box.appendChild(card);
    });
  });
}

function openStats() {
  const box = $('stats-content');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Загрузка…</div>';
  openModal('stats-modal');
  socket.emit('get achievements', function (res) {
    if (!res || !res.ok || !res.stats) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171;">Не удалось загрузить</div>';
      return;
    }
    const s = res.stats;
    const stats = [
      { emoji: '💬', label: 'Сообщений', value: Number(s.messages_sent || 0) },
      { emoji: '📞', label: 'Звонков', value: Number(s.calls_made || 0) },
      { emoji: '📲', label: 'Принято', value: Number(s.calls_received || 0) },
      { emoji: '🎁', label: 'Подарков', value: Number(s.gifts_sent || 0) },
      { emoji: '❤️', label: 'Получено', value: Number(s.gifts_received || 0) },
      { emoji: '📸', label: 'Историй', value: Number(s.stories_posted || 0) },
      { emoji: '👥', label: 'Друзей', value: Number(s.friends_added || 0) },
      { emoji: '🔥', label: 'Дней подряд', value: Number(s.days_active || 0) },
      { emoji: '🤖', label: 'Ботов', value: Number(s.bots_created || 0) },
      { emoji: '🎤', label: 'Голосовых', value: Number(s.voice_sent || 0) },
      { emoji: '🎥', label: 'Кружков', value: Number(s.circles_sent || 0) },
      { emoji: '📷', label: 'Фото', value: Number(s.photos_sent || 0) },
      { emoji: '😍', label: 'Реакций', value: Number(s.reactions_given || 0) },
      { emoji: '🐱', label: 'Стикеров', value: Number(s.stickers_sent || 0) },
      { emoji: '📍', label: 'Гео', value: Number(s.geo_sent || 0) },
    ];
    let html = '<div class="stats-grid">';
    stats.forEach(function (st) {
      html += '<div class="stat-card">' +
        '<div class="stat-emoji">' + st.emoji + '</div>' +
        '<div class="stat-value">' + st.value + '</div>' +
        '<div class="stat-label">' + st.label + '</div>' +
        '</div>';
    });
    html += '</div>';
    const dur = Number(s.calls_duration || 0);
    const min = Math.floor(dur / 60);
    const hours = Math.floor(min / 60);
    let timeStr = '';
    if (hours > 0) timeStr = hours + ' ч ' + (min % 60) + ' мин';
    else if (min > 0) timeStr = min + ' мин';
    else timeStr = dur + ' сек';
    html += '<div style="text-align:center;padding:14px;color:var(--text-muted);font-size:13px;">📞 Всего в звонках: <b style="color:var(--accent);">' + timeStr + '</b></div>';
    box.innerHTML = html;
  });
}

/* ─── БОТЫ ─── */
function openCreateBotModal() {
  const u = $('bot-username'); if (u) u.value = '';
  const n = $('bot-name'); if (n) n.value = '';
  const d = $('bot-description'); if (d) d.value = '';
  const e = $('bot-emoji'); if (e) e.value = '🤖';
  const err = $('create-bot-error'); if (err) err.textContent = '';
  const cl = $('bot-commands-list'); if (cl) cl.innerHTML = '';
  const pv = $('bot-avatar-preview'); if (pv) pv.style.display = 'none';
  state.tempBotAvatar = null;
  addBotCommandRow();
  openModal('create-bot-modal');
}

function addBotCommandRow() {
  const box = $('bot-commands-list');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'bot-command-row';
  row.innerHTML =
    '<input class="bcc-trigger" placeholder="/start" maxlength="40" />' +
    '<textarea class="bcc-response" placeholder="Ответ бота" rows="2" maxlength="1000"></textarea>' +
    '<button class="bcc-remove" type="button">×</button>';
  const rm = row.querySelector('.bcc-remove');
  if (rm) rm.onclick = function () { row.remove(); };
  box.appendChild(row);
}

function addEditBotCommandRow() {
  const box = $('edit-bot-commands-list');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'bot-command-row';
  row.innerHTML =
    '<input class="bcc-trigger" placeholder="/start" maxlength="40" />' +
    '<textarea class="bcc-response" placeholder="Ответ бота" rows="2" maxlength="1000"></textarea>' +
    '<button class="bcc-remove" type="button">×</button>';
  const rm = row.querySelector('.bcc-remove');
  if (rm) rm.onclick = function () { row.remove(); };
  box.appendChild(row);
}

function collectBotCommands(boxId) {
  const box = $(boxId);
  if (!box) return [];
  const rows = box.querySelectorAll('.bot-command-row');
  const out = [];
  rows.forEach(function (row) {
    const tr = row.querySelector('.bcc-trigger');
    const rs = row.querySelector('.bcc-response');
    if (!tr || !rs) return;
    const trigger = tr.value.trim();
    const response = rs.value.trim();
    if (trigger && response) out.push({ trigger: trigger, response: response });
  });
  return out;
}

function uploadBotAvatar(event) {
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
      state.tempBotAvatar = canvas.toDataURL('image/jpeg', 0.8);
      const imgEl = $('bot-avatar-img'); if (imgEl) imgEl.src = state.tempBotAvatar;
      const pv = $('bot-avatar-preview'); if (pv) pv.style.display = 'block';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function doCreateBot() {
  const u = $('bot-username'); if (!u) return;
  const username = u.value.trim().toLowerCase();
  const n = $('bot-name');
  const d = $('bot-description');
  const e = $('bot-emoji');
  const name = n ? n.value.trim() : '';
  const description = d ? d.value.trim() : '';
  const emoji = e ? e.value.trim() : '';
  const commands = collectBotCommands('bot-commands-list');
  const errEl = $('create-bot-error');
  if (errEl) errEl.textContent = '';
  if (!username) { if (errEl) errEl.textContent = 'Введи ник бота'; return; }
  if (!/_bot$/.test(username)) { if (errEl) errEl.textContent = 'Ник должен заканчиваться на _bot'; return; }
  if (!name) { if (errEl) errEl.textContent = 'Введи имя бота'; return; }
  socket.emit('create bot', {
    username: username, name: name, description: description || null,
    avatar: state.tempBotAvatar, emoji: emoji || null, commands: commands
  }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('create-bot-modal');
    showToast('🤖 Бот ' + name + ' создан!');
    vibrate([50, 30, 50]);
    socket.emit('get my bots', function (r) { if (r && r.ok) state.myBots = r.bots || []; });
  });
}

function openMyBots() {
  const box = $('my-bots-list');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Загрузка…</div>';
  openModal('my-bots-modal');
  socket.emit('get my bots', function (res) {
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;">Ошибка</div>';
      return;
    }
    state.myBots = res.bots || [];
    if (state.myBots.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока нет ботов 🤖<br><br>Нажми «Создать бота»</div>';
      return;
    }
    box.innerHTML = '';
    state.myBots.forEach(function (b) {
      const card = document.createElement('div');
      card.className = 'my-bot-card';
      const avStyle = b.avatar ? 'background-image:url(' + b.avatar + ')' : '';
      const avContent = b.avatar ? '' : (b.emoji || '🤖');
      card.innerHTML = '<div class="bot-avatar" style="' + avStyle + '">' + avContent + '</div>' +
        '<div class="bot-info">' +
          '<div class="bot-name">' + escapeHtml(b.name) + ' <span class="bot-mark">бот</span></div>' +
          '<div class="bot-desc">@' + escapeHtml(b.username) + ' · ' + escapeHtml(b.description || '') + '</div>' +
          '<div class="bot-cmd-count">📋 ' + b.commands.length + ' команд</div>' +
        '</div>';
      card.onclick = function () { openEditBot(b.username); };
      box.appendChild(card);
    });
  });
}

function openEditBot(username) {
  socket.emit('find bot', { username: username }, function (res) {
    if (!res || !res.ok) { showToast('⚠️ Бот не найден'); return; }
    const b = res.bot;
    state.editingBotUsername = b.username;
    const un = $('edit-bot-username'); if (un) un.value = b.username;
    const nm = $('edit-bot-name'); if (nm) nm.value = b.name;
    const ds = $('edit-bot-description'); if (ds) ds.value = b.description || '';
    const em = $('edit-bot-emoji'); if (em) em.value = b.emoji || '';
    const err = $('edit-bot-error'); if (err) err.textContent = '';
    const cmdsBox = $('edit-bot-commands-list');
    if (cmdsBox) {
      cmdsBox.innerHTML = '';
      if (b.commands.length === 0) addEditBotCommandRow();
      else b.commands.forEach(function (c) {
        const row = document.createElement('div');
        row.className = 'bot-command-row';
        row.innerHTML =
          '<input class="bcc-trigger" placeholder="/start" maxlength="40" value="' + escapeHtml(c.trigger) + '" />' +
          '<textarea class="bcc-response" placeholder="Ответ бота" rows="2" maxlength="1000">' + escapeHtml(c.response) + '</textarea>' +
          '<button class="bcc-remove" type="button">×</button>';
        const rm = row.querySelector('.bcc-remove');
        if (rm) rm.onclick = function () { row.remove(); };
        cmdsBox.appendChild(row);
      });
    }
    closeModal('my-bots-modal');
    openModal('edit-bot-modal');
  });
}

function doUpdateBot() {
  const username = state.editingBotUsername;
  if (!username) return;
  const nm = $('edit-bot-name');
  const ds = $('edit-bot-description');
  const em = $('edit-bot-emoji');
  const name = nm ? nm.value.trim() : '';
  const description = ds ? ds.value.trim() : '';
  const emoji = em ? em.value.trim() : '';
  const commands = collectBotCommands('edit-bot-commands-list');
  const errEl = $('edit-bot-error');
  if (errEl) errEl.textContent = '';
  if (!name) { if (errEl) errEl.textContent = 'Введи имя'; return; }
  socket.emit('update bot', {
    username: username, name: name, description: description || null,
    emoji: emoji || null, commands: commands
  }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('edit-bot-modal');
    showToast('✓ Бот обновлён');
    socket.emit('get my bots', function (r) { if (r && r.ok) state.myBots = r.bots || []; });
  });
}

function confirmDeleteBot() {
  const username = state.editingBotUsername;
  if (!username) return;
  if (!confirm('Удалить бота @' + username + '? Все его сообщения будут удалены.')) return;
  socket.emit('delete bot', { username: username }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('edit-bot-modal');
    showToast('🗑 Бот удалён');
    socket.emit('get my bots', function (r) { if (r && r.ok) state.myBots = r.bots || []; });
  });
}

function openFindBotModal() {
  const i = $('find-bot-input'); if (i) i.value = '';
  const e = $('find-bot-error'); if (e) e.textContent = '';
  openModal('find-bot-modal');
}

function doFindBot() {
  const inp = $('find-bot-input');
  if (!inp) return;
  const username = inp.value.trim().toLowerCase();
  const errEl = $('find-bot-error');
  if (errEl) errEl.textContent = '';
  if (!username) { if (errEl) errEl.textContent = 'Введи ник'; return; }
  socket.emit('find bot', { username: username }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Бот не найден'; return; }
    closeModal('find-bot-modal');
    showBotInfoModal(res.bot);
  });
}

function showBotInfoModal(bot) {
  state.currentBot = bot;
  const box = $('bot-info-content');
  if (!box) return;
  const avStyle = bot.avatar ? 'background-image:url(' + bot.avatar + ')' : '';
  const avContent = bot.avatar ? '' : (bot.emoji || '🤖');
  let cmdsHtml = '';
  if (bot.commands && bot.commands.length > 0) {
    cmdsHtml = '<div class="bot-commands-preview"><div class="bcp-title">📋 Команды</div>';
    bot.commands.forEach(function (c) {
      cmdsHtml += '<div class="bcp-row"><span class="bcp-trigger">' + escapeHtml(c.trigger) + '</span>' + escapeHtml(c.response.slice(0, 80)) + '</div>';
    });
    cmdsHtml += '</div>';
  } else {
    cmdsHtml = '<div class="modal-desc" style="margin-bottom:14px;">У бота нет команд</div>';
  }
  box.innerHTML = '<div class="profile-header">' +
    '<div class="profile-avatar-big bot" style="' + avStyle + '">' + avContent + '</div>' +
    '<div class="profile-name">' + escapeHtml(bot.name) + ' <span class="bot-mark">бот</span></div>' +
    '<div class="profile-nick">@' + escapeHtml(bot.username) + '</div>' +
    '</div>' +
    (bot.description ? '<div class="profile-bio">' + escapeHtml(bot.description) + '</div>' : '') +
    cmdsHtml;
  openModal('bot-info-modal');
}

function addFoundBot() {
  if (!state.currentBot) return;
  const bot = state.currentBot;
  socket.emit('add contact', { username: bot.username, displayName: bot.name }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    closeModal('bot-info-modal');
    showToast('✓ Бот добавлен в контакты');
    switchTab('chats');
    setTimeout(function () { openChat(bot.username); }, 300);
  });
}

/* ─── КОНТАКТЫ ─── */
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
    box.innerHTML = '<div class="tab-empty"><div class="big">👥</div>' + (q ? 'Ничего не найдено' : 'Пока нет контактов') + '<br><br><button style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:14px;font-weight:600;" onclick="openAddContactModal()">➕ Добавить контакт</button></div>';
    return;
  }
  list.forEach(function (c) {
    const div = document.createElement('div');
    div.className = 'chat-item' + (c.premium ? ' premium-user' : '');
    const avStyle = c.avatar ? 'background-image:url(' + c.avatar + ')' : (c.isBot ? 'background:linear-gradient(135deg,#06b6d4,#0891b2)' : 'background:var(--accent)');
    const avContent = c.avatar ? '' : (c.isBot ? (c.emojiStatus || '🤖') : initials(c.displayName || c.name));
    const badges = renderBadges(c);
    const online = c.online ? '<span class="online-dot"></span>' : '';
    const botMark = c.isBot ? ' <span class="bot-mark">бот</span>' : '';
    const avClass = 'avatar' + (c.isBot ? ' bot' : '') + (c.premium ? ' premium' : '');
    div.innerHTML = '<div class="' + avClass + '" style="' + avStyle + '">' + avContent + online + '</div>' +
      '<div class="chat-info"><div class="chat-name">' + escapeHtml(c.displayName || c.name) + botMark + badges + '</div>' +
      '<div class="chat-preview">@' + escapeHtml(c.name) + '</div></div>';
    div.onclick = function () { switchTab('chats'); openChat(c.name); };
    box.appendChild(div);
    attachRipple(div);
  });
}

/* ─── СПИСОК ЧАТОВ ─── */
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
  attachRipple(savedItem);

  const allContacts = state.contacts.filter(function (c) { return state.showArchived ? c.archived : !c.archived; });
  const allGroups = state.groups.filter(function (g) { return state.showArchived ? g.archived : !g.archived; });

  const pinnedContacts = allContacts.filter(function (c) { return c.pinned; }).sort(function (a, b) { return (b.pinOrder || 0) - (a.pinOrder || 0); });
  const unpinnedContacts = allContacts.filter(function (c) { return !c.pinned; });
  const pinnedGroups = allGroups.filter(function (g) { return g.pinned; }).sort(function (a, b) { return (b.pinOrder || 0) - (a.pinOrder || 0); });
  const unpinnedGroups = allGroups.filter(function (g) { return !g.pinned; });

  const activeContacts = pinnedContacts.concat(unpinnedContacts);
  const activeGroups = pinnedGroups.concat(unpinnedGroups);

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
        '<button style="background:var(--accent);color:#fff;border:none;padding:12px 24px;border-radius:14px;font-weight:600;" onclick="toggleArchiveView()">← Назад</button>';
    } else {
      empty.innerHTML = '<div class="big">👋</div>Пока никого нет.<br>Нажми <b>＋</b> и добавь друга, бота или создай канал.';
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
      '<div class="chat-preview">@' + escapeHtml(ch.slug) + ' · ' + ch.memberCount + ' подпис.</div>' +
    '</div>';
  div.onclick = function () { openChannelChat(ch); };
  attachRipple(div);
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
  div.className = 'chat-item' + (state.currentGroup && state.currentGroup.id === g.id ? ' active' : '') + (g.pinned ? ' pinned' : '');
  const avatar = g.avatar
    ? '<div class="avatar" style="background-image:url(' + g.avatar + ')"></div>'
    : '<div class="avatar group">👥</div>';
  const badge = unreadCount > 0 ? '<div class="chat-badge">' + unreadCount + '</div>' : '';
  const muteIcon = g.muted ? '<span class="chat-mute-icon">🔕</span>' : '';
  const pinMark = g.pinned ? '<span class="pin-mark">📌</span>' : '';
  const memberWord = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  div.innerHTML = avatar +
    '<div class="chat-info">' +
      '<div class="chat-name">' + escapeHtml(g.name) + ' ' + pinMark + muteIcon + '</div>' +
      '<div class="chat-preview">' + g.memberCount + ' участник' + memberWord + '</div>' +
    '</div>' +
    '<div class="chat-meta">' + badge + '</div>';
  div.onclick = function () { openGroupChat(g); };
  attachRipple(div);
  return div;
}

function renderContactItem(u) {
  const div = document.createElement('div');
  const unreadCount = state.unread[u.name] || 0;
  const isPremium = !!u.premium;
  div.className = 'chat-item' +
    (state.currentChat === u.name ? ' active' : '') +
    (u.pinned ? ' pinned' : '') +
    (isPremium ? ' premium-user' : '');
  const onlineDot = u.online ? '<span class="online-dot"></span>' : '';
  const style = u.avatar
    ? 'background-image:url(' + u.avatar + ')'
    : (u.isBot ? 'background:linear-gradient(135deg,#06b6d4,#0891b2)' : 'background:var(--accent)');
  const content = u.avatar ? '' : (u.isBot ? (u.emojiStatus || '🤖') : initials(u.displayName || u.name));
  const badge = unreadCount > 0 ? '<div class="chat-badge">' + unreadCount + '</div>' : '';
  const badges = renderBadges(u);
  const muteIcon = u.muted ? '<span class="chat-mute-icon">🔕</span>' : '';
  const pinMark = u.pinned ? '<span class="pin-mark">📌</span>' : '';
  const blockIcon = u.blocked ? '🚫 ' : '';
  const botMark = u.isBot ? ' <span class="bot-mark">бот</span>' : '';
  const emojiStr = u.emojiStatus && !u.isBot ? ' ' + u.emojiStatus : '';
  const isTyping = !!state.typingUsers[u.name];
  const preview = isTyping
    ? '<span class="typing">печатает…</span>'
    : (unreadCount > 0 ? 'новое сообщение' : (u.online ? (u.isBot ? 'бот онлайн' : 'в сети') : 'был(а) недавно'));
  const avClass = 'avatar' + (u.isBot ? ' bot' : '') + (isPremium ? ' premium' : '');
  div.innerHTML = '<div class="' + avClass + '" style="' + style + '">' + content + onlineDot + '</div>' +
    '<div class="chat-info">' +
      '<div class="chat-name">' + blockIcon + escapeHtml(u.displayName || u.name) + botMark + emojiStr + badges + ' ' + pinMark + muteIcon + '</div>' +
      '<div class="chat-preview">' + preview + '</div>' +
    '</div>' +
    '<div class="chat-meta">' + badge + '</div>';
  div.onclick = function () { openChat(u.name); };
  attachRipple(div);
  return div;
}

function filterContacts() { renderChatList(); }

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

/* ─── ОТКРЫТИЕ ЧАТА ─── */
function openChat(name) {
  state.currentChat = name;
  state.currentGroup = null;
  state.currentChannel = null;
  state.isSavedChat = false;

  const contact = state.contacts.find(function (c) { return c.name === name; });
  state.isBotChat = !!(contact && contact.isBot);
  state.currentBot = null;

  clearUnread(name);
  state.lastDateShown = '';
  state.pinnedMessageId = null;
  const pb = $('pinned-bar'); if (pb) pb.classList.remove('active');

  const isPremium = contact && contact.premium;
  const badges = renderBadgesBig(contact || {});
  const displayName = (contact && contact.displayName) || name;
  const botMark = state.isBotChat ? ' <span class="bot-mark">бот</span>' : '';
  const topName = $('chat-top-name'); if (topName) topName.innerHTML = escapeHtml(displayName) + botMark + ' ' + badges;
  const topStatus = $('chat-top-status');
  if (topStatus) {
    topStatus.textContent = contact && contact.online
      ? (state.isBotChat ? 'бот онлайн' : 'в сети')
      : 'был(а) недавно';
    topStatus.classList.remove('typing');
  }

  const av = $('chat-avatar');
  if (av) {
    av.classList.toggle('premium', !!isPremium);
    if (contact && contact.avatar) {
      av.style.backgroundImage = 'url(' + contact.avatar + ')';
      av.textContent = '';
      av.classList.remove('group', 'saved');
      av.classList.toggle('bot', state.isBotChat);
    } else if (state.isBotChat) {
      av.style.backgroundImage = '';
      av.textContent = (contact && contact.emojiStatus) || '🤖';
      av.style.background = '';
      av.classList.add('bot');
      av.classList.remove('group', 'saved');
    } else {
      av.style.backgroundImage = '';
      av.textContent = initials(displayName);
      av.style.background = 'var(--accent)';
      av.classList.remove('group', 'saved', 'bot');
    }
  }

  const ca = $('chat-actions'); if (ca) ca.style.display = 'flex';
  const c1 = $('callBtn1'); if (c1) c1.style.display = state.isBotChat ? 'none' : 'block';
  const c2 = $('callBtn2'); if (c2) c2.style.display = state.isBotChat ? 'none' : 'block';
  const cti = $('chat-top-info'); if (cti) cti.onclick = function () { openContactProfile(name); };

  if (state.isBotChat) {
    socket.emit('find bot', { username: name }, function (res) {
      if (res && res.ok && res.bot.commands.length > 0) {
        renderBotCommandsHint(res.bot.commands);
      } else {
        removeBotCommandsHint();
      }
    });
  } else {
    removeBotCommandsHint();
  }

  const box = $('messages'); if (box) box.innerHTML = '';
  const cs = $('chat-screen'); if (cs) cs.classList.add('active');
  socket.emit('load history', { withUser: name });
  setTimeout(function () { socket.emit('mark read', { withUser: name }); }, 300);
  renderChatList();
  updateTopStatusTyping();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
  bindRipples($('chat-screen'));
  applyMuteLock();
}

function renderBotCommandsHint(commands) {
  removeBotCommandsHint();
  const inputArea = $('input-area');
  if (!inputArea) return;
  const hint = document.createElement('div');
  hint.className = 'bot-commands-hint';
  hint.id = 'bot-commands-hint';
  commands.slice(0, 8).forEach(function (c) {
    const chip = document.createElement('button');
    chip.className = 'bch-chip';
    chip.textContent = c.trigger;
    chip.onclick = function () {
      const inp = $('msgInput');
      if (inp) inp.value = c.trigger;
      sendMsg();
    };
    hint.appendChild(chip);
  });
  if (inputArea.parentNode) inputArea.parentNode.insertBefore(hint, inputArea);
  bindRipples(hint);
}

function removeBotCommandsHint() {
  const el = $('bot-commands-hint');
  if (el) el.remove();
}

function openSavedChat() {
  state.currentChat = null;
  state.currentGroup = null;
  state.currentChannel = null;
  state.isSavedChat = true;
  state.isBotChat = false;
  state.currentBot = null;
  removeBotCommandsHint();
  clearUnread('__saved__');
  state.lastDateShown = '';
  state.pinnedMessageId = null;
  const pb = $('pinned-bar'); if (pb) pb.classList.remove('active');
  const topName = $('chat-top-name'); if (topName) topName.innerHTML = '⭐ Избранное';
  const topStatus = $('chat-top-status'); if (topStatus) topStatus.textContent = 'Сохранённые сообщения';
  const av = $('chat-avatar');
  if (av) {
    av.style.backgroundImage = '';
    av.textContent = '⭐';
    av.style.background = '';
    av.classList.add('saved');
    av.classList.remove('group', 'bot', 'premium');
  }
  const ca = $('chat-actions'); if (ca) ca.style.display = 'none';
  const cti = $('chat-top-info'); if (cti) cti.onclick = null;
  const box = $('messages'); if (box) box.innerHTML = '';
  const cs = $('chat-screen'); if (cs) cs.classList.add('active');
  socket.emit('load saved history');
  renderChatList();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
  applyMuteLock();
}

function openGroupChat(g) {
  state.currentGroup = g;
  state.currentChat = null;
  state.currentChannel = null;
  state.isSavedChat = false;
  state.isBotChat = false;
  state.currentBot = null;
  removeBotCommandsHint();
  clearUnread('g:' + g.id);
  state.lastDateShown = '';
  state.pinnedMessageId = g.pinnedMessageId || null;
  const topName = $('chat-top-name'); if (topName) topName.textContent = g.name;
  const memberWord = g.memberCount === 1 ? '' : (g.memberCount < 5 ? 'а' : 'ов');
  const topStatus = $('chat-top-status');
  if (topStatus) {
    topStatus.textContent = g.memberCount + ' участник' + memberWord;
    topStatus.classList.remove('typing');
  }
  const av = $('chat-avatar');
  if (av) {
    av.classList.remove('premium');
    if (g.avatar) {
      av.style.backgroundImage = 'url(' + g.avatar + ')';
      av.textContent = '';
      av.classList.add('group');
      av.classList.remove('saved', 'bot');
    } else {
      av.style.backgroundImage = '';
      av.textContent = '👥';
      av.style.background = '';
      av.classList.add('group');
      av.classList.remove('saved', 'bot');
    }
  }
  const ca = $('chat-actions'); if (ca) ca.style.display = 'flex';
  const c1 = $('callBtn1'); if (c1) c1.style.display = 'none';
  const c2 = $('callBtn2'); if (c2) c2.style.display = 'none';
  const cti = $('chat-top-info'); if (cti) cti.onclick = function () { openGroupInfo(); };
  const box = $('messages'); if (box) box.innerHTML = '';
  const cs = $('chat-screen'); if (cs) cs.classList.add('active');
  socket.emit('load group history', { groupId: g.id });
  const pb = $('pinned-bar');
  if (pb) {
    if (state.pinnedMessageId) {
      pb.classList.add('active');
      const pt = $('pinned-text'); if (pt) pt.textContent = 'Закреплённое сообщение';
    } else {
      pb.classList.remove('active');
    }
  }
  renderChatList();
  bindScrollDown();
  closeStickersPanel();
  applyChatWallpaper();
  applyMuteLock();
}

function closeChat() {
  if (state.currentChat) socket.emit('typing', { to: state.currentChat, isTyping: false });
  if (state.currentGroup) socket.emit('group typing', { groupId: state.currentGroup.id, isTyping: false });
  if (state.myTypingTimeout) { clearTimeout(state.myTypingTimeout); state.myTypingTimeout = null; }
  const cs = $('chat-screen'); if (cs) cs.classList.remove('active');
  state.currentChat = null;
  state.currentGroup = null;
  state.isSavedChat = false;
  state.isBotChat = false;
  state.currentBot = null;
  if (state.isRecording) stopVoiceRecording(true);
  hideReactionMenu();
  hideActionMenu();
  cancelReply();
  closeStickersPanel();
  removeBotCommandsHint();
  renderChatList();
}

/* ─── СКРОЛЛ ─── */
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

/* ─── УПОМИНАНИЯ ─── */
function highlightMentions(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/@([a-z0-9_]{3,20})/gi, function (match, username) {
    return '<span class="mention">@' + username + '</span>';
  });
}

/* ─── РЕНДЕР СООБЩЕНИЯ ─── */
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

  if (!msg.self && msg.from) {
    const c = state.contacts.find(function (x) { return x.name === msg.from; });
    if (c && c.premium) wrap.classList.add('from-premium');
  }

  if (msg.isGroup && !msg.self && msg.senderName) {
    const se = document.createElement('div');
    se.className = 'msg-sender';
    se.textContent = msg.senderName;
    wrap.appendChild(se);
  }

  const div = document.createElement('div');
  div.className = 'msg ' + (msg.self ? 'self' : 'other');

  if (msg.system) {
    div.className = 'msg system';
    div.innerHTML = escapeHtml(msg.text || '');
    wrap.appendChild(div);
    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    return;
  }

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

    if (msg.geo) {
      const geoBlock = renderGeoBlock(msg.geo);
      if (geoBlock) div.appendChild(geoBlock);
    }

    if (msg.text) {
      if (msg.text.indexOf('🎁 Подарок: ') === 0) {
        let body = msg.text.replace('🎁 Подарок: ', '');
        let userMsg = null;
        const nl = body.indexOf('\n💬 ');
        if (nl !== -1) { userMsg = body.slice(nl + 4); body = body.slice(0, nl); }
        const parts = body.split(' ');
        const emoji = parts[0];
        const name = parts.slice(1).join(' ');
        const giftDiv = document.createElement('div');
        giftDiv.className = 'gift-message-block';
        let html = '<div class="gift-emoji-big">' + emoji + '</div>' +
          '<div class="gift-name-big">' + escapeHtml(name) + '</div>' +
          '<div class="gift-label">🎁 ПОДАРОК</div>';
        if (userMsg) html += '<div class="gift-user-msg">💬 ' + escapeHtml(userMsg) + '</div>';
        giftDiv.innerHTML = html;
        div.appendChild(giftDiv);
      } else {
        const span = document.createElement('span');
        span.className = 'msg-text';
        span.innerHTML = highlightMentions(msg.text);
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

function scrollToMessage(id) {
  const el = document.querySelector('.msg-wrap[data-id="' + id + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'background 0.3s';
    el.style.background = 'rgba(139, 127, 255, 0.2)';
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

function showReactionMenu(e, messageId, wrap, isGroup) {
  state.activeReactionMsgId = messageId;
  state.activeReactionGroupId = isGroup && state.currentGroup ? state.currentGroup.id : null;
  const menu = $('reaction-menu');
  if (!menu) return;
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
  const m = $('reaction-menu');
  if (m) m.classList.remove('active');
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
  if (!menu) return;
  const touch = (e.touches && e.touches[0]) || e;
  let x = touch.clientX, y = touch.clientY;
  const isMine = msg.from === state.me.username;
  const editEl = $('action-edit');
  if (editEl) editEl.style.display = (isMine && !msg.voice && !msg.image && !msg.videoCircle && !msg.sticker && msg.text && !msg.geo) ? 'flex' : 'none';
  const delEl = $('action-delete');
  if (delEl) delEl.style.display = isMine ? 'flex' : 'none';
  const pinEl = $('action-pin');
  if (pinEl) pinEl.style.display = msg.isGroup ? 'flex' : 'none';
  const reportBtn = $('action-report');
  if (reportBtn) reportBtn.style.display = isMine ? 'none' : 'flex';
  menu.classList.add('active');
  const rect = menu.getBoundingClientRect();
  const w = rect.width || 200, h = rect.height || 280;
  x = Math.min(Math.max(x - w / 2, 10), window.innerWidth - w - 10);
  y = Math.min(Math.max(y, 10), window.innerHeight - h - 10);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  hideReactionMenu();
}
function hideActionMenu() {
  const m = $('action-menu');
  if (m) m.classList.remove('active');
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
          : (state.activeMessage.videoCircle ? '🎥 Кружок'
            : (state.activeMessage.geo ? '📍 Геолокация' : '')))));
  const rn = $('rp-name'); if (rn) rn.textContent = name;
  const rm = $('rp-msg'); if (rm) rm.textContent = preview;
  const rp = $('reply-preview'); if (rp) rp.classList.add('active');
  const inp = $('msgInput'); if (inp) inp.focus();
  hideActionMenu();
}
function cancelReply() {
  state.replyToMessage = null;
  const rp = $('reply-preview'); if (rp) rp.classList.remove('active');
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
  const t = $('edit-message-text'); if (t) t.value = state.activeMessage.text || '';
  hideActionMenu();
  openModal('edit-message-modal');
}
function doEditMessage() {
  const t = $('edit-message-text');
  if (!t) return;
  const text = t.value.trim();
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
    const pb = $('pinned-bar'); if (pb) pb.classList.add('active');
    const pt = $('pinned-text'); if (pt) pt.textContent = 'Закреплённое сообщение';
    hideActionMenu();
  });
}
function actionReport() {
  if (!state.activeMessage) return;
  const msg = state.activeMessage;
  const isGroup = !!msg.isGroup;
  const target = msg.from;
  openReportModal(target, msg.id, isGroup);
}

document.addEventListener('click', function (e) {
  const rm = $('reaction-menu');
  if (rm && rm.classList.contains('active') && !rm.contains(e.target)) hideReactionMenu();
  const am = $('action-menu');
  if (am && am.classList.contains('active') && !am.contains(e.target)) hideActionMenu();
});

/* ─── СВАЙП-ОТВЕТ ─── */
function bindSwipeReply(msgDiv, wrap, msg) {
  if (msg.deleted || msg.system) return;
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
    self: msg.self, isGroup: msg.isGroup, geo: msg.geo
  };
  const name = msg.self ? 'Я' : displayNameForUser(msg.from);
  const preview = msg.text || (msg.sticker ? 'Стикер' : (msg.image ? '📷 Фото' : (msg.voice ? '🎤 Голосовое' : (msg.videoCircle ? '🎥 Кружок' : (msg.geo ? '📍 Геолокация' : '')))));
  const rn = $('rp-name'); if (rn) rn.textContent = name;
  const rm = $('rp-msg'); if (rm) rm.textContent = preview;
  const rp = $('reply-preview'); if (rp) rp.classList.add('active');
  const inp = $('msgInput'); if (inp) inp.focus();
  vibrate(15);
}

/* ─── ДВОЙНОЙ ТАП ❤️ ─── */
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

var _origRenderMessage = renderMessage;
renderMessage = function (msg) {
  _origRenderMessage(msg);
  if (msg.self) {
    const box = document.getElementById('messages');
    if (!box) return;
    const last = box.lastElementChild;
    if (last && last.dataset.id == msg.id) {
      last.classList.add('just-sent');
      setTimeout(function () { last.classList.remove('just-sent'); }, 600);
    }
  }
};

/* ─── ОТПРАВКА ─── */
function sendMsg() {
  const input = $('msgInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (state.me.mute) {
    showToast('🔇 Ты в муте');
    return;
  }
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
    if (state.isBotChat) el.textContent = 'бот онлайн';
    else el.textContent = contact && contact.online ? 'в сети' : 'был(а) недавно';
    el.classList.remove('typing');
  }
}

function sendPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (state.me.mute) { showToast('🔇 Ты в муте'); event.target.value = ''; return; }
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
  if (state.me.mute) { showToast('🔇 Ты в муте'); return; }
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
      const rb = $('recording-bar'); if (rb) rb.classList.remove('active');
      const mb = $('micBtnInput'); if (mb) mb.classList.remove('recording');
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
    const rb = $('recording-bar'); if (rb) rb.classList.add('active');
    const mb = $('micBtnInput'); if (mb) mb.classList.add('recording');
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
  const rb = $('recording-bar'); if (rb) rb.classList.remove('active');
  const mb = $('micBtnInput'); if (mb) mb.classList.remove('recording');
}
function updateRecordingTimer() {
  const elapsed = Math.round((now() - state.recordingStartTime) / 1000);
  const m = Math.floor(elapsed / 60), s = elapsed % 60;
  const rt = $('recording-time'); if (rt) rt.textContent = m + ':' + s.toString().padStart(2, '0');
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
  if (state.me.mute) { showToast('🔇 Ты в муте'); return; }
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
  if (!preview) return;
  preview.srcObject = state.circleStream;
  preview.muted = true;
  const cp = $('circle-preview'); if (cp) cp.classList.add('active');
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
  const ct = $('circle-timer'); if (ct) ct.textContent = m + ':' + s.toString().padStart(2, '0');
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
  const cp = $('circle-preview'); if (cp) cp.classList.remove('active');
  const pv = $('circle-video-preview'); if (pv) pv.srcObject = null;
  state.circleRecorder = null;
  state.circleChunks = [];
}

/* ─── СТИКЕРЫ ─── */
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
    if (q) items = items.filter(function (s) {
      return ((s.emoji || '').toLowerCase().indexOf(q) !== -1) || ((s.url || '').toLowerCase().indexOf(q) !== -1);
    });
    box.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sticker-grid';
    const addBtn = document.createElement('button');
    addBtn.className = 'sticker-add-btn';
    addBtn.textContent = '+';
    addBtn.onclick = function () {
      const choice = confirm('OK — загрузить видео (MP4/WebM → GIF), Отмена — загрузить картинку');
      if (choice) { const f = $('stickerFileVideo'); if (f) f.click(); }
      else { const f = $('stickerFileImage'); if (f) f.click(); }
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
      const i = $('gif-url-input'); if (i) i.value = '';
      const e = $('gif-url-error'); if (e) e.textContent = '';
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
  if (state.me.mute) { showToast('🔇 Ты в муте'); return; }
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
  const inp = $('gif-url-input');
  if (!inp) return;
  const url = inp.value.trim();
  const errEl = $('gif-url-error');
  if (errEl) errEl.textContent = '';
  if (!url) { if (errEl) errEl.textContent = 'Введи ссылку'; return; }
  if (!/^https?:\/\//i.test(url)) { if (errEl) errEl.textContent = 'Ссылка должна начинаться с http:// или https://'; return; }
  socket.emit('add sticker', { data: url, type: /\.(mp4|webm)(\?|$)/i.test(url) ? 'video' : 'image' }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    state.stickersData.unshift({ id: res.id, url: res.url, type: res.type || 'image', emoji: null, time: now() });
    closeModal('gif-url-modal');
    if (state.stickerCurrentTab !== 'my') switchStickerTab('my');
    else renderStickersContent();
  });
}

/* ─── ГРУППЫ ─── */
function openCreateGroupModal() {
  if (!state.canCreateGroup) { alert('Ты уже создал группу. Максимум — одна.'); return; }
  if (state.contacts.length === 0) { alert('Сначала добавь контакты'); return; }
  state.createSelected.clear();
  const g = $('group-name'); if (g) g.value = '';
  const e = $('create-error'); if (e) e.textContent = '';
  renderCreateMembers();
  openModal('create-group-modal');
}
function renderCreateMembers() {
  const box = $('create-members');
  if (!box) return;
  box.innerHTML = '';
  state.contacts.forEach(function (c) {
    if (c.isBot) return;
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
  const n = $('group-name');
  if (!n) return;
  const name = n.value.trim();
  const errEl = $('create-error');
  if (errEl) errEl.textContent = '';
  if (!name) { if (errEl) errEl.textContent = 'Введи название'; return; }
  if (state.createSelected.size === 0) { if (errEl) errEl.textContent = 'Выбери хотя бы одного'; return; }
  socket.emit('create group', { name: name, members: Array.from(state.createSelected) }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('create-group-modal');
    showToast('✓ Группа создана');
  });
}
function openGroupInfo() {
  if (!state.currentGroup) return;
  const g = state.currentGroup;
  const title = $('group-info-title'); if (title) title.textContent = g.name;
  const desc = $('group-info-desc'); if (desc) desc.textContent = g.description || '';
  const list = $('group-info-members');
  if (list) {
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
  }
  const delBtn = $('delete-group-btn');
  const editBtn = $('edit-group-btn');
  if (g.creator === state.me.username) {
    if (delBtn) delBtn.style.display = 'block';
    if (editBtn) editBtn.style.display = 'block';
  } else {
    if (delBtn) delBtn.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
  }
  openModal('group-info-modal');
}
function openEditGroup() {
  if (!state.currentGroup) return;
  const n = $('edit-group-name'); if (n) n.value = state.currentGroup.name;
  const d = $('edit-group-desc'); if (d) d.value = state.currentGroup.description || '';
  closeModal('group-info-modal');
  openModal('edit-group-modal');
}
function doEditGroup() {
  if (!state.currentGroup) return;
  const n = $('edit-group-name');
  const d = $('edit-group-desc');
  const name = n ? n.value.trim() : '';
  const description = d ? d.value.trim() : '';
  socket.emit('update group', { groupId: state.currentGroup.id, name: name, description: description }, function () {
    closeModal('edit-group-modal');
  });
}
function openAddMembers() {
  closeModal('group-info-modal');
  if (!state.currentGroup) return;
  state.addMembersSelected.clear();
  const errEl = $('add-members-error'); if (errEl) errEl.textContent = '';
  const available = state.contacts.filter(function (c) { return !c.isBot && state.currentGroup.members.indexOf(c.name) === -1; });
  const box = $('add-members-list');
  if (!box) return;
  box.innerHTML = '';
  if (available.length === 0) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Все контакты уже в группе</div>';
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
  if (errEl) errEl.textContent = '';
  if (state.addMembersSelected.size === 0) { if (errEl) errEl.textContent = 'Выбери хотя бы одного'; return; }
  socket.emit('add group members', { groupId: state.currentGroup.id, members: Array.from(state.addMembersSelected) }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
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

/* ─── КАНАЛЫ ─── */
function openCreateChannelModal() {
  if (!state.canCreateChannel) { alert('Ты уже создал канал. Максимум — один.'); return; }
  const s = $('channel-slug'); if (s) s.value = '';
  const n = $('channel-name'); if (n) n.value = '';
  const d = $('channel-desc'); if (d) d.value = '';
  const e = $('create-channel-error'); if (e) e.textContent = '';
  openModal('create-channel-modal');
}
function doCreateChannel() {
  const s = $('channel-slug');
  const n = $('channel-name');
  const d = $('channel-desc');
  if (!s || !n) return;
  const slug = s.value.trim().toLowerCase().replace(/^@/, '');
  const name = n.value.trim();
  const description = d ? d.value.trim() : '';
  const errEl = $('create-channel-error');
  if (errEl) errEl.textContent = '';
  if (!slug) { if (errEl) errEl.textContent = 'Введи ID канала'; return; }
  if (!name) { if (errEl) errEl.textContent = 'Введи название'; return; }
  socket.emit('create channel', { slug: slug, name: name, description: description }, function (res) {
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('create-channel-modal');
    showToast('📢 Канал создан!');
  });
}
function openChannelChat(ch) {
  state.currentChannel = ch;
  state.currentChat = null;
  state.currentGroup = null;
  state.isSavedChat = false;
  state.isBotChat = false;
  removeBotCommandsHint();
  const tn = $('channel-top-name');
  if (tn) tn.innerHTML = escapeHtml(ch.name) + (ch.verified ? ' <span class="verified-badge big">✓</span>' : '');
  const ts = $('channel-top-status'); if (ts) ts.textContent = '@' + ch.slug + ' · ' + ch.memberCount + ' подписчиков';
  const av = $('channel-avatar');
  if (av) {
    if (ch.avatar) { av.style.backgroundImage = 'url(' + ch.avatar + ')'; av.textContent = ''; }
    else { av.style.backgroundImage = ''; av.textContent = '📢'; av.style.background = ''; }
  }
  const cs = $('channel-screen'); if (cs) cs.style.display = 'flex';
  socket.emit('load channel posts', { channelId: ch.id }, function (res) {
    const box = $('channel-posts');
    if (!box) return;
    box.innerHTML = '';
    if (!res || !res.ok) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Не удалось загрузить</div>';
      return;
    }
    if (res.posts.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);font-size:15px;">Пока нет публикаций</div>';
    } else res.posts.forEach(function (p) { renderChannelPost(p); });
  });
  const cia = $('channel-input-area');
  if (cia) cia.style.display = ch.creator === state.me.username ? 'flex' : 'none';
}
function closeChannelChat() {
  const cs = $('channel-screen'); if (cs) cs.style.display = 'none';
  state.currentChannel = null;
}
function renderChannelPost(p) {
  const box = $('channel-posts');
  if (!box) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:18px;padding:14px;background:var(--bg-panel);border-radius:14px;border:1px solid rgba(255,255,255,0.05);';
  let html = '';
  if (p.from_user !== state.me.username) {
    const authorContact = state.contacts.find(function (c) { return c.name === p.from_user; });
    const authorBadges = renderBadges(authorContact || {});
    html += '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 ' + escapeHtml(displayNameForUser(p.from_user)) + ' ' + authorBadges + '</div>';
  } else {
    const myBadges = renderBadges(state.me);
    if (myBadges) html += '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">📢 Я ' + myBadges + '</div>';
  }
  if (p.image) html += '<img src="' + p.image + '" style="max-width:100%;border-radius:14px;margin-bottom:8px;display:block;">';
  if (p.text) html += '<div style="font-size:15px;line-height:1.45;margin-bottom:8px;word-wrap:break-word;">' + highlightMentions(p.text) + '</div>';
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
  if (!input) return;
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
  const t = $('channel-info-title'); if (t) t.textContent = ch.name + (ch.verified ? ' ✓' : '');
  const d = $('channel-info-desc'); if (d) d.textContent = ch.description || '';
  const s = $('channel-info-stats'); if (s) s.innerHTML = '@' + escapeHtml(ch.slug) + '<br>' + ch.memberCount + ' подписчиков';
  const isOwner = ch.creator === state.me.username;
  const ib = $('channel-invite-btn'); if (ib) ib.style.display = isOwner ? 'block' : 'none';
  const eb = $('channel-edit-btn'); if (eb) eb.style.display = isOwner ? 'block' : 'none';
  const db = $('channel-delete-btn'); if (db) db.style.display = isOwner ? 'block' : 'none';
  const lb = $('channel-leave-btn'); if (lb) lb.style.display = isOwner ? 'none' : 'block';
  openModal('channel-info-modal');
}
function createChannelInvite() {
  if (!state.currentChannel) return;
  socket.emit('create channel invite', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    state.currentInviteCode = res.code;
    const c = $('channel-invite-code'); if (c) c.textContent = res.code;
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
  const n = $('edit-channel-name'); if (n) n.value = state.currentChannel.name;
  const d = $('edit-channel-desc'); if (d) d.value = state.currentChannel.description || '';
  closeModal('channel-info-modal');
  openModal('edit-channel-modal');
}
function doEditChannel() {
  if (!state.currentChannel) return;
  const n = $('edit-channel-name');
  const d = $('edit-channel-desc');
  const name = n ? n.value.trim() : '';
  const description = d ? d.value.trim() : '';
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
  const i = $('find-channel-input'); if (i) i.value = '';
  const e = $('find-channel-error'); if (e) e.textContent = '';
  openModal('find-channel-modal');
}
function doFindChannel() {
  const inp = $('find-channel-input');
  if (!inp) return;
  const q = inp.value.trim();
  const errEl = $('find-channel-error');
  if (errEl) errEl.textContent = '';
  if (!q) { if (errEl) errEl.textContent = 'Введи ID или код'; return; }
  if (/^[A-Z0-9]{8,12}$/i.test(q)) {
    socket.emit('resolve channel invite', { code: q }, function (res) {
      if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
      closeModal('find-channel-modal');
      showChannelFoundModal(res.channel);
    });
  } else {
    socket.emit('find channel by slug', { slug: q }, function (res) {
      if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
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
  const i = $('channel-comment-input'); if (i) i.value = '';
  loadChannelComments(postId);
  openModal('channel-comments-modal');
}
function loadChannelComments(postId) {
  socket.emit('load channel comments', { postId: postId }, function (res) {
    const box = $('channel-comments-list');
    if (!box) return;
    if (!res || !res.ok || !res.comments || res.comments.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">Пока нет комментариев</div>';
      return;
    }
    box.innerHTML = '';
    res.comments.forEach(function (c) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:10px 12px;background:var(--bg-input);border-radius:12px;margin-bottom:8px;';
      const cContact = state.contacts.find(function (x) { return x.name === c.from_user; });
      const cBadges = renderBadges(cContact || {});
      div.innerHTML = '<div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:4px;">' + escapeHtml(displayNameForUser(c.from_user)) + ' ' + cBadges + '</div>' +
        '<div style="font-size:14px;word-wrap:break-word;">' + highlightMentions(c.text || '') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + new Date(c.time).toLocaleString('ru-RU') + '</div>';
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}
function submitChannelComment() {
  if (!state.currentChannelPostId) return;
  const input = $('channel-comment-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  socket.emit('create channel comment', { postId: state.currentChannelPostId, text: text }, function (res) {
    if (!res || !res.ok) { alert((res && res.error) || 'Ошибка'); return; }
    input.value = '';
  });
}

/* ─── ПОИСК / ГАЛЕРЕЯ / ОБОИ ─── */
function openSearchInChat() {
  if (!state.currentChat && !state.currentGroup) return;
  const i = $('search-input'); if (i) i.value = '';
  const r = $('search-results'); if (r) r.innerHTML = '';
  openModal('search-modal');
  setTimeout(function () {
    const el = $('search-input'); if (el) el.focus();
  }, 100);
}

document.addEventListener('DOMContentLoaded', function () {
  const si = $('search-input');
  if (si) {
    si.addEventListener('input', function (e) {
      const q = e.target.value.trim();
      const results = $('search-results');
      if (!results) return;
      if (q.length < 2) { results.innerHTML = ''; return; }
      const params = state.currentGroup
        ? { query: q, groupId: state.currentGroup.id }
        : { query: q, withUser: state.currentChat };
      socket.emit('search messages', params, function (res) {
        if (!res || !res.ok || res.results.length === 0) {
          results.innerHTML = '<div style="text-align:center;color:#8b8b94;padding:20px;">Ничего не найдено</div>';
          return;
        }
        results.innerHTML = '';
        res.results.forEach(function (m) {
          const div = document.createElement('div');
          div.className = 'search-result';
          const from = displayNameForUser(m.from_user);
          const time = new Date(m.time).toLocaleString('ru-RU');
          div.innerHTML = '<div class="sr-from">' + escapeHtml(from) + '</div>' +
            '<div class="sr-text">' + highlightMentions(m.text || '') + '</div>' +
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
  const g = $('gallery-content'); if (g) g.innerHTML = '';
  const ge = $('gallery-empty'); if (ge) ge.style.display = 'none';
  openModal('gallery-modal');
  if (state.isSavedChat) socket.emit('load saved history');
  else if (state.currentChat) socket.emit('load history', { withUser: state.currentChat });
  else if (state.currentGroup) socket.emit('load group history', { groupId: state.currentGroup.id });
}
function fillGallery(messages) {
  const box = $('gallery-content');
  const emptyEl = $('gallery-empty');
  if (!box || !emptyEl) return;
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
  const img = $('lightbox-img'); if (img) img.src = src;
  const lb = $('lightbox'); if (lb) lb.classList.add('active');
}

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
  const isPinned = obj && obj.pinned;
  const title = state.currentGroup ? state.currentGroup.name : ((obj && obj.displayName) || state.currentChat);
  const t = $('chat-menu-title'); if (t) t.textContent = title;
  const m = $('chat-menu-mute'); if (m) m.textContent = isMuted ? '🔔 Включить уведомления' : '🔕 Отключить уведомления';
  const p = $('chat-menu-pin'); if (p) p.textContent = isPinned ? '📌 Открепить чат' : '📌 Закрепить чат';
  const a = $('chat-menu-archive'); if (a) a.textContent = isArchived ? '📤 Убрать из архива' : '📦 В архив';
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
function chatMenuTogglePin() {
  const key = currentChatKey();
  if (!key) return;
  socket.emit('toggle pin', { chatKey: key }, function (res) {
    closeModal('chat-menu-modal');
    if (res && res.ok) showToast(res.pinned ? '📌 Чат закреплён' : '📍 Чат откреплён');
  });
}
function openClearHistoryConfirm() { openModal('clear-history-modal'); }
function confirmClearHistory() {
  const withUser = state.currentChat;
  if (!withUser) {
    closeModal('clear-history-modal');
    showToast('⚠️ Очистка доступна только в личных чатах');
    return;
  }
  socket.emit('clear history', { withUser: withUser }, function (res) {
    closeModal('clear-history-modal');
    if (res && res.ok) {
      showToast('🧹 История очищена');
      const box = $('messages');
      if (box) box.innerHTML = '';
      state.lastDateShown = '';
    } else {
      showToast('❌ ' + ((res && res.error) || 'Не удалось'));
    }
  });
}

function getChatWallpaper(chatKey) {
  if (!chatKey) return null;
  return state.chatWallpapers[chatKey] || null;
}
function setChatWallpaper(chatKey, dataUrl) {
  if (!chatKey) return;
  if (dataUrl) state.chatWallpapers[chatKey] = dataUrl;
  else delete state.chatWallpapers[chatKey];
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
    box.style.backgroundRepeat = 'no-repeat';
    box.classList.add('has-wallpaper');
  } else {
    box.style.backgroundImage = '';
    box.style.backgroundSize = '';
    box.style.backgroundPosition = '';
    box.style.backgroundRepeat = '';
    box.classList.remove('has-wallpaper');
  }
}
function openWallpaperPicker() {
  const chatKey = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  if (!chatKey) return;
  const existing = $('wallpaper-modal');
  if (existing) existing.remove();
  const currentWp = getChatWallpaper(chatKey);
  const modal = document.createElement('div');
  modal.id = 'wallpaper-modal';
  modal.className = 'modal active';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px;';
  modal.innerHTML = '<div class="modal-box" style="background:var(--bg-panel);border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:24px;max-width:420px;width:100%;max-height:88vh;overflow-y:auto;animation:modalIn 0.3s var(--ease-spring);">' +
    '<h3 style="margin-bottom:18px;font-size:20px;text-align:center;font-weight:700;">🎨 Обои чата</h3>' +
    '<div id="wallpaper-preview" style="width:100%;height:200px;border-radius:14px;background:var(--bg-input);background-size:cover;background-position:center;margin-bottom:16px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;">' +
      (currentWp ? '' : 'Пока нет обоев') +
    '</div>' +
    '<button class="modal-primary" onclick="document.getElementById(\'wallpaper-file\').click()" style="width:100%;padding:14px;margin-bottom:10px;border-radius:14px;background:var(--accent);color:#fff;font-size:15px;font-weight:600;border:none;cursor:pointer;">📷 Выбрать из галереи</button>' +
    '<button class="modal-secondary" onclick="removeChatWallpaper()" style="width:100%;padding:14px;margin-bottom:10px;border-radius:14px;background:var(--bg-input);color:inherit;font-size:15px;font-weight:600;border:none;cursor:pointer;">🗑 Убрать обои</button>' +
    '<button class="modal-secondary" onclick="document.getElementById(\'wallpaper-modal\').remove()" style="width:100%;padding:14px;border-radius:14px;background:var(--bg-input);color:inherit;font-size:15px;font-weight:600;border:none;cursor:pointer;">Отмена</button>' +
    '<input type="file" id="wallpaper-file" accept="image/*" style="display:none" />' +
  '</div>';
  document.body.appendChild(modal);
  if (currentWp) {
    const preview = modal.querySelector('#wallpaper-preview');
    if (preview) {
      preview.style.backgroundImage = 'url(' + currentWp + ')';
      preview.textContent = '';
    }
  }
  const wf = modal.querySelector('#wallpaper-file');
  if (wf) {
    wf.addEventListener('change', function (e) {
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
          const preview = modal.querySelector('#wallpaper-preview');
          if (preview) {
            preview.style.backgroundImage = 'url(' + dataUrl + ')';
            preview.textContent = '';
          }
          setChatWallpaper(chatKey, dataUrl);
          showToast('🎨 Обои установлены');
          vibrate(15);
          setTimeout(function () { modal.remove(); }, 500);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.remove();
  });
}
function removeChatWallpaper() {
  const chatKey = state.currentChat || (state.currentGroup ? 'g:' + state.currentGroup.id : null);
  if (!chatKey) return;
  setChatWallpaper(chatKey, null);
  showToast('🎨 Обои удалены');
  vibrate(10);
  const modal = $('wallpaper-modal');
  if (modal) modal.remove();
}

/* ─── ИСТОРИИ ─── */
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
  const minePremiumClass = state.me.premium ? ' premium' : '';
  mineBubble.innerHTML = '<div class="story-ring mine ' + (mineHasStory ? 'has-story' : '') + minePremiumClass + '">' +
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
    const premiumClass = u.premium && !allViewed ? ' premium' : '';
    bubble.innerHTML = '<div class="story-ring ' + (allViewed ? 'viewed' : '') + premiumClass + '">' +
      '<div class="story-ring-inner" style="' + avs + '">' + avc + '</div></div>' +
      '<div class="story-name">' + escapeHtml(displayName) + '</div>';
    bubble.onclick = function () { openStoryViewer(idx, 0); };
    row.appendChild(bubble);
  });
}
function openStoryAddModal() {
  const f = $('story-file'); if (f) f.value = '';
  const pw = $('story-preview-wrap'); if (pw) pw.style.display = 'none';
  const ci = $('story-caption-input'); if (ci) ci.value = '';
  const e = $('story-add-error'); if (e) e.textContent = '';
  const sb = $('story-submit-btn');
  if (sb) { sb.disabled = true; sb.textContent = '📤 Опубликовать'; }
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
      const pi = $('story-preview-img'); if (pi) pi.src = dataUrl;
      const pw = $('story-preview-wrap'); if (pw) pw.style.display = 'block';
      const sb = $('story-submit-btn'); if (sb) sb.disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function submitStory() {
  if (!window._storyImageData) return;
  const ci = $('story-caption-input');
  const caption = ci ? ci.value.trim() : '';
  const errEl = $('story-add-error');
  if (errEl) errEl.textContent = '';
  const sb = $('story-submit-btn');
  if (sb) { sb.disabled = true; sb.textContent = 'Публикую…'; }
  socket.emit('post story', { image: window._storyImageData, caption: caption }, function (res) {
    if (sb) { sb.textContent = '📤 Опубликовать'; sb.disabled = false; }
    if (!res || !res.ok) { if (errEl) errEl.textContent = (res && res.error) || 'Ошибка'; return; }
    closeModal('story-add-modal');
    window._storyImageData = null;
    loadStories();
  });
}
function openStoryViewer(userIdx, storyIdx) {
  if (!state.storiesUsers[userIdx] || !state.storiesUsers[userIdx].stories[storyIdx]) return;
  state.currentStoryUserIdx = userIdx;
  state.currentStoryIdx = storyIdx;
  const sv = $('story-viewer'); if (sv) sv.classList.add('active');
  renderCurrentStory();
  startStoryTimer();
}
function renderCurrentStory() {
  const u = state.storiesUsers[state.currentStoryUserIdx];
  if (!u) return closeStoryViewer();
  const s = u.stories[state.currentStoryIdx];
  if (!s) return closeStoryViewer();
  const bar = $('story-progress-bar');
  if (bar) {
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
  }
  const av = $('story-avatar');
  if (av) {
    if (u.avatar) { av.style.backgroundImage = 'url(' + u.avatar + ')'; av.textContent = ''; }
    else {
      av.style.backgroundImage = '';
      av.textContent = initials(u.firstName || u.username);
      av.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)';
    }
    av.classList.toggle('premium', !!u.premium);
  }
  const displayName = (u.firstName || u.lastName)
    ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim()
    : u.username;
  const sn = $('story-name'); if (sn) sn.textContent = displayName;
  const st = $('story-time'); if (st) st.textContent = timeAgo(s.time);
  const si = $('story-image'); if (si) si.src = s.image;
  const cap = $('story-caption');
  if (cap) {
    if (s.caption) { cap.textContent = s.caption; cap.classList.add('show'); }
    else cap.classList.remove('show');
  }
  const isMine = u.username === state.me.username;
  const delBtn = $('story-delete-btn');
  const viewsBtn = $('story-views-btn');
  if (isMine) {
    if (delBtn) delBtn.style.display = 'flex';
    if (viewsBtn) {
      viewsBtn.style.display = 'flex';
      socket.emit('get story views', { storyId: s.id }, function (res) {
        if (res && res.ok) viewsBtn.textContent = '👁 ' + res.viewers.length;
      });
    }
  } else {
    if (delBtn) delBtn.style.display = 'none';
    if (viewsBtn) viewsBtn.style.display = 'none';
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
  const sv = $('story-viewer'); if (sv) sv.classList.remove('active');
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
    if (!box) return;
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

/* ─── ЗВОНКИ ─── */
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
  if (state.isBotChat) { showToast('🤖 Ботам нельзя звонить'); return; }
  if (state.me.mute) { showToast('🔇 Ты в муте — звонки недоступны'); return; }
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
    const rv = $('remoteVideo'); if (rv) rv.srcObject = e.streams[0];
    const rw = $('remote-video-wrap'); if (rw) rw.classList.remove('audio-only');
    const ab = $('call-avatar-big'); if (ab) ab.style.display = 'none';
    const st = $('call-status'); if (st) st.textContent = 'В разговоре';
    if (!state.callTimerInterval) startCallTimer();
  };
  const offer = await state.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
  await state.peerConnection.setLocalDescription(offer);
  socket.emit('call-user', { to: state.currentChat, offer: offer, video: video });
}
function showCallScreen(peerName, contact, video, statusText) {
  const badges = renderBadgesBig(contact || {});
  const displayName = (contact && contact.displayName) || peerName;
  const pn = $('call-peer-name'); if (pn) pn.innerHTML = escapeHtml(displayName) + ' ' + badges;
  const st = $('call-status'); if (st) st.textContent = statusText;
  const cs = $('call-screen'); if (cs) cs.classList.add('active');
  const lw = $('local-video-wrap');
  if (video && state.localStream) {
    if (lw) lw.classList.add('active');
    const lv = $('localVideo'); if (lv) lv.srcObject = state.localStream;
  } else if (lw) lw.classList.remove('active');
  const ba = $('call-avatar-big');
  const rw = $('remote-video-wrap');
  if (video) {
    if (rw) rw.classList.remove('audio-only');
    if (ba) ba.style.display = 'none';
  } else {
    if (rw) rw.classList.add('audio-only');
    if (ba) {
      ba.style.display = 'flex';
      ba.classList.toggle('premium', !!(contact && contact.premium));
      if (contact && contact.avatar) {
        ba.style.backgroundImage = 'url(' + contact.avatar + ')';
        ba.textContent = '';
      } else {
        ba.style.backgroundImage = '';
        ba.textContent = initials(displayName);
        ba.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)';
      }
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
  const badges = renderBadgesBig(contact || {});
  const iname = $('incoming-name'); if (iname) iname.innerHTML = escapeHtml(displayName) + ' ' + badges;
  const itype = $('incoming-type'); if (itype) itype.textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';
  const av = $('incoming-avatar');
  if (av) {
    av.classList.toggle('premium', !!(contact && contact.premium));
    if (contact && contact.avatar) {
      av.style.backgroundImage = 'url(' + contact.avatar + ')';
      av.textContent = '';
    } else {
      av.style.backgroundImage = '';
      av.textContent = initials(displayName);
      av.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)';
    }
  }
  const is = $('incoming-screen'); if (is) is.classList.add('active');
  playPing();
  vibrate();
});
function declineIncoming() {
  const is = $('incoming-screen'); if (is) is.classList.remove('active');
  if (state.incomingFrom) socket.emit('end-call', { to: state.incomingFrom });
  state.pendingOffer = null;
  state.incomingFrom = null;
}
async function acceptIncoming() {
  const is = $('incoming-screen'); if (is) is.classList.remove('active');
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
    const rv = $('remoteVideo'); if (rv) rv.srcObject = e.streams[0];
    const rw = $('remote-video-wrap'); if (rw) rw.classList.remove('audio-only');
    const ab = $('call-avatar-big'); if (ab) ab.style.display = 'none';
    const st = $('call-status'); if (st) st.textContent = 'В разговоре';
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
    const st = $('call-status'); if (st) st.textContent = 'В разговоре';
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
  const cs = $('call-screen'); if (cs) cs.classList.remove('active');
  const is = $('incoming-screen'); if (is) is.classList.remove('active');
  const lv = $('localVideo'); if (lv) lv.srcObject = null;
  const rv = $('remoteVideo'); if (rv) rv.srcObject = null;
  const lw = $('local-video-wrap'); if (lw) lw.classList.remove('active');
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

/* ─── SOCKET LISTENERS ─── */
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

socket.on('history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (data.withUser !== state.currentChat) return;
  const box = $('messages');
  if (!box) return;
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user, to: m.to_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      geo: (m.geo_lat != null && m.geo_lng != null) ? { lat: m.geo_lat, lng: m.geo_lng, label: m.geo_label } : null,
      reactions: m.reactions || {}, time: m.time,
      self: m.from_user === state.me.username,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted, read: !!m.read_at,
      system: !!m.system, systemType: m.system_type
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('saved history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (!state.isSavedChat) return;
  const box = $('messages');
  if (!box) return;
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user, to: m.to_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      geo: (m.geo_lat != null && m.geo_lng != null) ? { lat: m.geo_lat, lng: m.geo_lng, label: m.geo_label } : null,
      reactions: m.reactions || {}, time: m.time, self: true,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted,
      system: !!m.system, systemType: m.system_type
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('group history', function (data) {
  if (state.galleryWaiting) { fillGallery(data.messages); state.galleryWaiting = false; return; }
  if (!state.currentGroup || state.currentGroup.id !== data.groupId) return;
  const box = $('messages');
  if (!box) return;
  box.innerHTML = '';
  state.lastDateShown = '';
  data.messages.forEach(function (m) {
    renderMessage({
      id: m.id, from: m.from_user,
      text: m.text, image: m.image, sticker: m.sticker,
      voice: m.voice, voiceDuration: m.voice_duration,
      videoCircle: m.video_circle, videoDuration: m.video_duration,
      geo: (m.geo_lat != null && m.geo_lng != null) ? { lat: m.geo_lat, lng: m.geo_lng, label: m.geo_label } : null,
      reactions: m.reactions || {}, time: m.time,
      self: m.from_user === state.me.username,
      senderName: displayNameForUser(m.from_user),
      isGroup: true,
      replyData: m.replyData,
      edited: !!m.edited, deleted: !!m.deleted,
      system: !!m.system, systemType: m.system_type
    });
  });
  box.scrollTop = box.scrollHeight;
});

socket.on('history cleared', function (data) {
  const box = $('messages');
  if (box) box.innerHTML = '';
  state.lastDateShown = '';
  if (data && data.by && data.by !== state.me.username) {
    showToast('🧹 ' + displayNameForUser(data.by) + ' очистил(а) историю');
  }
});

socket.on('private message', function (data) {
  const isSavedMsg = data.from === state.me.username && data.to === state.me.username;

  if (data.self && state.currentChat === data.to && !isSavedMsg) {
    renderMessage({
      id: data.id, from: state.me.username, to: data.to,
      text: data.text, image: data.image, sticker: data.sticker,
      voice: data.voice, voiceDuration: data.voiceDuration,
      videoCircle: data.videoCircle, videoDuration: data.videoDuration,
      geo: data.geo || null,
      reactions: data.reactions || {}, time: data.time,
      self: true, replyData: data.replyData, read: false
    });
  } else if (data.self && state.isSavedChat && isSavedMsg) {
    renderMessage({
      id: data.id, from: state.me.username, to: state.me.username,
      text: data.text, image: data.image, sticker: data.sticker,
      voice: data.voice, voiceDuration: data.voiceDuration,
      videoCircle: data.videoCircle, videoDuration: data.videoDuration,
      geo: data.geo || null,
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
        geo: data.geo || null,
        reactions: data.reactions || {}, time: data.time,
        self: false, replyData: data.replyData,
        system: !!data.system, systemType: data.systemType
      });
      clearUnread(data.from);
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
      if (data.geo) preview = '📍 Геолокация';
      if (data.system) preview = data.text || 'Звонок';
      const isBotMsg = c && c.isBot;
      showBrowserNotification((isBotMsg ? '🤖 ' : '') + displayNameForUser(data.from), preview);
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
  if (ts) ts.innerHTML = highlightMentions(data.text);
});
socket.on('message deleted', function (data) {
  const wrap = document.querySelector('.msg-wrap[data-id="' + data.messageId + '"]');
  if (!wrap) return;
  const msgEl = wrap.querySelector('.msg');
  if (msgEl) {
    msgEl.classList.add('deleted');
    msgEl.innerHTML = '<i>Сообщение удалено</i>';
  }
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
      geo: data.geo || null,
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
        geo: data.geo || null,
        reactions: data.reactions || {}, time: data.time,
        self: false, senderName: displayNameForUser(data.from), isGroup: true, replyData: data.replyData
      });
      clearUnread('g:' + data.groupId);
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
      if (data.geo) preview = '📍 Геолокация';
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
  if (!el) return;
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
      if (!box) return;
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
    if (!box) return;
    box.innerHTML = '';
    res.posts.forEach(function (p) { renderChannelPost(p); });
  });
});
socket.on('channel post reaction', function () {
  if (!state.currentChannel) return;
  socket.emit('load channel posts', { channelId: state.currentChannel.id }, function (res) {
    if (!res || !res.ok) return;
    const box = $('channel-posts');
    if (!box) return;
    box.innerHTML = '';
    res.posts.forEach(function (p) { renderChannelPost(p); });
  });
});
socket.on('channel comment new', function (data) {
  const ccm = $('channel-comments-modal');
  if (ccm && ccm.classList.contains('active') && state.currentChannelPostId === data.postId) {
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
  const sv = $('story-viewer');
  if (sv && sv.classList.contains('active')) {
    if (!state.storiesUsers[state.currentStoryUserIdx]) return closeStoryViewer();
    renderCurrentStory();
    startStoryTimer();
  }
});

socket.on('settings', function (s) {
  state.settings = s || {};
  if (state.settings.stars !== undefined) state.me.stars = Number(state.settings.stars);
  saveJson(STORAGE.SETTINGS, state.settings);
  applyLocalSettings();
  const ss = $('settings-screen');
  if (ss && ss.classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});
socket.on('stars updated', function (data) {
  state.me.stars = Number((data && data.stars) || 0);
  const b = $('gifts-catalog-balance');
  if (b) b.textContent = state.me.stars;
  const ss = $('settings-screen');
  if (ss && ss.classList.contains('active')) renderSettings();
  if (state.activeTab === 'settings') renderSettingsTab();
});
socket.on('me updated', function (data) {
  if (data.premium !== undefined) state.me.premium = !!data.premium;
  if (data.verified !== undefined) state.me.verified = !!data.verified;
  if (data.hammer !== undefined) state.me.hammer = !!data.hammer;
  if (data.scam !== undefined) state.me.scam = !!data.scam;
  if (data.avatar) state.me.avatar = data.avatar;
  if (data.banner !== undefined) state.me.banner = data.banner;
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
socket.on('friend updated', function (data) {
  if (!data || !data.username) return;
  const c = state.contacts.find(function (x) { return x.name === data.username; });
  if (c) {
    if (data.premium !== undefined) c.premium = !!data.premium;
    if (data.verified !== undefined) c.verified = !!data.verified;
    if (data.hammer !== undefined) c.hammer = !!data.hammer;
    if (data.scam !== undefined) c.scam = !!data.scam;
    if (data.avatar !== undefined) c.avatar = data.avatar;
    if (data.banner !== undefined) c.banner = data.banner;
    saveJson(STORAGE.CONTACTS_CACHE, state.contacts);
    renderChatList();
    if (state.activeTab === 'contacts') renderContactsTab();
    if (state.currentChat === data.username) {
      const badges = renderBadgesBig(c);
      const displayName = c.displayName || c.name;
      const nameEl = $('chat-top-name');
      if (nameEl) nameEl.innerHTML = escapeHtml(displayName) + ' ' + badges;
      const av = $('chat-avatar');
      if (av) av.classList.toggle('premium', !!c.premium);
    }
  }
});

socket.on('mentioned', function (data) {
  playPing();
  vibrate([40, 30, 40]);
  const fromName = displayNameForUser(data.from);
  const preview = data.text || '';
  if (data.groupId) {
    showToast('📣 ' + fromName + ' упомянул(а) тебя в «' + (data.groupName || 'группе') + '»');
  } else {
    showToast('📣 ' + fromName + ' упомянул(а) тебя');
  }
  showBrowserNotification('📣 Упоминание от ' + fromName, preview);
});

socket.on('achievement unlocked', function (data) {
  playPing();
  vibrate([50, 30, 50]);
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;top:calc(70px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%) translateY(-20px);background:var(--bg-panel);border:1px solid var(--accent);border-radius:18px;padding:16px 22px;display:flex;align-items:center;gap:14px;z-index:99999;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(139,127,255,0.35);opacity:0;transition:all 0.4s cubic-bezier(0.34,1.4,0.64,1);max-width:calc(100vw - 40px);';
  card.innerHTML = '<div style="font-size:36px;line-height:1;">' + (data.emoji || '🏆') + '</div>' +
    '<div>' +
      '<div style="font-size:11px;color:var(--accent);font-weight:700;letter-spacing:1px;">🏆 ДОСТИЖЕНИЕ</div>' +
      '<div style="font-size:15px;font-weight:700;margin-top:2px;">' + escapeHtml(data.name || '') + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);">+5 ⭐</div>' +
    '</div>';
  document.body.appendChild(card);
  requestAnimationFrame(function () {
    card.style.opacity = '1';
    card.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(function () {
    card.style.opacity = '0';
    card.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(function () { if (card.parentNode) card.remove(); }, 400);
  }, 3200);
});

socket.on('gift received', function (payload) {
  const giftKey = payload.gift_key || payload.giftKey;
  const gift = state.giftsCatalog[giftKey];
  const fromUser = payload.from_user || payload.from;
  const contact = state.contacts.find(function (c) { return c.name === fromUser; });
  const fromName = (contact && contact.displayName) || fromUser;
  if (gift) {
    let toast = '🎁 ' + fromName + ' подарил: ' + gift.emoji + ' ' + gift.name + '!';
    if (payload.gift_message) toast += '\n💬 ' + payload.gift_message;
    showToast(toast);
    playPing();
    vibrate();
  } else {
    showToast('🎁 ' + fromName + ' подарил подарок!');
    socket.emit('get gifts catalog', function (r) {
      if (r && r.ok) state.giftsCatalog = r.catalog || {};
    });
  }
});
socket.on('my gifts updated', function () {
  const mgm = $('my-gifts-modal');
  if (mgm && mgm.classList.contains('active')) openMyGifts();
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

/* ─── ИНИЦИАЛИЗАЦИЯ ─── */
window.addEventListener('load', function () {
  try {
    loadUnread();
    initNotifications();
    showChatListSkeleton();

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

    bindRipples();

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

    const creds = loadJson(STORAGE.SESSION);
    if (!creds || !creds.sessionId) {
      hideSplash();
      const auth = $('auth'); if (auth) auth.classList.add('active');
    }
  } catch (e) {
    console.error('Init error:', e);
    hideSplash();
    const auth = $('auth'); if (auth) auth.classList.add('active');
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(function (m) { m.classList.remove('active'); });
    hideReactionMenu();
    hideActionMenu();
  }
});

console.log('✅ Azerta v13.6 — Client загружен');
console.log('📍 Геолокация: send geo');
console.log('🚨 Жалобы: report, resolve report');
console.log('🛡️  Модерация: openModPanel, ban/mute/warn user');
console.log('✓ ГОТОВО');
