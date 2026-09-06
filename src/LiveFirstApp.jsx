import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Coins, Compass, Heart, Home, Inbox, Search, User, Play } from 'lucide-react';
import { invalidateLiveFeedCache, supabase } from './supabaseClient';
import LiveClientDiagnostics from './LiveClientDiagnostics';
import DroxionChat from './DroxionChat';
import ShortFeed from './ShortFeed';
import GlobalLiveHub from './GlobalLiveHub';
import DroxionWallet from './DroxionWallet';
import NotificationsPanel from './NotificationsPanel';
import ProfileAvatarEnhancer from './ProfileAvatarEnhancer';
import PublishReadyEnhancer from './PublishReadyEnhancer';
import ProfileAccountActionsEnhancer from './ProfileAccountActionsEnhancer';
import ProductionLiveHost from './features/live/components/ProductionLiveHost';
import ProductionLiveBrowser from './features/live/components/ProductionLiveBrowser';
import LiveGuestInvitePrompt from './features/live/components/LiveGuestInvitePrompt';
import LiveGuestViewerBridge from './features/live/components/LiveGuestViewerBridge';
import CreatorProfileHome from './features/profile/CreatorProfileHome';
import './real-home.css';
import './live-first-app.css';
import './product-shell.css';

const PENDING_LIVE_PUSH_KEY = 'droxion.pendingLivePush';
const PENDING_CHAT_PUSH_KEY = 'droxion.pendingChatPush';
const PUBLIC_NATIVE_LIVE_ENABLED = false;

const TABS = [
  { id: 'live', label: 'Home', icon: Home },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'feed', label: 'Feed', icon: Play },
  { id: 'following', label: 'Following', icon: Heart },
  { id: 'wallet', label: 'Wallet', icon: Coins },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function LiveFirstApp() {
  const [tab, setTab] = useState('live');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [immersiveLive, setImmersiveLive] = useState(false);
  const [hostStudioOpen, setHostStudioOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [liveHomeVersion, setLiveHomeVersion] = useState(0);

  async function refreshWallet(authUser = user, knownBalance) {
    const hasKnownBalance = Number.isFinite(knownBalance);
    if (hasKnownBalance) setCoins(Number(knownBalance));
    if (!authUser?.id) { if (!hasKnownBalance) setCoins(0); return; }
    const { data, error } = await supabase.from('droxion_wallets').select('coin_balance').eq('user_id', authUser.id).maybeSingle();
    if (!error && data) setCoins(Number(data.coin_balance || 0));
  }

  useEffect(() => {
    let mounted = true;
    const scheduleWalletRefresh = authUser => {
      if (!authUser?.id) { setCoins(0); return; }
      window.setTimeout(() => { if (mounted) refreshWallet(authUser).catch(() => {}); }, 0);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const authUser = session?.user || null; setUser(authUser); scheduleWalletRefresh(authUser);
    });
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const authUser = data?.user || null; setUser(authUser); scheduleWalletRefresh(authUser);
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!immersiveLive) return;
    const unlockLiveAudio = () => {
      Array.from(document.querySelectorAll('.liveRoomV4 audio,.productionViewerPage audio')).forEach(audio => {
        audio.muted = false; audio.volume = 1;
        const playback = audio.play?.(); if (playback?.catch) playback.catch(() => {});
      });
    };
    const events = ['pointerdown', 'touchend', 'keydown'];
    events.forEach(eventName => document.addEventListener(eventName, unlockLiveAudio, { passive: true }));
    unlockLiveAudio();
    const retry = window.setInterval(unlockLiveAudio, 1200);
    return () => { window.clearInterval(retry); events.forEach(eventName => document.removeEventListener(eventName, unlockLiveAudio)); };
  }, [immersiveLive]);

  useEffect(() => {
    const openLiveHome = () => {
      setHostStudioOpen(false); setImmersiveLive(false); setSearchOpen(false); setNotificationsOpen(false); setChatOpen(false); setTab('live');
      invalidateLiveFeedCache(); setLiveHomeVersion(version => version + 1);
      try { window.localStorage.removeItem(PENDING_LIVE_PUSH_KEY); } catch {}
    };
    const openChatFromPush = () => {
      setHostStudioOpen(false); setImmersiveLive(false); setSearchOpen(false); setNotificationsOpen(false); setTab('live'); setChatOpen(true);
    };
    window.addEventListener('droxion:live-push-open', openLiveHome);
    window.addEventListener('droxion:chat-push-open', openChatFromPush);
    try {
      const pendingLive = window.localStorage.getItem(PENDING_LIVE_PUSH_KEY);
      const pendingChat = window.localStorage.getItem(PENDING_CHAT_PUSH_KEY);
      if (pendingChat) window.setTimeout(openChatFromPush, 0);
      else if (pendingLive) window.setTimeout(openLiveHome, 0);
    } catch {}
    return () => {
      window.removeEventListener('droxion:live-push-open', openLiveHome);
      window.removeEventListener('droxion:chat-push-open', openChatFromPush);
    };
  }, []);

  function openGoLiveInsideHome() {
    if (!PUBLIC_NATIVE_LIVE_ENABLED) return;
    setTab('live'); setImmersiveLive(false); setSearchOpen(false); setNotificationsOpen(false); setChatOpen(false); setHostStudioOpen(true);
  }

  function chooseTab(nextTab) {
    setHostStudioOpen(false); setImmersiveLive(false); setSearchOpen(false); setNotificationsOpen(false);
    if (nextTab === 'wallet') { setChatOpen(false); setWalletOpen(true); return; }
    if (nextTab === 'inbox') { setChatOpen(true); return; }
    setChatOpen(false); setTab(nextTab);
  }

  function startLiveFromFeed() { openGoLiveInsideHome(); }
  function watchCreatorLive() { setTab('live'); setHostStudioOpen(false); }

  const nativeLiveBrowser = <ProductionLiveBrowser key={`home-live-${liveHomeVersion}`} currentUserId={user?.id} coins={coins} onCoinsChanged={value => setCoins(Number(value || 0))} onOpenWallet={() => setWalletOpen(true)} onImmersiveChange={setImmersiveLive} />;
  const liveHubProps = {
    query: searchQuery,
    currentUserId: user?.id,
    coins,
    onCoinsChanged: value => setCoins(Number(value || 0)),
    onOpenWallet: () => setWalletOpen(true)
  };

  let content = <GlobalLiveHub {...liveHubProps} nativeLive={PUBLIC_NATIVE_LIVE_ENABLED ? nativeLiveBrowser : null} mode="home" />;
  if (tab === 'explore') content = <GlobalLiveHub {...liveHubProps} mode="explore" />;
  if (tab === 'following') content = <GlobalLiveHub {...liveHubProps} mode="following" />;
  if (tab === 'feed') content = <ShortFeed currentUserId={user?.id} onWatchLive={PUBLIC_NATIVE_LIVE_ENABLED ? watchCreatorLive : undefined} onStartLive={PUBLIC_NATIVE_LIVE_ENABLED ? startLiveFromFeed : undefined} nativeLiveEnabled={PUBLIC_NATIVE_LIVE_ENABLED} />;
  if (tab === 'profile') content = <CreatorProfileHome currentUserId={user?.id} coins={coins} onOpenWallet={() => setWalletOpen(true)} />;

  const discoveryTab = tab === 'live' || tab === 'explore' || tab === 'following';

  return (
    <main className={`lfShell ${tab === 'feed' ? 'lfFeedTab' : ''} ${chatOpen ? 'lfChatTab' : ''} ${immersiveLive ? 'lfImmersiveLive' : ''}`}>
      <LiveClientDiagnostics /><ProfileAvatarEnhancer /><PublishReadyEnhancer /><ProfileAccountActionsEnhancer />
      <LiveGuestInvitePrompt currentUserId={user?.id} />
      <LiveGuestViewerBridge enabled={immersiveLive} currentUserId={user?.id} />

      {!immersiveLive && !chatOpen && tab !== 'feed' && <header className={`lfTopbar ${discoveryTab ? 'lfHomeTopbar' : ''}`}>
        <button className="lfBrand" type="button" onClick={() => chooseTab('live')} aria-label="Open Droxion home"><span><strong>DROXION</strong><small>LIVE EVERYWHERE</small></span></button>
        {discoveryTab ? <div className="lfHomeActions">
          <button className="lfSearchButton" type="button" onClick={() => setSearchOpen(value => !value)} aria-label="Search LIVE creators"><Search size={19} /></button>
          <button className="lfSearchButton" type="button" onClick={() => setWalletOpen(true)} aria-label={`Wallet ${coins} coins`}><Coins size={19} /></button>
          <button className="lfSearchButton" type="button" onClick={() => setChatOpen(true)} aria-label="Inbox"><Inbox size={19} /></button>
          <button className="lfNotificationButton" type="button" onClick={() => setNotificationsOpen(true)} aria-label="Notifications"><Bell size={19} />{unreadNotifications > 0 && <i />}</button>
        </div> : <div className="lfSectionLabel">{TABS.find(item => item.id === tab)?.label}</div>}
        {discoveryTab && searchOpen && <label className="lfSearchOverlay"><Search size={17} /><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search creators, games, categories or platforms" /><button type="button" onClick={() => { setSearchQuery(''); setSearchOpen(false); }}>×</button></label>}
      </header>}

      {chatOpen && !immersiveLive && <header className="lfTopbar"><button className="lfBrand" type="button" onClick={() => setChatOpen(false)} aria-label="Back to Droxion Home"><ArrowLeft size={22} /><span><strong>DROXION</strong><small>INBOX</small></span></button><div className="lfSectionLabel">Messages</div></header>}
      <div className={`lfContent ${immersiveLive ? 'lfContentImmersive' : ''}`}>{chatOpen ? <DroxionChat /> : content}</div>
      {!immersiveLive && !chatOpen && <nav className="lfNav" aria-label="Droxion navigation">{TABS.map(item => { const Icon = item.icon; const active = item.id === tab; return <button type="button" data-tab={item.id} key={item.id} onClick={() => chooseTab(item.id)} className={active ? 'active' : ''}><span className="lfNavIcon"><Icon size={20} /></span><span>{item.label}</span></button>; })}</nav>}

      {PUBLIC_NATIVE_LIVE_ENABLED && hostStudioOpen && <ProductionLiveHost creatorId={user?.id} onClose={() => { setHostStudioOpen(false); invalidateLiveFeedCache(); setLiveHomeVersion(version => version + 1); }} />}
      {walletOpen && <DroxionWallet coins={coins} onClose={() => setWalletOpen(false)} onBalanceRefresh={knownBalance => refreshWallet(user, knownBalance)} />}
      {user && <NotificationsPanel open={notificationsOpen} onClose={() => setNotificationsOpen(false)} onUnreadChange={setUnreadNotifications} />}
    </main>
  );
}
