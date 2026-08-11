import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, History, MessageCircle, Phone, Users, UserCheck, WalletCards } from 'lucide-react';
import { supabase } from './supabaseClient';

const views = [
  ['followers', 'Followers', Users],
  ['following', 'Following', UserCheck],
  ['history', 'History', History],
  ['earnings', 'Earnings & PayPal', WalletCards]
];

function avatar(person) {
  return person.avatar_url
    ? <img src={person.avatar_url} alt={person.display_name || 'Droxion user'} style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover' }} />
    : <div style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#ede9fe', color: '#6d28d9', fontWeight: 900 }}>{(person.display_name || 'D')[0]}</div>;
}

export default function ProfileTools() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'followers';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [withdrawCoins, setWithdrawCoins] = useState('1000');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setNotice('');
      if (view === 'followers' || view === 'following') {
        const fn = view === 'followers' ? 'droxion_followers' : 'droxion_following';
        const { data, error } = await supabase.rpc(fn);
        if (!alive) return;
        if (error) setNotice(error.message); else setRows(data || []);
      } else if (view === 'history') {
        const { data, error } = await supabase.rpc('droxion_connection_history');
        if (!alive) return;
        if (error) setNotice(error.message); else setRows(data || []);
      } else {
        const [{ data: creatorWallet, error: walletError }, { data: payoutRows }] = await Promise.all([
          supabase.rpc('droxion_creator_wallet_status'),
          supabase.from('droxion_payout_requests').select('id,paypal_email,creator_coins,amount_cents,currency,status,created_at,completed_at').order('created_at', { ascending: false }).limit(50)
        ]);
        if (!alive) return;
        if (walletError) setNotice(walletError.message); else setWallet(creatorWallet || null);
        setPayouts(payoutRows || []);
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [view]);

  function message(person) {
    try {
      localStorage.setItem('droxion-chat-partner', JSON.stringify({
        user_id: person.user_id || person.partner_id,
        display_name: person.display_name,
        avatar_url: person.avatar_url,
        country: person.country,
        allow_messages: person.allow_messages
      }));
      localStorage.setItem('droxion-active-tab', 'chat');
    } catch {}
    navigate('/');
  }

  function call(person) {
    const id = person.user_id || person.partner_id;
    navigate(`/direct-call?to=${encodeURIComponent(id)}`);
  }

  async function withdraw() {
    if (withdrawing) return;
    setWithdrawing(true);
    setNotice('');
    try {
      const amount = Math.floor(Number(withdrawCoins || 0));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch('/api/paypal/creator-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paypalEmail, creatorCoins: amount })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || data.reason || 'Withdrawal failed.');
      setNotice(`PayPal payout submitted: $${data.amount}.`);
      const [{ data: creatorWallet }, { data: payoutRows }] = await Promise.all([
        supabase.rpc('droxion_creator_wallet_status'),
        supabase.from('droxion_payout_requests').select('id,paypal_email,creator_coins,amount_cents,currency,status,created_at,completed_at').order('created_at', { ascending: false }).limit(50)
      ]);
      setWallet(creatorWallet || null);
      setPayouts(payoutRows || []);
    } catch (error) {
      setNotice(error?.message || 'Withdrawal failed.');
    }
    setWithdrawing(false);
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 16px 100px', minHeight: '100vh', background: '#f8fafc', color: '#111827' }}>
      <button onClick={() => navigate('/')} style={{ border: 0, background: 'transparent', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, cursor: 'pointer' }}><ArrowLeft size={18} /> Profile</button>
      <h1 style={{ marginBottom: 6 }}>Profile Tools</h1>
      <p style={{ color: '#64748b', marginTop: 0 }}>Followers, people you talked to, and creator payouts.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, margin: '18px 0' }}>
        {views.map(([key, label, Icon]) => <button key={key} onClick={() => setParams({ view: key })} style={{ border: view === key ? '2px solid #7c3aed' : '1px solid #e5e7eb', background: '#fff', borderRadius: 14, minHeight: 52, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} /> {label}</button>)}
      </div>

      {notice && <div style={{ padding: 12, borderRadius: 12, background: '#eef2ff', color: '#3730a3', marginBottom: 12 }}>{notice}</div>}
      {loading && <div style={{ padding: 24, textAlign: 'center' }}>Loading…</div>}

      {!loading && view !== 'earnings' && rows.length === 0 && <div style={{ padding: 30, background: '#fff', borderRadius: 18, textAlign: 'center' }}>Nothing here yet.</div>}
      {!loading && view !== 'earnings' && rows.map(person => (
        <div key={`${person.user_id || person.partner_id}-${person.latest_at || person.followed_at || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 10 }}>
          {avatar(person)}
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{person.display_name || 'Droxion user'}</strong>
            <div style={{ color: '#64748b', fontSize: 13 }}>{person.country || 'Global'}{person.interaction_type ? ` · ${person.interaction_type.replace('_', ' ')}` : ''}</div>
            {person.latest_at && <div style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(person.latest_at).toLocaleString()}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={person.allow_messages === false} onClick={() => message(person)} title="Message" style={{ width: 42, height: 42, borderRadius: 12, border: 0 }}><MessageCircle size={18} /></button>
            <button disabled={person.allow_video_calls === false} onClick={() => call(person)} title="Video call - 50 coins" style={{ width: 42, height: 42, borderRadius: 12, border: 0 }}><Phone size={18} /></button>
          </div>
        </div>
      ))}

      {!loading && view === 'earnings' && (
        <>
          <div style={{ padding: 18, borderRadius: 18, background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 style={{ marginTop: 0 }}>Creator Earnings</h2>
            <h1>{wallet?.available_coins || 0} coins</h1>
            <p>Available: <strong>${(Number(wallet?.available_cents || 0) / 100).toFixed(2)}</strong></p>
            <p>Pending payout: {wallet?.pending_payout_coins || 0} coins</p>
            <p>Lifetime earned: {wallet?.lifetime_earned_coins || 0} coins</p>
            <p>Lifetime withdrawn: {wallet?.lifetime_withdrawn_coins || 0} coins</p>
            <p style={{ fontSize: 13, color: '#64748b' }}>Live gifts: 70% creator / 30% Droxion. Minimum PayPal payout is 1,000 creator coins ($10.00).</p>
            <input value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="Your personal PayPal email" style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 12px', borderRadius: 12, border: '1px solid #d1d5db', marginBottom: 8 }} />
            <input value={withdrawCoins} onChange={e => setWithdrawCoins(e.target.value)} inputMode="numeric" placeholder="Creator coins" style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 12px', borderRadius: 12, border: '1px solid #d1d5db', marginBottom: 8 }} />
            <button disabled={withdrawing} onClick={withdraw} style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 13, background: '#7c3aed', color: '#fff', fontWeight: 900 }}>{withdrawing ? 'Sending…' : 'Withdraw to PayPal'}</button>
          </div>
          <h2>Payout History</h2>
          {payouts.length === 0 ? <div style={{ padding: 20, background: '#fff', borderRadius: 16 }}>No withdrawals yet.</div> : payouts.map(row => <div key={row.id} style={{ padding: 14, background: '#fff', borderRadius: 14, marginBottom: 8, border: '1px solid #e5e7eb' }}><strong>${(Number(row.amount_cents) / 100).toFixed(2)} · {String(row.status).toUpperCase()}</strong><div style={{ fontSize: 13, color: '#64748b' }}>{row.paypal_email} · {new Date(row.created_at).toLocaleString()}</div></div>)}
        </>
      )}
    </div>
  );
}
