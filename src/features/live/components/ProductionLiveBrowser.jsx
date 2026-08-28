import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Gift, Radio, RefreshCw, Send, Users, X } from 'lucide-react';
import { Track } from 'livekit-client';
import { subscribeLiveEvents, supabase } from '../../../supabaseClient';
import { attachRemoteTrack, detachRemoteTrack, unlockRemoteAudio } from '../../../livekit/livekitRoom';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';
import LiveGiftCinema from './LiveGiftCinema';
import '../styles/production-live-browser.css';
import '../styles/production-gift-selection.css';

const PULL_THRESHOLD = 58;
const VIEWER_HEARTBEAT_MS = 45000;
const GIFT_TABS = [
  { id: 'popular', label: 'Popular' },
  { id: 'premium', label: 'Premium' },
  { id: 'big', label: 'Big Gifts' }
];

function safeRpc(name, args) {
  return Promise.resolve(supabase.rpc(name, args));
}

function dedupeById(rows, limit = 120) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row?.id ?? `${row?.created_at || ''}:${row?.body || row?.gift_name || ''}`);
    map.set(key, row);
  }
  return Array.from(map.values())
    .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')))
    .slice(-limit);
}

function giftTabFor(gift = {}) {
  const cost = Number(gift.cost_coins || 0);
  if (cost >= 5000) return 'big';
  if (cost >= 750) return 'premium';
  return 'popular';
}

function giftFailureMessage(data, error, gift) {
  if (error?.message) return error.message;
  const reason = String(data?.reason || '');
  if (reason === 'insufficient_coins') {
    return `Not enough coins. ${gift?.gift_name || 'This gift'} needs ${Number(data?.required_coins ?? gift?.cost_coins ?? 0)} coins and you have ${Number(data?.coin_balance ?? 0)}.`;
  }
  if (reason === 'recipient_not_live') return 'This creator is no longer LIVE.';
  if (reason === 'invalid_gift') return 'This gift is unavailable. Choose another gift.';
  if (reason === 'blocked') return 'This gift cannot be sent to this creator.';
  if (reason === 'invalid_recipient') return "You can't send a gift to your own LIVE from the same account.";
  return 'Gift could not be sent. Please try again.';
}

export default function ProductionLiveBrowser({
  currentUserId,
  coins = 0,
  onCoinsChanged,
  onOpenWallet,
  onImmersiveChange
}) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [activeRoom, setActiveRoom] = useState(null);
  const [viewerState, setViewerState] = useState('idle');
  const [notice, setNotice] = useState('');
  const [viewerCount, setViewerCount] = useState(0);

  // Viewer interaction only. These states do not participate in LiveKit.
  const [messages, setMessages] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);
  const [giftOptions, setGiftOptions] = useState([]);
  const [giftTab, setGiftTab] = useState('popular');
  const [selectedGift, setSelectedGift] = useState(null);
  const [draft, setDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [giftDrawerOpen, setGiftDrawerOpen] = useState(false);
  const [busyGift, setBusyGift] = useState('');

  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const pullStartYRef = useRef(null);
  const connectRunRef = useRef(0);
  const refreshTimerRef = useRef(null);
  const lastChatIdRef = useRef(0);

  const visibleGiftOptions = useMemo(
    () => giftOptions.filter(gift => giftTabFor(gift) === giftTab),
    [giftOptions, giftTab]
  );

  const loadFeed = useCallback(async ({ spinner = false } = {}) => {
    if (spinner) setRefreshing(true);
    try {
      const { data, error } = await safeRpc('droxion_live_feed');
      if (error) throw error;
      setProfiles(Array.isArray(data) ? data : []);
      setNotice('');
    } catch (error) {
      setNotice(error?.message || 'Could not refresh LIVE.');
    } finally {
      setLoading(false);
      if (spinner) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    safeRpc('droxion_gift_options').then(({ data, error }) => {
      if (!error) setGiftOptions(Array.isArray(data) ? data : []);
    }).catch(() => {});

    const queueRefresh = () => {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => loadFeed(), 120);
    };

    const channel = supabase
      .channel(`production-live-browser:${currentUserId || 'anon'}`)
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
      window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener('pageshow', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      try { Promise.resolve(supabase.removeChannel(channel)).catch(() => {}); } catch {}
    };
  }, [currentUserId, loadFeed, activeRoom]);

  useEffect(() => {
    onImmersiveChange?.(Boolean(activeRoom));
    return () => onImmersiveChange?.(false);
  }, [activeRoom, onImmersiveChange]);

  const leaveViewer = useCallback(() => {
    const oldRoom = roomRef.current;
    roomRef.current = null;
    connectRunRef.current += 1;

    const sessionId = activeRoom?.session_id;
    if (sessionId) safeRpc('droxion_leave_live', { p_session_id: sessionId }).catch(() => {});

    try {
      if (videoRef.current) {
        videoRef.current.pause?.();
        videoRef.current.srcObject = null;
      }
      if (audioRef.current) {
        audioRef.current.pause?.();
        audioRef.current.srcObject = null;
      }
    } catch {}

    disconnectTransport(oldRoom).catch(() => {});
    setActiveRoom(null);
    setViewerState('idle');
    setNotice('');
    setViewerCount(0);
    setMessages([]);
    setGiftEvents([]);
    setGiftTab('popular');
    setSelectedGift(null);
    setDraft('');
    setGiftDrawerOpen(false);
    lastChatIdRef.current = 0;
    loadFeed();
  }, [activeRoom?.session_id, loadFeed]);

  function openRoom(profile) {
    if (!profile?.session_id || !profile?.user_id) {
      setNotice('This LIVE is no longer available. Pull down to refresh.');
      loadFeed();
      return;
    }

    // IMPORTANT: render the viewer UI first. The LiveKit connection happens in
    // the effect below only after the video/audio elements exist in the DOM.
    setNotice('');
    setViewerState('connecting');
    setViewerCount(Number(profile.viewer_count || 0));
    setMessages([]);
    setGiftEvents([]);
    setGiftTab('popular');
    setSelectedGift(null);
    setDraft('');
    setGiftDrawerOpen(false);
    lastChatIdRef.current = 0;
    setActiveRoom(profile);
  }

  // WORKING VIDEO CONNECTION — intentionally unchanged.
  useEffect(() => {
    if (!activeRoom?.session_id || !activeRoom?.user_id) return undefined;

    const runId = ++connectRunRef.current;
    const sessionId = String(activeRoom.session_id);
    const hostId = String(activeRoom.user_id);
    let cancelled = false;
    let connectedRoom = null;

    const attachTrack = (track, participant) => {
      if (cancelled || runId !== connectRunRef.current) return;
      const identity = String(participant?.identity || '').split('::')[0];
      if (identity && identity !== hostId) return;

      const element = track.kind === Track.Kind.Video ? videoRef.current : audioRef.current;
      if (!element) return;

      try {
        attachRemoteTrack(track, element);
        element.setAttribute('playsinline', '');
        element.autoplay = true;
        if (track.kind === Track.Kind.Video) {
          element.muted = true;
          setViewerState('live');
          setNotice('');
        }
        Promise.resolve(element.play?.()).catch(() => {});
      } catch (error) {
        setNotice(error?.message || 'Could not display LIVE video.');
      }
    };

    const connect = async () => {
      try {
        // Registration/counting must never block opening the viewer.
        safeRpc('droxion_join_live', { p_host_id: hostId }).then(({ data, error }) => {
          if (cancelled || runId !== connectRunRef.current) return;
          if (error || data?.allowed === false) {
            setNotice(error?.message || 'This LIVE may have ended.');
          }
        }).catch(() => {});

        const room = await connectViewerTransport({
          sessionId,
          callbacks: {
            onTrackSubscribed: (track, _publication, participant) => attachTrack(track, participant),
            onTrackUnsubscribed: track => {
              try { detachRemoteTrack(track); } catch {}
            },
            onParticipantChange: () => {
              const count = roomRef.current?.remoteParticipants?.size || 0;
              setViewerCount(Math.max(0, count));
            },
            onReconnecting: () => {
              if (!cancelled) {
                setViewerState('reconnecting');
                setNotice('Reconnecting LIVE…');
              }
            },
            onReconnected: () => {
              if (!cancelled) setNotice('');
            },
            onDisconnected: () => {
              if (!cancelled) {
                setViewerState('ended');
                setNotice('LIVE disconnected.');
              }
            }
          }
        });

        if (cancelled || runId !== connectRunRef.current) {
          disconnectTransport(room).catch(() => {});
          return;
        }

        connectedRoom = room;
        roomRef.current = room;
        setViewerCount(Math.max(Number(activeRoom.viewer_count || 0), room.remoteParticipants?.size || 0));
        Promise.resolve(unlockRemoteAudio(room)).catch(() => {});
      } catch (error) {
        if (!cancelled && runId === connectRunRef.current) {
          setViewerState('error');
          setNotice(error?.message || 'Could not open this LIVE.');
        }
      }
    };

    // One animation frame guarantees React has committed the <video>/<audio>
    // elements before LiveKit can deliver TrackSubscribed.
    const frame = window.requestAnimationFrame(connect);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (connectedRoom && roomRef.current === connectedRoom) roomRef.current = null;
      disconnectTransport(connectedRoom).catch(() => {});
    };
  }, [activeRoom?.session_id, activeRoom?.user_id]);

  useEffect(() => {
    const sessionId = activeRoom?.session_id;
    if (!sessionId) return undefined;

    const beat = () => safeRpc('droxion_live_viewer_heartbeat', { p_session_id: sessionId }).catch(() => {});
    beat();
    const timer = window.setInterval(beat, VIEWER_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [activeRoom?.session_id]);

  // Chat/gift subscriptions are deliberately separate from the video transport.
  useEffect(() => {
    const sessionId = activeRoom?.session_id;
    if (!sessionId) return undefined;

    let stopped = false;
    lastChatIdRef.current = 0;

    safeRpc('droxion_live_chat_messages', {
      p_session_id: sessionId,
      p_after_id: 0
    }).then(({ data, error }) => {
      if (stopped || error) return;
      const rows = Array.isArray(data) ? data : [];
      setMessages(dedupeById(rows));
      lastChatIdRef.current = rows.reduce((max, row) => Math.max(max, Number(row?.id || 0)), 0);
    }).catch(() => {});

    let unsubscribe = null;
    try {
      unsubscribe = subscribeLiveEvents(sessionId, event => {
        if (stopped || !event) return;
        if (event.type === 'chat' && event.row) {
          setMessages(current => dedupeById([...current, event.row]));
          lastChatIdRef.current = Math.max(lastChatIdRef.current, Number(event.row.id || 0));
        }
        if (event.type === 'gift' && event.row) {
          setGiftEvents(current => dedupeById([...current, event.row], 30));
        }
      });
    } catch {}

    return () => {
      stopped = true;
      try { unsubscribe?.(); } catch {}
    };
  }, [activeRoom?.session_id]);

  useEffect(() => () => {
    connectRunRef.current += 1;
    const room = roomRef.current;
    roomRef.current = null;
    disconnectTransport(room).catch(() => {});
  }, []);

  async function sendChat() {
    const sessionId = activeRoom?.session_id;
    const body = draft.trim();
    if (!sessionId || !body || sendingChat) return;

    setSendingChat(true);
    try {
      const { data, error } = await safeRpc('droxion_send_live_chat', {
        p_session_id: sessionId,
        p_body: body
      });
      if (error || data?.allowed === false) {
        throw new Error(error?.message || data?.reason || 'Message could not be sent.');
      }
      setDraft('');

      // Pull the just-sent row immediately; realtime remains the normal path.
      const { data: rows } = await safeRpc('droxion_live_chat_messages', {
        p_session_id: sessionId,
        p_after_id: lastChatIdRef.current
      });
      if (Array.isArray(rows) && rows.length) {
        setMessages(current => dedupeById([...current, ...rows]));
        lastChatIdRef.current = Math.max(lastChatIdRef.current, ...rows.map(row => Number(row?.id || 0)));
      }
    } catch (error) {
      setNotice(error?.message || 'Message could not be sent.');
    } finally {
      setSendingChat(false);
    }
  }

  async function sendGift(gift = selectedGift) {
    if (!gift?.gift_code || busyGift) return;
    if (!currentUserId) {
      setNotice('Sign in to send gifts.');
      return;
    }
    if (!activeRoom?.user_id) {
      setNotice('This creator is no longer LIVE.');
      return;
    }
    if (String(activeRoom.user_id) === String(currentUserId)) {
      setNotice("You can't send a gift to your own LIVE from the same account.");
      return;
    }

    setBusyGift(String(gift.gift_code));
    setNotice('');
    try {
      const { data, error } = await safeRpc('droxion_send_live_gift', {
        p_recipient_id: activeRoom.user_id,
        p_gift_code: gift.gift_code
      });
      if (data?.reason === 'insufficient_coins') {
        setGiftDrawerOpen(false);
        setSelectedGift(null);
        setNotice('');
        onOpenWallet?.();
        return;
      }
      if (error || data?.allowed === false) {
        throw new Error(giftFailureMessage(data, error, gift));
      }

      onCoinsChanged?.(Number(data?.coin_balance ?? coins));
      setGiftDrawerOpen(false);
      setSelectedGift(null);
      setNotice(`${data?.emoji || gift.emoji || '🎁'} ${data?.gift_name || gift.gift_name || 'Gift'} sent to ${activeRoom.display_name || 'creator'}.`);
      window.setTimeout(() => setNotice(current => current?.includes('sent to') ? '' : current), 2200);
    } catch (error) {
      setNotice(error?.message || 'Gift could not be sent. Please try again.');
    } finally {
      setBusyGift('');
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    }
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
    setPullDistance(Math.min(92, Math.max(0, y - pullStartYRef.current) * 0.55));
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
    await loadFeed({ spinner: true });
    setPullDistance(0);
  }

  if (activeRoom) {
    const combinedEvents = [
      ...messages.slice(-7).map(row => ({ ...row, eventType: 'chat', eventKey: `chat-${row.id}` })),
      ...giftEvents.slice(-4).map(row => ({ ...row, eventType: 'gift', eventKey: `gift-${row.id}` }))
    ].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).slice(-8);

    return (
      <section className="productionViewerPage">
        <video ref={videoRef} className="productionViewerVideo" autoPlay playsInline muted />
        <audio ref={audioRef} autoPlay playsInline />

        <div className="productionViewerTop">
          <button type="button" onClick={leaveViewer} aria-label="Back to Home"><ArrowLeft size={22} /></button>
          <div><span className="productionViewerLive">LIVE</span><strong>{activeRoom.display_name || 'Droxion Live'}</strong></div>
          <span className="productionViewerCount"><Users size={15} /> {viewerCount}</span>
        </div>

        {viewerState !== 'live' && (
          <div className="productionViewerStatus">
            <Radio size={32} />
            <strong>{viewerState === 'error' ? 'Could not open LIVE' : viewerState === 'ended' ? 'LIVE ended' : viewerState === 'reconnecting' ? 'Reconnecting LIVE…' : 'Connecting LIVE video…'}</strong>
            {notice && <span>{notice}</span>}
          </div>
        )}

        {viewerState === 'live' && (
          <>
            <LiveGiftCinema giftEvents={giftEvents} />

            <div className="productionViewerChat" aria-live="polite">
              {combinedEvents.length === 0 && <div className="productionViewerChatHint">Live chat will appear here.</div>}
              {combinedEvents.map(event => event.eventType === 'gift' ? (
                <div className="productionViewerChatLine productionViewerGiftLine" key={event.eventKey}>
                  <strong>{event.display_name || event.sender_name || 'Viewer'}</strong>
                  <span>sent {event.emoji || '🎁'} {event.gift_name || 'a gift'}</span>
                </div>
              ) : (
                <div className="productionViewerChatLine" key={event.eventKey}>
                  <strong>{event.display_name || 'Viewer'}</strong>
                  <span>{event.body}</span>
                </div>
              ))}
            </div>

            <div className="productionViewerComposer">
              <input
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Say something…"
                maxLength={500}
                aria-label="Live chat message"
              />
              <button
                type="button"
                className="productionViewerGiftButton"
                onClick={() => {
                  setGiftTab('popular');
                  setSelectedGift(null);
                  setGiftDrawerOpen(true);
                }}
                aria-label="Open gifts"
              >
                <Gift size={20} />
              </button>
              <button type="button" className="productionViewerSendButton" onClick={sendChat} disabled={!draft.trim() || sendingChat} aria-label="Send message">
                <Send size={20} />
              </button>
            </div>
          </>
        )}

        {viewerState === 'live' && notice && <div className="productionViewerNotice">{notice}</div>}

        {giftDrawerOpen && (
          <div className="productionGiftBackdrop" onClick={() => { if (!busyGift) { setGiftDrawerOpen(false); setSelectedGift(null); } }}>
            <div className="productionGiftDrawer" onClick={event => event.stopPropagation()}>
              <div className="productionGiftHeader">
                <div><strong>Choose a gift</strong><span>🪙 {coins} coins · Select first, then SEND</span></div>
                <button type="button" disabled={Boolean(busyGift)} onClick={() => { setGiftDrawerOpen(false); setSelectedGift(null); }} aria-label="Close gifts"><X size={21} /></button>
              </div>

              <div className="productionGiftTabs" role="tablist" aria-label="Gift categories">
                {GIFT_TABS.map(tab => (
                  <button
                    type="button"
                    role="tab"
                    key={tab.id}
                    aria-selected={giftTab === tab.id}
                    className={giftTab === tab.id ? 'isActive' : ''}
                    disabled={Boolean(busyGift)}
                    onClick={() => {
                      setGiftTab(tab.id);
                      setSelectedGift(null);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="productionGiftGrid">
                {visibleGiftOptions.map(gift => {
                  const selected = selectedGift?.gift_code === gift.gift_code;
                  return (
                    <button
                      type="button"
                      key={gift.gift_code}
                      className={selected ? 'isSelected' : ''}
                      aria-pressed={selected}
                      disabled={Boolean(busyGift)}
                      onClick={() => setSelectedGift(gift)}
                    >
                      <span>{gift.emoji || '🎁'}</span>
                      <strong>{gift.gift_name}</strong>
                      <small>{gift.cost_coins} coins</small>
                      {selected && <b className="productionGiftSelectedMark">Selected</b>}
                    </button>
                  );
                })}
              </div>

              <div className="productionGiftSelectionBar">
                <div className="productionGiftSelectionSummary">
                  {selectedGift ? (
                    <>
                      <span>{selectedGift.emoji || '🎁'}</span>
                      <div><strong>{selectedGift.gift_name}</strong><small>{selectedGift.cost_coins} coins</small></div>
                    </>
                  ) : (
                    <div><strong>Select a gift</strong><small>Nothing is charged until you tap SEND.</small></div>
                  )}
                </div>
                <button type="button" className="productionGiftSend" disabled={!selectedGift || Boolean(busyGift)} onClick={() => sendGift()}>
                  {busyGift ? 'SENDING…' : 'SEND'}
                </button>
              </div>

              <button type="button" className="productionBuyCoins" onClick={() => onOpenWallet?.()}>+ Buy Coins</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="productionLiveBrowse" onTouchStart={handlePullStart} onTouchMove={handlePullMove} onTouchEnd={handlePullEnd} onTouchCancel={handlePullEnd}>
      <div className="livePullRefresh" style={{ height: pullDistance }}><RefreshCw size={18} /><span>{refreshing ? 'Refreshing LIVE…' : pullDistance >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull down to refresh LIVE'}</span></div>
      <div className="productionLiveRefreshHint"><span>Pull down to refresh LIVE</span><button type="button" onClick={() => loadFeed({ spinner: true })} disabled={refreshing}><RefreshCw size={16} /></button></div>

      {notice && <div className="productionBrowseNotice">{notice}</div>}
      {loading ? (
        <div className="productionLiveEmpty"><RefreshCw size={28} /><strong>Loading LIVE…</strong></div>
      ) : profiles.length === 0 ? (
        <div className="productionLiveEmpty"><Radio size={30} /><strong>No one is LIVE right now</strong><span>Pull down to refresh.</span></div>
      ) : (
        <div className="productionLiveGrid">
          {profiles.map(profile => (
            <button type="button" key={`${profile.user_id}:${profile.session_id}`} className="productionLiveCard" onClick={() => openRoom(profile)}>
              <div className="productionLiveCardMedia">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <div className="productionLiveAvatarPlaceholder" />}
                <div className="productionLiveCardShade" />
                <span className="productionLiveBadge">LIVE</span>
                <span className="productionLiveViewers"><Users size={14} /> {profile.viewer_count || 0}</span>
                <div className="productionLiveCardInfo">
                  <strong>{profile.display_name || 'Droxion creator'}{profile.age ? `, ${profile.age}` : ''}</strong>
                  <b>{profile.title || 'Live on Droxion'}</b>
                  <small>{profile.country || 'Global'}{profile.language ? ` · ${profile.language}` : ''}</small>
                  <em>Tap to open LIVE</em>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
