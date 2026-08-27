import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Mic, MicOff, Radio, RotateCcw, Users, X } from 'lucide-react';
import LocalLiveVideo from './LocalLiveVideo';
import HostLiveAudienceOverlay from './HostLiveAudienceOverlay';
import { useLiveBroadcast } from '../hooks/useLiveBroadcast';
import { useLiveReleaseSidecars } from '../hooks/useLiveReleaseSidecars';
import { setHostCameraMuted, setHostMicrophoneMuted } from '../services/liveHostControlService';
import { LIVE_PHASE, isLiveBusy } from '../types/liveState';
import '../styles/production-live-host.css';

export default function ProductionLiveHost({ onClose, creatorId }) {
  const { state, mediaStream, ensurePreview, stopPreview, startBroadcast, endBroadcast, getRoom } = useLiveBroadcast();
  const [title, setTitle] = useState('Live on Droxion');
  const [orientation, setOrientation] = useState('vertical');
  const [previewRequested, setPreviewRequested] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [controlBusy, setControlBusy] = useState('');
  const [controlError, setControlError] = useState('');

  const busy = isLiveBusy(state.phase);
  const live = state.phase === LIVE_PHASE.LIVE || state.phase === LIVE_PHASE.RECONNECTING;
  const connecting = state.phase === LIVE_PHASE.STARTING || state.phase === LIVE_PHASE.CONNECTING;

  useLiveReleaseSidecars({
    enabled: live,
    creatorId,
    sessionId: state.sessionId,
    stream: mediaStream,
    title
  });

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
    }
  }, [live]);

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

  return (
    <section className="prodLiveHost" aria-label="Droxion LIVE studio">
      <header className="prodLiveHostTopbar">
        <button type="button" className="prodLiveIconButton" onClick={closeHost} aria-label="Back">
          <ArrowLeft size={24} />
        </button>
        <div className="prodLiveIdentity">
          <strong>{live ? 'Your LIVE' : 'Go LIVE'}</strong>
          <span>{statusText}</span>
        </div>
        <div className={`prodLiveStatus ${live ? 'isLive' : ''}`}>
          <Radio size={16} />
          <span>{live ? 'LIVE' : 'PREVIEW'}</span>
        </div>
      </header>

      <div className={`prodLiveStage ${orientation === 'horizontal' ? 'horizontal' : 'vertical'}`}>
        {mediaStream ? (
          <LocalLiveVideo stream={mediaStream} />
        ) : (
          <div className="prodLiveCameraPlaceholder">
            <Camera size={42} />
            <strong>Camera preview</strong>
            <span>Allow camera and microphone to start.</span>
          </div>
        )}

        {live && <div className="prodLiveBadge">LIVE</div>}
        <div className="prodLiveViewerPill"><Users size={17} /><span>{state.viewerCount || 0}</span></div>

        {live ? (
          <div className="prodLiveMediaControls" aria-label="LIVE media controls">
            <button
              type="button"
              className={micMuted ? 'isOff' : ''}
              onClick={toggleMicrophone}
              aria-pressed={micMuted}
              aria-busy={controlBusy === 'mic'}
              aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
              title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              className={cameraMuted ? 'isOff' : ''}
              onClick={toggleCamera}
              aria-pressed={cameraMuted}
              aria-busy={controlBusy === 'camera'}
              aria-label={cameraMuted ? 'Turn camera on' : 'Turn camera off'}
              title={cameraMuted ? 'Turn camera on' : 'Turn camera off'}
            >
              {cameraMuted ? <CameraOff size={18} /> : <Camera size={18} />}
            </button>
          </div>
        ) : (
          <div className="prodLiveMediaPill"><Mic size={17} /><Camera size={17} /></div>
        )}

        {live && state.sessionId && <HostLiveAudienceOverlay sessionId={state.sessionId} />}
      </div>

      {(state.error || controlError) && <div className="prodLiveError">{controlError || state.error}</div>}

      {!live && !connecting && (
        <div className="prodLiveSetup">
          <label>
            <span>LIVE title</span>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="What are you streaming?" />
          </label>
          <label>
            <span>Orientation</span>
            <select value={orientation} onChange={event => setOrientation(event.target.value)}>
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          {!mediaStream && (
            <button type="button" className="prodLiveSecondary" onClick={() => ensurePreview({ orientation })} disabled={busy}>
              <RotateCcw size={18} /> Retry camera
            </button>
          )}
          <button
            type="button"
            className="prodLiveStart"
            disabled={busy || !mediaStream}
            onClick={() => startBroadcast({ title, orientation })}
          >
            <Radio size={19} /> Start LIVE
          </button>
        </div>
      )}

      {connecting && (
        <div className="prodLiveConnecting">
          <span className="prodLiveSpinner" />
          <strong>{statusText}</strong>
          <span>Connecting your camera and microphone securely…</span>
        </div>
      )}

      {live && (
        <div className="prodLiveBottomControls">
          <div>
            <strong>{title || 'Live on Droxion'}</strong>
            <span>{state.viewerCount || 0} viewer{state.viewerCount === 1 ? '' : 's'}</span>
          </div>
          <button type="button" className="prodLiveEnd" onClick={endBroadcast} disabled={state.phase === LIVE_PHASE.ENDING}>
            <X size={18} /> End LIVE
          </button>
        </div>
      )}
    </section>
  );
}
