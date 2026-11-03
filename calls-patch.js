'use strict';

/* ═══════════════════════════════════════════════════════════
   📞 AZERTA — PATCH ЗВОНКОВ v2
   ✓ STUN-only
   ✓ Очередь ICE-кандидатов (до setRemoteDescription)
   ✓ Правильный cleanup
   ✓ Логирование ICE-состояний
   ═══════════════════════════════════════════════════════════ */

(function () {
  if (typeof state === 'undefined' || typeof socket === 'undefined') {
    console.error('❌ calls-patch: app.js не загружен');
    return;
  }

  window.RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.relay.metered.ca:80' }
    ],
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Очередь ICE-кандидатов (пока не установлен remoteDescription)
  let pendingCandidates = [];
  let remoteDescSet = false;

  function flushPendingCandidates() {
    if (!state.peerConnection) return;
    pendingCandidates.forEach(function (c) {
      state.peerConnection.addIceCandidate(c).catch(function () {});
    });
    pendingCandidates = [];
  }

  function bindPeerEvents(pc, isCaller) {
    pc.onicecandidate = function (e) {
      if (e.candidate) {
        socket.emit('ice-candidate', {
          to: isCaller ? state.currentChat : state.incomingFrom,
          candidate: e.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = function () {
      const st = pc.iceConnectionState;
      console.log('🔌 ICE:', st);
      const stEl = $('call-status');
      if (st === 'failed') {
        if (stEl) stEl.textContent = '❌ Соединение не установлено';
        if (typeof showToast === 'function') showToast('❌ P2P заблокирован. Нужен TURN или VPN.');
      } else if (st === 'disconnected') {
        if (stEl) stEl.textContent = '⚠️ Связь прервалась';
      } else if (st === 'connected' || st === 'completed') {
        if (stEl) stEl.textContent = 'В разговоре';
      }
    };

    pc.ontrack = function (e) {
      console.log('📹 track:', e.track.kind);
      const rv = $('remoteVideo');
      if (rv) {
        rv.srcObject = e.streams[0];
        const rw = $('remote-video-wrap');
        if (rw) rw.classList.remove('audio-only');
        const ab = $('call-avatar-big');
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
      if (err.name === 'NotAllowedError') msg = '🚫 Доступ запрещён. Разреши камеру/микрофон в браузере.';
      else if (err.name === 'NotFoundError') msg = '🎤 Устройство не найдено';
      else if (err.name === 'NotReadableError') msg = '⚠️ Устройство занято другим приложением';
      else if (err.name === 'SecurityError') msg = '🔒 Нужен HTTPS';
      alert(msg);
      return null;
    }
  }

  // ─── Исходящий звонок ───
  window.startCall = async function (video) {
    if (!state.currentChat || state.callActive) return;
    if (state.isBotChat) { showToast('🤖 Ботам нельзя звонить'); return; }
    if (state.me.mute) { showToast('🔇 Ты в муте'); return; }

    const contact = state.contacts.find(function (c) { return c.name === state.currentChat; });
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
    pendingCandidates = [];
    remoteDescSet = false;

    showCallScreen(state.currentChat, contact, video, 'Вызов...');

    const pc = new RTCPeerConnection(window.RTC_CONFIG);
    state.peerConnection = pc;

    stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
    bindPeerEvents(pc, true);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: video
      });
      await pc.setLocalDescription(offer);
      socket.emit('call-user', { to: state.currentChat, offer: offer, video: video });
      console.log('📤 offer sent');
    } catch (err) {
      console.error('❌ offer:', err);
      alert('Ошибка: ' + err.message);
      window.cleanupCall();
    }
  };

  // ─── Входящий звонок ───
  window.acceptIncoming = async function () {
    const is = $('incoming-screen');
    if (is) is.classList.remove('active');
    if (!state.pendingOffer || !state.incomingFrom) return;

    const from = state.incomingFrom;
    const video = state.incomingVideo;
    const offer = state.pendingOffer;
    state.pendingOffer = null;
    state.incomingFrom = null;
    state.currentChat = from;

    const stream = await askMedia(video);
    if (!stream) {
      socket.emit('end-call', { to: from });
      return;
    }

    state.localStream = stream;
    state.callActive = true;
    state.micOn = true;
    state.camOn = !!video;
    pendingCandidates = [];
    remoteDescSet = false;

    const contact = state.contacts.find(function (c) { return c.name === from; });
    showCallScreen(from, contact, video, 'Соединение...');

    const pc = new RTCPeerConnection(window.RTC_CONFIG);
    state.peerConnection = pc;

    stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
    bindPeerEvents(pc, false);

    try {
      await pc.setRemoteDescription(offer);
      remoteDescSet = true;
      flushPendingCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer-call', { to: from, answer: answer });
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

    if (state.peerConnection) {
      try { state.peerConnection.close(); } catch (e) {}
      state.peerConnection = null;
    }

    if (state.localStream) {
      try { state.localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      state.localStream = null;
    }

    const cs = $('call-screen'); if (cs) cs.classList.remove('active');
    const is = $('incoming-screen'); if (is) is.classList.remove('active');
    const lv = $('localVideo'); if (lv) lv.srcObject = null;
    const rv = $('remoteVideo'); if (rv) rv.srcObject = null;
    const lw = $('local-video-wrap'); if (lw) lw.classList.remove('active');

    pendingCandidates = [];
    remoteDescSet = false;
    console.log('📞 cleanup');
  };

  window.hangUp = function () {
    if (state.currentChat) socket.emit('end-call', { to: state.currentChat });
    window.cleanupCall();
  };

  window.toggleMic = function () {
    if (!state.localStream) return;
    const t = state.localStream.getAudioTracks()[0];
    if (!t) return;
    state.micOn = !state.micOn;
    t.enabled = state.micOn;
    if (typeof updateCallButtons === 'function') updateCallButtons();
  };

  window.toggleCamera = function () {
    if (!state.localStream) return;
    const t = state.localStream.getVideoTracks()[0];
    if (!t) return;
    state.camOn = !state.camOn;
    t.enabled = state.camOn;
    if (typeof updateCallButtons === 'function') updateCallButtons();
  };

  // ─── Переопределяем socket-обработчики ───
  ['call-answered', 'ice-candidate', 'call-ended', 'call-failed', 'incoming-call'].forEach(function (ev) {
    socket.off(ev);
  });

  socket.on('call-answered', async function (data) {
    try {
      if (state.peerConnection) {
        await state.peerConnection.setRemoteDescription(data.answer);
        remoteDescSet = true;
        flushPendingCandidates();
        const st = $('call-status');
        if (st) st.textContent = 'В разговоре';
        if (typeof startCallTimer === 'function' && !state.callTimerInterval) startCallTimer();
      }
    } catch (err) {
      console.error('❌ answer apply:', err);
    }
  });

  socket.on('ice-candidate', async function (data) {
    if (!state.peerConnection || !data.candidate) return;
    if (!remoteDescSet) {
      pendingCandidates.push(data.candidate);
      return;
    }
    try {
      await state.peerConnection.addIceCandidate(data.candidate);
    } catch (e) {
      if (e.name !== 'InvalidStateError') console.warn('addIce:', e);
    }
  });

  socket.on('call-ended', function () {
    window.cleanupCall();
  });

  socket.on('call-failed', function (data) {
    alert('Не удалось: ' + ((data && data.reason) || 'неизвестно'));
    window.cleanupCall();
  });

  socket.on('incoming-call', function (data) {
    state.incomingFrom = data.from;
    state.incomingVideo = data.video;
    state.pendingOffer = data.offer;

    const contact = state.contacts.find(function (c) { return c.name === data.from; });
    const displayName = (contact && contact.displayName) || data.from;
    const badges = typeof renderBadgesBig === 'function' ? renderBadgesBig(contact || {}) : '';

    const iname = $('incoming-name');
    if (iname) iname.innerHTML = escapeHtml(displayName) + ' ' + badges;
    const itype = $('incoming-type');
    if (itype) itype.textContent = data.video ? 'Видеозвонок' : 'Аудиозвонок';

    const av = $('incoming-avatar');
    if (av) {
      av.classList.toggle('premium', !!(contact && contact.premium));
      const v = contact && (contact.avatar_video || contact.avatar);
      if (v && contact.avatar_video) {
        // Видео-аватар в incoming
        av.innerHTML = '<video autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:50%"><source src="' + v + '"></video>';
        av.style.backgroundImage = '';
      } else if (contact && contact.avatar) {
        av.style.backgroundImage = 'url(' + contact.avatar + ')';
        av.textContent = '';
      } else {
        av.style.backgroundImage = '';
        av.textContent = typeof initials === 'function' ? initials(displayName) : displayName.slice(0, 2).toUpperCase();
      }
    }

    const is = $('incoming-screen');
    if (is) is.classList.add('active');

    if (typeof playPing === 'function') playPing();
    if (typeof vibrate === 'function') vibrate();
  });

  console.log('📞 calls-patch v2 loaded');
})();
