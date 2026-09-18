import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { invalidateLiveFeedCache, supabase } from './supabaseClient';
import LiveClientDiagnostics from './LiveClientDiagnostics';
import DroxionWallet from './DroxionWallet';
import ProductionLiveHost from './features/live/components/ProductionLiveHost';
import ProductionLiveBrowser from './features/live/components/ProductionLiveBrowser';
import './live-first-app.css';

function ageFromDateOfBirth(value) {
  if (!value) return 0;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function LiveFirstApp() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [hostStudioOpen, setHostStudioOpen] = useState(false);
  const [creatorNotice, setCreatorNotice] = useState('');

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

  async function openCreatorStudio() {
    setCreatorNotice('');

    if (!user?.id) {
      window.location.assign('/login');
      return;
    }

    try {
      const [profileResult, creatorResult] = await Promise.all([
        supabase
          .from('droxion_profiles')
          .select('gender,date_of_birth')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('droxion_creator_accounts')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      if (creatorResult.error) throw creatorResult.error;

      const isAdultWoman =
        String(profileResult.data?.gender || '').toLowerCase() === 'woman' &&
        ageFromDateOfBirth(profileResult.data?.date_of_birth) >= 18;

      if (!isAdultWoman) {
        setCreatorNotice('Only adult women (18+) can become LIVE creators on Droxion.');
        window.setTimeout(() => setCreatorNotice(''), 3200);
        return;
      }

      if (String(creatorResult.data?.status || '').toLowerCase() !== 'approved') {
        setCreatorNotice('Creator verification is required before you can go LIVE.');
        window.setTimeout(() => setCreatorNotice(''), 3200);
        return;
      }

      setHostStudioOpen(true);
    } catch {
      setCreatorNotice('Could not verify creator eligibility. Please try again.');
      window.setTimeout(() => setCreatorNotice(''), 3200);
    }
  }

  return (
    <main className="droxionVerticalShell">
      <LiveClientDiagnostics />

      <ProductionLiveBrowser
        currentUserId={user?.id}
        coins={coins}
        onCoinsChanged={value => setCoins(Number(value || 0))}
        onOpenWallet={() => setWalletOpen(true)}
      />

      <div className="droxionVerticalBrand" aria-hidden="true">DROXION</div>
      <button className="droxionCreatorLiveButton" type="button" onClick={openCreatorStudio}>
        <Camera size={18} />
        <span>Go LIVE</span>
      </button>

      {creatorNotice && <div className="droxionCreatorNotice">{creatorNotice}</div>}

      {hostStudioOpen && (
        <ProductionLiveHost
          creatorId={user?.id}
          onClose={() => {
            setHostStudioOpen(false);
            invalidateLiveFeedCache();
          }}
        />
      )}

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
