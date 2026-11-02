'use strict';

/* ═══════════════════════════════════════════════════════════
   📞 AZERTA — патч звонков (STUN-only, без TURN)
   Подключать ПОСЛЕ app.js.
   Перезаписывает: startCall, acceptIncoming, handlers, cleanup.
   ═══════════════════════════════════════════════════════════ */

(function () {
  if (typeof state === 'undefined' || typeof socket === 'undefined') {
    console.error('❌ calls-patch: app.js не загружен');
    return;
  }

  // Только STUN
  window.RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.relay.metered.ca:80' }
    ],
    iceCandidatePoolSize: 4
  };

  // ─── Запуск исходящего звонка ───
  window.startCall = async function (video) {
    if (!state.currentChat || state.callActive) return;
    if (state.isBotChat) { showToast('🤖 Ботам нельзя звонить'); return; }
    if (state.me.mute) { showToast('🔇 Ты в муте'); return; }

    const contact = state.contacts.find(function (c) { return c.name === state.currentChat; });
    if (contact && !contact.online) {
      alert((contact.displayName || state.currentChat) + ' не в сети.');
      return;
    }

    try {
      console.log('🎤 getUserMedia...');
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { facingMode: 'user' } : false
      });
      console.log('✅ Треки:', state.localStream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error('❌ getUserMedia:', err);
      let msg = 'Не удалось получить доступ';
      if (err.name === 'NotAllowedError') msg = '🚫 Доступ запрещён. Разреши микрофон/камеру в браузере.';
      else if (err.name === 'NotFoundError') msg = '🎤 Устройство не найдено';
      else if (err.name === 'NotReadableError') msg = '⚠️ Устройство занято другим приложением';
      else if (err.name === 'SecurityError') msg = '🔒 Нужен HTTPS (Render даёт его автоматически)';
      alert(msg);
      return;
    }

    state.callActive = true;
    state.micOn = true;
    state.camOn = !!video;
    showCallScreen(state.currentChat, contact, video, 'Вызов...');

    state.peerConnection = new RTCPeerConnection(window.RTC_CONFIG);

    state.localStream.getTracks().forEach(function (t) {
      state.peerConnection.addTrack(t, state.localStream);
    });

    state.peerConnection.onicecandidate = function (e) {
      if (e.candidate) {
        socket.emit('ice-candidate', { to: state.currentChat, candidate: e.candidate });
      }
    };

    state.peerConnection.oniceconnectionstatechange = function () {
      const st = state.peerConnection.iceConnectionState;
      console.log('🔌 ICE:', st);
      const stEl = $('call-status');
      if (st === 'failed') {
        if (stEl) stEl.textContent = '❌ Не удалось соединиться';
        showToast('❌ Сеть блокирует P2P. Нужен TURN или VPN.');
      } else if (st === 'disconnected') {
        if (stEl) stEl.textContent = '⚠️ Связь прервалась';
      } else if (st === 'connected' || st === 'completed') {
        if (stEl) stEl.textContent = 'В разговоре';
      }
    };

    state.peerConnection.ontrack = function (e) {
      console.log('📹 ontrack:', e.track.kind);
      const rv = $('remoteVideo');
      if (rv) {
        rv.srcObject = e.streams[0];
        const rw = $('remote-video-wrap');
        if (rw) rw.classList.remove('audio-only');
        const ab = $('call-avatar-big');
        if (ab) ab.style.display = 'none';
      }
      const st = $('call-status');
      if (st) st.textContent = 'В разговоре';
      if (!state.callTimerInterval) startCallTimer();
    };

    try {
      const offer = await state.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: video
      });
      await state.peerConnection.setLocalDescription(offer);
      socket.emit('call-user', { to: state.currentChat, offer: offer, video: video });
      console.log('📤 Offer отправлен');
    } catch (err) {
      console.error('❌ Offer:', err);
      alert('Ошибка звонка: ' + err.message);
      window.cleanupCall();
    }
  };

  // ─── Принятие входящего ───
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

    try {
      console.log('🎤 getUserMedia (accept)...');
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { facingMode: 'user' } : false
      });
      console.log('✅ Треки:', state.localStream.getTracks().map(t => t.kind));
    } catch (err) {
      console.error('❌ getUserMedia:', err);
      alert('Не удалось: ' + err.message);
      socket.emit('end-call', { to: from });
      return;
    }

    state.callActive = true;
    state.micOn = true;
    state.camOn = !!video;
    const contact = state.contacts.find(function (c) { return c.name === from; });
    showCallScreen(from, contact, video, 'Соединение...');

    state.peerConnection = new RTCPeerConnection(window.RTC_CONFIG);

    state.localStream.getTracks().forEach(function (t) {
      state.peerConnection.addTrack(t, state.localStream);
    });

    state.peerConnection.onicecandidate = function (e) {
      if (e.candidate) {
        socket.emit('ice-candidate', { to: from, candidate: e.candidate });
      }
    };

    state.peerConnection.oniceconnectionstatechange = function () {
      const st = state.peerConnection.iceConnectionState;
      console.log('🔌 ICE (accept):', st);
      const stEl = $('call-status');
      if (st === 'failed' && stEl) stEl.textContent = '❌ Не удалось соединиться';
      else if (st === 'connected' || st === 'completed') {
        if (stEl) stEl.textContent = 'В разговоре';
      }
    };

    state.peerConnection.ontrack = function (e) {
      console.log('📹 ontrack (accept):', e.track.kind);
      const rv = $('remoteVideo');
      if (rv) {
        rv.srcObject = e.streams[0];
        const rw = $('remote-video-wrap');
        if (rw) rw.classList.remove('audio-only');
        const ab = $('call-avatar-big');
        if (ab) ab.style.display = 'none';
      }
      const st = $('call-status');
      if (st) st.textContent = 'В разговоре';
      if (!state.callTimerInterval) startCallTimer();
    };

    try {
      await state.peerConnection.setRemoteDescription(offer);
      const answer = await state.peerConnection.createAnswer();
      await state.peerConnection.setLocalDescription(answer);
      socket.emit('answer-call', { to: from, answer: answer });
      console.log('📤 Answer отправлен');
    } catch (err) {
      console.error('❌ Answer:', err);
      alert('Ошибка: ' + err.message);
      window.cleanupCall();
    }
  };

  // ─── Cleanup ───
  window.cleanupCall = function () {
    state.callActive = false;
    if (typeof stopCallTimer === 'function') stopCallTimer();

    if (typeof state.isScreenSharing !== 'undefined' && state.isScreenSharing && typeof stopScreenShare === 'function') {
      try { stopScreenShare(); } catch (e) {}
    }

    if (state.peerConnection) {
      try { state.peerConnection.close(); } catch (e) {}
      state.peerConnection = null;
    }

    if (state.localStream) {
      try { state.localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      state.localStream = null;
    }

    const cs = $('call-screen');
    if (cs) cs.classList.remove('active');
    const is = $('incoming-screen');
    if (is) is.classList.remove('active');

    const lv = $('localVideo');
    if (lv) lv.srcObject = null;
    const rv = $('remoteVideo');
    if (rv) rv.srcObject = null;
    const lw = $('local-video-wrap');
    if (lw) lw.classList.remove('active');

    console.log('📞 Звонок очищен');
  };

  // ─── Перезаписываем обработчики socket ───
  socket.off('call-answered');
  socket.off('ice-candidate');
  socket.off('call-ended');
  socket.off('call-failed');
  socket.off('incoming-call');

  socket.on('call-answered', async function (data) {
    try {
      if (state.peerConnection) {
        await state.peerConnection.setRemoteDescription(data.answer);
        const st = $('call-status');
        if (st) st.textContent = 'В разговоре';
        if (!state.callTimerInterval && typeof startCallTimer === 'function') startCallTimer();
        console.log('✅ Answer применён');
      }
    } catch (err) {
      console.error('❌ setRemoteDescription(answer):', err);
    }
  });

  socket.on('ice-candidate', async function (data) {
    if (state.peerConnection && data.candidate) {
      try {
        await state.peerConnection.addIceCandidate(data.candidate);
      } catch (e) {
        if (e.name !== 'InvalidStateError') console.warn('⚠️ addIceCandidate:', e);
      }
    }
  });

  socket.on('call-ended', function () {
    console.log('📞 call-ended');
    window.cleanupCall();
  });

  socket.on('call-failed', function (data) {
    console.error('❌ call-failed:', data && data.reason);
    alert('Не удалось: ' + ((data && data.reason) || 'неизвестно'));
    window.cleanupCall();
  });

  socket.on('incoming-call', function (data) {
    console.log('📞 incoming-call:', data.from);
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
      if (contact && contact.avatar) {
        av.style.backgroundImage = 'url(' + contact.avatar + ')';
        av.textContent = '';
      } else {
        av.style.backgroundImage = '';
        av.textContent = typeof initials === 'function' ? initials(displayName) : displayName.slice(0, 2).toUpperCase();
        av.style.background = 'linear-gradient(135deg,#6d5eff,#8b7fff)';
      }
    }

    const is = $('incoming-screen');
    if (is) is.classList.add('active');

    if (typeof playPing === 'function') playPing();
    if (typeof vibrate === 'function') vibrate();
  });

  // ─── Переопределяем hangUp на всякий случай ───
  window.hangUp = function () {
    if (state.currentChat) socket.emit('end-call', { to: state.currentChat });
    window.cleanupCall();
  };

  // ─── Тумблеры (микрофон/камера) ───
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

  console.log('📞 calls-patch загружен (STUN-only)');
})();
