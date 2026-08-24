import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Home, Inbox, Plus, Search, Trophy, User, Play } from 'lucide-react';
import { supabase } from './supabaseClient';
import LiveExperience from './LiveExperienceScale';
import LiveHomePreviewEnhancer from './LiveHomePreviewEnhancer';
import LiveCameraStartupEnhancer from './LiveCameraStartupEnhancer';
import LiveProfile from './LiveProfile';
import Rankings from './Rankings';
import DroxionChat from './DroxionChat';
import ShortFeed from './ShortFeed';
import HomeDiscoveryControls from './HomeDiscoveryControls';
import DroxionWallet from './DroxionWallet';
import NotificationsPanel from './NotificationsPanel';
import ProfileAvatarEnhancer from './ProfileAvatarEnhancer';
import PublishReadyEnhancer from './PublishReadyEnhancer';
import ProfileAccountActionsEnhancer from './ProfileAccountActionsEnhancer';
import './real-home.css';
import './live-first-app.css';
import './product-shell.css';

const TABS = [
  { id: 'live', label: 'Home', icon: Home },
  { id: 'feed', label: 'Feed', icon: Play },
  { id: 'go-live', label: 'LIVE', icon: Plus },
  { id: 'rankings', label: 'Ranking', icon: Trophy },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function LiveFirstApp() {
  const [tab, setTab] = useState('live');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [immersiveLive, setImmersiveLive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  async function refreshWallet(authUser = user) {
    if (!authUser?.id) { setCoins(0); return; }
    const { data } = await supabase.from('droxion_wallets').select('coin_balance').eq('user_id', authUser.id).maybeSingle();
    setCoins(Number(data?.coin_balance || 0));
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      const authUser = data?.user || null;
      setUser(authUser);
      if (authUser) await refreshWallet(authUser);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const authUser = session?.user || null;
      setUser(authUser);
      if (authUser) await refreshWallet(authUser); else setCoins(0);
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!immersiveLive) return;
    const unlockLiveAudio = () => {
      Array.from(document.querySelectorAll('.liveRoomV4 audio')).forEach(audio => {
        audio.muted = false; audio.volume = 1;
        const playback = audio.play?.();
        if (playback?.catch) playback.catch(() => {});
      });
    };
    const events = ['pointerdown', 'touchend', 'keydown'];
    events.forEach(eventName => document.addEventListener(eventName, unlockLiveAudio, { passive: true }));
    unlockLiveAudio();
    const retry = window.setInterval(unlockLiveAudio, 1200);
    return () => { window.clearInterval(retry); events.forEach(eventName => document.removeEventListener(eventName, unlockLiveAudio)); };
  }, [immersiveLive]);

  function chooseTab(nextTab) {
    setImmersiveLive(false);
    setSearchOpen(false);
    setNotificationsOpen(false);
    setChatOpen(false);
    if (nextTab === 'go-live') {
      setTab('live');
      window.setTimeout(() => document.querySelector('.liveGoButton')?.click(), 80);
      return;
    }
    setTab(nextTab);
  }

  function startLiveFromFeed() {
    setTab('live');
    window.setTimeout(() => document.querySelector('.liveGoButton')?.click(), 80);
  }

  function watchCreatorLive(creatorId) {
    setTab('live');
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('droxion:open-live-creator', { detail: { creatorId } })), 80);
  }

  let content = <><HomeDiscoveryControls query={searchQuery} /><LiveExperience currentUserId={user?.id} coins={coins} onCoinsChanged={value => setCoins(Number(value || 0))} onOpenWallet={() => setWalletOpen(true)} onImmersiveChange={setImmersiveLive} /></>;
  if (tab === 'feed') content = <ShortFeed currentUserId={user?.id} onWatchLive={watchCreatorLive} onStartLive={startLiveFromFeed} />;
  if (tab === 'rankings') content = <Rankings />;
  if (tab === 'profile') content = <LiveProfile onOpenWallet={() => setWalletOpen(true)} coins={coins} />;

  return (
    <main className={`lfShell ${tab === 'feed' ? 'lfFeedTab' : ''} ${chatOpen ? 'lfChatTab' : ''} ${immersiveLive ? 'lfImmersiveLive' : ''}`}>
      <ProfileAvatarEnhancer />
      <PublishReadyEnhancer />
      <ProfileAccountActionsEnhancer />
      <LiveCameraStartupEnhancer />
      <LiveHomePreviewEnhancer currentUserId={user?.id} enabled={tab === 'live' && !immersiveLive && !chatOpen} />

      {!immersiveLive && !chatOpen && tab !== 'feed' && <header className={`lfTopbar ${tab === 'live' ? 'lfHomeTopbar' : ''}`}>
        <button className="lfBrand" type="button" onClick={() => chooseTab('live')} aria-label="Open Droxion home"><span><strong>DROXION</strong><small>LIVE SOCIAL</small></span></button>
        {tab === 'live' ? <div className="lfHomeActions">
          <button className="lfSearchButton" type="button" onClick={() => setSearchOpen(value => !value)} aria-label="Search LIVE creators"><Search size={19} /></button>
          <button className="lfSearchButton" type="button" onClick={() => setChatOpen(true)} aria-label="Inbox"><Inbox size={19} /></button>
          <button className="lfNotificationButton" type="button" onClick={() => setNotificationsOpen(true)} aria-label="Notifications"><Bell size={19} />{unreadNotifications > 0 && <i />}</button>
        </div> : <div className="lfSectionLabel">{TABS.find(item => item.id === tab)?.label}</div>}
        {tab === 'live' && searchOpen && <label className="lfSearchOverlay"><Search size={17} /><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search creators or LIVE streams" /><button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>×</button></label>}
      </header>}

      {chatOpen && !immersiveLive && <header className="lfTopbar"><button className="lfBrand" type="button" onClick={() => setChatOpen(false)} aria-label="Back to Droxion Home"><ArrowLeft size={22} /><span><strong>DROXION</strong><small>INBOX</small></span></button><div className="lfSectionLabel">Messages</div></header>}

      <div className={`lfContent ${immersiveLive ? 'lfContentImmersive' : ''}`}>{chatOpen ? <DroxionChat /> : content}</div>

      {!immersiveLive && !chatOpen && <nav className="lfNav" aria-label="Droxion navigation">{TABS.map(item => { const Icon = item.icon; const active = item.id === tab; return <button type="button" key={item.id} onClick={() => chooseTab(item.id)} className={active ? 'active' : ''}><span className="lfNavIcon"><Icon size={20} /></span><span>{item.label}</span></button>; })}</nav>}

      {walletOpen && <DroxionWallet coins={coins} onClose={() => setWalletOpen(false)} onBalanceRefresh={() => refreshWallet()} />}
      {user && <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onUnreadChange={setUnreadNotifications} />}
    </main>
  );
}
