import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import LiveClientDiagnostics from './LiveClientDiagnostics';
import DroxionWallet from './DroxionWallet';
import ExternalVerticalLiveFeed from './ExternalVerticalLiveFeed';
import ShortFeed from './ShortFeed';
import './live-first-app.css';

export default function LiveFirstApp() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [feedMode, setFeedMode] = useState('live');

  async function refreshWallet(authUser = user, knownBalance) {
    if (Number.isFinite(knownBalance)) setCoins(Number(knownBalance));

    if (!authUser?.id) {
      if (!Number.isFinite(knownBalance)) setCoins(0);
      return;
    }

    const { data, error } = await supabase
      .from('droxion_wallets')
      .select('coin_balance')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!error && data) setCoins(Number(data.coin_balance || 0));
  }

  useEffect(() => {
    let mounted = true;

    const applySession = authUser => {
      if (!mounted) return;
      setUser(authUser || null);

      if (!authUser?.id) {
        setCoins(0);
        return;
      }

      window.setTimeout(() => {
        if (mounted) refreshWallet(authUser).catch(() => {});
      }, 0);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user || null);
    });

    supabase.auth.getUser().then(({ data }) => {
      applySession(data?.user || null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <main className="droxionVerticalShell">
      <LiveClientDiagnostics />

      {feedMode === 'live' ? (
        <ExternalVerticalLiveFeed
          currentUserId={user?.id}
          coins={coins}
          onCoinsChanged={value => setCoins(Number(value || 0))}
          onOpenWallet={() => setWalletOpen(true)}
        />
      ) : (
        <ShortFeed currentUserId={user?.id} />
      )}

      <div className="droxionVerticalBrand" aria-hidden="true">DROXION</div>

      <nav className="droxionFeedNav" aria-label="Droxion feeds">
        <button
          type="button"
          className={feedMode === 'live' ? 'active' : ''}
          onClick={() => setFeedMode('live')}
          aria-pressed={feedMode === 'live'}
        >
          <span className="droxionFeedNavDot" />
          <strong>LIVE</strong>
        </button>
        <button
          type="button"
          className={feedMode === 'reels' ? 'active' : ''}
          onClick={() => setFeedMode('reels')}
          aria-pressed={feedMode === 'reels'}
        >
          <span className="droxionFeedNavReel">▶</span>
          <strong>REELS</strong>
        </button>
      </nav>

      {walletOpen && (
        <DroxionWallet
          coins={coins}
          onClose={() => setWalletOpen(false)}
          onBalanceRefresh={knownBalance => refreshWallet(user, knownBalance)}
        />
      )}
    </main>
  );
}
