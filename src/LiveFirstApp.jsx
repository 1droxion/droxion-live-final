import { useEffect, useState } from 'react';
import { Clapperboard, MessageCircle, Radio, UserRound } from 'lucide-react';
import { supabase } from './supabaseClient';
import LiveClientDiagnostics from './LiveClientDiagnostics';
import DroxionWallet from './DroxionWallet';
import ExternalVerticalLiveFeed from './ExternalVerticalLiveFeed';
import ShortFeed from './ShortFeed';
import LiveProfile from './LiveProfile';
import DroxionChat from './DroxionChat';
import './live-first-app.css';

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', Icon: UserRound },
  { id: 'reels', label: 'Reels', Icon: Clapperboard },
  { id: 'live', label: 'LIVE', Icon: Radio },
  { id: 'inbox', label: 'Inbox', Icon: MessageCircle }
];

export default function LiveFirstApp() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [feedMode, setFeedMode] = useState('live');
  const [inboxUnread, setInboxUnread] = useState(0);

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

  async function refreshInboxUnread(authUser = user) {
    if (!authUser?.id) {
      setInboxUnread(0);
      return;
    }

    const [messagesResult, notificationsResult] = await Promise.all([
      supabase
        .from('droxion_direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', authUser.id)
        .is('read_at', null),
      supabase.rpc('droxion_my_notifications', { p_limit: 100 })
    ]);

    const unreadMessages = Number(messagesResult.count || 0);
    const unreadActivity = (notificationsResult.data || []).filter(item => !item.read_at).length;
    setInboxUnread(unreadMessages + unreadActivity);
  }

  useEffect(() => {
    let mounted = true;

    const applySession = authUser => {
      if (!mounted) return;
      setUser(authUser || null);

      if (!authUser?.id) {
        setCoins(0);
        setInboxUnread(0);
        return;
      }

      window.setTimeout(() => {
        if (!mounted) return;
        refreshWallet(authUser).catch(() => {});
        refreshInboxUnread(authUser).catch(() => {});
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

  useEffect(() => {
    if (!user?.id) return undefined;
    const timer = window.setInterval(() => {
      refreshInboxUnread(user).catch(() => {});
    }, 12000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    if (feedMode === 'inbox') {
      window.setTimeout(() => refreshInboxUnread(user).catch(() => {}), 250);
    }
  }, [feedMode, user?.id]);

  return (
    <main className={`droxionVerticalShell droxionMode-${feedMode}`}>
      <LiveClientDiagnostics />

      <section className="droxionTabStage">
        {feedMode === 'live' && (
          <ExternalVerticalLiveFeed
            currentUserId={user?.id}
            coins={coins}
            onCoinsChanged={value => setCoins(Number(value || 0))}
            onOpenWallet={() => setWalletOpen(true)}
          />
        )}

        {feedMode === 'reels' && <ShortFeed currentUserId={user?.id} />}

        {feedMode === 'profile' && (
          <LiveProfile
            coins={coins}
            onOpenWallet={() => setWalletOpen(true)}
          />
        )}

        {feedMode === 'inbox' && <DroxionChat />}
      </section>

      {feedMode === 'live' && <div className="droxionVerticalBrand" aria-hidden="true">DROXION</div>}

      <nav className="droxionFeedNav" aria-label="Droxion navigation">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            type="button"
            key={id}
            className={`${feedMode === id ? 'active' : ''} ${id === 'live' ? 'liveTab' : ''}`}
            onClick={() => setFeedMode(id)}
            aria-pressed={feedMode === id}
          >
            <span className="droxionNavIcon">
              <Icon size={id === 'live' ? 22 : 20} strokeWidth={feedMode === id ? 2.5 : 2} />
              {id === 'inbox' && inboxUnread > 0 && (
                <b className="droxionInboxBadge">{inboxUnread > 99 ? '99+' : inboxUnread}</b>
              )}
            </span>
            <strong>{label}</strong>
          </button>
        ))}
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
