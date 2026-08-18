import { useEffect, useMemo, useState } from 'react';
import { Bell, Radio, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './notifications.css';

function ago(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function NotificationsPanel({ open, onClose, onUnreadChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load(markRead = false) {
    setLoading(true);
    const { data } = await supabase.rpc('droxion_my_notifications', { p_limit: 60 });
    const rows = data || [];
    setItems(rows);
    onUnreadChange?.(rows.filter(row => !row.read_at).length);
    if (markRead && rows.some(row => !row.read_at)) {
      await supabase.rpc('droxion_mark_notifications_read');
      setItems(current => current.map(row => ({ ...row, read_at: row.read_at || new Date().toISOString() })));
      onUnreadChange?.(0);
    }
    setLoading(false);
  }

  useEffect(() => { load(false); const timer = setInterval(() => load(false), 12000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (open) load(true); }, [open]);

  const grouped = useMemo(() => items, [items]);
  if (!open) return null;

  return <div className="dnBackdrop" onClick={onClose}>
    <aside className="dnPanel" onClick={event => event.stopPropagation()}>
      <header><div><span>ACTIVITY</span><h2>Notifications</h2></div><button onClick={onClose} aria-label="Close notifications"><X size={20}/></button></header>
      <div className="dnList">{loading && grouped.length === 0 ? <div className="dnEmpty">Loading…</div> : grouped.length === 0 ? <div className="dnEmpty"><Bell size={28}/><strong>No notifications yet</strong><span>When creators you follow go LIVE, you’ll see it here.</span></div> : grouped.map(item => <div className={`dnItem ${item.read_at ? '' : 'unread'}`} key={item.id}>
        <div className="dnAvatar">{item.actor_avatar ? <img src={item.actor_avatar} alt=""/> : <Radio size={18}/>}</div>
        <div><strong>{item.title}</strong><span>{item.body || 'Droxion update'}</span><small>{ago(item.created_at)} ago</small></div>
      </div>)}</div>
    </aside>
  </div>;
}
