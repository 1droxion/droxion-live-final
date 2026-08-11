import { useEffect, useState } from 'react';
import { Bell, Coins, Crown, Home, MessageCircle, Trophy, User, Video } from 'lucide-react';
import { supabase } from './supabaseClient';
import LiveExperience from './LiveExperience';
import LiveProfile from './LiveProfile';
import DroxionWallet from './DroxionWallet';
import './real-home.css';
import './live-first-app.css';

const TABS = [
  { id: 'live', label: 'Home', icon: Home },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'go-live', label: 'GO LIVE', icon: Video, primary: true },
  { id: 'inbox', label: 'Inbox', icon: MessageCircle },
  { id: 'me', label: 'Me', icon: User },
];

function Rankings() {
  return <section className="lfPage lfPlaceholder"><div className="lfEyebrow"><Trophy size={16} /> DROXION RANKINGS</div><h1>Top creators will live here.</h1><p>Daily, weekly, monthly, rising creators, most viewed and most gifted rankings are next after the LIVE core is stable.</p><div className="lfComingCard"><Crown size={28} /><div><strong>Rankings foundation ready</strong><span>We will connect this to real LIVE views, follows and gifts.</span></div></div></section>;
}

function Inbox() {
  return <section className="lfPage lfPlaceholder"><div className="lfEyebrow"><Bell size={16} /> INBOX</div><h1>LIVE activity and messages.</h1><p>Creator-goes-live alerts, guest requests, follows, gifts and direct messages will be consolidated here.</p></section>;
}

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

  function chooseTab(nextTab) {
    setImmersiveLive(false);
    if (nextTab === 'go-live') {
      setTab('live');
      window.setTimeout(() => document.querySelector('.liveGoButton')?.click(), 80);
      return;
    }
    setTab(nextTab);
  }

  let content;
  if (tab === 'live') {
    content = <LiveExperience currentUserId={user?.id} coins={coins} onCoinsChanged={value => setCoins(Number(value || 0))} onOpenWallet={() => setWalletOpen(true)} onImmersiveChange={setImmersiveLive} />;
  } else if (tab === 'rankings') content = <Rankings />;
  else if (tab === 'inbox') content = <Inbox />;
  else content = <LiveProfile onOpenWallet={() => setWalletOpen(true)} coins={coins} />;

  return (
    <main className={`lfShell ${immersiveLive ? 'lfImmersiveLive' : ''}`}>
      {!immersiveLive && <header className="lfTopbar"><button className="lfBrand" type="button" onClick={() => setTab('live')} aria-label="Open Droxion home"><span className="lfBrandMark">D</span><span><strong>DROXION</strong><small>LIVE SOCIAL</small></span></button><button className="lfCoins" type="button" onClick={() => setWalletOpen(true)}><Coins size={17} /> {coins}</button></header>}

      <div className={`lfContent ${immersiveLive ? 'lfContentImmersive' : ''}`}>{content}</div>

      {!immersiveLive && <nav className="lfNav" aria-label="Droxion navigation">{TABS.map(item => { const Icon = item.icon; const active = item.id === tab; return <button type="button" key={item.id} onClick={() => chooseTab(item.id)} className={`${active ? 'active' : ''} ${item.primary ? 'primary' : ''}`}><span className="lfNavIcon"><Icon size={item.primary ? 23 : 20} /></span><span>{item.label}</span></button>; })}</nav>}

      {walletOpen && <DroxionWallet coins={coins} onClose={() => setWalletOpen(false)} onBalanceRefresh={() => refreshWallet()} />}
    </main>
  );
}
