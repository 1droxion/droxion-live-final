import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Compass, Radio, MessageCircle, User, Video, BadgeCheck, UserPlus, UserCheck, Send } from 'lucide-react';
import { supabase } from './supabaseClient';
import DroxionProfile from './DroxionProfile';
import DroxionWallet from './DroxionWallet';
import LiveExperience from './LiveExperience';
import './real-home.css';

const FILTERS = [
  { id: 'both', label: 'Both' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' }
];

function storedTab() {
  try {
    const value = window.localStorage.getItem('droxion-active-tab');
    return ['live', 'discover', 'chat', 'profile'].includes(value) ? value : 'discover';
  } catch {
    return 'discover';
  }
}

function storedChatPartner() {
  try {
    const raw = window.localStorage.getItem('droxion-chat-partner');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user_id ? parsed : null;
  } catch {
    return null;
  }
}

function ageFromDob(value) {
  if (!value) return null;
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function genderMatches(profileGender, filter) {
  const value = String(profileGender || '').trim().toLowerCase();
  if (filter === 'both') return true;
  if (filter === 'male') return value === 'man' || value === 'male';
  if (filter === 'female') return value === 'woman' || value === 'female';
  return false;
}

function BottomNav({ tab, onTab, unreadCount = 0 }) {
  const items = [
    ['live', 'Live', Radio],
    ['discover', 'Discover', Compass],
    ['random', 'Random Call', Video],
    ['chat', 'Chat', MessageCircle],
    ['profile', 'Profile', User]
  ];

  return (
    <nav className="realBottomNav">
      {items.map(([key, label, Icon]) => (
        <button
          key={key}
          className={tab === key ? `realNavItem active ${key === 'random' ? 'randomCenter' : ''}` : `realNavItem ${key === 'random' ? 'randomCenter' : ''}`}
          onClick={() => onTab(key)}
        >
          <span className="navIcon" style={{ position: 'relative' }}>
            <Icon size={key === 'random' ? 25 : 21} />
            {key === 'chat' && unreadCount > 0 && (
              <b style={{ position: 'absolute', top: -8, right: -10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'grid', placeItems: 'center', background: '#ef4444', color: '#fff', fontSize: 10, lineHeight: 1 }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </b>
            )}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function RealProfileCard({ profile, following, onToggleFollow, onChat, busy }) {
  const age = Number.isFinite(Number(profile.age)) ? Number(profile.age) : ageFromDob(profile.date_of_birth);
  const interests = Array.isArray(profile.interests) ? profile.interests.slice(0, 4) : [];

  return (
    <article className="realProfileCard">
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.display_name || 'Droxion user'} />
      ) : (
        <div className="realAvatarFallback">{(profile.display_name || 'D')[0]?.toUpperCase()}</div>
      )}
      <div className="realProfileBody">
        <h2>{profile.display_name || 'Droxion user'}{age ? `, ${age}` : ''} <BadgeCheck size={18} /></h2>
        <p>{profile.show_country === false ? '' : profile.country || ''}{profile.language ? `${profile.show_country === false || !profile.country ? '' : ' · '}${profile.language}` : ''}</p>
        {interests.length > 0 && <div className="realChips">{interests.map(x => <span key={x}>{x}</span>)}</div>}
        {profile.bio && <p className="realBio">{profile.bio}</p>}
        <div className="realProfileActions">
          <button disabled={busy} onClick={() => onToggleFollow(profile.user_id)}>
            {following ? <UserCheck size={18} /> : <UserPlus size={18} />}
            {following ? 'Following' : 'Follow'}
          </button>
          <button disabled={profile.allow_messages === false} onClick={() => onChat(profile)}>
            <MessageCircle size={18} />
            {profile.allow_messages === false ? 'Chat Off' : 'Chat'}
          </button>
        </div>
      </div>
    </article>
  );
}

async function loadAllDiscoverableProfiles() {
  const rows = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.rpc('droxion_discover_profiles', {
      p_limit: pageSize,
      p_offset: offset
    });

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

function DiscoverReal({ currentUserId, onChat }) {
  const [profiles, setProfiles] = useState([]);
  const [filter, setFilter] = useState('both');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(new Set());
  const [busyFollow, setBusyFollow] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await loadAllDiscoverableProfiles();
        if (!alive) return;
        setProfiles(data.filter(p => p.user_id !== currentUserId));

        if (currentUserId) {
          const { data: follows, error: followError } = await supabase
            .from('droxion_follows')
            .select('followed_id')
            .eq('follower_id', currentUserId);
          if (!followError && alive) setFollowing(new Set((follows || []).map(x => x.followed_id)));
        }
      } catch (err) {
        if (alive) {
          setError(err?.message || 'Could not load profiles.');
          setProfiles([]);
        }
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [currentUserId]);

  async function toggleFollow(profileId) {
    if (!currentUserId) {
      setNotice('Log in to follow people.');
      return;
    }
    setBusyFollow(profileId);
    setNotice('');

    if (following.has(profileId)) {
      const { error: deleteError } = await supabase
        .from('droxion_follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', profileId);
      if (deleteError) setNotice(deleteError.message);
      else setFollowing(previous => {
        const next = new Set(previous);
        next.delete(profileId);
        return next;
      });
    } else {
      const { error: insertError } = await supabase
        .from('droxion_follows')
        .insert({ follower_id: currentUserId, followed_id: profileId });
      if (insertError) setNotice(insertError.message);
      else setFollowing(previous => new Set([...previous, profileId]));
    }

    setBusyFollow('');
  }

  const visible = useMemo(() => profiles.filter(p => genderMatches(p.gender, filter)), [profiles, filter]);

  return (
    <section className="realPage">
      <div className="realHeading"><h1>Discover</h1><p>Real Droxion members who chose to be discoverable.</p></div>
      <div className="discoverFilters">
        {FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      {notice && <div className="realNotice">{notice}</div>}
      {loading && <div className="realEmpty">Loading real profiles…</div>}
      {error && <div className="realEmpty">{error}</div>}
      {!loading && !error && visible.length === 0 && <div className="realEmpty">No {filter === 'male' ? 'male' : filter === 'female' ? 'female' : 'real'} profiles match this filter yet.</div>}
      <div className="realProfileGrid">
        {visible.map(profile => (
          <RealProfileCard
            key={profile.user_id}
            profile={profile}
            following={following.has(profile.user_id)}
            busy={busyFollow === profile.user_id}
            onToggleFollow={toggleFollow}
            onChat={onChat}
          />
        ))}
      </div>
    </section>
  );
}

function ChatInbox({ currentUserId, onOpenConversation, onOpenDiscover, onUnreadChanged }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;

    async function refresh() {
      const { data, error: inboxError } = await supabase.rpc('droxion_chat_conversations');
      if (!alive) return;
      if (inboxError) {
        setError(inboxError.message || 'Could not load chats.');
      } else {
        setError('');
        const rows = data || [];
        setConversations(rows);
        onUnreadChanged?.(rows.reduce((sum, row) => sum + Number(row.unread_count || 0), 0));
      }
      setLoading(false);
    }

    refresh();
    const timer = setInterval(refresh, 2500);
    const channel = supabase
      .channel(`droxion-inbox-${currentUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'droxion_direct_messages',
        filter: `recipient_id=eq.${currentUserId}`
      }, refresh)
      .subscribe();

    return () => {
      alive = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, onUnreadChanged]);

  return (
    <section className="realPage chatInboxPage">
      <div className="realHeading"><h1>Chat</h1><p>Your Droxion conversations.</p></div>
      {loading && <div className="realEmpty">Loading chats…</div>}
      {error && <div className="realNotice">{error}</div>}
      {!loading && !error && conversations.length === 0 && (
        <>
          <div className="realEmpty">No conversations yet. Start from Discover.</div>
          <button className="realPrimaryButton" onClick={onOpenDiscover}>Open Discover</button>
        </>
      )}
      <div className="chatHistoryList">
        {conversations.map(item => {
          const partner = {
            user_id: item.partner_id,
            display_name: item.display_name,
            avatar_url: item.avatar_url,
            country: item.country,
            allow_messages: item.allow_messages
          };
          return (
            <button className="chatHistoryItem" key={item.partner_id} onClick={() => onOpenConversation(partner)}>
              {item.avatar_url ? (
                <img className="chatHistoryAvatar" src={item.avatar_url} alt={item.display_name || 'Droxion user'} />
              ) : (
                <div className="chatHistoryAvatar chatHistoryFallback">{(item.display_name || 'D')[0]?.toUpperCase()}</div>
              )}
              <div className="chatHistoryText">
                <div className="chatHistoryTop">
                  <strong>{item.display_name || 'Droxion user'}</strong>
                  <span>{item.latest_at ? new Date(item.latest_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div className="chatHistoryBottom">
                  <span>{item.latest_sender_id === currentUserId ? 'You: ' : ''}{item.latest_body || ''}</span>
                  {Number(item.unread_count || 0) > 0 && <b>{Number(item.unread_count)}</b>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ChatReal({ currentUserId, partner, onBackToInbox, onOpenWallet, onWalletChanged, onUnreadChanged }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [freeMessages, setFreeMessages] = useState(2);
  const [chatCoins, setChatCoins] = useState(0);

  useEffect(() => {
    if (!currentUserId) return;
    let alive = true;

    async function loadChatStatus() {
      const { data, error: statusError } = await supabase.rpc('droxion_chat_status');
      if (!alive || statusError || !data) return;
      setFreeMessages(Number(data.free_messages_remaining || 0));
      setChatCoins(Number(data.coin_balance || 0));
    }

    loadChatStatus();
    return () => { alive = false; };
  }, [currentUserId, partner?.user_id]);

  useEffect(() => {
    if (!currentUserId || !partner?.user_id) return;
    let alive = true;

    async function refresh() {
      const { data, error: queryError } = await supabase.rpc('droxion_get_direct_conversation', {
        p_partner_id: partner.user_id,
        p_limit: 200
      });
      if (!alive) return;
      if (queryError) {
        setError(queryError.message || 'Could not load messages.');
      } else {
        setError('');
        setMessages(data || []);
        await supabase.rpc('droxion_mark_conversation_read', { p_partner_id: partner.user_id });
        onUnreadChanged?.();
      }
    }

    refresh();
    const timer = setInterval(refresh, 2500);
    const channel = supabase
      .channel(`droxion-thread-${currentUserId}-${partner.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'droxion_direct_messages',
        filter: `recipient_id=eq.${currentUserId}`
      }, payload => {
        if (payload.new?.sender_id === partner.user_id) refresh();
      })
      .subscribe();

    return () => {
      alive = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, partner?.user_id, onUnreadChanged]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !currentUserId || !partner?.user_id || sending) return;

    setSending(true);
    setError('');

    const { data, error: sendError } = await supabase.rpc('droxion_send_direct_message', {
      p_recipient_id: partner.user_id,
      p_body: body
    });

    if (sendError) {
      setError(sendError.message || 'Could not send message.');
      setSending(false);
      return;
    }

    if (!data?.allowed) {
      const balance = Number(data?.coin_balance || 0);
      setChatCoins(balance);
      setFreeMessages(Number(data?.free_messages_remaining || 0));
      setError('You used your 2 free messages and have no coins. Add coins to continue chatting — each message costs 1 coin.');
      if (balance <= 0) onOpenWallet?.();
      setSending(false);
      return;
    }

    const sentMessage = data.message;
    if (sentMessage?.id) {
      setMessages(previous => previous.some(item => item.id === sentMessage.id) ? previous : [...previous, sentMessage]);
    }

    const remaining = Number(data.free_messages_remaining || 0);
    const balance = Number(data.coin_balance || 0);
    const charged = Number(data.charged_coins || 0);

    setDraft('');
    setFreeMessages(remaining);
    setChatCoins(balance);
    onWalletChanged?.(balance);

    if (remaining === 0 && charged === 0) {
      setError(balance > 0
        ? `Your 2 free messages are used. You have ${balance} coins, so future messages cost 1 coin each.`
        : 'Your 2 free messages are used. Future messages cost 1 coin each.');
    } else {
      setError('');
    }

    setSending(false);
  }

  return (
    <section className="realPage chatPage">
      <div className="chatHeader">
        <button onClick={onBackToInbox}>←</button>
        {partner.avatar_url ? (
          <img className="chatHeaderAvatar" src={partner.avatar_url} alt={partner.display_name || 'Droxion user'} />
        ) : (
          <div className="chatHeaderAvatar chatHistoryFallback">{(partner.display_name || 'D')[0]?.toUpperCase()}</div>
        )}
        <div>
          <strong>{partner.display_name || 'Droxion user'}</strong>
          <span>{partner.country || 'Worldwide'}</span>
        </div>
      </div>

      <div className="realNotice">
        {freeMessages > 0
          ? `${freeMessages} free message${freeMessages === 1 ? '' : 's'} left`
          : `1 coin per message · ${chatCoins} coins available`}
      </div>

      {error && <div className="realNotice">{error}</div>}

      <div className="chatMessages">
        {messages.length === 0 && !error && <div className="realEmpty">No messages yet. Say hello.</div>}
        {messages.map(message => (
          <div key={message.id} className={message.sender_id === currentUserId ? 'chatBubble mine' : 'chatBubble'}>
            {message.body}
          </div>
        ))}
      </div>

      <div className="chatComposer">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) sendMessage(); }}
          maxLength={1000}
          placeholder={freeMessages > 0 ? 'Message…' : 'Message · 1 coin'}
        />
        <button disabled={sending || !draft.trim()} onClick={sendMessage}><Send size={19} /></button>
      </div>
    </section>
  );
}

export default function DroxionHomeReal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(storedTab);
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [freeMatches, setFreeMatches] = useState(0);
  const [plan, setPlan] = useState('free');
  const [walletOpen, setWalletOpen] = useState(false);
  const [chatPartner, setChatPartner] = useState(storedChatPartner);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadWallet(authUser = user) {
    if (!authUser?.id) return;
    const { data: wallet } = await supabase
      .from('droxion_wallets')
      .select('coin_balance,free_matches_remaining,plan')
      .eq('user_id', authUser.id)
      .maybeSingle();
    setCoins(Number(wallet?.coin_balance || 0));
    setFreeMatches(Number(wallet?.free_matches_remaining || 0));
    setPlan(wallet?.plan || 'free');
  }

  async function loadUnreadCount() {
    if (!user?.id) return;
    const { data, error } = await supabase.rpc('droxion_chat_conversations');
    if (error) return;
    setUnreadCount((data || []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(authUser || null);
      if (authUser) await loadWallet(authUser);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;

    async function refreshUnread() {
      const { data, error } = await supabase.rpc('droxion_chat_conversations');
      if (!alive || error) return;
      setUnreadCount((data || []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0));
    }

    refreshUnread();
    const timer = setInterval(refreshUnread, 3000);
    const channel = supabase
      .channel(`droxion-global-chat-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'droxion_direct_messages',
        filter: `recipient_id=eq.${user.id}`
      }, refreshUnread)
      .subscribe();

    return () => {
      alive = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem('droxion-active-tab', tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    try {
      if (chatPartner?.user_id) window.localStorage.setItem('droxion-chat-partner', JSON.stringify(chatPartner));
      else window.localStorage.removeItem('droxion-chat-partner');
    } catch {}
  }, [chatPartner]);

  function openChat(profile) {
    if (!user) {
      navigate('/login');
      return;
    }
    setChatPartner(profile);
    setTab('chat');
  }

  function openChatInbox() {
    setChatPartner(null);
    setTab('chat');
    loadUnreadCount();
  }

  function changeTab(next) {
    if (next === 'random') {
      navigate('/random');
      return;
    }
    if (next === 'chat') {
      setTab('chat');
      return;
    }
    setTab(next);
  }

  let content;
  if (tab === 'live') content = (
    <LiveExperience
      currentUserId={user?.id}
      coins={coins}
      onCoinsChanged={balance => setCoins(Number(balance || 0))}
      onOpenWallet={() => setWalletOpen(true)}
    />
  );
  else if (tab === 'discover') content = <DiscoverReal currentUserId={user?.id} onChat={openChat} />;
  else if (tab === 'chat' && chatPartner) content = (
    <ChatReal
      currentUserId={user?.id}
      partner={chatPartner}
      onBackToInbox={openChatInbox}
      onOpenWallet={() => setWalletOpen(true)}
      onWalletChanged={balance => setCoins(Number(balance || 0))}
      onUnreadChanged={loadUnreadCount}
    />
  );
  else if (tab === 'chat') content = (
    <ChatInbox
      currentUserId={user?.id}
      onOpenConversation={openChat}
      onOpenDiscover={() => setTab('discover')}
      onUnreadChanged={setUnreadCount}
    />
  );
  else content = <DroxionProfile onOpenWallet={() => setWalletOpen(true)} coins={coins} freeMatches={freeMatches} plan={plan} />;

  return (
    <main className="realAppShell">
      <header className="realTopbar">
        <div className="realBrand"><span>D</span><strong>DROXION</strong></div>
        <button className="realCoins" onClick={() => setWalletOpen(true)} aria-label="Open Droxion wallet and plans"><Coins size={18} /> {coins}</button>
      </header>
      <div className="realContent">{content}</div>
      <BottomNav tab={tab} onTab={changeTab} unreadCount={unreadCount} />
      {walletOpen && (
        <DroxionWallet
          coins={coins}
          freeMatches={freeMatches}
          plan={plan}
          onClose={() => setWalletOpen(false)}
          onBalanceRefresh={() => loadWallet()}
        />
      )}
    </main>
  );
}
