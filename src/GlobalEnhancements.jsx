import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, PhoneCall, UserCheck, Users, WalletCards, X } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function GlobalEnhancements() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const [profileTab, setProfileTab] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || stopped) return;
      const { data } = await supabase.rpc('droxion_incoming_direct_call');
      if (!stopped) setIncoming(data?.call_id ? data : null);
    }
    poll();
    const timer = setInterval(poll, 1500);
    return () => { stopped = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    const check = () => {
      try { setProfileTab(window.localStorage.getItem('droxion-active-tab') === 'profile' && window.location.pathname === '/'); }
      catch { setProfileTab(false); }
    };
    check();
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  }, []);

  async function respond(accept) {
    if (!incoming?.call_id) return;
    const id = incoming.call_id;
    const { data } = await supabase.rpc('droxion_respond_direct_call', { p_call_id: id, p_accept: accept });
    setIncoming(null);
    if (accept && data?.allowed) navigate(`/direct-call?call=${encodeURIComponent(id)}`);
  }

  const shortcuts = [
    ['followers', 'Followers', Users],
    ['following', 'Following', UserCheck],
    ['history', 'History', History],
    ['earnings', 'Earnings & PayPal', WalletCards]
  ];

  return (
    <>
      {profileTab && (
        <div style={{ position: 'fixed', left: 14, right: 14, bottom: 86, zIndex: 40, maxWidth: 720, margin: '0 auto', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 18, padding: 12, boxShadow: '0 14px 40px rgba(15,23,42,.16)' }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>More Profile Options</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7 }}>
            {shortcuts.map(([key, label, Icon]) => (
              <button key={key} onClick={() => navigate(`/profile-tools?view=${key}`)} style={{ minHeight: 42, border: '1px solid #e5e7eb', borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 800 }}><Icon size={17} /> {label}</button>
            ))}
          </div>
        </div>
      )}

      {incoming && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,.72)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(92vw,390px)', background: '#fff', borderRadius: 24, padding: 22, textAlign: 'center', color: '#111827' }}>
            <button onClick={() => respond(false)} style={{ float: 'right', border: 0, background: 'transparent' }}><X /></button>
            {incoming.avatar_url ? <img src={incoming.avatar_url} alt={incoming.display_name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', marginTop: 14 }} /> : <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#ede9fe', display: 'grid', placeItems: 'center', margin: '14px auto 0', fontSize: 32, fontWeight: 900 }}>{(incoming.display_name || 'D')[0]}</div>}
            <h2>{incoming.display_name || 'Droxion user'}</h2>
            <p>{incoming.country || 'Global'} · Incoming video call</p>
            <p style={{ color: '#64748b', fontSize: 13 }}>The caller pays 50 coins when connected, then 5 coins every 10 seconds.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => respond(false)} style={{ minHeight: 50, border: 0, borderRadius: 14, background: '#fee2e2', color: '#b91c1c', fontWeight: 900 }}>Decline</button>
              <button onClick={() => respond(true)} style={{ minHeight: 50, border: 0, borderRadius: 14, background: '#16a34a', color: '#fff', fontWeight: 900, display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}><PhoneCall size={19} /> Accept</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
