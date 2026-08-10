import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Compass, Radio, MessageCircle, User, Video, BadgeCheck } from 'lucide-react';
import { supabase } from './supabaseClient';
import DroxionProfile from './DroxionProfile';
import './real-home.css';

const FILTERS = [
  { id: 'both', label: 'Both' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' }
];

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
  if (filter === 'both') return true;
  if (filter === 'male') return profileGender === 'man' || profileGender === 'male';
  if (filter === 'female') return profileGender === 'woman' || profileGender === 'female';
  return true;
}

function BottomNav({ tab, onTab }) {
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
          <span className="navIcon"><Icon size={key === 'random' ? 25 : 21} /></span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function RealProfileCard({ profile }) {
  const age = ageFromDob(profile.date_of_birth);
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
      </div>
    </article>
  );
}

function DiscoverReal({ currentUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [filter, setFilter] = useState('both');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('droxion_profiles')
        .select('user_id, display_name, bio, date_of_birth, country, language, gender, interests, avatar_url, discovery_enabled, show_country, allow_video_calls')
        .eq('discovery_enabled', true)
        .limit(100);

      if (!alive) return;
      if (queryError) {
        setError(queryError.message || 'Could not load profiles.');
        setProfiles([]);
      } else {
        setProfiles((data || []).filter(p => p.user_id !== currentUserId));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [currentUserId]);

  const visible = useMemo(() => profiles.filter(p => genderMatches(p.gender, filter)), [profiles, filter]);

  return (
    <section className="realPage">
      <div className="realHeading"><h1>Discover</h1><p>Real Droxion members who chose to be discoverable.</p></div>
      <div className="discoverFilters">
        {FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      {loading && <div className="realEmpty">Loading real profiles…</div>}
      {error && <div className="realEmpty">{error}</div>}
      {!loading && !error && visible.length === 0 && <div className="realEmpty">No real profiles match this filter yet.</div>}
      <div className="realProfileGrid">{visible.map(profile => <RealProfileCard key={profile.user_id} profile={profile} />)}</div>
    </section>
  );
}

function LiveReal({ currentUserId }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('droxion_profiles')
        .select('user_id, display_name, bio, date_of_birth, country, language, gender, interests, avatar_url, discovery_enabled, show_country, allow_video_calls')
        .eq('discovery_enabled', true)
        .eq('allow_video_calls', true)
        .limit(50);
      if (!alive) return;
      setProfiles((data || []).filter(p => p.user_id !== currentUserId));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [currentUserId]);

  return (
    <section className="realPage">
      <div className="realHeading"><h1>Live</h1><p>Real members who allow video calls.</p></div>
      <div className="realNotice">We only label somebody “online” when real presence data confirms it. No fake online profiles.</div>
      {loading ? <div className="realEmpty">Loading…</div> : profiles.length === 0 ? <div className="realEmpty">No available members yet.</div> : <div className="realProfileGrid">{profiles.map(profile => <RealProfileCard key={profile.user_id} profile={profile} />)}</div>}
    </section>
  );
}

function ChatReal() {
  return <section className="realPage"><div className="realHeading"><h1>Chat</h1><p>Your real Droxion conversations will appear here.</p></div><div className="realEmpty">No fake conversations are shown.</div></section>;
}

export default function DroxionHomeReal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('discover');
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(authUser || null);
      if (authUser) {
        const { data: wallet } = await supabase.from('droxion_wallets').select('coin_balance').eq('user_id', authUser.id).maybeSingle();
        if (alive) setCoins(Number(wallet?.coin_balance || 0));
      }
    })();
    return () => { alive = false; };
  }, []);

  function changeTab(next) {
    if (next === 'random') {
      navigate('/random');
      return;
    }
    setTab(next);
  }

  let content;
  if (tab === 'live') content = <LiveReal currentUserId={user?.id} />;
  else if (tab === 'discover') content = <DiscoverReal currentUserId={user?.id} />;
  else if (tab === 'chat') content = <ChatReal />;
  else content = <DroxionProfile coins={coins} freeMatches={0} plan="free" />;

  return (
    <main className="realAppShell">
      <header className="realTopbar">
        <div className="realBrand"><span>D</span><strong>DROXION</strong></div>
        <div className="realCoins"><Coins size={18} /> {coins}</div>
      </header>
      <div className="realContent">{content}</div>
      <BottomNav tab={tab} onTab={changeTab} />
    </main>
  );
}
