import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_PHASE, isLiveBusy } from '../types/liveState';
import { isUsableMediaStream, requestBroadcastMedia, stopMediaStream } from '../services/liveMediaService';
import { createLiveSession, endLiveSession, sendLiveHeartbeat } from '../services/liveSessionService';
import { connectHostTransport, disconnectTransport } from '../services/liveTransportService';

const HEARTBEAT_INTERVAL_MS = 12000;

const initialState = {
  phase: LIVE_PHASE.IDLE,
  sessionId: '',
  transportState: 'disconnected',
  error: '',
  viewerCount: 0
};

export function useLiveBroadcast() {
  const [state, setState] = useState(initialState);
  const [mediaStream, setMediaStream] = useState(null);
  const roomRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef('');
  const heartbeatRef = useRef(null);
  const operationRef = useRef(false);
  const mountedRef = useRef(true);

  const patchState = useCallback(patch => {
    if (!mountedRef.current) return;
    setState(current => ({ ...current, ...patch }));
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }, []);

  const runHeartbeat = useCallback(() => {
    clearHeartbeat();
    const beat = async () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      try {
        const status = await sendLiveHeartbeat(sessionId);
        if (!status.isLive) {
          if (status.reason === 'session_mismatch') {
            patchState({
              phase: LIVE_PHASE.ERROR,
              transportState: 'disconnected',
              error: 'A newer LIVE session is active on another device.'
            });
            clearHeartbeat();
            return;
          }
          patchState({
            phase: LIVE_PHASE.ERROR,
            transportState: 'disconnected',
            error: 'This LIVE session is no longer active.'
          });
          clearHeartbeat();
        }
      } catch {
        // A transient heartbeat failure should not kill a healthy LiveKit room.
      }
    };
    beat();
    heartbeatRef.current = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeat, patchState]);

  const ensurePreview = useCallback(async ({ orientation = 'vertical', facingMode = 'user' } = {}) => {
    if (isUsableMediaStream(streamRef.current)) {
      patchState({ phase: LIVE_PHASE.PREVIEW, error: '' });
      return streamRef.current;
    }

    const stream = await requestBroadcastMedia({ orientation, facingMode });
    streamRef.current = stream;
    setMediaStream(stream);
    patchState({ phase: LIVE_PHASE.PREVIEW, error: '' });
    return stream;
  }, [patchState]);

  const startBroadcast = useCallback(async ({
    title = 'Live on Droxion',
    orientation = 'vertical',
    allowGuestRequests = false
  } = {}) => {
    if (operationRef.current || isLiveBusy(state.phase) || state.phase === LIVE_PHASE.LIVE) return;
    operationRef.current = true;
    patchState({ phase: LIVE_PHASE.STARTING, error: '', transportState: 'disconnected' });

    let startedSessionId = '';
    try {
      let stream = streamRef.current;
      if (!isUsableMediaStream(stream)) {
        stream = await requestBroadcastMedia({ orientation });
        streamRef.current = stream;
        setMediaStream(stream);
      }

      const session = await createLiveSession({ title, orientation, allowGuestRequests });
      startedSessionId = session.sessionId;
      sessionIdRef.current = startedSessionId;
      patchState({
        phase: LIVE_PHASE.CONNECTING,
        sessionId: startedSessionId,
        transportState: 'connecting'
      });

      const transport = await connectHostTransport({
        sessionId: startedSessionId,
        stream,
        callbacks: {
          onParticipantChange: () => {
            const room = roomRef.current;
            patchState({ viewerCount: room?.remoteParticipants?.size || 0 });
          },
          onReconnecting: () => patchState({ phase: LIVE_PHASE.RECONNECTING, transportState: 'reconnecting' }),
          onReconnected: () => patchState({ phase: LIVE_PHASE.LIVE, transportState: 'connected' }),
          onDisconnected: () => patchState({
            phase: LIVE_PHASE.ERROR,
            transportState: 'disconnected',
            error: 'LIVE video disconnected. End LIVE and try again.'
          })
        }
      });

      roomRef.current = transport.room;
      patchState({
        phase: LIVE_PHASE.LIVE,
        transportState: 'connected',
        viewerCount: transport.room.remoteParticipants?.size || 0
      });
      runHeartbeat();
    } catch (error) {
      if (startedSessionId) {
        try { await endLiveSession(startedSessionId); } catch {}
      }
      if (roomRef.current) await disconnectTransport(roomRef.current);
      roomRef.current = null;
      sessionIdRef.current = '';
      patchState({
        phase: LIVE_PHASE.ERROR,
        sessionId: '',
        transportState: 'disconnected',
        error: error?.message || 'LIVE could not start.'
      });
    } finally {
      operationRef.current = false;
    }
  }, [patchState, runHeartbeat, state.phase]);

  const endBroadcast = useCallback(async () => {
    if (operationRef.current) return;
    operationRef.current = true;
    patchState({ phase: LIVE_PHASE.ENDING, error: '' });
    clearHeartbeat();

    const room = roomRef.current;
    roomRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = '';

    try {
      await disconnectTransport(room);
      if (sessionId) await endLiveSession(sessionId);
    } catch (error) {
      patchState({ error: error?.message || 'LIVE ended locally but server cleanup failed.' });
    } finally {
      stopMediaStream(stream);
      setMediaStream(null);
      patchState({ ...initialState });
      operationRef.current = false;
    }
  }, [clearHeartbeat, patchState]);

  const stopPreview = useCallback(() => {
    if (sessionIdRef.current) return;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setMediaStream(null);
    patchState({ ...initialState });
  }, [patchState]);

  const getRoom = useCallback(() => roomRef.current, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearHeartbeat();
      const room = roomRef.current;
      const stream = streamRef.current;
      const sessionId = sessionIdRef.current;
      roomRef.current = null;
      streamRef.current = null;
      sessionIdRef.current = '';
      disconnectTransport(room);
      stopMediaStream(stream);
      if (sessionId) endLiveSession(sessionId).catch(() => {});
    };
  }, [clearHeartbeat]);

  return {
    state,
    mediaStream,
    ensurePreview,
    stopPreview,
    startBroadcast,
    endBroadcast,
    getRoom
  };
}
