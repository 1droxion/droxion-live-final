import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Radio, RefreshCw, Users } from 'lucide-react';
import { Track } from 'livekit-client';
import { supabase } from '../../../supabaseClient';
import { attachRemoteTrack, detachRemoteTrack, unlockRemoteAudio } from '../../../livekit/livekitRoom';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';
import '../styles/production-live-browser.css';

const PULL_THRESHOLD = 58;
const VIEWER_HEARTBEAT_MS = 45000;

function safeRpc(name, args) {
  return Promise.resolve(supabase.rpc(name, args));
}

export default function ProductionLiveBrowser({ currentUserId, onImmersiveChange }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [activeRoom, setActiveRoom] = useState(null);
  const [viewerState, setViewerState] = useState('idle');
  const [notice, setNotice] = useState('');
  const [viewerCount, setViewerCount] = useState(0);

  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const pullStartYRef = useRef(null);
  const connectRunRef = useRef(0);
  const refreshTimerRef = useRef(null);

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
    setActiveRoom(profile);
  }

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

  useEffect(() => () => {
    connectRunRef.current += 1;
    const room = roomRef.current;
    roomRef.current = null;
    disconnectTransport(room).catch(() => {});
  }, []);

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

        {viewerState === 'live' && notice && <div className="productionViewerNotice">{notice}</div>}
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
