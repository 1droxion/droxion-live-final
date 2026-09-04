import { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { LIVE_PHASE } from '../types/liveState';
import { getLiveRoomStatus } from '../services/liveSessionService';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';

function publicationName(track, publication) {
  return String(
    publication?.trackName ||
    publication?.name ||
    track?.__droxionPublicationName ||
    track?.name ||
    ''
  ).toLowerCase();
}

function publicationSource(track, publication) {
  return publication?.source || track?.__droxionSource || track?.source || '';
}

function isScreenVideo(track, publication) {
  const source = publicationSource(track, publication);
  const sourceText = String(source || '').toLowerCase();
  const name = publicationName(track, publication);
  return source === Track.Source.ScreenShare || sourceText.includes('screen') || name.startsWith('droxion_screen');
}

export function useLiveViewer(sessionId) {
  const [state, setState] = useState({ phase: LIVE_PHASE.IDLE, error: '' });
  const [screenTrack, setScreenTrack] = useState(null);
  const [cameraTrack, setCameraTrack] = useState(null);
  const [audioTrack, setAudioTrack] = useState(null);
  const roomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setScreenTrack(null);
    setCameraTrack(null);
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
            onTrackSubscribed: (track, publication) => {
              if (cancelled) return;
              if (track.kind === 'video') {
                if (isScreenVideo(track, publication)) setScreenTrack(track);
                else setCameraTrack(track);
              }
              if (track.kind === 'audio') setAudioTrack(track);
            },
            onTrackUnsubscribed: (track, publication) => {
              if (cancelled) return;
              if (track.kind === 'video') {
                if (isScreenVideo(track, publication)) {
                  setScreenTrack(current => current === track ? null : current);
                } else {
                  setCameraTrack(current => current === track ? null : current);
                }
              }
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
      setScreenTrack(null);
      setCameraTrack(null);
      setAudioTrack(null);
      disconnectTransport(room);
    };
  }, [sessionId]);

  return {
    state,
    screenTrack,
    cameraTrack,
    videoTrack: screenTrack || cameraTrack,
    audioTrack
  };
}
