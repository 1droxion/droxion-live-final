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
  const [userId, setUserId] = useState(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id || null;
    setUserId(uid);
    if (!uid) { setItems([]); onUnreadChange?.(0); return; }
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
    if (!userId) return;
    const now = new Date().toISOString();
    await supabase.from('droxion_notifications').update({ read_at: now }).eq('recipient_id', userId).is('read_at', null);
    setItems(current => current.map(row => ({ ...row, read_at: row.read_at || now })));
    onUnreadChange?.(0);
  }

  async function markOneRead(item) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    await supabase.from('droxion_notifications').update({ read_at: now }).eq('id', item.id);
    setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: now } : row));
    onUnreadChange?.(Math.max(0, items.filter(row => !row.read_at).length - 1));
  }

  if (!open) return null;

  return <div className="dnBackdrop" onClick={onClose}>
    <aside className="dnPanel" onClick={event => event.stopPropagation()}>
      <header><div><span>ACTIVITY</span><h2>Notifications</h2></div><button onClick={onClose} aria-label="Close notifications"><X size={20}/></button></header>
      <div className="dnToolbar"><span>{items.filter(row => !row.read_at).length} unread</span><button type="button" onClick={markAllRead}>Mark all read</button></div>
      <div className="dnList">{loading && items.length === 0 ? <div className="dnEmpty">Loading…</div> : items.length === 0 ? <div className="dnEmpty"><Bell size={28}/><strong>No notifications yet</strong><span>When creators you follow go LIVE, you’ll see it here.</span></div> : items.map(item => <button type="button" className={`dnItem ${item.read_at ? '' : 'unread'}`} key={item.id} onClick={() => markOneRead(item)}>
        <div className="dnAvatar">{item.actor_avatar_url ? <img src={item.actor_avatar_url} alt=""/> : <UserRound size={18}/>}</div>
        <div><strong>{item.title}</strong><span>{item.body || 'Droxion update'}</span><small>{ago(item.created_at)} ago</small></div>
        {item.notification_type === 'live_started' && item.is_live && <em><Radio size={11}/> LIVE NOW</em>}
      </button>)}</div>
    </aside>
  </div>;
}
