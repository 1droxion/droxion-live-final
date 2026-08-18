import { useEffect, useState } from 'react';
import { Banknote, Coins, Gift, Sparkles, Star, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import './creator-center.css';

const money = cents => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function CreatorCenter({ onOpenWallet, onOpenProfile }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setNotice('');
    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth?.user || null;
    setUser(currentUser);
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const [walletResult, recentResult, analyticsResult] = await Promise.all([
      supabase.rpc('droxion_creator_wallet_status'),
      supabase.rpc('droxion_my_recent_live_gifts', { p_limit: 20 }),
      supabase.rpc('droxion_creator_analytics')
    ]);

    if (walletResult.error) setNotice(walletResult.error.message || 'Creator wallet could not be loaded.');
    setWallet(walletResult.data || null);
    setRecent(recentResult.data || []);
    setAnalytics(analyticsResult.error ? null : (analyticsResult.data || null));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (!user && !loading) {
    return (
      <section className="ccPage ccSignedOut">
        <div className="ccIcon"><Sparkles size={28} /></div>
        <h1>Creator Center</h1>
        <p>Sign in to see earnings, LIVE gifts and supporter analytics.</p>
        <a href="/login">Sign in</a>
      </section>
    );
  }

  const creatorShare = Number(analytics?.creator_share_percent ?? wallet?.creator_share_percent ?? 0);
  const platformShare = Number(analytics?.platform_share_percent ?? wallet?.platform_share_percent ?? 0);
  const splitReady = creatorShare === 51 && platformShare === 49;
  const available = Number(wallet?.available_cents || 0);
  const lifetime = Number(wallet?.lifetime_earned_coins || 0);
  const pending = Number(wallet?.pending_payout_coins || 0);
  const sevenDays = Number(analytics?.last_7d_creator_coins || 0);
  const thirtyDays = Number(analytics?.last_30d_creator_coins || 0);
  const supporterCount = Number(analytics?.unique_supporters || 0);
  const totalGifts = Number(analytics?.lifetime_gifts || recent.length || 0);

  return (
    <section className="ccPage">
      <div className="ccHero">
        <div className="ccHeroIcon"><Sparkles size={22} /></div>
        <div>
          <span>DROXION CREATOR</span>
          <h1>Creator Center</h1>
          <p>Your LIVE earnings, supporters and gift activity in one place.</p>
        </div>
      </div>

      {loading ? <div className="ccLoading">Loading Creator Center…</div> : (
        <>
          {notice && <div className="ccNotice">{notice}</div>}

          <div className="ccBalanceCard">
            <span>Available creator balance</span>
            <strong>{money(available)}</strong>
            <small>{Number(wallet?.available_coins || 0).toLocaleString()} creator coins available</small>
            <div className="ccBalanceActions">
              <button type="button" onClick={onOpenProfile}><Banknote size={16} /> Withdraw earnings</button>
              <button type="button" onClick={onOpenWallet}><Coins size={16} /> Droxion wallet</button>
            </div>
          </div>

          <div className="ccGrid">
            <div><span><Banknote size={15} /> Last 7 days</span><strong>{money(sevenDays)}</strong><small>Creator earnings</small></div>
            <div><span><Star size={15} /> Last 30 days</span><strong>{money(thirtyDays)}</strong><small>Creator earnings</small></div>
            <div><span><Users size={15} /> Supporters</span><strong>{supporterCount.toLocaleString()}</strong><small>Unique gifters</small></div>
            <div><span><Gift size={15} /> LIVE gifts</span><strong>{totalGifts.toLocaleString()}</strong><small>Lifetime gifts</small></div>
          </div>

          <div className={`ccSplit ${splitReady ? 'ready' : 'pending'}`}>
            <div>
              <span>LIVE gift revenue split</span>
              <strong>{splitReady ? '51% Creator · 49% Droxion' : `${creatorShare || 70}% Creator · ${platformShare || 30}% Droxion currently`}</strong>
            </div>
            <p>{splitReady
              ? 'The 51/49 split is active and calculated on Droxion servers.'
              : 'This preview is still connected to the existing backend. After you approve the update, we will activate the prepared 51% creator / 49% Droxion migration.'}</p>
          </div>

          <div className="ccSummaryRow">
            <div><span>Lifetime earned</span><strong>{money(lifetime)}</strong></div>
            <div><span>Pending payout</span><strong>{money(pending)}</strong></div>
          </div>

          {analytics?.top_supporter_name && (
            <div className="ccTopSupporter">
              <div><Star size={18} /></div>
              <span><small>Top supporter</small><strong>{analytics.top_supporter_name}</strong><em>{Number(analytics.top_supporter_spend_coins || 0).toLocaleString()} coins · {Number(analytics.top_supporter_gifts || 0)} gifts</em></span>
            </div>
          )}

          <div className="ccSectionHead">
            <div><span>RECENT ACTIVITY</span><h2>LIVE gifts</h2></div>
            <button type="button" onClick={load}>Refresh</button>
          </div>

          <div className="ccGiftList">
            {recent.length === 0 ? <div className="ccEmpty"><Gift size={26} /><strong>No gifts yet</strong><span>Gifts you receive during LIVE will appear here.</span></div> : recent.slice(0, 12).map(row => (
              <div className="ccGiftRow" key={row.id}>
                <div className="ccGiftEmoji">{row.emoji || '🎁'}</div>
                <div className="ccGiftWho"><strong>{row.sender_name || 'Droxion supporter'}</strong><span>{row.gift_name || 'Gift'} · {Number(row.cost_coins || 0)} coins</span></div>
                <div className="ccGiftEarn"><strong>{money(row.creator_coins || 0)}</strong><span>earned</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
