import { useEffect, useState } from 'react';
import { Gift, Radio, Video, WalletCards } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function LiveExperience({ currentUserId, coins = 0, onCoinsChanged, onOpenWallet }) {
  const [isLive, setIsLive] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [busyGift, setBusyGift] = useState('');
  const [notice, setNotice] = useState('');
  const [creatorWallet, setCreatorWallet] = useState(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [withdrawCoins, setWithdrawCoins] = useState('1000');
  const [withdrawing, setWithdrawing] = useState(false);

  async function loadLive() {
    const { data } = await supabase.rpc('droxion_live_profiles');
    setProfiles(data || []);
  }

  async function loadCreatorWallet() {
    if (!currentUserId) return;
    const { data } = await supabase.rpc('droxion_creator_wallet_status');
    if (data) setCreatorWallet(data);
  }

  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;

    (async () => {
      const [{ data: status }, { data: giftRows }] = await Promise.all([
        supabase.rpc('droxion_live_status'),
        supabase.rpc('droxion_gift_options')
      ]);
      if (!alive) return;
      setIsLive(Boolean(status?.is_live));
      setGifts(giftRows || []);
      await Promise.all([loadLive(), loadCreatorWallet()]);
    })();

    const refresh = setInterval(loadLive, 5000);
    const channel = supabase
      .channel(`droxion-live-list-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'droxion_live_presence' }, loadLive)
      .subscribe();

    return () => {
      alive = false;
      clearInterval(refresh);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!isLive) return;
    const heartbeat = async () => {
      const { data } = await supabase.rpc('droxion_live_heartbeat');
      if (data?.is_live === false) setIsLive(false);
    };
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    return () => clearInterval(timer);
  }, [isLive]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`droxion-live-gifts-${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'droxion_live_gifts',
        filter: `recipient_id=eq.${currentUserId}`
      }, async payload => {
        const gift = payload.new;
        setNotice(`${gift.emoji || '🎁'} You received ${gift.gift_name || 'a gift'}!`);
        await loadCreatorWallet();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  async function toggleLive() {
    setNotice('');
    const next = !isLive;
    const { data, error } = await supabase.rpc('droxion_set_live', { p_live: next });
    if (error) {
      setNotice(error.message || 'Could not change live status.');
      return;
    }
    setIsLive(Boolean(data?.is_live));
    setNotice(next ? 'You are LIVE now.' : 'Live ended.');
    await loadLive();
  }

  async function sendGift(profile, gift) {
    if (busyGift) return;
    setBusyGift(`${profile.user_id}:${gift.gift_code}`);
    setNotice('');
    const { data, error } = await supabase.rpc('droxion_send_live_gift', {
      p_recipient_id: profile.user_id,
      p_gift_code: gift.gift_code
    });
    if (error) {
      setNotice(error.message || 'Gift could not be sent.');
    } else if (!data?.allowed) {
      if (data?.reason === 'insufficient_coins') {
        setNotice(`You need ${data.required_coins} coins for this gift.`);
        onOpenWallet?.();
      } else if (data?.reason === 'recipient_not_live') {
        setNotice('This user is no longer live.');
        await loadLive();
      } else {
        setNotice('Gift could not be sent.');
      }
    } else {
      onCoinsChanged?.(Number(data.coin_balance || 0));
      setNotice(`${data.emoji} ${data.gift_name} sent. Creator receives ${data.creator_coins} coins; Droxion keeps ${data.platform_coins}.`);
    }
    setBusyGift('');
  }

  async function withdraw() {
    if (withdrawing) return;
    const amount = Math.floor(Number(withdrawCoins || 0));
    setWithdrawing(true);
    setNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again.');
      const response = await fetch('/api/paypal/creator-payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ paypalEmail, creatorCoins: amount })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || data.reason || 'Withdrawal failed.');
      setNotice(`PayPal payout submitted: $${data.amount}.`);
      await loadCreatorWallet();
    } catch (error) {
      setNotice(error?.message || 'Withdrawal failed.');
    }
    setWithdrawing(false);
  }

  return (
    <section className="realPage">
      <div className="realHeading">
        <h1>Live</h1>
        <p>Only people who are actively live appear here.</p>
      </div>

      <button className="realPrimaryButton" onClick={toggleLive} style={{ marginTop: 18, background: isLive ? '#dc2626' : undefined }}>
        {isLive ? <><Radio size={19} /> End Live</> : <><Video size={19} /> Go Live</>}
      </button>

      {isLive && <div className="realNotice">🔴 LIVE · Keep this page/app open to stay visible.</div>}
      {notice && <div className="realNotice">{notice}</div>}

      {profiles.length === 0 ? (
        <div className="realEmpty">Nobody is live right now.</div>
      ) : (
        <div className="realProfileGrid" style={{ marginTop: 18 }}>
          {profiles.map(profile => (
            <article className="realProfileCard" key={profile.user_id}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.display_name} /> : <div className="realAvatarFallback">{(profile.display_name || 'D')[0]}</div>}
              <div className="realProfileBody">
                <h2>{profile.display_name}{profile.age ? `, ${profile.age}` : ''}</h2>
                <p>🔴 LIVE{profile.country ? ` · ${profile.country}` : ''}</p>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                  {gifts.map(gift => (
                    <button
                      key={gift.gift_code}
                      disabled={Boolean(busyGift)}
                      onClick={() => sendGift(profile, gift)}
                      style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, background: '#1d1d27', color: '#fff', minHeight: 52, fontWeight: 800 }}
                    >
                      {gift.emoji} {gift.gift_name}<br /><small>{gift.cost_coins} coins</small>
                    </button>
                  ))}
                </div>
                <p style={{ marginTop: 9 }}>{coins} coins available · <button type="button" onClick={onOpenWallet} style={{ background: 'none', border: 0, color: '#a78bfa', padding: 0 }}>Buy coins</button></p>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="realNotice" style={{ marginTop: 24 }}>
        <strong><Gift size={17} style={{ verticalAlign: 'middle' }} /> Creator Gifts</strong>
        <p style={{ marginBottom: 6 }}>Creators receive 70% of every gift. Droxion keeps 30%.</p>
        <p style={{ margin: 0 }}>Withdrawable: <strong>{creatorWallet?.available_coins || 0} creator coins</strong> = ${(Number(creatorWallet?.available_cents || 0) / 100).toFixed(2)}</p>
      </div>

      <div className="realNotice">
        <strong><WalletCards size={17} style={{ verticalAlign: 'middle' }} /> PayPal Withdrawal</strong>
        <p>Minimum: 1,000 creator coins ($10.00).</p>
        <input value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="Your PayPal email" style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 12px', marginBottom: 8 }} />
        <input value={withdrawCoins} onChange={e => setWithdrawCoins(e.target.value)} inputMode="numeric" placeholder="Creator coins" style={{ width: '100%', height: 44, borderRadius: 12, padding: '0 12px', marginBottom: 8 }} />
        <button className="realPrimaryButton" disabled={withdrawing} onClick={withdraw}>{withdrawing ? 'Sending…' : 'Withdraw to PayPal'}</button>
      </div>
    </section>
  );
}
