import { useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { connectViewerTransport, disconnectTransport } from '../services/liveTransportService';

const POLL_MS = 900;

function findLegacyViewerNodes() {
  const room = document.querySelector('.liveRoomV4');
  if (!room) return null;

  const hostVideo = room.querySelector('video.liveMainVideo:not(.liveLocalPreview)');
  if (!hostVideo) return null;

  const stage = room.querySelector('.liveStageV4');
  const hostAudio = stage?.querySelector('audio') || room.querySelector('audio');
  const loading = Array.from(room.querySelectorAll('.liveVideoLoading')).find(node =>
    node.textContent?.includes('Connecting LIVE video')
  ) || null;

  return { room, hostVideo, hostAudio, loading };
}

async function currentViewerMembership() {
  const { data, error } = await supabase.rpc('droxion_my_active_live_viewing');
  if (error) throw error;
  return data && typeof data === 'object' ? data : null;
}

function attachTrack(track, element) {
  if (!track || !element) return;
  try { track.attach(element); } catch {}
  element.autoplay = true;
  element.playsInline = true;
  element.setAttribute('playsinline', '');
  const play = element.play?.();
  play?.catch?.(() => {});
}

function revealVideo(nodes) {
  if (!nodes) return;
  if (nodes.loading) nodes.loading.style.display = 'none';
  nodes.hostVideo.style.opacity = '1';
}

function restoreLoading(nodes) {
  if (!nodes) return;
  if (nodes.loading) nodes.loading.style.display = '';
}

export default function LegacyViewerV2Bridge() {
  const roomRef = useRef(null);
  const sessionRef = useRef('');
  const attachedTracksRef = useRef(new Set());
  const connectingRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const cleanup = async () => {
      const room = roomRef.current;
      roomRef.current = null;
      sessionRef.current = '';
      attachedTracksRef.current.forEach(track => {
        try { track.detach(); } catch {}
      });
      attachedTracksRef.current.clear();
      await disconnectTransport(room);
    };

    const connectIfNeeded = async () => {
      if (disposed || connectingRef.current) return;
      const nodes = findLegacyViewerNodes();
      if (!nodes) {
        if (roomRef.current) await cleanup();
        return;
      }

      let membership;
      try {
        membership = await currentViewerMembership();
      } catch {
        restoreLoading(nodes);
        return;
      }
      if (!membership?.session_id || !membership?.host_id) return;

      const sessionId = String(membership.session_id);
      const hostId = String(membership.host_id);
      if (roomRef.current && sessionRef.current === sessionId) return;

      connectingRef.current = true;
      await cleanup();
      if (disposed) {
        connectingRef.current = false;
        return;
      }

      try {
        const room = await connectViewerTransport({
          sessionId,
          callbacks: {
            onTrackSubscribed: (track, _publication, participant) => {
              if (disposed) return;
              const currentNodes = findLegacyViewerNodes();
              if (!currentNodes) return;
              const identity = String(participant?.identity || '');
              if (identity && identity !== hostId) return;

              if (track.kind === 'video') {
                attachTrack(track, currentNodes.hostVideo);
                attachedTracksRef.current.add(track);
                revealVideo(currentNodes);
              } else if (track.kind === 'audio' && currentNodes.hostAudio) {
                attachTrack(track, currentNodes.hostAudio);
                attachedTracksRef.current.add(track);
              }
            },
            onReconnecting: () => restoreLoading(findLegacyViewerNodes()),
            onReconnected: () => revealVideo(findLegacyViewerNodes()),
            onDisconnected: () => restoreLoading(findLegacyViewerNodes())
          }
        });

        if (disposed) {
          await disconnectTransport(room);
          return;
        }
        roomRef.current = room;
        sessionRef.current = sessionId;
      } catch {
        restoreLoading(findLegacyViewerNodes());
      } finally {
        connectingRef.current = false;
      }
    };

    const timer = window.setInterval(() => {
      connectIfNeeded().catch(() => {});
    }, POLL_MS);
    connectIfNeeded().catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === 'visible') connectIfNeeded().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      cleanup().catch(() => {});
    };
  }, []);

  return null;
}
