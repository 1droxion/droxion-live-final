import { useEffect, useState } from 'react';
import LiveRemoteGuestTile from './LiveRemoteGuestTile';
import '../styles/live-guest-invite.css';

export default function LiveGuestViewerBridge({ enabled }) {
  const [room, setRoom] = useState(null);

  useEffect(() => {
    const ready = event => setRoom(event?.detail?.room || null);
    const closed = event => {
      const closedRoom = event?.detail?.room;
      setRoom(current => !closedRoom || current === closedRoom ? null : current);
    };
    window.addEventListener('droxion:viewer-room-ready', ready);
    window.addEventListener('droxion:viewer-room-closed', closed);
    return () => {
      window.removeEventListener('droxion:viewer-room-ready', ready);
      window.removeEventListener('droxion:viewer-room-closed', closed);
    };
  }, []);

  if (!enabled || !room) return null;
  return <div className="liveGuestGlobalLayer"><LiveRemoteGuestTile room={room} /></div>;
}
