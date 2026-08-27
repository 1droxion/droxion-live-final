import { useEffect, useRef, useState } from 'react';
import { LIVE_PHASE } from '../types/liveState';
import { getLiveRoomStatus } from '../services/liveSessionService';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';

export function useLiveViewer(sessionId) {
  const [state, setState] = useState({ phase: LIVE_PHASE.IDLE, error: '' });
  const [videoTrack, setVideoTrack] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const roomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setVideoTrack(null);
    setAudioTrack(null);

    if (!sessionId) {
      setState({ phase: LIVE_PHASE.ERROR, error: 'LIVE session ID is missing.' });
      return undefined;
    }

    const connect = async () => {
      setState({ phase: LIVE_PHASE.CONNECTING, error: '' });
      try {
        const status = await getLiveRoomStatus(sessionId);
        if (!status.isLive) throw new Error('This LIVE has ended or is not available.');

        const room = await connectViewerTransport({
          sessionId,
          callbacks: {
            onTrackSubscribed: track => {
              if (cancelled) return;
              if (track.kind === 'video') setVideoTrack(track);
              if (track.kind === 'audio') setAudioTrack(track);
            },
            onTrackUnsubscribed: track => {
              if (cancelled) return;
              if (track.kind === 'video') setVideoTrack(current => current === track ? null : current);
              if (track.kind === 'audio') setAudioTrack(current => current === track ? null : current);
            },
            onReconnecting: () => !cancelled && setState({ phase: LIVE_PHASE.RECONNECTING, error: '' }),
            onReconnected: () => !cancelled && setState({ phase: LIVE_PHASE.LIVE, error: '' }),
            onDisconnected: () => !cancelled && setState({ phase: LIVE_PHASE.ERROR, error: 'The LIVE video disconnected.' })
          }
        });

        if (cancelled) {
          await disconnectTransport(room);
          return;
        }
        roomRef.current = room;
        setState({ phase: LIVE_PHASE.LIVE, error: '' });
      } catch (error) {
        if (!cancelled) setState({ phase: LIVE_PHASE.ERROR, error: error?.message || 'Could not join LIVE.' });
      }
    };

    connect();
    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      disconnectTransport(room);
    };
  }, [sessionId]);

  return { state, videoTrack, audioTrack };
}
