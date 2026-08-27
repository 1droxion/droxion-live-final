import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gift, Radio, RefreshCw, Send, Users, X } from 'lucide-react';
import { Track } from 'livekit-client';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { attachRemoteTrack, detachRemoteTrack, unlockRemoteAudio } from '../../../livekit/livekitRoom';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';
import '../../../live-experience-v3.css';
import '../../../live-experience-v4.css';
import '../styles/production-live-browser.css';

const PULL_THRESHOLD = 58;
const VIEWER_HEARTBEAT_MS = 45000;
const ROOM_STATUS_MS = 15000;

function dedupeById(rows, limit = 200) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row?.id ?? `${row?.created_at || ''}:${row?.body || row?.gift_name || ''}`);
    map.set(key, row);
  }
  return Array.from(map.values())
    .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')))
    .slice(-limit);
}

export default function ProductionLiveBrowser({ currentUserId, coins = 0, onCoinsChanged, onOpenWallet, onImmersiveChange }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [activeRoom, setActiveRoom] = useState(null);
  const [viewerState, setViewerState] = useState('idle');
  const [notice, setNotice] = useState('');
  const [roomStatus, setRoomStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [giftDrawerOpen, setGiftDrawerOpen] = useState(false);
  const [busyGift, setBusyGift] = useState('');
  const [draft, setDraft] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);

  const roomRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pullStartYRef = useRef(null);
  const openRequestRef = useRef(0);
  const lastChatIdRef = useRef(0);
  const refreshTimerRef = useRef(null);

  const sessionId = activeRoom?.session_id || '';

  const loadFeed = useCallback(async ({ spinner = false } = {}) => {
    if (spinner) setRefreshing(true);
    const { data, error } = await supabase.rpc('droxion_live_feed');
    if (!error) setProfiles(Array.isArray(data) ? data : []);
    else setNotice(error.message || 'Could not refresh LIVE.');
    setLoading(false);
    if (spinner) setRefreshing(false);
    return Array.isArray(data) ? data : [];
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadFeed(),
      supabase.rpc('droxion_gift_options')
    ]).then(([, giftResult]) => {
      if (alive && !giftResult?.error) setGifts(giftResult?.data || []);
    }).catch(() => {});

    const queueRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => loadFeed().catch(() => {}), 120);
    };

    const presence = supabase
      .channel(`prod-live-browser-presence:${currentUserId || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'droxion_live_presence' }, queueRefresh)
      .subscribe();

    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden' && !activeRoom) queueRefresh();
    };
    window.addEventListener('pageshow', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);

    return () => {
      alive = false;
      window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener('pageshow', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      try { Promise.resolve(supabase.removeChannel(presence)).catch(() => {}); } catch {}
    };
  }, [currentUserId, loadFeed, activeRoom]);

  useEffect(() => {
    onImmersiveChange?.(Boolean(activeRoom));
    return () => onImmersiveChange?.(false);
  }, [activeRoom, onImmersiveChange]);

  const clearRemoteElements = useCallback(() => {
    const video = remoteVideoRef.current;
    const audio = remoteAudioRef.current;
    if (video) {
      try { video.pause?.(); } catch {}
      try { video.srcObject = null; } catch {}
    }
    if (audio) {
      try { audio.pause?.(); } catch {}
      try { audio.srcObject = null; } catch {}
    }
  }, []);

  const leaveViewer = useCallback(async ({ refresh = true } = {}) => {
    const leavingSession = activeRoom?.session_id || '';
    const room = roomRef.current;
    roomRef.current = null;
    openRequestRef.current += 1;
    clearRemoteElements();
    setActiveRoom(null);
    setViewerState('idle');
    setRoomStatus(null);
    setMessages([]);
    setGiftEvents([]);
    setGiftDrawerOpen(false);
    setAudioBlocked(false);
    setNotice('');
    if (leavingSession) supabase.rpc('droxion_leave_live', { p_session_id: leavingSession }).catch(() => {});
    disconnectTransport(room).catch(() => {});
    if (refresh) loadFeed().catch(() => {});
  }, [activeRoom?.session_id, clearRemoteElements, loadFeed]);

  const openRoom = useCallback(async profile => {
    const nextSessionId = String(profile?.session_id || '');
    const hostId = String(profile?.user_id || '');
    if (!nextSessionId || !hostId) {
      setNotice('This LIVE is no longer available. Pull down to refresh.');
      loadFeed().catch(() => {});
      return;
    }

    const requestId = ++openRequestRef.current;
    const oldRoom = roomRef.current;
    roomRef.current = null;
    clearRemoteElements();
    disconnectTransport(oldRoom).catch(() => {});

    // Open the viewer UI immediately. No backend cleanup call is allowed to
    // block the tap/navigation path.
    setActiveRoom(profile);
    setViewerState('connecting');
    setNotice('Connecting LIVE video…');
    setRoomStatus(null);
    setMessages([]);
    setGiftEvents([]);
    lastChatIdRef.current = 0;

    // Viewer registration is useful for analytics/counts, but LiveKit viewer
    // authorization is session-based and does not depend on this write. Never
    // await it before opening the room.
    supabase.rpc('droxion_join_live', { p_host_id: hostId }).then(({ data, error }) => {
      if (requestId !== openRequestRef.current) return;
      if (error || data?.allowed === false) {
        setNotice(error?.message || 'This LIVE may have ended.');
      }
    }).catch(() => {});

    try {
      const room = await connectViewerTransport({
        sessionId: nextSessionId,
        callbacks: {
          onTrackSubscribed: (track, _publication, participant) => {
            if (requestId !== openRequestRef.current) return;
            const identity = String(participant?.identity || '').split('::')[0];
            if (identity !== hostId) return;
            const element = track.kind === Track.Kind.Video ? remoteVideoRef.current : remoteAudioRef.current;
            if (!element) return;
            attachRemoteTrack(track, element);
            element.setAttribute('playsinline', '');
            if (track.kind === Track.Kind.Video) element.muted = true;
            const playback = element.play?.();
            if (playback?.catch) playback.catch(() => {
              if (track.kind === Track.Kind.Audio) setAudioBlocked(true);
            });
            if (track.kind === Track.Kind.Video) {
              setViewerState('live');
              setNotice('');
            }
          },
          onTrackUnsubscribed: track => {
            try { detachRemoteTrack(track); } catch {}
          },
          onReconnecting: () => {
            if (requestId === openRequestRef.current) {
              setViewerState('reconnecting');
              setNotice('Reconnecting LIVE…');
            }
          },
          onReconnected: () => {
            if (requestId === openRequestRef.current) {
              setViewerState('live');
              setNotice('');
            }
          },
          onDisconnected: () => {
            if (requestId === openRequestRef.current) {
              setViewerState('ended');
              setNotice('LIVE disconnected. Pull down on Home to refresh.');
            }
          }
        }
      });

      if (requestId !== openRequestRef.current) {
        disconnectTransport(room).catch(() => {});
        return;
      }
      roomRef.current = room;
      const unlocked = await unlockRemoteAudio(room).catch(() => false);
      if (requestId === openRequestRef.current) setAudioBlocked(!unlocked);
    } catch (error) {
      if (requestId !== openRequestRef.current) return;
      setViewerState('error');
      setNotice(error?.message || 'Could not open this LIVE.');
      loadFeed().catch(() => {});
    }
  }, [clearRemoteElements, loadFeed]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const beat = () => supabase.rpc('droxion_live_viewer_heartbeat', { p_session_id: sessionId }).catch(() => {});
    beat();
    const timer = window.setInterval(beat, VIEWER_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let stopped = false;
    const check = async () => {
      const { data } = await supabase.rpc('droxion_live_room_status', { p_session_id: sessionId });
      if (stopped) return;
      setRoomStatus(data || null);
      if (data?.active === false) {
        setViewerState('ended');
        setNotice('This LIVE has ended.');
      }
    };
    check();
    const timer = window.setInterval(check, ROOM_STATUS_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    let stopped = false;
    supabase.rpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: 0 }).then(({ data }) => {
      if (stopped) return;
      const rows = Array.isArray(data) ? data : [];
      setMessages(dedupeById(rows));
      lastChatIdRef.current = rows.reduce((max, row) => Math.max(max, Number(row?.id || 0)), 0);
    }).catch(() => {});

    const unsubscribe = subscribeLiveEvents(sessionId, event => {
      if (stopped) return;
      if (event?.type === 'chat' && event.row) {
        setMessages(current => dedupeById([...current, event.row]));
        lastChatIdRef.current = Math.max(lastChatIdRef.current, Number(event.row.id || 0));
      }
      if (event?.type === 'gift' && event.row) {
        setGiftEvents(current => dedupeById([...current, event.row], 30));
      }
    });
    return () => { stopped = true; unsubscribe?.(); };
  }, [sessionId]);

  useEffect(() => () => {
    const room = roomRef.current;
    roomRef.current = null;
    openRequestRef.current += 1;
    disconnectTransport(room).catch(() => {});
  }, []);

  async function sendChat() {
    const body = draft.trim();
    if (!body || !sessionId) return;
    setDraft('');
    const { data, error } = await supabase.rpc('droxion_send_live_chat', { p_session_id: sessionId, p_body: body });
    if (error || data?.allowed === false) {
      setNotice(error?.message || 'Message could not be sent.');
      return;
    }
    const { data: rows } = await supabase.rpc('droxion_live_chat_messages', { p_session_id: sessionId, p_after_id: lastChatIdRef.current });
    if (rows?.length) {
      setMessages(current => dedupeById([...current, ...rows]));
      lastChatIdRef.current = Math.max(lastChatIdRef.current, ...rows.map(row => Number(row?.id || 0)));
    }
  }

  async function sendGift(gift) {
    if (!activeRoom?.user_id || busyGift) return;
    setBusyGift(String(gift.gift_code || 'gift'));
    const { data, error } = await supabase.rpc('droxion_send_live_gift', {
      p_recipient_id: activeRoom.user_id,
      p_gift_code: gift.gift_code
    });
    setBusyGift('');
    if (error || data?.allowed === false) {
      if (data?.reason === 'insufficient_coins') onOpenWallet?.();
      setNotice(error?.message || (data?.reason === 'insufficient_coins' ? 'Not enough coins.' : 'Gift could not be sent.'));
      return;
    }
    onCoinsChanged?.(Number(data.coin_balance || 0));
    setGiftDrawerOpen(false);
    setNotice(`${data?.emoji || gift.emoji || '🎁'} ${data?.gift_name || gift.gift_name || 'Gift'} sent.`);
  }

  function handlePullStart(event) {
    if (activeRoom || refreshing) return;
    const scrollTop = document.scrollingElement?.scrollTop || document.documentElement?.scrollTop || 0;
    if (scrollTop > 2) return;
    pullStartYRef.current = event.touches?.[0]?.clientY ?? null;
  }

  function handlePullMove(event) {
    if (activeRoom || pullStartYRef.current == null) return;
    const scrollTop = document.scrollingElement?.scrollTop || document.documentElement?.scrollTop || 0;
    if (scrollTop > 2) return;
    const y = event.touches?.[0]?.clientY ?? pullStartYRef.current;
    const distance = Math.max(0, y - pullStartYRef.current);
    setPullDistance(Math.min(92, distance * 0.55));
  }

  async function handlePullEnd() {
    if (activeRoom) return;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD && !refreshing;
    pullStartYRef.current = null;
    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }
    setPullDistance(46);
    try { await loadFeed({ spinner: true }); }
    finally { setPullDistance(0); }
  }

  if (activeRoom) {
    const combinedEvents = [
      ...messages.slice(-8).map(row => ({ ...row, eventType: 'chat', eventKey: `c-${row.id}` })),
      ...giftEvents.slice(-5).map(row => ({ ...row, eventType: 'gift', eventKey: `g-${row.id}` }))
    ].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).slice(-8);

    return (
      <section className={`liveRoomPage liveRoomV4 liveRoom-${activeRoom.orientation || 'vertical'}`}>
        <div className="liveStage liveStageV4">
          <video ref={remoteVideoRef} autoPlay playsInline muted className="liveMainVideo" />
          <audio ref={remoteAudioRef} autoPlay playsInline />

          {viewerState !== 'live' && <div className="liveVideoLoading"><Radio size={30} /><strong>{viewerState === 'error' ? 'Could not open LIVE' : viewerState === 'ended' ? 'LIVE ended' : viewerState === 'reconnecting' ? 'Reconnecting LIVE…' : 'Connecting LIVE video…'}</strong></div>}
          {audioBlocked && <button type="button" className="liveAudioRecovery" onClick={() => unlockRemoteAudio(roomRef.current).then(unlocked => setAudioBlocked(!unlocked))}>Enable audio</button>}

          <div className="liveTopOverlay liveTopV4">
            <button type="button" className="liveBackButton" onClick={() => leaveViewer()}><ArrowLeft size={21} /><span>Exit</span></button>
            <div className="liveIdentity"><span className="liveBadge">LIVE</span><div className="liveIdentityText"><strong>{activeRoom.display_name || 'Droxion Live'}</strong><small>{activeRoom.title || 'Live on Droxion'}</small></div></div>
            <div className="liveViewerBadge"><Users size={15} /> {roomStatus?.viewer_count || activeRoom.viewer_count || 0}</div>
          </div>

          <div className="liveBottomGradient" />
          <div className="liveChatOverlay liveChatV4">
            {combinedEvents.map(event => event.eventType === 'gift'
              ? <div className="liveChatLine liveGiftEvent" key={event.eventKey}><strong>{event.display_name || 'Viewer'}</strong> sent {event.emoji} {event.gift_name}</div>
              : <div className="liveChatLine" key={event.eventKey}><strong>{event.display_name || 'Viewer'}</strong> {event.body}</div>)}
            {combinedEvents.length === 0 && <div className="liveChatHint">Live chat will appear here.</div>}
          </div>

          <div className="liveComposerOverlay liveComposerV4">
            <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Say something…" maxLength={500} />
            <button type="button" className="liveGiftButton" onClick={() => setGiftDrawerOpen(true)}><Gift size={19} /></button>
            <button type="button" onClick={sendChat} disabled={!draft.trim()}><Send size={18} /></button>
          </div>

          {notice && <div className="liveNotice liveNoticeV4">{notice}</div>}

          {giftDrawerOpen && <div className="liveGiftDrawerBackdrop" onClick={() => setGiftDrawerOpen(false)}><div className="liveGiftDrawer" onClick={event => event.stopPropagation()}><div className="liveGiftDrawerHead"><div><strong>Send a gift</strong><span>🪙 {coins} coins</span></div><button type="button" onClick={() => setGiftDrawerOpen(false)}><X size={20} /></button></div><div className="liveGiftGridV4">{gifts.map(gift => <button type="button" key={gift.gift_code} disabled={Boolean(busyGift)} onClick={() => sendGift(gift)}><span>{gift.emoji}</span><strong>{gift.gift_name}</strong><small>{gift.cost_coins} coins</small></button>)}</div><button type="button" className="liveBuyCoinsV4" onClick={() => onOpenWallet?.()}>+ Buy Coins</button></div></div>}
        </div>
      </section>
    );
  }

  const pullText = refreshing ? 'Refreshing LIVE…' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull down to refresh';

  return (
    <section className="realPage liveBrowsePage liveFeedPage liveOnlyHome productionLiveBrowse" onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd} onTouchCancel={handlePullEnd}>
      <div className={`livePullRefresh ${refreshing ? 'refreshing' : ''}`} style={{ height: pullDistance }} aria-live="polite"><RefreshCw size={19} /><span>{pullText}</span></div>
      <div className="productionLiveRefreshHint"><span>Pull down to refresh LIVE</span><button type="button" onClick={() => loadFeed({ spinner: true })} disabled={refreshing} aria-label="Refresh LIVE"><RefreshCw size={15} /></button></div>

      {notice && !loading && <div className="liveNotice productionBrowseNotice">{notice}</div>}
      {loading ? <div className="liveZeroState liveZeroSimple"><span className="liveZeroIcon"><RefreshCw size={26} /></span><h2>Loading LIVE…</h2></div> : profiles.length === 0 ? <div className="liveZeroState liveZeroSimple"><span className="liveZeroIcon"><Radio size={28} /></span><h2>No one is LIVE right now</h2><p>Pull down to refresh when a creator starts LIVE.</p></div> : <div className="liveFeedScroll liveOnlyScroll" aria-label="People live now">{profiles.map(profile => <button type="button" key={`${profile.user_id}:${profile.session_id}`} className={`liveFeedCard ${profile.orientation === 'horizontal' ? 'horizontal' : 'vertical'}`} onClick={() => openRoom(profile)}><div className="liveBrowseFallback" />{profile.avatar_url && <img src={profile.avatar_url} alt={profile.display_name || 'LIVE creator'} loading="lazy" decoding="async" />}<div className="liveBrowseShade" /><div className="liveFeedCardTop"><span className="liveBadge">LIVE</span><span className="liveFeedViewers"><Users size={13} /> {profile.viewer_count || 0}</span></div><div className="liveBrowseInfo"><strong>{profile.display_name}{profile.age ? `, ${profile.age}` : ''}</strong><b>{profile.title || 'Live on Droxion'}</b><small>{profile.country || 'Global'}{profile.language ? ` · ${profile.language}` : ''}</small><em>Tap to open LIVE</em></div></button>)}</div>}
    </section>
  );
}
