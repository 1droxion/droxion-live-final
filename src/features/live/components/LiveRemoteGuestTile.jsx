import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import { attachRemoteTrack, detachRemoteTrack } from '../../../livekit/livekitRoom';
import '../styles/live-guest-invite.css';

function participantMeta(participant) {
  try { return participant?.metadata ? JSON.parse(participant.metadata) : {}; } catch { return {}; }
}

function isGuestParticipant(participant, excludeUserId = '') {
  const metadata = participantMeta(participant);
  if (String(metadata?.role || '').toLowerCase() !== 'guest') return false;
  const userId = String(metadata?.droxionUserId || participant?.identity || '').split('::')[0];
  return !excludeUserId || userId !== String(excludeUserId);
}

function publicationsOf(participant) {
  if (!participant) return [];
  if (typeof participant.getTrackPublications === 'function') return participant.getTrackPublications() || [];
  if (participant.trackPublications?.values) return Array.from(participant.trackPublications.values());
  return [];
}

export default function LiveRemoteGuestTile({ room, excludeUserId = '', onVisibilityChange }) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const visibilityCallbackRef = useRef(onVisibilityChange);
  const [visible, setVisible] = useState(false);
  const [guestName, setGuestName] = useState('Guest');

  useEffect(() => {
    visibilityCallbackRef.current = onVisibilityChange;
  }, [onVisibilityChange]);

  useEffect(() => {
    if (!room) {
      setVisible(false);
      visibilityCallbackRef.current?.(false);
      return undefined;
    }
    let stopped = false;

    const updateVisibility = nextVisible => {
      if (stopped) return;
      setVisible(nextVisible);
      visibilityCallbackRef.current?.(nextVisible);
    };

    const attach = (track, participant) => {
      if (stopped || !isGuestParticipant(participant, excludeUserId)) return;
      const element = track?.kind === Track.Kind.Video ? videoRef.current : audioRef.current;
      if (!element) return;
      try {
        attachRemoteTrack(track, element);
        element.autoplay = true;
        element.playsInline = true;
        if (track.kind === Track.Kind.Video) {
          element.muted = true;
          updateVisibility(true);
        }
        const rawName = String(participant?.name || '').trim();
        setGuestName(rawName || 'Guest');
        Promise.resolve(element.play?.()).catch(() => {});
      } catch {}
    };

    const detach = (track, participant) => {
      if (!isGuestParticipant(participant, excludeUserId)) return;
      try { detachRemoteTrack(track); } catch {}
      if (track?.kind === Track.Kind.Video) updateVisibility(false);
    };

    const replay = () => {
      const participants = room.remoteParticipants?.values ? Array.from(room.remoteParticipants.values()) : [];
      let foundGuest = false;
      participants.forEach(participant => {
        if (!isGuestParticipant(participant, excludeUserId)) return;
        foundGuest = true;
        publicationsOf(participant).forEach(publication => {
          try { if (publication?.setSubscribed && !publication.isSubscribed) publication.setSubscribed(true); } catch {}
          if (publication?.track) attach(publication.track, participant);
        });
      });
      if (!foundGuest) updateVisibility(false);
    };

    const disconnected = participant => {
      if (isGuestParticipant(participant, excludeUserId)) updateVisibility(false);
    };

    room.on(RoomEvent.TrackSubscribed, attach);
    room.on(RoomEvent.TrackUnsubscribed, detach);
    room.on(RoomEvent.ParticipantDisconnected, disconnected);
    replay();
    const timer = window.setInterval(replay, 1500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      visibilityCallbackRef.current?.(false);
      try { room.off(RoomEvent.TrackSubscribed, attach); } catch {}
      try { room.off(RoomEvent.TrackUnsubscribed, detach); } catch {}
      try { room.off(RoomEvent.ParticipantDisconnected, disconnected); } catch {}
    };
  }, [room, excludeUserId]);

  return (
    <div className={`liveRemoteGuestTile ${visible ? 'isVisible' : ''}`} style={{ display: visible ? 'block' : 'none' }} aria-hidden={!visible}>
      <video ref={videoRef} className="liveRemoteGuestVideo" autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay playsInline />
      <span className="liveRemoteGuestTileLabel">{guestName}</span>
    </div>
  );
}
