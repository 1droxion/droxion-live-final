import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, CameraOff, Gamepad2, LayoutGrid, Mic, MicOff, MonitorUp, MoreHorizontal, Radio, RotateCcw, SwitchCamera, Trophy, Users, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import LocalLiveVideo from './LocalLiveVideo';
import HostLiveAudienceOverlay from './HostLiveAudienceOverlay';
import LiveAudienceDrawer from './LiveAudienceDrawer';
import LiveRemoteGuestTile from './LiveRemoteGuestTile';
import { useLiveBroadcast } from '../hooks/useLiveBroadcast';
import { useLiveReleaseSidecars } from '../hooks/useLiveReleaseSidecars';
import { setHostCameraMuted, setHostMicrophoneMuted, switchHostCameraFacing } from '../services/liveHostControlService';
import { refreshLiveFacecamLayout } from '../services/livePublisherService';
import { createLiveStudioStream, defaultStudioLayout, LIVE_SOURCE_MODE, studioLayoutsForOrientation, supportsDisplayCapture } from '../services/liveStudioService';
import { LIVE_PHASE, isLiveBusy } from '../types/liveState';
import '../styles/production-live-host.css';
import '../styles/live-audience-trigger.css';
import '../styles/live-host-minimal-redesign.css';
import '../styles/live-studio.css';

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 8);
}

export default function ProductionLiveHost({ onClose, creatorId }) {
  const { state, mediaStream, ensurePreview, setPreparedMedia, stopPreview, startBroadcast, endBroadcast, getRoom } = useLiveBroadcast();
  const [title, setTitle] = useState('Live on Droxion');
  const [tagsText, setTagsText] = useState('');
  const [orientation, setOrientation] = useState('vertical');
  const [sourceMode, setSourceMode] = useState(LIVE_SOURCE_MODE.CAMERA);
  const [studioLayout, setStudioLayout] = useState(defaultStudioLayout('vertical'));
  const [facecamPosition, setFacecamPosition] = useState({ x: 0.735, y: 0.64, size: 0.235 });
  const [studioPreparing, setStudioPreparing] = useState(false);
  const [studioAudioNotice, setStudioAudioNotice] = useState('');
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(false);
  const [setupSaved, setSetupSaved] = useState(false);
  const studioControllerRef = useRef(null);
  const facecamPositionRef = useRef(facecamPosition);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const screenEndShouldEndBroadcastRef = useRef(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [controlBusy, setControlBusy] = useState('');
  const [controlError, setControlError] = useState('');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [guestState, setGuestState] = useState({ status: 'none' });
  const [guestVisible, setGuestVisible] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);

  const busy = isLiveBusy(state.phase) || studioPreparing;
  const live = state.phase === LIVE_PHASE.LIVE || state.phase === LIVE_PHASE.RECONNECTING;
  const connecting = state.phase === LIVE_PHASE.STARTING || state.phase === LIVE_PHASE.CONNECTING;
  screenEndShouldEndBroadcastRef.current = Boolean(state.sessionId) || live || connecting;
  const guestAccepted = guestState?.status === 'accepted' && Boolean(guestState?.invitee_id);
  const splitLive = live && guestAccepted && guestVisible;
  const isStudioMode = sourceMode !== LIVE_SOURCE_MODE.CAMERA;
  const hasFacecam = sourceMode === LIVE_SOURCE_MODE.SCREEN_CAMERA;
  const availableLayouts = useMemo(() => studioLayoutsForOrientation(orientation), [orientation]);
  const tags = useMemo(() => parseTags(tagsText), [tagsText]);

  useLiveReleaseSidecars({ enabled: live, creatorId, sessionId: state.sessionId, stream: mediaStream, title });

  const statusText = useMemo(() => {
    if (live) return state.phase === LIVE_PHASE.RECONNECTING ? 'Reconnecting…' : 'You are live';
    if (connecting) return state.phase === LIVE_PHASE.STARTING ? 'Starting LIVE…' : 'Connecting video…';
    if (state.phase === LIVE_PHASE.ERROR) return state.error || 'LIVE could not start.';
    if (mediaStream && isStudioMode) return setupSaved ? 'Setup saved — ready to go LIVE' : 'Preview ready — adjust your stream';
    if (mediaStream) return 'Preview ready';
    return 'Choose your format and source';
  }, [live, connecting, state.phase, state.error, mediaStream, isStudioMode, setupSaved]);

  useEffect(() => {
    if (sourceMode !== LIVE_SOURCE_MODE.CAMERA || previewRequested || mediaStream || live || connecting) return;
    setPreviewRequested(true);
    ensurePreview({ orientation, facingMode }).catch(() => {});
  }, [sourceMode, previewRequested, mediaStream, live, connecting, orientation, facingMode, ensurePreview]);

  useEffect(() => {
    const next = defaultStudioLayout(orientation);
    setStudioLayout(next);
    setSetupSaved(false);
    studioControllerRef.current?.setLayout?.(next);
  }, [orientation]);

  useEffect(() => {
    if (!live) {
      setMicMuted(false);
      setCameraMuted(false);
      setControlBusy('');
      setControlError('');
      setAudienceOpen(false);
      setControlsOpen(false);
      setLayoutPanelOpen(false);
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
    return () => { stopped = true; window.clearInterval(timer); };
  }, [live, state.sessionId]);

  useEffect(() => {
    if (!controlsOpen) return undefined;
    const closeOutside = event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.prodLiveMoreMenu') || target.closest('.prodLiveMoreButton') || target.closest('.liveStudioLayoutPanel')) return;
      setControlsOpen(false);
      setLayoutPanelOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [controlsOpen]);

  async function closeHost() {
    if (live || connecting || state.sessionId) { try { await endBroadcast(); } catch {} }
    else stopPreview();
    studioControllerRef.current = null;
    onClose?.();
  }

  function chooseFormat(nextOrientation) {
    if (live || connecting || busy || (isStudioMode && mediaStream)) return;
    setOrientation(nextOrientation === 'horizontal' ? 'horizontal' : 'vertical');
    setSetupSaved(false);
  }

  async function chooseCameraSource() {
    if (live || connecting || busy) return;
    stopPreview();
    studioControllerRef.current = null;
    setSetupSaved(false);
    setSourceMode(LIVE_SOURCE_MODE.CAMERA);
    setCameraMuted(false);
    setPreviewRequested(true);
    setStudioAudioNotice('');
    setControlError('');
    try { await ensurePreview({ orientation, facingMode }); }
    catch (error) { setControlError(error?.message || 'Could not open camera.'); }
  }

  async function chooseStudioSource(nextMode) {
    if (live || connecting || busy) return;
    if (!supportsDisplayCapture()) {
      setControlError('Screen/Game sharing is available on supported desktop browsers. Mobile screen broadcast comes in the native build.');
      return;
    }
    setStudioPreparing(true);
    setSetupSaved(false);
    setControlError('');
    setStudioAudioNotice('');
    const layout = defaultStudioLayout(orientation);
    setStudioLayout(layout);
    try {
      stopPreview();
      studioControllerRef.current = null;
      const controller = await createLiveStudioStream({
        mode: nextMode,
        layout,
        orientation,
        facingMode,
        facecamPosition: facecamPositionRef.current,
        onScreenEnded: () => {
          if (screenEndShouldEndBroadcastRef.current) endBroadcast().catch(() => {});
          else {
            stopPreview();
            studioControllerRef.current = null;
            setSourceMode(LIVE_SOURCE_MODE.CAMERA);
            setSetupSaved(false);
            setPreviewRequested(false);
          }
        }
      });
      studioControllerRef.current = controller;
      setPreparedMedia(controller.stream, controller.stop);
      setSourceMode(nextMode);
      setCameraMuted(false);
      setPreviewRequested(true);
      if (!controller.hasSystemAudio) {
        setStudioAudioNotice('Screen is ready. To include game/video sound, choose Entire Screen and enable “Share system audio” in Chrome.');
      } else {
        setStudioAudioNotice('System audio + microphone are included.');
      }
    } catch (error) {
      setSourceMode(LIVE_SOURCE_MODE.CAMERA);
      setSetupSaved(false);
      setPreviewRequested(false);
      setStudioAudioNotice('');
      setControlError(error?.message || 'Could not start screen sharing.');
    } finally {
      setStudioPreparing(false);
    }
  }

  function chooseLayout(nextLayout) {
    setSetupSaved(false);
    setStudioLayout(nextLayout);
    studioControllerRef.current?.setLayout?.(nextLayout);
    if (live) setLayoutPanelOpen(false);
  }

  function setFacecam(next) {
    setSetupSaved(false);
    const normalized = studioControllerRef.current?.setFacecamPosition?.(next) || next;
    facecamPositionRef.current = normalized;
    setFacecamPosition(normalized);
    return normalized;
  }

  async function commitFacecamLayout() {
    if (!live || !hasFacecam || orientation !== 'horizontal' || studioLayout !== 'free_facecam') return;
    const room = getRoom();
    if (!room || !mediaStream) return;
    try {
      await refreshLiveFacecamLayout({ room, stream: mediaStream });
    } catch (error) {
      setControlError(error?.message || 'Could not update facecam layout for viewers.');
    }
  }

  function beginFacecamDrag(event) {
    if (!hasFacecam || orientation !== 'horizontal' || studioLayout !== 'free_facecam') return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    dragRef.current = { rect, pointerId: event.pointerId };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  }

  function moveFacecam(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const size = facecamPositionRef.current.size;
    const normalizedHeight = size * (4 / 3);
    const x = Math.min(0.988 - size, Math.max(0.012, (event.clientX - drag.rect.left) / drag.rect.width - size / 2));
    const y = Math.min(0.982 - normalizedHeight, Math.max(0.018, (event.clientY - drag.rect.top) / drag.rect.height - normalizedHeight / 2));
    setFacecam({ ...facecamPositionRef.current, x, y });
  }

  function endFacecamDrag(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    commitFacecamLayout().catch(() => {});
  }

  function resizeFacecam(event) {
    setFacecam({ ...facecamPositionRef.current, size: Number(event.target.value) });
  }

  async function startLiveNow() {
    if (busy || !mediaStream || (isStudioMode && !setupSaved)) return;
    if (isStudioMode) {
      try { document.querySelector('.hostLiveMonitorTrigger')?.click(); } catch {}
    }
    await startBroadcast({ title, tags, orientation });
  }

  async function toggleMicrophone(event) {
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (!live || controlBusy) return;
    const room = getRoom(); if (!room) return;
    const previous = micMuted; const nextMuted = !previous;
    setMicMuted(nextMuted); setControlBusy('mic'); setControlError('');
    try { await setHostMicrophoneMuted(room, nextMuted); }
    catch (error) { setMicMuted(previous); setControlError(error?.message || 'Could not change microphone.'); }
    finally { setControlBusy(''); }
  }

  async function toggleCamera(event) {
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (!live || controlBusy || sourceMode === LIVE_SOURCE_MODE.SCREEN) return;
    const previous = cameraMuted; const nextMuted = !previous;
    setCameraMuted(nextMuted); setControlBusy('camera'); setControlError('');
    try {
      if (hasFacecam) studioControllerRef.current?.setCameraVisible?.(!nextMuted);
      else {
        const room = getRoom(); if (!room) return;
        await setHostCameraMuted(room, nextMuted);
      }
    } catch (error) {
      setCameraMuted(previous);
      setControlError(error?.message || 'Could not change camera.');
    } finally { setControlBusy(''); }
  }

  async function switchCamera(event) {
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (!live || cameraMuted || controlBusy || sourceMode === LIVE_SOURCE_MODE.SCREEN) return;
    const previous = facingMode; const nextFacing = previous === 'user' ? 'environment' : 'user';
    setControlBusy('switch-camera'); setControlError('');
    try {
      if (hasFacecam) await studioControllerRef.current?.switchCameraFacing?.(nextFacing);
      else {
        const room = getRoom(); if (!room) return;
        await switchHostCameraFacing(room, mediaStream, nextFacing, orientation);
      }
      setFacingMode(nextFacing); setControlsOpen(false);
    } catch (error) {
      setFacingMode(previous); setControlError(error?.message || 'Could not switch camera.');
    } finally { setControlBusy(''); }
  }

  function openAudience() { setControlsOpen(false); setAudienceOpen(true); }
  function openTopSupporters() { setControlsOpen(false); try { document.querySelector('.liveTopSupportersTrigger')?.click(); } catch {} }

  async function removeGuestFromMenu() {
    if (!state.sessionId || !guestState?.invitee_id || guestBusy) return;
    setGuestBusy(true); setControlError('');
    try {
      const { data, error } = await supabase.rpc('droxion_host_remove_live_guest', { p_session_id: state.sessionId, p_invitee_id: guestState.invitee_id });
      if (error || data?.allowed === false) throw new Error(error?.message || data?.reason || 'Could not remove guest.');
      setGuestState({ status: 'none' }); setGuestVisible(false); setControlsOpen(false);
    } catch (error) { setControlError(error?.message || 'Could not remove guest.'); }
    finally { setGuestBusy(false); }
  }

  async function endLiveFromMenu() { setControlsOpen(false); setLayoutPanelOpen(false); await endBroadcast(); studioControllerRef.current = null; }

  const facecamSizeControl = hasFacecam && orientation === 'horizontal' && studioLayout === 'free_facecam' ? (
    <label className="liveStudioFacecamSize">
      <span><strong>Facecam size</strong><small>{Math.round(facecamPosition.size * 100)}%</small></span>
      <input
        type="range"
        min="0.14"
        max="0.50"
        step="0.01"
        value={facecamPosition.size}
        onChange={resizeFacecam}
        onPointerUp={() => commitFacecamLayout().catch(() => {})}
        onKeyUp={() => commitFacecamLayout().catch(() => {})}
        aria-label="Facecam size"
      />
      <small>Small ↔ Large</small>
    </label>
  ) : null;

  const showCreatorHudController = (isStudioMode && mediaStream) || (live && Boolean(state.sessionId));

  return (
    <section className={`prodLiveHost ${live ? 'isMinimalLive' : ''} ${splitLive ? 'hasGuest' : ''} ${isStudioMode ? 'isStudioLive isStudioComposer' : ''}`} aria-label="Droxion LIVE studio">
      {!live && <header className="prodLiveHostTopbar"><button type="button" className="prodLiveIconButton" onClick={closeHost} aria-label="Back"><ArrowLeft size={24} /></button><div className="prodLiveIdentity"><strong>Go LIVE</strong><span>{statusText}</span></div><div className="prodLiveStatus"><Radio size={16} /><span>PREVIEW</span></div></header>}

      {!live && !connecting && <div className="liveStudioFormatBar">
        <div><strong>Choose LIVE format</strong><small>This is exactly how the viewer canvas is shaped.</small></div>
        <div className="liveStudioFormatChoices">
          <button type="button" className={orientation === 'vertical' ? 'active' : ''} onClick={() => chooseFormat('vertical')} disabled={isStudioMode && Boolean(mediaStream)}><b>Phone</b><span>9:16 vertical</span></button>
          <button type="button" className={orientation === 'horizontal' ? 'active' : ''} onClick={() => chooseFormat('horizontal')} disabled={isStudioMode && Boolean(mediaStream)}><b>Desktop</b><span>16:9 horizontal</span></button>
        </div>
      </div>}

      <div ref={stageRef} className={`prodLiveStage ${orientation === 'horizontal' ? 'horizontal' : 'vertical'} ${mediaStream ? 'hasRealPreview' : 'isExamplePreview'}`}>
        {mediaStream ? <LocalLiveVideo stream={mediaStream} /> : <div className="prodLiveCameraPlaceholder liveStudioExamplePlaceholder">{orientation === 'horizontal' ? <MonitorUp size={46} /> : <Camera size={46} />}<strong>{orientation === 'horizontal' ? 'Desktop LIVE preview' : 'Phone LIVE preview'}</strong><span>Choose Screen / Game or Game + Facecam below to load your real preview here.</span></div>}
        {hasFacecam && orientation === 'horizontal' && studioLayout === 'free_facecam' && mediaStream && (
          <button
            type="button"
            className="liveStudioFacecamDrag"
            style={{ left: `${facecamPosition.x * 100}%`, top: `${facecamPosition.y * 100}%`, width: `${facecamPosition.size * 100}%` }}
            onPointerDown={beginFacecamDrag}
            onPointerMove={moveFacecam}
            onPointerUp={endFacecamDrag}
            onPointerCancel={endFacecamDrag}
            aria-label="Drag facecam position"
          ><span>Drag facecam</span></button>
        )}
        {live && <div className="prodLiveBadge prodLiveMinimalLiveBadge">LIVE</div>}
        {live && (state.sessionId ? <button type="button" className="prodLiveViewerPill liveAudienceTrigger prodLiveMinimalViewerCount" onClick={openAudience} aria-label="Open LIVE audience"><Users size={16} /><span>{state.viewerCount || 0}</span></button> : <div className="prodLiveViewerPill prodLiveMinimalViewerCount"><Users size={16} /><span>{state.viewerCount || 0}</span></div>)}
        {live && guestAccepted && <LiveRemoteGuestTile room={getRoom()} onVisibilityChange={setGuestVisible} />}
        {showCreatorHudController && <HostLiveAudienceOverlay sessionId={state.sessionId} showInline={live} />}

        {live && layoutPanelOpen && hasFacecam && <div className="liveStudioLayoutPanel"><strong>{orientation === 'horizontal' ? 'Facecam layout' : 'Vertical layout'}</strong><div>{availableLayouts.map(item => <button type="button" key={item.id} className={studioLayout === item.id ? 'active' : ''} onClick={() => chooseLayout(item.id)}>{item.label}</button>)}</div>{facecamSizeControl}{orientation === 'horizontal' && <small>Drag the facecam directly on the stream, then resize it here.</small>}</div>}

        {live && controlsOpen && <div className="prodLiveMoreMenu" role="menu" aria-label="LIVE controls">
          <button type="button" onClick={toggleMicrophone} disabled={Boolean(controlBusy)} role="menuitem">{micMuted ? <MicOff size={19} /> : <Mic size={19} />}<span><strong>Microphone</strong><small>{micMuted ? 'Off' : 'On'}</small></span></button>
          <button type="button" onClick={toggleCamera} disabled={Boolean(controlBusy) || sourceMode === LIVE_SOURCE_MODE.SCREEN} role="menuitem">{cameraMuted ? <CameraOff size={19} /> : <Camera size={19} />}<span><strong>{hasFacecam ? 'Facecam' : 'Camera'}</strong><small>{sourceMode === LIVE_SOURCE_MODE.SCREEN ? 'Not used in screen-only mode' : cameraMuted ? 'Off' : 'On'}</small></span></button>
          <button type="button" onClick={switchCamera} disabled={Boolean(controlBusy) || cameraMuted || sourceMode === LIVE_SOURCE_MODE.SCREEN} role="menuitem"><SwitchCamera size={19} /><span><strong>Switch camera</strong><small>{facingMode === 'user' ? 'Front → Back' : 'Back → Front'}</small></span></button>
          {hasFacecam && <button type="button" onClick={() => { setLayoutPanelOpen(value => !value); setControlsOpen(false); }} role="menuitem"><LayoutGrid size={19} /><span><strong>LIVE layout</strong><small>{orientation === 'horizontal' ? 'Drag + resize facecam' : '70/30 or 50/50 only'}</small></span></button>}
          <button type="button" onClick={openAudience} disabled={!state.sessionId} role="menuitem"><Users size={19} /><span><strong>Audience / Invite</strong><small>Viewers and invite guest</small></span></button>
          <button type="button" onClick={openTopSupporters} role="menuitem"><Trophy size={19} /><span><strong>Top Supporters</strong><small>Who gave the most gifts</small></span></button>
          {guestAccepted && <button type="button" className="prodLiveMoreRemoveGuest" onClick={removeGuestFromMenu} disabled={guestBusy} role="menuitem"><X size={19} /><span><strong>Remove Guest</strong><small>{guestBusy ? 'Removing…' : `Remove ${guestState.display_name || 'guest'} from LIVE`}</small></span></button>}
          <button type="button" className="prodLiveMoreEnd" onClick={endLiveFromMenu} disabled={state.phase === LIVE_PHASE.ENDING} role="menuitem"><X size={19} /><span><strong>End LIVE</strong><small>Stop this broadcast</small></span></button>
        </div>}

        {live && <button type="button" className={`prodLiveMoreButton ${controlsOpen ? 'isOpen' : ''}`} onClick={() => { setLayoutPanelOpen(false); setControlsOpen(value => !value); }} aria-expanded={controlsOpen} aria-label="More LIVE controls"><MoreHorizontal size={27} /></button>}
      </div>

      {(state.error || controlError) && <div className="prodLiveError">{controlError || state.error}</div>}
      {isStudioMode && studioAudioNotice && <div className={`liveStudioAudioNotice ${mediaStream?.__droxionStudio?.hasSystemAudio ? 'isReady' : 'isWarning'}`}>{studioAudioNotice}</div>}

      {!live && !connecting && <div className={`prodLiveSetup ${isStudioMode ? 'liveStudioComposerPanel' : ''}`}>
        <div className="liveStudioSourcePicker"><span>Choose source</span><div>
          <button type="button" className={sourceMode === LIVE_SOURCE_MODE.CAMERA ? 'active' : ''} onClick={chooseCameraSource} disabled={busy}><Camera size={20} /><strong>Camera</strong><small>Normal LIVE</small></button>
          <button type="button" className={sourceMode === LIVE_SOURCE_MODE.SCREEN ? 'active' : ''} onClick={() => chooseStudioSource(LIVE_SOURCE_MODE.SCREEN)} disabled={busy}><MonitorUp size={20} /><strong>Screen / Game</strong><small>Full screen capture</small></button>
          <button type="button" className={sourceMode === LIVE_SOURCE_MODE.SCREEN_CAMERA ? 'active' : ''} onClick={() => chooseStudioSource(LIVE_SOURCE_MODE.SCREEN_CAMERA)} disabled={busy}><Gamepad2 size={20} /><strong>Game + Facecam</strong><small>Screen + camera</small></button>
        </div></div>

        {hasFacecam && mediaStream && <div className="liveStudioPreflightLayouts"><span>{orientation === 'horizontal' ? 'Adjust facecam' : 'Vertical layout'}</span><div>{availableLayouts.map(item => <button type="button" key={item.id} className={studioLayout === item.id ? 'active' : ''} onClick={() => chooseLayout(item.id)}>{item.label}</button>)}</div>{facecamSizeControl}{orientation === 'horizontal' && <small>Drag the facecam directly on the large preview above and choose the size here.</small>}</div>}

        {!mediaStream && sourceMode === LIVE_SOURCE_MODE.CAMERA && <button type="button" className="prodLiveSecondary" onClick={() => ensurePreview({ orientation, facingMode })} disabled={busy}><RotateCcw size={18} /> Retry camera</button>}
        {!mediaStream && isStudioMode && <button type="button" className="prodLiveSecondary" onClick={() => chooseStudioSource(sourceMode)} disabled={busy}><MonitorUp size={18} /> Choose screen again</button>}

        {isStudioMode && mediaStream && <button type="button" className={`liveStudioSaveSetup ${setupSaved ? 'isSaved' : ''}`} onClick={() => setSetupSaved(true)}><strong>{setupSaved ? '✓ Setup saved' : 'Save this setup'}</strong><span>{setupSaved ? 'Your screen, format and facecam position are ready.' : 'Save screen + facecam placement before adding LIVE details.'}</span></button>}

        {(!isStudioMode || setupSaved) && <div className="liveStudioMetaPanel">
          <label><span>LIVE title</span><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="What are you streaming?" /></label>
          <label><span>Tags <small>{tags.length}/8</small></span><input value={tagsText} onChange={event => setTagsText(event.target.value)} maxLength={160} placeholder="gaming, reaction, music" /></label>
        </div>}

        <button type="button" className="prodLiveStart" disabled={busy || !mediaStream || (isStudioMode && !setupSaved)} onClick={startLiveNow}><Radio size={19} />{isStudioMode && !setupSaved ? ' Save setup first' : ' Go LIVE'}</button>
      </div>}

      {connecting && <div className="prodLiveConnecting"><span className="prodLiveSpinner" /><strong>{statusText}</strong><span>Connecting your {isStudioMode ? 'LIVE Studio' : 'camera and microphone'} securely…</span></div>}
      <LiveAudienceDrawer open={audienceOpen} sessionId={state.sessionId} onClose={() => setAudienceOpen(false)} />
    </section>
  );
}
