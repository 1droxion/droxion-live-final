import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './live-home-preview.css';

function iceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    });
  }
  return servers;
}

function addOrientationBadge(card) {
  if (!card || card.querySelector('.liveOrientationBadge')) return;
  const badge = document.createElement('span');
  badge.className = 'liveOrientationBadge';
  badge.setAttribute('aria-hidden', 'true');
  const horizontal = card.classList.contains('horizontal');
  badge.innerHTML = horizontal
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>';
  card.appendChild(badge);
}

function ensurePreviewVideo(card) {
  if (!card) return null;
  let video = card.querySelector('.liveHomePreviewVideo');
  if (video) return video;
  video = document.createElement('video');
  video.className = 'liveHomePreviewVideo';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('aria-hidden', 'true');
  card.insertBefore(video, card.firstChild);
  return video;
}

export default function LiveHomePreviewEnhancer({ currentUserId, enabled = true }) {
  useEffect(() => {
    if (!currentUserId || !enabled) return undefined;

    let disposed = false;
    let profiles = [];
    let profileByUser = new Map();
    let syncTimer = null;
    let switchTimer = null;
    let pollTimer = null;
    let heartbeatTimer = null;
    let observer = null;
    let domObserver = null;
    let activeHostId = '';
    let activeSessionId = '';
    let activeCard = null;
    let activeVideo = null;
    let peer = null;
    let remoteStream = null;
    let lastSignalId = 0;
    let pendingIce = [];
    let enteringFullLive = false;
    const ratios = new Map();
    const observedCards = new Set();

    const clearTimers = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      pollTimer = null;
      heartbeatTimer = null;
    };

    const clearMedia = () => {
      try { peer?.close(); } catch {}
      peer = null;
      remoteStream?.getTracks?.().forEach(track => track.stop());
      remoteStream = null;
      pendingIce = [];
      lastSignalId = 0;
      if (activeVideo) {
        try { activeVideo.pause?.(); } catch {}
        activeVideo.srcObject = null;
        activeVideo.classList.remove('isPlaying');
      }
      activeCard?.classList.remove('liveHomePreviewActive');
    };

    const leavePreview = async () => {
      const sessionToLeave = activeSessionId;
      clearTimers();
      clearMedia();
      activeHostId = '';
      activeSessionId = '';
      activeCard = null;
      activeVideo = null;
      if (sessionToLeave && !enteringFullLive) {
        try { await supabase.rpc('droxion_leave_live', { p_session_id: sessionToLeave }); } catch {}
      }
    };

    const sendSignal = async (recipientId, type, payload = {}) => {
      if (!activeSessionId || !recipientId || disposed) return;
      await supabase.rpc('droxion_send_live_signal', {
        p_session_id: activeSessionId,
        p_recipient_id: recipientId,
        p_stream_role: 'host',
        p_signal_type: type,
        p_payload: payload
      });
    };

    const attachStream = stream => {
      if (!activeVideo || !stream || disposed) return;
      remoteStream = stream;
      activeVideo.srcObject = stream;
      activeVideo.muted = true;
      activeVideo.playsInline = true;
      activeVideo.classList.add('isPlaying');
      const playback = activeVideo.play?.();
      playback?.catch?.(() => {});
    };

    const createViewerPeer = async offer => {
      try { peer?.close(); } catch {}
      pendingIce = [];
      peer = new RTCPeerConnection({ iceServers: iceServers(), iceCandidatePoolSize: 6 });
      peer.onicecandidate = event => {
        if (event.candidate && activeHostId) sendSignal(activeHostId, 'ice', event.candidate.toJSON()).catch(() => {});
      };
      peer.ontrack = event => {
        let stream = event.streams?.[0];
        if (!stream) {
          stream = remoteStream || new MediaStream();
          if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track);
        }
        attachStream(stream);
      };
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      for (const candidate of pendingIce.splice(0)) {
        try { await peer.addIceCandidate(candidate); } catch {}
      }
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal(activeHostId, 'answer', peer.localDescription?.toJSON?.() || answer);
    };

    const pollSignals = async () => {
      if (!activeSessionId || !activeHostId || disposed) return;
      const sessionAtStart = activeSessionId;
      const { data: rows } = await supabase.rpc('droxion_live_signals_for_me', {
        p_session_id: sessionAtStart,
        p_after_id: lastSignalId
      });
      if (disposed || sessionAtStart !== activeSessionId) return;
      for (const row of rows || []) {
        lastSignalId = Math.max(lastSignalId, Number(row.id) || 0);
        if (row.sender_id !== activeHostId || row.stream_role !== 'host') continue;
        try {
          if (row.signal_type === 'offer') {
            await createViewerPeer(row.payload);
          } else if (row.signal_type === 'ice') {
            const candidate = new RTCIceCandidate(row.payload);
            if (peer?.remoteDescription) await peer.addIceCandidate(candidate);
            else pendingIce.push(candidate);
          }
        } catch (error) {
          console.warn('Home LIVE preview signal error', error);
        }
      }
    };

    const startPreview = async card => {
      const hostId = card?.dataset?.liveUser || '';
      if (!hostId || hostId === activeHostId || disposed) return;
      enteringFullLive = false;
      await leavePreview();
      if (disposed) return;

      const profile = profileByUser.get(hostId);
      if (!profile) return;
      const video = ensurePreviewVideo(card);
      if (!video) return;

      activeHostId = hostId;
      activeCard = card;
      activeVideo = video;
      card.classList.add('liveHomePreviewActive');

      const { data, error } = await supabase.rpc('droxion_join_live', { p_host_id: hostId });
      if (disposed || hostId !== activeHostId) return;
      if (error || !data?.allowed || !data?.session_id) {
        clearMedia();
        activeHostId = '';
        return;
      }

      activeSessionId = data.session_id;
      lastSignalId = 0;
      pollSignals().catch(() => {});
      pollTimer = window.setInterval(() => pollSignals().catch(() => {}), 450);
      heartbeatTimer = window.setInterval(() => {
        if (activeSessionId) supabase.rpc('droxion_live_viewer_heartbeat', { p_session_id: activeSessionId }).catch?.(() => {});
      }, 15000);
      try { await sendSignal(hostId, 'watch_request', {}); } catch {}
    };

    const chooseBestVisible = () => {
      if (disposed || enteringFullLive) return;
      let bestCard = null;
      let bestRatio = 0;
      ratios.forEach((ratio, card) => {
        if (card.classList.contains('dxFilteredOut')) return;
        if (ratio > bestRatio) { bestRatio = ratio; bestCard = card; }
      });
      if (!bestCard || bestRatio < 0.35) return;
      if (bestCard === activeCard) return;
      if (switchTimer) window.clearTimeout(switchTimer);
      switchTimer = window.setTimeout(() => startPreview(bestCard).catch(() => {}), 140);
    };

    const onCardClickCapture = event => {
      const card = event.currentTarget;
      const clickedHost = card?.dataset?.liveUser || '';
      if (!clickedHost) return;
      if (clickedHost === activeHostId) {
        enteringFullLive = true;
        clearTimers();
        clearMedia();
      } else {
        enteringFullLive = false;
        leavePreview().catch(() => {});
      }
    };

    const decorateCards = () => {
      const cards = Array.from(document.querySelectorAll('.liveOnlyHome .liveFeedCard'));
      cards.forEach((card, index) => {
        const profile = profiles[index];
        if (profile?.user_id) card.dataset.liveUser = profile.user_id;
        if (profile?.session_id) card.dataset.liveSession = profile.session_id;
        addOrientationBadge(card);
        if (!card.dataset.previewClickBound) {
          card.dataset.previewClickBound = '1';
          card.addEventListener('click', onCardClickCapture, true);
        }
        if (!observedCards.has(card)) {
          observedCards.add(card);
          observer?.observe(card);
        }
      });
      observedCards.forEach(card => {
        if (!card.isConnected) {
          observer?.unobserve(card);
          observedCards.delete(card);
          ratios.delete(card);
        }
      });
    };

    const syncProfiles = async () => {
      if (disposed) return;
      const { data } = await supabase.rpc('droxion_live_feed');
      if (disposed) return;
      profiles = data || [];
      profileByUser = new Map(profiles.map(profile => [profile.user_id, profile]));
      decorateCards();
      chooseBestVisible();
    };

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
      chooseBestVisible();
    }, { threshold: [0, 0.25, 0.4, 0.6, 0.8], rootMargin: '-8% 0px -18% 0px' });

    domObserver = new MutationObserver(() => decorateCards());
    domObserver.observe(document.body, { childList: true, subtree: true });

    syncProfiles().catch(() => {});
    syncTimer = window.setInterval(() => syncProfiles().catch(() => {}), 5000);

    return () => {
      disposed = true;
      if (syncTimer) window.clearInterval(syncTimer);
      if (switchTimer) window.clearTimeout(switchTimer);
      observer?.disconnect();
      domObserver?.disconnect();
      observedCards.forEach(card => card.removeEventListener('click', onCardClickCapture, true));
      clearTimers();
      clearMedia();
      if (activeSessionId && !enteringFullLive) {
        supabase.rpc('droxion_leave_live', { p_session_id: activeSessionId }).catch?.(() => {});
      }
    };
  }, [currentUserId, enabled]);

  return null;
}
