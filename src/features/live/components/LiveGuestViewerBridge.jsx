import { useEffect, useState } from 'react';
import LiveRemoteGuestTile from './LiveRemoteGuestTile';
import '../styles/live-guest-invite.css';

export default function LiveGuestViewerBridge({ enabled, currentUserId }) {
  const [room, setRoom] = useState(null);
  const [guestVisible, setGuestVisible] = useState(false);

  useEffect(() => {
    const ready = event => {
      setRoom(event?.detail?.room || null);
      setGuestVisible(false);
    };
    const closed = event => {
      const closedRoom = event?.detail?.room;
      setRoom(current => !closedRoom || current === closedRoom ? null : current);
      setGuestVisible(false);
    };
    window.addEventListener('droxion:viewer-room-ready', ready);
    window.addEventListener('droxion:viewer-room-closed', closed);
    return () => {
      window.removeEventListener('droxion:viewer-room-ready', ready);
      window.removeEventListener('droxion:viewer-room-closed', closed);
    };
  }, []);

  useEffect(() => {
    if (!enabled) setGuestVisible(false);
  }, [enabled]);

  if (!enabled || !room) return null;
  return (
    <div className={`liveGuestGlobalLayer ${guestVisible ? 'isGuestVisible' : ''}`}>
      <LiveRemoteGuestTile room={room} excludeUserId={currentUserId} onVisibilityChange={setGuestVisible} />
    </div>
  );
}
