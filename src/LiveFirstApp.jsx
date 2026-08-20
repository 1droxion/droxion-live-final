import { useEffect, useState } from 'react';
import { Bell, Home, MessageCircle, Plus, Search, Trophy, User } from 'lucide-react';
import { supabase } from './supabaseClient';
import LiveExperience from './LiveExperience';
import LiveHomePreviewEnhancer from './LiveHomePreviewEnhancer';
import LiveProfile from './LiveProfile';
import Rankings from './Rankings';
import DroxionChat from './DroxionChat';
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
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'go-live', label: 'GO LIVE', icon: Plus },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
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
    if (nextTab === 'go-live') {
      setTab('live');
      window.setTimeout(() => document.querySelector('.liveGoButton')?.click(), 80);
      return;
    }
    setTab(nextTab);
  }

  let content = <><HomeDiscoveryControls query={searchQuery} /><LiveExperience currentUserId={user?.id} coins={coins} onCoinsChanged={value => setCoins(Number(value || 0))} onOpenWallet={() => setWalletOpen(true)} onImmersiveChange={setImmersiveLive} /></>;
  if (tab === 'rankings') content = <Rankings />;
  if (tab === 'chat') content = <DroxionChat />;
  if (tab === 'profile') content = <LiveProfile onOpenWallet={() => setWalletOpen(true)} coins={coins} />;

  return (
    <main className={`lfShell ${tab === 'chat' ? 'lfChatTab' : ''} ${immersiveLive ? 'lfImmersiveLive' : ''}`}>
      <ProfileAvatarEnhancer />
      <PublishReadyEnhancer />
      <ProfileAccountActionsEnhancer />
      <LiveHomePreviewEnhancer currentUserId={user?.id} enabled={tab === 'live' && !immersiveLive} />

      {!immersiveLive && <header className={`lfTopbar ${tab === 'live' ? 'lfHomeTopbar' : ''}`}>
        <button className="lfBrand" type="button" onClick={() => chooseTab('live')} aria-label="Open Droxion home"><span><strong>DROXION</strong><small>LIVE SOCIAL</small></span></button>
        {tab === 'live' ? <div className="lfHomeActions">
          <button className="lfSearchButton" type="button" onClick={() => setSearchOpen(value => !value)} aria-label="Search LIVE creators"><Search size={19} /></button>
          <button className="lfNotificationButton" type="button" onClick={() => setNotificationsOpen(true)} aria-label="Notifications"><Bell size={19} />{unreadNotifications > 0 && <i />}</button>
        </div> : <div className="lfSectionLabel">{TABS.find(item => item.id === tab)?.label}</div>}
        {tab === 'live' && searchOpen && <label className="lfSearchOverlay"><Search size={17} /><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search creators or LIVE streams" /><button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>×</button></label>}
      </header>}

      <div className={`lfContent ${immersiveLive ? 'lfContentImmersive' : ''}`}>{content}</div>

      {!immersiveLive && <nav className="lfNav" aria-label="Droxion navigation">{TABS.map(item => { const Icon = item.icon; const active = item.id === tab; return <button type="button" key={item.id} onClick={() => chooseTab(item.id)} className={`${active ? 'active' : ''}`}><span className="lfNavIcon"><Icon size={20} /></span><span>{item.label}</span></button>; })}</nav>}

      {walletOpen && <DroxionWallet coins={coins} onClose={() => setWalletOpen(false)} onBalanceRefresh={() => refreshWallet()} />}
      {user && <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onUnreadChange={setUnreadNotifications} />}
    </main>
  );
}
