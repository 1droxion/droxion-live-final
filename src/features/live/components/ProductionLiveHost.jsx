import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Mic, MicOff, MoreHorizontal, Radio, RotateCcw, Trophy, Users, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import LocalLiveVideo from './LocalLiveVideo';
import HostLiveAudienceOverlay from './HostLiveAudienceOverlay';
import LiveAudienceDrawer from './LiveAudienceDrawer';
import LiveRemoteGuestTile from './LiveRemoteGuestTile';
import { useLiveBroadcast } from '../hooks/useLiveBroadcast';
import { useLiveReleaseSidecars } from '../hooks/useLiveReleaseSidecars';
import { setHostCameraMuted, setHostMicrophoneMuted } from '../services/liveHostControlService';
import { LIVE_PHASE, isLiveBusy } from '../types/liveState';
import '../styles/production-live-host.css';
import '../styles/live-audience-trigger.css';
import '../styles/live-host-minimal-redesign.css';

export default function ProductionLiveHost({ onClose, creatorId }) {
  const { state, mediaStream, ensurePreview, stopPreview, startBroadcast, endBroadcast, getRoom } = useLiveBroadcast();
  const [title, setTitle] = useState('Live on Droxion');
  const [orientation, setOrientation] = useState('vertical');
  const [previewRequested, setPreviewRequested] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [controlBusy, setControlBusy] = useState('');
  const [controlError, setControlError] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [guestState, setGuestState] = useState({ status: 'none' });
  const [guestVisible, setGuestVisible] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  const busy = isLiveBusy(state.phase);
  const live = state.phase === LIVE_PHASE.LIVE || state.phase === LIVE_PHASE.RECONNECTING;
  const connecting = state.phase === LIVE_PHASE.STARTING || state.phase === LIVE_PHASE.CONNECTING;
  const guestAccepted = guestState?.status === 'accepted' && Boolean(guestState?.invitee_id);
  const splitLive = live && guestAccepted && guestVisible;

  useLiveReleaseSidecars({ enabled: live, creatorId, sessionId: state.sessionId, stream: mediaStream, title });

  const statusText = useMemo(() => {
    if (live) return state.phase === LIVE_PHASE.RECONNECTING ? 'Reconnecting…' : 'You are live';
    if (connecting) return state.phase === LIVE_PHASE.STARTING ? 'Starting LIVE…' : 'Connecting video…';
    if (state.phase === LIVE_PHASE.ERROR) return state.error || 'LIVE could not start.';
    if (mediaStream) return 'Preview ready';
    return 'Ready to go LIVE';
  }, [live, connecting, state.phase, state.error, mediaStream]);

  useEffect(() => {
    if (previewRequested || mediaStream || live || connecting) return;
    setPreviewRequested(true);
    ensurePreview({ orientation }).catch(() => {});
  }, [previewRequested, mediaStream, live, connecting, orientation, ensurePreview]);

  useEffect(() => {
    if (!live) {
      setMicMuted(false);
      setCameraMuted(false);
      setControlBusy('');
      setControlError('');
      setAudienceOpen(false);
      setControlsOpen(false);
      setGuestState({ status: 'none' });
      setGuestVisible(false);
      setGuestBusy(false);
    }
  }, [live]);

  useEffect(() => {
    if (!live || !state.sessionId) return undefined;
    let stopped = false;

    const loadGuestState = async () => {
      try {
        const { data, error } = await supabase.rpc('droxion_host_live_guest_state', { p_session_id: state.sessionId });
        if (stopped || error) return;
        const next = data && typeof data === 'object' ? data : { status: 'none' };
        setGuestState(next);
        if (next.status !== 'accepted') setGuestVisible(false);
      } catch {}
    };

    loadGuestState();
    const timer = window.setInterval(loadGuestState, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [live, state.sessionId]);

  useEffect(() => {
    if (!controlsOpen) return undefined;
    const closeOutside = event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.prodLiveMoreMenu') || target.closest('.prodLiveMoreButton')) return;
      setControlsOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [controlsOpen]);

  async function closeHost() {
    if (live || connecting || state.sessionId) {
      try { await endBroadcast(); } catch {}
    } else {
      stopPreview();
    }
    onClose?.();
  }

  async function toggleMicrophone(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!live || controlBusy) return;
    const room = getRoom();
    if (!room) return;
    const previous = micMuted;
    const nextMuted = !previous;
    setMicMuted(nextMuted);
    setControlBusy('mic');
    setControlError('');
    try {
      await setHostMicrophoneMuted(room, nextMuted);
    } catch (error) {
      setMicMuted(previous);
      setControlError(error?.message || 'Could not change microphone.');
    } finally {
      setControlBusy('');
    }
  }

  async function toggleCamera(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!live || controlBusy) return;
    const room = getRoom();
    if (!room) return;
    const previous = cameraMuted;
    const nextMuted = !previous;
    setCameraMuted(nextMuted);
    setControlBusy('camera');
    setControlError('');
    try {
      await setHostCameraMuted(room, nextMuted);
    } catch (error) {
      setCameraMuted(previous);
      setControlError(error?.message || 'Could not change camera.');
    } finally {
      setControlBusy('');
    }
  }

  function openAudience() {
    setControlsOpen(false);
    setAudienceOpen(true);
  }

  function openTopSupporters() {
    setControlsOpen(false);
    try { document.querySelector('.liveTopSupportersTrigger')?.click(); } catch {}
  }

  async function removeGuestFromMenu() {
    if (!state.sessionId || !guestState?.invitee_id || guestBusy) return;
    setGuestBusy(true);
    setControlError('');
    try {
      const { data, error } = await supabase.rpc('droxion_host_remove_live_guest', {
        p_session_id: state.sessionId,
        p_invitee_id: guestState.invitee_id
      });
      if (error || data?.allowed === false) {
        throw new Error(error?.message || data?.reason || 'Could not remove guest.');
      }
      setGuestState({ status: 'none' });
      setGuestVisible(false);
      setControlsOpen(false);
    } catch (error) {
      setControlError(error?.message || 'Could not remove guest.');
    } finally {
      setGuestBusy(false);
    }
  }

  async function endLiveFromMenu() {
    setControlsOpen(false);
    await endBroadcast();
  }

  return (
    <section className={`prodLiveHost ${live ? 'isMinimalLive' : ''} ${splitLive ? 'hasGuest' : ''}`} aria-label="Droxion LIVE studio">
      {!live && (
        <header className="prodLiveHostTopbar">
          <button type="button" className="prodLiveIconButton" onClick={closeHost} aria-label="Back"><ArrowLeft size={24} /></button>
          <div className="prodLiveIdentity"><strong>Go LIVE</strong><span>{statusText}</span></div>
          <div className="prodLiveStatus"><Radio size={16} /><span>PREVIEW</span></div>
        </header>
      )}

      <div className={`prodLiveStage ${orientation === 'horizontal' ? 'horizontal' : 'vertical'}`}>
        {mediaStream ? <LocalLiveVideo stream={mediaStream} /> : (
          <div className="prodLiveCameraPlaceholder"><Camera size={42} /><strong>Camera preview</strong><span>Allow camera and microphone to start.</span></div>
        )}

        {live && <div className="prodLiveBadge prodLiveMinimalLiveBadge">LIVE</div>}

        {live && (state.sessionId ? (
          <button type="button" className="prodLiveViewerPill liveAudienceTrigger prodLiveMinimalViewerCount" onClick={openAudience} aria-label="Open LIVE audience">
            <Users size={16} /><span>{state.viewerCount || 0}</span>
          </button>
        ) : (
          <div className="prodLiveViewerPill prodLiveMinimalViewerCount"><Users size={16} /><span>{state.viewerCount || 0}</span></div>
        ))}

        {live && guestAccepted && <LiveRemoteGuestTile room={getRoom()} onVisibilityChange={setGuestVisible} />}
        {live && state.sessionId && <HostLiveAudienceOverlay sessionId={state.sessionId} />}

        {live && controlsOpen && (
          <div className="prodLiveMoreMenu" role="menu" aria-label="LIVE controls">
            <button type="button" onClick={toggleMicrophone} disabled={Boolean(controlBusy)} role="menuitem">
              {micMuted ? <MicOff size={19} /> : <Mic size={19} />}
              <span><strong>Microphone</strong><small>{micMuted ? 'Off' : 'On'}</small></span>
            </button>
            <button type="button" onClick={toggleCamera} disabled={Boolean(controlBusy)} role="menuitem">
              {cameraMuted ? <CameraOff size={19} /> : <Camera size={19} />}
              <span><strong>Camera</strong><small>{cameraMuted ? 'Off' : 'On'}</small></span>
            </button>
            <button type="button" onClick={openAudience} disabled={!state.sessionId} role="menuitem">
              <Users size={19} /><span><strong>Audience / Invite</strong><small>Viewers and invite guest</small></span>
            </button>
            <button type="button" onClick={openTopSupporters} role="menuitem">
              <Trophy size={19} /><span><strong>Top Supporters</strong><small>Who gave the most gifts</small></span>
            </button>
            {guestAccepted && (
              <button type="button" className="prodLiveMoreRemoveGuest" onClick={removeGuestFromMenu} disabled={guestBusy} role="menuitem">
                <X size={19} /><span><strong>Remove Guest</strong><small>{guestBusy ? 'Removing…' : `Remove ${guestState.display_name || 'guest'} from LIVE`}</small></span>
              </button>
            )}
            <button type="button" className="prodLiveMoreEnd" onClick={endLiveFromMenu} disabled={state.phase === LIVE_PHASE.ENDING} role="menuitem">
              <X size={19} /><span><strong>End LIVE</strong><small>Stop this broadcast</small></span>
            </button>
          </div>
        )}

        {live && (
          <button type="button" className={`prodLiveMoreButton ${controlsOpen ? 'isOpen' : ''}`} onClick={() => setControlsOpen(value => !value)} aria-expanded={controlsOpen} aria-label="More LIVE controls">
            <MoreHorizontal size={27} />
          </button>
        )}
      </div>

      {(state.error || controlError) && <div className="prodLiveError">{controlError || state.error}</div>}

      {!live && !connecting && (
        <div className="prodLiveSetup">
          <label><span>LIVE title</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="What are you streaming?" /></label>
          <label><span>Orientation</span><select value={orientation} onChange={event => setOrientation(event.target.value)}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label>
          {!mediaStream && <button type="button" className="prodLiveSecondary" onClick={() => ensurePreview({ orientation })} disabled={busy}><RotateCcw size={18} /> Retry camera</button>}
          <button type="button" className="prodLiveStart" disabled={busy || !mediaStream} onClick={() => startBroadcast({ title, orientation })}><Radio size={19} /> Start LIVE</button>
        </div>
      )}

      {connecting && <div className="prodLiveConnecting"><span className="prodLiveSpinner" /><strong>{statusText}</strong><span>Connecting your camera and microphone securely…</span></div>}

      <LiveAudienceDrawer open={audienceOpen} sessionId={state.sessionId} onClose={() => setAudienceOpen(false)} />
    </section>
  );
}
