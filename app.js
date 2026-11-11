'use strict';

/* ═══════════════════════════════════════════════════════════
   🌌 AZERTA v22.0 — FINAL CLIENT (Stable Release)
   ═══════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const socket = io();
const api = (ev, payload, cb) => socket.emit(ev, payload, typeof cb === 'function' ? cb : () => {});
let state = { me: {}, contacts: [], settings: {}, unread: {}, currentChat: null };

// Утилиты
function hideSplash() { const sp = $('splash-screen'); if (sp) { sp.style.opacity = '0'; setTimeout(() => sp.remove(), 300); } }
setTimeout(hideSplash, 1500);

function openModal(id) { const m = $(id); if (m) m.classList.add('active'); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove('active'); }
function toast(text) { alert(text); } // Просто алерт для надежности

// ─── 1. Авторизация ───
window.doLogin = function() {
  const u = $('login-username').value.trim().toLowerCase();
  const p = $('login-password').value;
  if (!u || !p) return alert('Заполни поля');
  
  api('login', { username: u, password: p }, (res) => {
    if (res && res.ok) {
      localStorage.setItem('aurora-session', JSON.stringify({ username: res.username, sessionId: res.sessionId }));
      enterApp(res);
    } else {
      alert(res?.error || 'Ошибка');
    }
  });
};

async function tryAutoLogin() {
  const saved = localStorage.getItem('aurora-session');
  if (!saved) return false;
  try {
    const creds = JSON.parse(saved);
    return new Promise(res => {
      api('login with session', { sessionId: creds.sessionId }, (r) => {
        if (r && r.ok) { enterApp(r); res(true); }
        else { res(false); }
      });
    });
  } catch { return false; }
}

function enterApp(res) {
  Object.assign(state.me, res);
  $('auth').classList.remove('active');
  $('app').classList.add('active');
  hideSplash();
  loadContacts();
}

// ─── 2. Контакты и Чаты ───
function loadContacts() {
  api('get contacts', (list) => {
    state.contacts = list || [];
    renderChatList();
  });
}

function renderChatList() {
  const box = $('chat-list'); if (!box) return;
  box.innerHTML = '';
  
  // Избранное
  const saved = document.createElement('div');
  saved.className = 'chat-item';
  saved.innerHTML = `<div class="avatar saved">⭐</div><div class="chat-info"><div class="chat-name">Избранное</div><div class="chat-preview">Сохранённые</div></div>`;
  saved.onclick = () => openChat('__saved__');
  box.appendChild(saved);

  // Личные
  if (state.contacts.length) {
    const h = document.createElement('div');
    h.className = 'section-header';
    h.textContent = 'ЛИЧНЫЕ';
    box.appendChild(h);

    state.contacts.forEach(u => {
      const div = document.createElement('div');
      div.className = 'chat-item';
      const style = u.avatar ? `background-image:url(${u.avatar})` : 'background:var(--accent)';
      const content = u.avatar ? '' : (u.displayName ? u.displayName[0] : '?');
      div.innerHTML = `<div class="avatar" style="${style}">${content}</div><div class="chat-info"><div class="chat-name">${u.displayName || u.name}</div><div class="chat-preview">${u.online ? 'в сети' : 'был(а) недавно'}</div></div>`;
      div.onclick = () => openChat(u.name);
      box.appendChild(div);
    });
  }
}

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
        const d = document.createElement('div');
        d.className = `msg-wrap ${isSelf ? 'self' : 'other'}`;
        d.innerHTML = `<div class="msg ${isSelf ? 'self' : 'other'}">${m.text}</div>`;
        box.appendChild(d);
      });
      box.scrollTop = box.scrollHeight;
    }
  });
}

window.closeChat = function() { $('chat-screen').classList.remove('active'); state.currentChat = null; };

window.sendMsg = function() {
  const text = $('msgInput').value.trim();
  if (!text || !state.currentChat) return;
  const to = state.currentChat === '__saved__' ? state.me.username : state.currentChat;
  api('private message', { to, text });
  $('msgInput').value = '';
};

// ─── 3. Настройки ───
window.openSettings = function() {
  $('settings-screen').classList.add('active');
  renderSettings();
};

window.closeSettings = function() {
  $('settings-screen').classList.remove('active');
};

function renderSettings() {
  const box = $('settings-content');
  const me = state.me;
  
  box.innerHTML = `
    <div class="settings-profile-card-tg" onclick="openModal('profile-modal')">
      <div class="tg-profile-row">
        <div class="tg-profile-avatar" style="${me.avatar ? `background-image:url(${me.avatar})` : ''}">${me.avatar ? '' : '👤'}</div>
        <div class="tg-profile-info">
          <div class="tg-profile-name">${me.firstName || me.username || 'Профиль'}</div>
          <div class="tg-profile-username">@${me.username || ''}</div>
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
  const data = {
    firstName: $('my-first-name').value.trim(),
    lastName: $('my-last-name').value.trim(),
    bio: $('my-bio').value.trim()
  };
  api('update profile', data, (res) => {
    if (res && res.ok) {
      Object.assign(state.me, data);
      closeModal('profile-modal');
      renderSettings();
      alert('Сохранено');
    }
  });
};

window.pickAvatarMedia = function() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
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
        closeModal('profile-modal');
        alert('Аватар обновлён');
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  };
  input.click();
};

window.changeTheme = function() {
  const v = state.settings.theme === 'light' ? 'dark' : 'light';
  api('update settings', { key: 'theme', value: v }, () => {
    state.settings.theme = v;
    document.body.classList.toggle('light', v === 'light');
    renderSettings();
  });
};

window.logout = function() {
  if (confirm('Выйти?')) { localStorage.clear(); location.reload(); }
};

window.switchTab = function(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
  $('tab-' + tab)?.classList.add('active');
  
  if (tab === 'chats') {
    $('chat-list').style.display = 'block';
    $('search-wrap').style.display = 'block';
  } else {
    $('chat-list').style.display = 'none';
    $('search-wrap').style.display = 'none';
    if (tab === 'settings') openSettings();
  }
};

window.togglePassword = function(id) {
  const i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password';
};

// ─── 4. Приём событий ───
socket.on('private message', (data) => {
  if (state.currentChat === data.from && !data.self) {
    const box = $('messages');
    const d = document.createElement('div');
    d.className = 'msg-wrap other';
    d.innerHTML = `<div class="msg other">${data.text}</div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }
});

socket.on('contacts', (list) => {
  state.contacts = list || [];
  renderChatList();
});

// ─── 5. Запуск ───
window.addEventListener('load', async () => {
  const ok = await tryAutoLogin();
  if (!ok) {
    $('auth').classList.add('active');
    hideSplash();
  }
});