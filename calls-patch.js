'use strict';

/* ═══════════════════════════════════════════════════════════
   📞 AZERTA — calls.js v3 (fixed compatibility with app.js)
   ═══════════════════════════════════════════════════════════ */

(function () {
  if (typeof state === 'undefined' || typeof socket === 'undefined') {
    console.error('❌ calls.js: app.js не загружен');
    return;
  }

  // ─── Helpers (универсальные, чтобы работать и со старым app.js, и с новым) ───
  const $id = (id) => document.getElementById(id);
  const _toast = (msg) => {
    if (typeof toast === 'function') toast(msg);
    else if (typeof showToast === 'function') showToast(msg);
    else console.log('TOAST:', msg);
  };
  const _vib = (ms) => {
    if (typeof vib === 'function') vib(ms);
    else if (typeof vibrate === 'function') vibrate(ms);
  };
  const _esc = (s) => {
    if (typeof esc === 'function') return esc(s);
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  };
  const _initials = (n) => {
    if (typeof initials === 'function') return initials(n);
    return String(n || '?').slice(0, 2).toUpperCase();
  };
  const _badgesBig = (u) => (typeof renderBadgesBig === 'function' ? renderBadgesBig(u) : '');
  const _ping = () => { if (typeof playPing === 'function') playPing(); };

  // ─── Конфиг WebRTC ───
  window.RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      // TURN fallback (нужен для симметричного NAT)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // ─── ICE-очередь (привязана к peerConnection) ───
  const iceQueue = new WeakMap(); // pc → { pending: [], remoteSet: bool }
  function q(pc) {
    if (!iceQueue.has(pc)) iceQueue.set(pc, { pending: [], remoteSet: false });
    return iceQueue.get(pc);
  }
  function flushIce(pc) {
    const st = q(pc);
    if (!st.remoteSet) return;
    st.pending.forEach(c => {
      pc.addIceCandidate(c).catch(e => {
        if (e.name !== 'InvalidStateError') console.warn('addIce:', e);
      });
    });
    st.pending = [];
  }

  // ─── Вспомогательные: показать экран звонка ───
  function showCallScreenCompat(peerName, contact, video, statusText) {
    if (typeof showCallScreen === 'function') {
      showCallScreen(peerName, contact, video, statusText);
      return;
    }
    // Fallback, если showCallScreen переименована
    const pn = $id('call-peer-name');
    if (pn) pn.innerHTML = _esc(contact?.displayName || peerName) + ' ' + _badgesBig(contact || {});
    const st = $id('call-status');
    if (st) st.textContent = statusText;
    $id('call-screen')?.classList.add('active');
    const lw = $id('local-video-wrap');
    if (video && state.localStream) {
      lw?.classList.add('active');
      const lv = $id('localVideo');
      if (lv) lv.srcObject = state.localStream;
    } else lw?.classList.remove('active');
    const ba = $id('call-avatar-big');
    const rw = $id('remote-video-wrap');
    if (video) {
      rw?.classList.remove('audio-only');
      if (ba) ba.style.display = 'none';
    } else {
      rw?.classList.add('audio-only');
      if (ba) {
        ba.style.display = 'flex';
        ba.classList.toggle('premium', !!contact?.premium);
        if (contact?.avatar) {
          ba.style.backgroundImage = `url(${contact.avatar})`;
          ba.textContent = '';
        } else {
          ba.style.backgroundImage = '';
          ba.textContent = _initials(contact?.displayName || peerName);
          ba.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)';
        }
      }
    }
    if (typeof updateCallButtons === 'function') updateCallButtons();
  }

  function bindPeerEvents(pc, isCaller) {
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const to = isCaller ? state.currentChat : state.incomingFrom;
      socket.emit('ice-candidate', { to, candidate: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      console.log('🔌 ICE:', st);
      const stEl = $id('call-status');
      if (st === 'failed') {
        if (stEl) stEl.textContent = '❌ Соединение не установлено';
        _toast('❌ P2P заблокирован. Нужен TURN или VPN.');
        // Попытка restartIce (современные браузеры)
        try { pc.restartIce(); } catch {}
      } else if (st === 'disconnected') {
        if (stEl) stEl.textContent = '⚠️ Связь прервалась';
      } else if (st === 'connected' || st === 'completed') {
        if (stEl) stEl.textContent = 'В разговоре';
      }
    };

    pc.ontrack = (e) => {
      console.log('📹 track:', e.track.kind);
      const rv = $id('remoteVideo');
      if (rv) {
        rv.srcObject = e.streams[0];
        $id('remote-video-wrap')?.classList.remove('audio-only');
        const ab = $id('call-avatar-big');
        if (ab) ab.style.display = 'none';
      }
      if (typeof startCallTimer === 'function' && !state.callTimerInterval) {
        startCallTimer();
      }
    };
  }

  async function askMedia(video) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: video ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
    } catch (err) {
      console.error('❌ getUserMedia:', err);
      let msg = 'Не удалось получить доступ';
      if (err.name === 'NotAllowedError') msg = '🚫 Доступ запрещён. Разреши камеру/микрофон.';
      else if (err.name === 'NotFoundError') msg = '🎤 Устройство не найдено';
      else if (err.name === 'NotReadableError') msg = '⚠️ Устройство занято';
      else if (err.name === 'SecurityError') msg = '🔒 Нужен HTTPS';
      alert(msg);
      return null;
    }
  }

  // ─── Исходящий звонок ───
  window.startCall = async function (video) {
    if (!state.currentChat || state.callActive) return;
    if (state.isBotChat) { _toast('🤖 Ботам нельзя звонить'); return; }
    if (state.me.mute) { _toast('🔇 Ты в муте'); return; }

    const contact = state.contacts.find(c => c.name === state.currentChat);
    if (contact && !contact.online) {
      alert((contact.displayName || state.currentChat) + ' не в сети.');
      return;
    }

    const stream = await askMedia(video);
    if (!stream) return;

    state.localStream = stream;
    state.callActive = true;
    state.micOn = true;
    state.camOn = !!video;

    showCallScreenCompat(state.currentChat, contact, video, 'Вызов...');

    const pc = new RTCPeerConnection(window.RTC_CONFIG);
    state.peerConnection = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    bindPeerEvents(pc, true);

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
      await pc.setLocalDescription(offer);
      socket.emit('call-user', { to: state.currentChat, offer, video });
      console.log('📤 offer sent');
    } catch (err) {
      console.error('❌ offer:', err);
      alert('Ошибка: ' + err.message);
      window.cleanupCall();
    }
  };

  // ─── Входящий звонок ───
  window.acceptIncoming = async function () {
    $id('incoming-screen')?.classList.remove('active');
    if (!state.pendingOffer || !state.incomingFrom) return;

    const from = state.incomingFrom;
    const video = state.incomingVideo;
    const offer = state.pendingOffer;
    state.pendingOffer = null;
    state.incomingFrom = null;
    state.currentChat = from;

    const stream = await askMedia(video);
    if (!stream) { socket.emit('end-call', { to: from }); return; }

    state.localStream = stream;
    state.callActive = true;
    state.micOn = true;
    state.camOn = !!video;

    const contact = state.contacts.find(c => c.name === from);
    showCallScreenCompat(from, contact, video, 'Соединение...');

    const pc = new RTCPeerConnection(window.RTC_CONFIG);
    state.peerConnection = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    bindPeerEvents(pc, false);

    try {
      await pc.setRemoteDescription(offer);
      q(pc).remoteSet = true;
      flushIce(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer-call', { to: from, answer });
      console.log('📤 answer sent');
    } catch (err) {
      console.error('❌ answer:', err);
      alert('Ошибка: ' + err.message);
      window.cleanupCall();
    }
  };

  // ─── Cleanup ───
  window.cleanupCall = function () {
    state.callActive = false;
    if (typeof stopCallTimer === 'function') stopCallTimer();
    clearTimeout(window._gtt); window._gtt = null;

    if (state.peerConnection) {
      try { state.peerConnection.close(); } catch {}
      state.peerConnection = null;
    }
    if (state.localStream) {
      try { state.localStream.getTracks().forEach(t => t.stop()); } catch {}
      state.localStream = null;
    }

    $id('call-screen')?.classList.remove('active');
    $id('incoming-screen')?.classList.remove('active');
    const lv = $id('localVideo'); if (lv) lv.srcObject = null;
    const rv = $id('remoteVideo'); if (rv) rv.srcObject = null;
    $id('local-video-wrap')?.classList.remove('active');
    console.log('📞 cleanup');
  };

  window.hangUp = function () {
    if (state.currentChat) socket.emit('end-call', { to: state.currentChat });
    window.cleanupCall();
  };

  window.toggleMic = function () {
    const t = state.localStream?.getAudioTracks()[0];
    if (!t) return;
    state.micOn = !state.micOn;
    t.enabled = state.micOn;
    if (typeof updateCallButtons === 'function') updateCallButtons();
  };

  window.toggleCamera = function () {
    const t = state.localStream?.getVideoTracks()[0];
    if (!t) return;
    state.camOn = !state.camOn;
    t.enabled = state.camOn;
    if (typeof updateCallButtons === 'function') updateCallButtons();
  };

  // ─── Переопределяем обработчики ───
  ['call-answered', 'ice-candidate', 'call-ended', 'call-failed', 'incoming-call']
    .forEach(ev => socket.off(ev));

  socket.on('call-answered', async (data) => {
    try {
      if (!state.peerConnection) return;
      await state.peerConnection.setRemoteDescription(data.answer);
      q(state.peerConnection).remoteSet = true;
      flushIce(state.peerConnection);
      const st = $id('call-status');
      if (st) st.textContent = 'В разговоре';
      if (typeof startCallTimer === 'function' && !state.callTimerInterval) startCallTimer();
    } catch (err) { console.error('❌ answer apply:', err); }
  });

  socket.on('ice-candidate', async (data) => {
    if (!state.peerConnection || !data.candidate) return;
    const st = q(state.peerConnection);
    if (!st.remoteSet) { st.pending.push(data.candidate); return; }
    try {
      await state.peerConnection.addIceCandidate(data.candidate);
    } catch (e) {
      if (e.name !== 'InvalidStateError') console.warn('addIce:', e);
    }
  });

  socket.on('call-ended', () => window.cleanupCall());
  socket.on('call-failed', (data) => {
    alert('Не удалось: ' + (data?.reason || 'неизвестно'));
    window.cleanupCall();
  });

  socket.on('incoming-call', (data) => {
    state.incomingFrom = data.from;
    state.incomingVideo = data.video;
    state.pendingOffer = data.offer;

    const contact = state.contacts.find(c => c.name === data.from);
    const dn = contact?.displayName || data.from;
    const iname = $id('incoming-name');
    if (iname) iname.innerHTML = _esc(dn) + ' ' + _badgesBig(contact || {});
    const itype = $id('incoming-type');
    if (itype) itype.textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';

    const av = $id('incoming-avatar');
    if (av) {
      av.classList.toggle('premium', !!contact?.premium);
      // ВАЖНО: в app.js — camelCase avatarVideo, а не avatar_video
      if (contact?.avatarVideo) {
        av.innerHTML = `<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="${contact.avatarVideo}"></video>`;
        av.style.backgroundImage = '';
      } else if (contact?.avatar) {
        av.style.backgroundImage = `url(${contact.avatar})`;
        av.textContent = '';
      } else {
        av.style.backgroundImage = '';
        av.textContent = _initials(dn);
      }
    }

    $id('incoming-screen')?.classList.add('active');
    _ping();
    _vib([100, 50, 100]);
  });

  console.log('📞 calls.js v3 (fixed) loaded');
})();