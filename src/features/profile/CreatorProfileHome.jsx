import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, BarChart3, ChevronRight, Clapperboard, Coins, Edit3, Landmark, Settings, Share2, Sparkles } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import LiveProfile from '../../LiveProfile';
import ProfileClipsGrid from './ProfileClipsGrid';
import './creator-profile-home.css';

function money(cents) { return `$${(Number(cents || 0) / 100).toFixed(2)}`; }
function compact(value) { const number = Number(value || 0); if (number < 1000) return String(number); if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`; return `${(number / 1_000_000).toFixed(1).replace('.0', '')}M`; }
function startOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function buildSevenDaySeries(rows) { const today = startOfDay(new Date()); return Array.from({ length: 7 }, (_, index) => { const day = new Date(today); day.setDate(today.getDate() - (6 - index)); const next = new Date(day); next.setDate(day.getDate() + 1); const amount = (rows || []).reduce((sum, row) => { const created = new Date(row.created_at); return created >= day && created < next ? sum + Number(row.amount_cents || 0) : sum; }, 0); return { label: day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1), amount }; }); }

function EarningsSparkline({ series }) {
  const max = Math.max(1, ...series.map(item => Number(item.amount || 0)));
  const points = series.map((item, index) => { const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * 100; const y = 38 - (Number(item.amount || 0) / max) * 32; return `${x},${y}`; }).join(' ');
  return <div className="creatorAnalyticsChart" aria-label="Last 7 days earnings chart"><svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" /></svg><div>{series.map(item => <span key={`${item.label}:${item.amount}`}>{item.label}</span>)}</div></div>;
}

function ProfileActions({ onEdit, onSettings, onShare }) {
  return <div className="creatorUserActions"><button type="button" onClick={onEdit}><Edit3 size={18} /><span><strong>Edit profile</strong><small>Identity, bio and interests</small></span><ChevronRight size={17} /></button><button type="button" onClick={onSettings}><Settings size={18} /><span><strong>Settings</strong><small>Privacy, safety and account</small></span><ChevronRight size={17} /></button><button type="button" onClick={onShare}><Share2 size={18} /><span><strong>Share profile</strong><small>Invite people to follow you</small></span><ChevronRight size={17} /></button></div>;
}

export default function CreatorProfileHome({ currentUserId, coins = 0, onOpenWallet }) {
  const [panel, setPanel] = useState('');
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [earningsRows, setEarningsRows] = useState([]);
  const [giftCount, setGiftCount] = useState(0);
  const [clipStats, setClipStats] = useState({ views: 0, likes: 0, clips: 0 });
  const [automation, setAutomation] = useState({ enabled: false, clips_per_day: 5, clip_duration_minutes: 10, auto_publish: true, owned_sources_only: true });
  const [automationSaving, setAutomationSaving] = useState(false);
  const [automationNotice, setAutomationNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date(); since.setDate(since.getDate() - 30);
      const [profileResult, statsResult, earningsResult, giftsResult, clipsResult, automationResult] = await Promise.all([
        supabase.from('droxion_profiles').select('user_id,display_name,username,avatar_url,bio,country,language').eq('user_id', currentUserId).maybeSingle(),
        supabase.rpc('droxion_follow_stats'),
        supabase.from('droxion_creator_earnings').select('amount_cents,created_at,source').eq('user_id', currentUserId).gte('created_at', since.toISOString()).order('created_at', { ascending: true }),
        supabase.from('droxion_live_gifts').select('id', { count: 'exact', head: true }).eq('recipient_id', currentUserId),
        supabase.from('droxion_live_clips').select('views_count,likes_count,status').eq('creator_id', currentUserId),
        supabase.from('droxion_replay_automation_settings').select('enabled,clips_per_day,clip_duration_minutes,auto_publish,owned_sources_only').eq('user_id', currentUserId).maybeSingle()
      ]);
      if (!alive) return;
      setProfile(profileResult.data || null); setFollowers(Number(statsResult.data?.followers || 0)); setFollowing(Number(statsResult.data?.following || 0)); setEarningsRows(earningsResult.data || []); setGiftCount(Number(giftsResult.count || 0));
      if (automationResult.data) setAutomation(automationResult.data);
      const readyClips = (clipsResult.data || []).filter(row => row.status === 'ready');
      setClipStats({ clips: readyClips.length, views: readyClips.reduce((sum, row) => sum + Number(row.views_count || 0), 0), likes: readyClips.reduce((sum, row) => sum + Number(row.likes_count || 0), 0) });
      setLoading(false);
    })().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [currentUserId]);

  const sevenDays = useMemo(() => buildSevenDaySeries(earningsRows), [earningsRows]);
  const todayStart = startOfDay(new Date());
  const todayEarnings = earningsRows.reduce((sum, row) => new Date(row.created_at) >= todayStart ? sum + Number(row.amount_cents || 0) : sum, 0);
  const sevenDayEarnings = sevenDays.reduce((sum, item) => sum + item.amount, 0);

  async function saveAutomation(patch) {
    if (!currentUserId || automationSaving) return;
    const next = { ...automation, ...patch };
    setAutomation(next); setAutomationSaving(true); setAutomationNotice('');
    const { error } = await supabase.from('droxion_replay_automation_settings').upsert({ user_id: currentUserId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setAutomationSaving(false);
    setAutomationNotice(error ? 'Could not save auto-video settings.' : 'Auto-video settings saved.');
    window.setTimeout(() => setAutomationNotice(''), 2200);
  }

  async function shareProfile() { const shareUrl = typeof window !== 'undefined' ? window.location.href : ''; const title = profile?.display_name || profile?.username || 'Droxion profile'; try { if (navigator.share) await navigator.share({ title, text: `Follow ${title} on Droxion`, url: shareUrl }); else if (navigator.clipboard && shareUrl) await navigator.clipboard.writeText(shareUrl); } catch {} }

  if (panel === 'settings') return <div className="creatorProfileSettingsShell"><div className="creatorProfileSettingsTop"><button type="button" onClick={() => setPanel('')}>← Profile</button><strong>Settings</strong></div><LiveProfile coins={coins} onOpenWallet={onOpenWallet} /></div>;
  if (panel === 'edit') return <LiveProfile key="profile-edit" coins={coins} onOpenWallet={onOpenWallet} initialView="edit" onExit={() => setPanel('')} />;
  if (panel === 'withdraw') return <LiveProfile key="creator-dashboard-withdraw" coins={coins} onOpenWallet={onOpenWallet} initialView="withdraw" onExit={() => setPanel('studio')} />;
  if (panel === 'followers' || panel === 'following') return <LiveProfile key={`creator-dashboard-${panel}`} coins={coins} onOpenWallet={onOpenWallet} initialView="network" initialNetworkMode={panel} onExit={() => setPanel('')} />;
  if (loading) return <section className="creatorProfileHome creatorProfileLoading">Loading profile…</section>;

  const displayName = profile?.display_name || profile?.username || 'Droxion User';
  return <section className="creatorProfileHome profileV3">
    <header className="creatorProfileHeroV3"><div className="creatorProfileCover" aria-hidden="true"><div className="creatorProfileCoverGlow" /></div><div className="creatorProfileIdentity"><div className="creatorProfileAvatarWrap">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <div className="creatorProfileAvatarFallback">{displayName[0]?.toUpperCase()}</div>}<span className="creatorProfileLiveRing" aria-hidden="true" /></div><div className="creatorProfileNameBlock"><h1>{displayName}<BadgeCheck size={20} className="creatorVerified" aria-label="Droxion profile" /></h1>{profile?.username && <span>@{profile.username}</span>}{(profile?.country || profile?.language) && <small>{[profile?.country, profile?.language].filter(Boolean).join(' · ')}</small>}</div><button type="button" className="creatorProfileShareIcon" onClick={shareProfile} aria-label="Share profile"><Share2 size={18} /></button></div>{profile?.bio && <p className="creatorProfileBio">{profile.bio}</p>}<div className="creatorProfileSocialStats creatorProfileSocialStatsV3"><button type="button" onClick={() => setPanel('followers')}><strong>{compact(followers)}</strong><span>Followers</span></button><button type="button" onClick={() => setPanel('following')}><strong>{compact(following)}</strong><span>Following</span></button><div><strong>{compact(clipStats.clips)}</strong><span>Reels</span></div><div><strong>{compact(clipStats.likes)}</strong><span>Likes</span></div></div><div className="creatorProfilePrimaryActions"><button type="button" className="creatorProfileEditPrimary" onClick={() => setPanel('edit')}><Edit3 size={17} /> Edit profile</button><button type="button" className="creatorStudioPrimary" onClick={() => setPanel(panel === 'studio' ? '' : 'studio')}><Sparkles size={17} /> Creator Studio</button></div></header>

    {panel === 'studio' ? <section className="creatorStudioV3" aria-label="Private creator studio">
      <div className="creatorStudioTitle"><div><span>PRIVATE</span><h2>Creator Studio</h2><p>Your money, performance and creator controls are visible only to you.</p></div><BarChart3 size={24} /></div>
      <button className="creatorCenterCard" type="button" aria-label="Creator analytics"><div className="creatorCenterHead"><span>Performance</span><ChevronRight size={19} /></div><div className="creatorCenterNumbers"><div><strong>{money(todayEarnings)}</strong><span>Today</span></div><div><strong>{money(sevenDayEarnings)}</strong><span>7 days</span></div><div><strong>{compact(giftCount)}</strong><span>Gifts</span></div><div><strong>{compact(clipStats.views)}</strong><span>Reel views</span></div></div><EarningsSparkline series={sevenDays} /></button>
      <div className="creatorStudioMoneyGrid"><button className="creatorWalletMini" type="button" onClick={onOpenWallet}><Coins size={18} /><span><strong>{coins} coins</strong><small>Wallet</small></span><ChevronRight size={18} /></button><button className="creatorWithdrawMini" type="button" onClick={() => setPanel('withdraw')}><Landmark size={19} /><span><strong>Withdraw earnings</strong><small>PayPal or secure bank payout</small></span><ChevronRight size={18} /></button></div>
      <section className="creatorAutoVideoCard"><div className="creatorAutoVideoHead"><div><span>AUTO VIDEO</span><h3><Clapperboard size={18} /> Auto-create & publish</h3><p>For LIVE sources you own or have permission to reuse.</p></div><label className="creatorAutoSwitch"><input type="checkbox" checked={Boolean(automation.enabled)} onChange={event => saveAutomation({ enabled: event.target.checked })} /><span /></label></div><div className="creatorAutoVideoGrid"><label><span>Videos per day</span><select value={automation.clips_per_day} onChange={event => saveAutomation({ clips_per_day: Number(event.target.value) })}>{[1,2,3,4,5].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><span>Max video length</span><select value={automation.clip_duration_minutes} onChange={event => saveAutomation({ clip_duration_minutes: Number(event.target.value) })}>{[1,2,3,5,10].map(value => <option key={value} value={value}>{value} min</option>)}</select></label></div><label className="creatorAutoCheck"><input type="checkbox" checked={Boolean(automation.auto_publish)} onChange={event => saveAutomation({ auto_publish: event.target.checked })} /><span>Auto-post finished videos to my Droxion Feed</span></label><div className="creatorAutoRule"><ShieldText />Owned/authorized sources only · up to 5 videos/day · up to 10 minutes each</div>{automationNotice && <small className="creatorAutoNotice">{automationSaving ? 'Saving…' : automationNotice}</small>}</section>
    </section> : <><div className="creatorProfileContentTabs" role="tablist" aria-label="Profile content"><button type="button" className="active">Reels</button><button type="button">Live replays</button><button type="button">About</button></div><div className="creatorProfileClipsTitle"><strong>Latest</strong><span>{compact(clipStats.views)} views · {compact(clipStats.likes)} likes</span></div><ProfileClipsGrid currentUserId={currentUserId} /><ProfileActions onEdit={() => setPanel('edit')} onSettings={() => setPanel('settings')} onShare={shareProfile} /></>}
  </section>;
}

function ShieldText() { return <span aria-hidden="true">✓</span>; }
