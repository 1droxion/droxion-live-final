import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronRight, Coins, Edit3, Landmark, Settings, UserRound, Video } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import LiveProfile from '../../LiveProfile';
import ProfileClipsGrid from './ProfileClipsGrid';
import './creator-profile-home.css';

function money(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function compact(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(1).replace('.0', '')}M`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildSevenDaySeries(rows) {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (6 - index));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const amount = (rows || []).reduce((sum, row) => {
      const created = new Date(row.created_at);
      return created >= day && created < next ? sum + Number(row.amount_cents || 0) : sum;
    }, 0);
    return { label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1), amount };
  });
}

function storedProfileMode() {
  try {
    return window.localStorage.getItem('droxion-profile-mode') === 'user' ? 'user' : 'creator';
  } catch {
    return 'creator';
  }
}

function EarningsSparkline({ series }) {
  const max = Math.max(1, ...series.map(item => Number(item.amount || 0)));
  const points = series.map((item, index) => {
    const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * 100;
    const y = 38 - (Number(item.amount || 0) / max) * 32;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="creatorAnalyticsChart" aria-label="Last 7 days earnings chart">
      <svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img">
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div>{series.map(item => <span key={`${item.label}:${item.amount}`}>{item.label}</span>)}</div>
    </div>
  );
}

export default function CreatorProfileHome({ currentUserId, coins = 0, onOpenWallet }) {
  const [panel, setPanel] = useState('');
  const [profileMode, setProfileMode] = useState(storedProfileMode);
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [earningsRows, setEarningsRows] = useState([]);
  const [giftCount, setGiftCount] = useState(0);
  const [clipStats, setClipStats] = useState({ views: 0, likes: 0, clips: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const [profileResult, statsResult, earningsResult, giftsResult, clipsResult] = await Promise.all([
        supabase.from('droxion_profiles').select('user_id,display_name,username,avatar_url,bio,country,language').eq('user_id', currentUserId).maybeSingle(),
        supabase.rpc('droxion_follow_stats'),
        supabase.from('droxion_creator_earnings').select('amount_cents,created_at,source').eq('user_id', currentUserId).gte('created_at', since.toISOString()).order('created_at', { ascending: true }),
        supabase.from('droxion_live_gifts').select('id', { count: 'exact', head: true }).eq('recipient_id', currentUserId),
        supabase.from('droxion_live_clips').select('views_count,likes_count,status').eq('creator_id', currentUserId)
      ]);
      if (!alive) return;
      setProfile(profileResult.data || null);
      setFollowers(Number(statsResult.data?.followers || 0));
      setFollowing(Number(statsResult.data?.following || 0));
      setEarningsRows(earningsResult.data || []);
      setGiftCount(Number(giftsResult.count || 0));
      const readyClips = (clipsResult.data || []).filter(row => row.status === 'ready');
      setClipStats({
        clips: readyClips.length,
        views: readyClips.reduce((sum, row) => sum + Number(row.views_count || 0), 0),
        likes: readyClips.reduce((sum, row) => sum + Number(row.likes_count || 0), 0)
      });
      setLoading(false);
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [currentUserId]);

  const sevenDays = useMemo(() => buildSevenDaySeries(earningsRows), [earningsRows]);
  const todayStart = startOfDay(new Date());
  const todayEarnings = earningsRows.reduce((sum, row) => new Date(row.created_at) >= todayStart ? sum + Number(row.amount_cents || 0) : sum, 0);
  const sevenDayEarnings = sevenDays.reduce((sum, item) => sum + item.amount, 0);

  function chooseMode(nextMode) {
    setProfileMode(nextMode);
    try { window.localStorage.setItem('droxion-profile-mode', nextMode); } catch {}
  }

  if (panel === 'settings') {
    return (
      <div className="creatorProfileSettingsShell">
        <div className="creatorProfileSettingsTop"><button type="button" onClick={() => setPanel('')}>← Profile</button><strong>Settings</strong></div>
        <LiveProfile coins={coins} onOpenWallet={onOpenWallet} />
      </div>
    );
  }

  if (panel === 'edit') {
    return <LiveProfile key="profile-edit" coins={coins} onOpenWallet={onOpenWallet} initialView="edit" onExit={() => setPanel('')} />;
  }

  if (panel === 'withdraw') {
    return <LiveProfile key="creator-dashboard-withdraw" coins={coins} onOpenWallet={onOpenWallet} initialView="withdraw" onExit={() => setPanel('')} />;
  }

  if (panel === 'followers' || panel === 'following') {
    return <LiveProfile key={`creator-dashboard-${panel}`} coins={coins} onOpenWallet={onOpenWallet} initialView="network" initialNetworkMode={panel} onExit={() => setPanel('')} />;
  }

  if (loading) return <section className="creatorProfileHome creatorProfileLoading">Loading profile…</section>;

  const creatorMode = profileMode === 'creator';

  return (
    <section className={`creatorProfileHome ${creatorMode ? 'isCreatorMode' : 'isUserMode'}`}>
      <header className="creatorProfileHero">
        <button className="creatorProfileSettings" type="button" onClick={() => setPanel('settings')} aria-label="Open profile settings"><Settings size={21} /></button>
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <div className="creatorProfileAvatarFallback">{(profile?.display_name || profile?.username || 'D')[0]?.toUpperCase()}</div>}
        <h1>{profile?.display_name || profile?.username || 'Droxion User'}</h1>
        {profile?.username && <span>@{profile.username}</span>}
        {profile?.bio && <p>{profile.bio}</p>}

        <div className="creatorProfileModeSwitch" role="group" aria-label="Profile mode">
          <button type="button" className={creatorMode ? '' : 'active'} onClick={() => chooseMode('user')}><UserRound size={16} /> User</button>
          <button type="button" className={creatorMode ? 'active' : ''} onClick={() => chooseMode('creator')}><Video size={16} /> Creator</button>
        </div>

        <div className={`creatorProfileSocialStats ${creatorMode ? '' : 'userStats'}`}>
          <button type="button" onClick={() => setPanel('followers')} aria-label="View followers"><strong>{compact(followers)}</strong><span>Followers</span></button>
          <button type="button" onClick={() => setPanel('following')} aria-label="View following"><strong>{compact(following)}</strong><span>Following</span></button>
          {creatorMode && <div><strong>{compact(clipStats.clips)}</strong><span>Reels</span></div>}
        </div>
      </header>

      {!creatorMode ? (
        <div className="creatorUserActions">
          <button type="button" onClick={() => setPanel('edit')}><Edit3 size={19} /><span><strong>Edit Profile</strong><small>Name, bio, country, language and interests</small></span><ChevronRight size={18} /></button>
          <button type="button" onClick={() => setPanel('settings')}><Settings size={19} /><span><strong>Settings</strong><small>Privacy, support and account controls</small></span><ChevronRight size={18} /></button>
        </div>
      ) : (
        <>
          <section className="creatorDashboardSection" aria-label="Creator dashboard">
            <div className="creatorDashboardLabel"><BarChart3 size={18} /><strong>Creator Dashboard</strong></div>
            <button className="creatorCenterCard" type="button" aria-label="Creator analytics">
              <div className="creatorCenterHead"><span>Performance</span><ChevronRight size={19} /></div>
              <div className="creatorCenterNumbers">
                <div><strong>{money(todayEarnings)}</strong><span>Today</span></div>
                <div><strong>{money(sevenDayEarnings)}</strong><span>7 days</span></div>
                <div><strong>{compact(giftCount)}</strong><span>Gifts</span></div>
                <div><strong>{compact(clipStats.views)}</strong><span>Reel views</span></div>
              </div>
              <EarningsSparkline series={sevenDays} />
            </button>
          </section>

          <button className="creatorWalletMini" type="button" onClick={onOpenWallet}><Coins size={18} /><span><strong>{coins} coins</strong><small>Wallet</small></span><ChevronRight size={18} /></button>

          <button className="creatorWithdrawMini" type="button" onClick={() => setPanel('withdraw')}><Landmark size={19} /><span><strong>Withdraw Earnings</strong><small>PayPal or secure bank payout</small></span><ChevronRight size={18} /></button>

          <div className="creatorProfileClipsTitle"><strong>LIVE Reels</strong><span>{compact(clipStats.views)} views · {compact(clipStats.likes)} likes</span></div>
          <ProfileClipsGrid currentUserId={currentUserId} />
        </>
      )}
    </section>
  );
}
