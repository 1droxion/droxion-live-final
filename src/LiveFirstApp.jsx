import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import LiveClientDiagnostics from './LiveClientDiagnostics';
import DroxionWallet from './DroxionWallet';
import ExternalVerticalLiveFeed from './ExternalVerticalLiveFeed';
import './live-first-app.css';

export default function LiveFirstApp() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);

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

    supabase.auth.getUser().then(({ data }) => applySession(data?.user || null));

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <main className="droxionVerticalShell">
      <LiveClientDiagnostics />

      <ExternalVerticalLiveFeed
        currentUserId={user?.id}
        coins={coins}
        onCoinsChanged={value => setCoins(Number(value || 0))}
        onOpenWallet={() => setWalletOpen(true)}
      />

      <div className="droxionVerticalBrand" aria-hidden="true">DROXION</div>

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
