import { useEffect, useState } from 'react';
import { Coins, Home, Sparkles, User, Video } from 'lucide-react';
import { supabase } from './supabaseClient';
import LiveExperience from './LiveExperience';
import LiveProfile from './LiveProfile';
import CreatorCenter from './CreatorCenter';
import DroxionWallet from './DroxionWallet';
import ProfileAvatarEnhancer from './ProfileAvatarEnhancer';
import PublishReadyEnhancer from './PublishReadyEnhancer';
import './real-home.css';
import './live-first-app.css';

const TABS = [
  { id: 'live', label: 'Home', icon: Home },
  { id: 'go-live', label: 'GO LIVE', icon: Video, primary: true },
  { id: 'creator', label: 'Creator', icon: Sparkles },
  { id: 'me', label: 'Me', icon: User },
];

export default function LiveFirstApp() {
  const [tab, setTab] = useState('live');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [immersiveLive, setImmersiveLive] = useState(false);

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
      const audioElements = Array.from(document.querySelectorAll('.liveRoomV4 audio'));
      audioElements.forEach(audio => {
        audio.muted = false;
        audio.volume = 1;
        const playback = audio.play?.();
        if (playback?.catch) playback.catch(() => {});
      });
    };

    const events = ['pointerdown', 'touchend', 'keydown'];
    events.forEach(eventName => document.addEventListener(eventName, unlockLiveAudio, { passive: true }));
    unlockLiveAudio();

    const retry = window.setInterval(unlockLiveAudio, 1200);
    return () => {
      window.clearInterval(retry);
      events.forEach(eventName => document.removeEventListener(eventName, unlockLiveAudio));
    };
  }, [immersiveLive]);

  function chooseTab(nextTab) {
    setImmersiveLive(false);
    if (nextTab === 'go-live') {
      setTab('live');
      window.setTimeout(() => document.querySelector('.liveGoButton')?.click(), 80);
      return;
    }
    setTab(nextTab);
  }

  let content = <LiveExperience currentUserId={user?.id} coins={coins} onCoinsChanged={value => setCoins(Number(value || 0))} onOpenWallet={() => setWalletOpen(true)} onImmersiveChange={setImmersiveLive} />;
  if (tab === 'creator') content = <CreatorCenter onOpenWallet={() => setWalletOpen(true)} onOpenProfile={() => setTab('me')} />;
  if (tab === 'me') content = <LiveProfile onOpenWallet={() => setWalletOpen(true)} coins={coins} />;

  return (
    <main className={`lfShell ${immersiveLive ? 'lfImmersiveLive' : ''}`}>
      <ProfileAvatarEnhancer />
      <PublishReadyEnhancer />
      {!immersiveLive && <header className="lfTopbar"><button className="lfBrand" type="button" onClick={() => setTab('live')} aria-label="Open Droxion home"><img className="lfBrandMark" src="/droxion-logo.svg" alt="" aria-hidden="true" /><span><strong>DROXION</strong><small>LIVE SOCIAL</small></span></button><div className="lfTopActions"><button className="lfCreatorShortcut" type="button" onClick={() => setTab('creator')}><Sparkles size={16} /><span>Creator</span></button><button className="lfCoins" type="button" onClick={() => setWalletOpen(true)}><Coins size={17} /> {coins}</button></div></header>}

      <div className={`lfContent ${immersiveLive ? 'lfContentImmersive' : ''}`}>{content}</div>

      {!immersiveLive && <nav className="lfNav" aria-label="Droxion navigation">{TABS.map(item => { const Icon = item.icon; const active = item.id === tab; return <button type="button" key={item.id} onClick={() => chooseTab(item.id)} className={`${active ? 'active' : ''} ${item.primary ? 'primary' : ''}`}><span className="lfNavIcon"><Icon size={item.primary ? 23 : 20} /></span><span>{item.label}</span></button>; })}</nav>}

      {walletOpen && <DroxionWallet coins={coins} onClose={() => setWalletOpen(false)} onBalanceRefresh={() => refreshWallet()} />}
    </main>
  );
}
