import { Bell, Radio, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import './notification-center.css';

function avatar(item) {
  if (item?.actor_avatar_url) return <img src={item.actor_avatar_url} alt="" />;
  return <span className="dnAvatarFallback"><UserRound size={18} /></span>;
}

export default function NotificationCenter({ userId, open, onClose, onUnreadChange, onWatchLive }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!userId) { setItems([]); onUnreadChange?.(0); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('droxion_my_notifications', { p_limit: 50 });
    const rows = error ? [] : (data || []);
    setItems(rows);
    onUnreadChange?.(rows.filter(row => !row.read_at).length);
    setLoading(false);
  }

  useEffect(() => {
    load();
    if (!userId) return undefined;
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [userId]);

  useEffect(() => { if (open) load(); }, [open]);

  async function markAllRead() {
    if (!userId) return;
    await supabase.from('droxion_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
    await load();
  }

  async function openNotification(item) {
    if (!item.read_at) {
      await supabase.from('droxion_notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
    }
    if (item.notification_type === 'live_started' && item.actor_id && item.is_live) onWatchLive?.(item.actor_id);
    onClose?.();
    await load();
  }

  if (!open) return null;

  return <div className="dnBackdrop" onClick={onClose}><section className="dnPanel" onClick={event => event.stopPropagation()} aria-label="Notifications"><header><div><span>ACTIVITY</span><h2>Notifications</h2></div><button type="button" onClick={onClose}><X size={20} /></button></header><div className="dnToolbar"><span>{items.filter(row => !row.read_at).length} unread</span><button type="button" onClick={markAllRead}>Mark all read</button></div><div className="dnList">{loading && items.length === 0 ? <div className="dnEmpty"><Bell size={24} /><strong>Loading notifications…</strong></div> : items.length === 0 ? <div className="dnEmpty"><Bell size={24} /><strong>No notifications yet</strong><span>When creators you follow go LIVE, you’ll see it here.</span></div> : items.map(item => <button type="button" key={item.id} className={`dnItem ${item.read_at ? '' : 'unread'}`} onClick={() => openNotification(item)}>{avatar(item)}<div><strong>{item.title}</strong><span>{item.body || 'Droxion activity'}</span><small>{new Date(item.created_at).toLocaleString()}</small></div>{item.notification_type === 'live_started' && item.is_live && <em><Radio size={11} /> WATCH LIVE</em>}</button>)}</div></section></div>;
}
