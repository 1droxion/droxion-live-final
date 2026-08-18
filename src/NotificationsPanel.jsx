import { useEffect, useState } from 'react';
import { Bell, Radio, UserRound, X } from 'lucide-react';
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

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('droxion_my_notifications', { p_limit: 60 });
    const rows = error ? [] : (data || []);
    setItems(rows);
    onUnreadChange?.(rows.filter(row => !row.read_at).length);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 12000);
    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => { clearInterval(timer); listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => { if (open) load(); }, [open]);

  async function markAllRead() {
    await supabase.rpc('droxion_mark_notifications_read');
    const now = new Date().toISOString();
    setItems(current => current.map(row => ({ ...row, read_at: row.read_at || now })));
    onUnreadChange?.(0);
  }

  if (!open) return null;

  return <div className="dnBackdrop" onClick={onClose}>
    <aside className="dnPanel" onClick={event => event.stopPropagation()}>
      <header><div><span>ACTIVITY</span><h2>Notifications</h2></div><button onClick={onClose} aria-label="Close notifications"><X size={20}/></button></header>
      <div className="dnToolbar"><span>{items.filter(row => !row.read_at).length} unread</span><button type="button" onClick={markAllRead}>Mark all read</button></div>
      <div className="dnList">{loading && items.length === 0 ? <div className="dnEmpty">Loading…</div> : items.length === 0 ? <div className="dnEmpty"><Bell size={28}/><strong>No notifications yet</strong><span>When creators you follow go LIVE, you’ll see it here.</span></div> : items.map(item => <div className={`dnItem ${item.read_at ? '' : 'unread'}`} key={item.id}>
        <div className="dnAvatar">{item.actor_avatar ? <img src={item.actor_avatar} alt=""/> : <UserRound size={18}/>}</div>
        <div><strong>{item.title}</strong><span>{item.body || 'Droxion update'}</span><small>{ago(item.created_at)} ago</small></div>
        {item.type === 'live_started' && <em><Radio size={11}/> LIVE ALERT</em>}
      </div>)}</div>
    </aside>
  </div>;
}
