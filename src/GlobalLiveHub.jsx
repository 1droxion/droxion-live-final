import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Compass, Filter, Flame, Globe2, Heart, MessageCircle, Radio, RefreshCw, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { rankLiveStreams, recordLiveBehavior } from './recommendationEngine';
import { supabase } from './supabaseClient';
import ExternalLiveDroxionChat from './ExternalLiveDroxionChat';
import './global-live-hub.css';
import './explore-following.css';
import './watch-related.css';

const EXTERNAL_PROVIDERS = [
  { id: 'all', label: 'All LIVE' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' }
];

const CATEGORIES = ['All', 'Gaming', 'IRL', 'Music', 'Sports', 'Talk'];
const EXPLORE_TOPICS = [
  { id: 'gaming', label: 'Gaming', tone: 'violet' },
  { id: 'sports', label: 'Sports', tone: 'cyan' },
  { id: 'irl', label: 'IRL', tone: 'blue' },
  { id: 'music', label: 'Music', tone: 'pink' },
  { id: 'just-chatting', label: 'Just Chatting', tone: 'indigo' },
  { id: 'entertainment', label: 'Entertainment', tone: 'orange' },
  { id: 'news', label: 'News', tone: 'red' },
  { id: 'education', label: 'Education', tone: 'green' },
  { id: 'gta', label: 'GTA', tone: 'amber' },
  { id: 'minecraft', label: 'Minecraft', tone: 'emerald' },
  { id: 'valorant', label: 'Valorant', tone: 'rose' },
  { id: 'fortnite', label: 'Fortnite', tone: 'purple' }
];
const REFRESH_MS = 120000;
const LIVE_DISCOVERY_LIMIT = 120;
const RECENT_LIVE_KEY = 'droxion.live.recent.v1';

function formatViewers(value) {
  const count = Number(value || 0);
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  return String(Math.max(0, count));
}

function providerClass(provider) {
  if (provider === 'youtube') return 'youtube';
  if (provider === 'twitch') return 'twitch';
  if (provider === 'kick') return 'kick';
  return 'droxion';
}

function creatorKey(stream) {
  const provider = String(stream?.provider || '').toLowerCase();
  const identity = String(stream?.channelId || stream?.channelSlug || stream?.creatorName || '').trim().toLowerCase();
  return `${provider}:${identity}`.slice(0, 220);
}

function streamSearchText(stream) {
  return `${stream?.creatorName || ''} ${stream?.title || ''} ${stream?.category || ''} ${stream?.providerLabel || ''} ${stream?.language || ''}`.toLowerCase();
}

function matchesExploreTopic(stream, topicId) {
  if (!topicId || topicId === 'all') return true;
  const haystack = streamSearchText(stream);
  const category = String(stream?.category || '').toLowerCase();
  if (topicId === 'gaming') return category === 'gaming' || /game|gaming|esport|gta|minecraft|valorant|fortnite|league|counter strike|call of duty/.test(haystack);
  if (topicId === 'sports') return category === 'sports' || /sport|football|soccer|basketball|baseball|cricket|mma|boxing|racing|formula 1|f1\b/.test(haystack);
  if (topicId === 'irl') return category === 'irl' || /\birl\b|travel|outdoor|people|blog|lifestyle|walking|city/.test(haystack);
  if (topicId === 'music') return category === 'music' || /music|concert|dj\b|song|singing|radio/.test(haystack);
  if (topicId === 'just-chatting') return category === 'talk' || /just chatting|chatting|podcast|talk show|interview|q&a/.test(haystack);
  if (topicId === 'entertainment') return /entertainment|comedy|movie|film|reaction|show|celebrity|variety/.test(haystack);
  if (topicId === 'news') return /\bnews\b|breaking|politics|election|weather|world live|current events/.test(haystack);
  if (topicId === 'education') return /education|learn|study|science|coding|programming|lecture|tutorial|technology/.test(haystack);
  if (topicId === 'gta') return /grand theft auto|\bgta\b/.test(haystack);
  if (topicId === 'minecraft') return /minecraft/.test(haystack);
  if (topicId === 'valorant') return /valorant/.test(haystack);
  if (topicId === 'fortnite') return /fortnite/.test(haystack);
  return false;
}

function readRecentIds() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_LIVE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function providerEmptyMessage(provider, providers, availableProviderCount) {
  if (provider !== 'all' && provider !== 'droxion') {
    const state = providers?.[provider] || {};
    const label = provider === 'youtube' ? 'YouTube' : provider === 'twitch' ? 'Twitch' : 'Kick';
    if (state.reason === 'missing_credentials') return `${label} is not connected to Droxion yet.`;
    if (state.reason === 'provider_error') return `${label} is temporarily unavailable. Other LIVE sources still work.`;
    if (state.reason === 'empty_result') return `${label} returned no embeddable LIVE streams in this refresh. Try again shortly.`;
    return `No matching ${label} LIVE streams right now.`;
  }
  return availableProviderCount === 0 ? 'LIVE discovery is temporarily unavailable.' : 'No matching LIVE streams right now.';
}

function relatedLiveStreams(stream, streams) {
  if (!stream) return [];
  const category = String(stream.category || '').toLowerCase();
  const language = String(stream.language || '').toLowerCase();
  return [...(streams || [])]
    .filter(item => item?.id && item.id !== stream.id)
    .map(item => {
      let score = Math.log10(Math.max(1, Number(item.viewerCount || 0))) * 2;
      if (category && String(item.category || '').toLowerCase() === category) score += 16;
      if (item.provider === stream.provider) score += 5;
      if (language && String(item.language || '').toLowerCase() === language) score += 3;
      if (creatorKey(item) === creatorKey(stream)) score -= 50;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(entry => entry.item);
}

function StreamCard({ stream, isFollowing, onOpen, onToggleFollow }) {
  return <article className="dxGlobalCard" onClick={() => onOpen(stream)} data-provider={stream.provider} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onOpen(stream); }}>
    <div className="dxGlobalThumb">{stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" loading="lazy" /> : <div className="dxGlobalThumbFallback"><Radio size={28} /></div>}<span className="dxGlobalLivePill">LIVE</span><span className={`dxProviderBadge ${providerClass(stream.provider)}`}>{stream.providerLabel}</span><span className="dxGlobalViewers"><Users size={13} /> {formatViewers(stream.viewerCount)}</span></div>
    <div className="dxGlobalCardBody"><div className="dxCardCreator"><span className={`dxCreatorDot ${providerClass(stream.provider)}`} /><strong>{stream.creatorName}</strong><button type="button" className={`dxQuickFollow ${isFollowing ? 'following' : ''}`} onClick={event => { event.stopPropagation(); onToggleFollow(stream); }} aria-label={isFollowing ? 'Unfollow creator' : 'Follow creator'}><Heart size={14} fill={isFollowing ? 'currentColor' : 'none'} /></button></div><span className="dxCardTitle">{stream.title}</span><div className="dxCardMeta"><small>{stream.category || 'LIVE'}</small>{stream.language && <small>{String(stream.language).toUpperCase()}</small>}<b>Watch</b></div></div>
  </article>;
}

function RelatedLiveRail({ stream, streams, onSelect }) {
  const related = useMemo(() => relatedLiveStreams(stream, streams), [stream, streams]);
  if (!related.length) return null;
  return <section className="dxRelatedLive">
    <div className="dxRelatedHead"><div><span>KEEP WATCHING</span><strong>Related LIVE</strong></div><small>Picked from the current Droxion LIVE network</small></div>
    <div className="dxRelatedRail">{related.map(item => <button type="button" key={item.id} className="dxRelatedCard" onClick={() => onSelect(item)}>
      <div className="dxRelatedThumb">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : <span />}<i>LIVE</i><b><Users size={11} /> {formatViewers(item.viewerCount)}</b></div>
      <strong>{item.title || 'LIVE now'}</strong>
      <div><span className={`dxProviderMini ${providerClass(item.provider)}`}>{item.providerLabel}</span><small>{item.creatorName}</small></div>
    </button>)}</div>
  </section>;
}

function ExternalLivePlayer({ stream, streams, onSelectStream, onClose, currentUserId, coins, onCoinsChanged, onOpenWallet, isFollowing, onToggleFollow }) {
  const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  useEffect(() => {
    if (!stream) return undefined;
    recordLiveBehavior(stream, 'open');
    const watchTimer = window.setTimeout(() => recordLiveBehavior(stream, 'watch'), 30000);
    const longWatchTimer = window.setTimeout(() => recordLiveBehavior(stream, 'watchLong'), 120000);
    return () => { window.clearTimeout(watchTimer); window.clearTimeout(longWatchTimer); };
  }, [stream]);

  let src = '';
  if (stream?.embedType === 'youtube' && stream.externalId) src = `https://www.youtube.com/embed/${encodeURIComponent(stream.externalId)}?autoplay=1&playsinline=1&rel=0`;
  else if (stream?.embedType === 'twitch' && stream.channelSlug) src = `https://player.twitch.tv/?channel=${encodeURIComponent(stream.channelSlug)}&parent=${encodeURIComponent(parent)}&autoplay=true`;
  else if (stream?.embedType === 'kick' && stream.channelSlug) src = `https://player.kick.com/${encodeURIComponent(stream.channelSlug)}`;

  return <div className="dxLiveModal" role="dialog" aria-modal="true" aria-label={`${stream?.creatorName || 'Creator'} LIVE`}>
    <div className="dxLiveModalBackdrop" onClick={onClose} />
    <section className="dxLiveModalSheet dxLiveWithChat">
      <div className="dxLiveModalTop">
        <div><span className={`dxProviderBadge ${providerClass(stream?.provider)}`}>{stream?.providerLabel || 'LIVE'}</span><strong>{stream?.creatorName || 'Creator'}</strong></div>
        <button type="button" className={`dxModalFollow ${isFollowing ? 'following' : ''}`} onClick={() => onToggleFollow?.(stream)}><Heart size={14} fill={isFollowing ? 'currentColor' : 'none'} />{isFollowing ? 'Following' : 'Follow'}</button>
        <div className="dxWatchSafe"><ShieldCheck size={14} /><span>Inside Droxion</span></div>
        <button type="button" onClick={onClose} aria-label="Close LIVE"><X size={22} /></button>
      </div>
      <div className="dxExternalLiveLayout">
        <div className="dxExternalVideoColumn">
          <div className="dxLivePlayerFrame">{src ? <iframe src={src} title={`${stream?.creatorName || 'Creator'} LIVE`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /> : <div className="dxLivePlayerFallback">This LIVE is temporarily unavailable inside Droxion.</div>}</div>
          <div className="dxLiveModalMeta">
            <div className="dxWatchTitle"><Radio size={17} /><span>{stream?.title || 'LIVE now'}</span></div>
            <div className="dxWatchMetaChips"><span>{stream?.category || 'LIVE'}</span>{stream?.language && <span>{String(stream.language).toUpperCase()}</span>}<span><Users size={14} /> {formatViewers(stream?.viewerCount)} watching</span></div>
            <div className="dxLiveModalActions"><span className="dxStayOnDroxion"><ShieldCheck size={15} /> Source messages + Droxion chat + gifts in one LIVE chat</span></div>
            <div className="dxLiveAdSlot" data-droxion-ad-placement="live_below_player" aria-hidden="true" />
          </div>
          <RelatedLiveRail stream={stream} streams={streams} onSelect={onSelectStream} />
        </div>
        <aside className="dxSourceChatPanel"><header><MessageCircle size={16} /><strong>Droxion LIVE Chat</strong><span>ONE CHAT</span></header><ExternalLiveDroxionChat stream={stream} currentUserId={currentUserId} coins={coins} onCoinsChanged={onCoinsChanged} onOpenWallet={onOpenWallet} /></aside>
      </div>
    </section>
  </div>;
}

export default function GlobalLiveHub({ query = '', nativeLive = null, currentUserId, coins = 0, onCoinsChanged, onOpenWallet, mode = 'home' }) {
  const [streams, setStreams] = useState([]);
  const [providers, setProviders] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const [provider, setProvider] = useState('all');
  const [category, setCategory] = useState('All');
  const [language, setLanguage] = useState('All');
  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreTopic, setExploreTopic] = useState('all');
  const [recentIds, setRecentIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [followingKeys, setFollowingKeys] = useState(new Set());
  const refreshTimerRef = useRef(null);
  const providerOptions = useMemo(() => nativeLive ? [...EXTERNAL_PROVIDERS, { id: 'droxion', label: 'Droxion' }] : EXTERNAL_PROVIDERS, [nativeLive]);

  const loadFollowing = useCallback(async () => {
    if (!currentUserId) { setFollowingKeys(new Set()); return; }
    const { data } = await supabase.from('droxion_external_follows').select('creator_key').eq('user_id', currentUserId).limit(1000);
    setFollowingKeys(new Set((data || []).map(row => row.creator_key)));
  }, [currentUserId]);

  const loadStreams = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch(`/api/live-hub?limit=${LIVE_DISCOVERY_LIMIT}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`LIVE discovery unavailable (${response.status})`);
      const data = await response.json();
      setStreams(Array.isArray(data?.streams) ? data.streams : []);
      setProviders(data?.providers && typeof data.providers === 'object' ? data.providers : {});
      setNotice('');
    } catch (error) { setNotice(error?.message || 'Could not refresh global LIVE discovery.'); }
    finally { setLoading(false); if (manual) setRefreshing(false); }
  }, []);

  useEffect(() => { loadFollowing(); }, [loadFollowing]);
  useEffect(() => { setRecentIds(readRecentIds()); }, []);
  useEffect(() => {
    loadStreams();
    refreshTimerRef.current = window.setInterval(() => { if (document.visibilityState !== 'hidden') loadStreams(); }, REFRESH_MS);
    return () => window.clearInterval(refreshTimerRef.current);
  }, [loadStreams]);

  const languages = useMemo(() => ['All', ...new Set(streams.map(stream => String(stream.language || '').trim().toUpperCase()).filter(Boolean))].slice(0, 9), [streams]);
  const effectiveExploreQuery = mode === 'explore' ? String(exploreQuery || query || '').trim().toLowerCase() : '';

  const exploreBaseStreams = useMemo(() => mode !== 'explore' ? [] : streams.filter(stream => {
    if (provider !== 'all' && stream.provider !== provider) return false;
    if (language !== 'All' && String(stream.language || '').toUpperCase() !== language) return false;
    if (effectiveExploreQuery && !streamSearchText(stream).includes(effectiveExploreQuery)) return false;
    return true;
  }), [streams, provider, language, mode, effectiveExploreQuery]);

  const exploreTopicCards = useMemo(() => {
    if (mode !== 'explore') return [];
    const rankedBase = rankLiveStreams(exploreBaseStreams);
    const allCard = { id: 'all', label: 'All LIVE', tone: 'all', count: rankedBase.length, viewers: rankedBase.reduce((sum, stream) => sum + Number(stream.viewerCount || 0), 0), preview: rankedBase.find(stream => stream.thumbnailUrl) || rankedBase[0] };
    const topicCards = EXPLORE_TOPICS.map(topic => {
      const matches = rankedBase.filter(stream => matchesExploreTopic(stream, topic.id));
      return { ...topic, count: matches.length, viewers: matches.reduce((sum, stream) => sum + Number(stream.viewerCount || 0), 0), preview: matches.find(stream => stream.thumbnailUrl) || matches[0] };
    }).filter(topic => topic.count > 0).sort((a, b) => (b.count - a.count) || (b.viewers - a.viewers));
    return allCard.count ? [allCard, ...topicCards].slice(0, 12) : topicCards.slice(0, 12);
  }, [exploreBaseStreams, mode]);

  const filtered = useMemo(() => {
    const q = mode === 'explore' ? effectiveExploreQuery : String(query || '').trim().toLowerCase();
    return rankLiveStreams(streams.filter(stream => {
      if (mode === 'following' && !followingKeys.has(creatorKey(stream))) return false;
      if (provider !== 'all' && stream.provider !== provider) return false;
      if (mode !== 'explore' && category !== 'All' && String(stream.category || '').toLowerCase() !== category.toLowerCase()) return false;
      if (language !== 'All' && String(stream.language || '').toUpperCase() !== language) return false;
      if (mode === 'explore' && !matchesExploreTopic(stream, exploreTopic)) return false;
      if (q && !streamSearchText(stream).includes(q)) return false;
      return true;
    }));
  }, [streams, query, provider, category, language, mode, followingKeys, effectiveExploreQuery, exploreTopic]);

  const recentStreams = useMemo(() => {
    const byId = new Map(streams.map(stream => [stream.id, stream]));
    return recentIds.map(id => byId.get(id)).filter(Boolean).slice(0, 4);
  }, [recentIds, streams]);

  const availableProviderCount = Object.values(providers).filter(value => value?.enabled && Number(value?.available || 0) > 0).length;
  const missingProviders = Object.entries(providers).filter(([, value]) => value?.reason === 'missing_credentials').map(([key]) => key);
  const totalAvailable = Object.values(providers).reduce((sum, value) => sum + Number(value?.available || 0), 0);

  async function toggleFollow(stream) {
    if (!currentUserId) { setNotice('Sign in to follow creators on Droxion.'); return; }
    const key = creatorKey(stream);
    const already = followingKeys.has(key);
    if (already) {
      const { error } = await supabase.from('droxion_external_follows').delete().eq('user_id', currentUserId).eq('creator_key', key);
      if (error) return setNotice('Could not update your followed creators.');
      setFollowingKeys(current => { const next = new Set(current); next.delete(key); return next; });
    } else {
      const { error } = await supabase.from('droxion_external_follows').insert({ user_id: currentUserId, creator_key: key, provider: stream.provider, external_creator_id: stream.channelId || stream.externalId || null, channel_slug: stream.channelSlug || null, creator_name: stream.creatorName || 'Creator', avatar_url: null });
      if (error) return setNotice('Could not follow this creator.');
      setFollowingKeys(current => new Set([...current, key])); recordLiveBehavior(stream, 'follow');
    }
  }

  function openStream(stream) {
    recordLiveBehavior(stream, 'open'); setSelected(stream);
    setRecentIds(current => {
      const next = [stream.id, ...current.filter(id => id !== stream.id)].slice(0, 12);
      try { window.localStorage.setItem(RECENT_LIVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function chooseExploreTopic(topicId) {
    setExploreTopic(topicId);
    window.requestAnimationFrame(() => document.querySelector('.dxExploreResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const player = selected ? <ExternalLivePlayer stream={selected} streams={streams} onSelectStream={openStream} onClose={() => setSelected(null)} currentUserId={currentUserId} coins={coins} onCoinsChanged={onCoinsChanged} onOpenWallet={onOpenWallet} isFollowing={followingKeys.has(creatorKey(selected))} onToggleFollow={toggleFollow} /> : null;

  if (mode === 'explore') {
    const selectedTopicLabel = exploreTopic === 'all' ? 'Recommended LIVE' : (EXPLORE_TOPICS.find(item => item.id === exploreTopic)?.label || 'LIVE');
    const visibleExploreStreams = filtered.slice(0, exploreTopic === 'all' ? 16 : 32);
    return <section className="dxGlobalLiveHub dxHubMode-explore dxExploreV2">
      <div className="dxExploreHeroV2"><div className="dxExploreHeroCopy"><span><Compass size={15} /> DROXION EXPLORE</span><h1>Find your next LIVE.</h1><p>Search creators, games and communities across YouTube, Twitch and Kick — all inside Droxion.</p></div><button type="button" className="dxExploreRefresh" onClick={() => loadStreams({ manual: true })} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Refreshing' : 'Refresh'}</button><label className="dxExploreSearchV2"><Search size={19} /><input value={exploreQuery} onChange={event => { setExploreQuery(event.target.value); setExploreTopic('all'); }} placeholder="Search creators, games, topics or platforms" />{exploreQuery && <button type="button" onClick={() => setExploreQuery('')} aria-label="Clear search"><X size={16} /></button>}</label></div>
      <div className="dxExploreFiltersV2"><div className="dxGlobalProviderRail" aria-label="LIVE sources">{providerOptions.filter(item => item.id !== 'droxion').map(item => { const external = item.id !== 'all'; const enabled = external ? providers?.[item.id]?.enabled !== false : true; const active = provider === item.id; const count = external ? Number(providers?.[item.id]?.available || 0) : totalAvailable; return <button type="button" key={item.id} className={`${active ? 'active' : ''} ${enabled ? '' : 'disabled'} ${providerClass(item.id)}`} onClick={() => { setProvider(item.id); setExploreTopic('all'); }} disabled={!enabled && external}><span>{item.label}</span>{count > 0 && <small>{count}</small>}</button>; })}</div><div className="dxExploreLanguageBar"><Filter size={13} />{languages.map(item => <button type="button" key={item} className={language === item ? 'active' : ''} onClick={() => { setLanguage(item); setExploreTopic('all'); }}>{item === 'All' ? 'Any language' : item}</button>)}</div></div>
      {notice && <div className="dxGlobalNotice">{notice}</div>}
      {!notice && !loading && missingProviders.length > 0 && <div className="dxGlobalSetupNotice"><Search size={16} /><span>{missingProviders.map(item => item[0].toUpperCase() + item.slice(1)).join(', ')} discovery will turn on automatically after its server credentials are added.</span></div>}
      <section className="dxExploreSection dxExploreTopicsSection"><header className="dxExploreSectionHeader"><div><span><Flame size={14} /> LIVE CATEGORIES</span><h2>Explore by category</h2></div><small>{exploreBaseStreams.length} streams in this view</small></header>{loading ? <div className="dxExploreTopicGrid dxExploreLoadingGrid">{Array.from({ length: 8 }, (_, index) => <div className="dxExploreTopicSkeleton" key={index} />)}</div> : exploreTopicCards.length ? <div className="dxExploreTopicGrid">{exploreTopicCards.map(topic => <button type="button" key={topic.id} className={`dxExploreTopicCard tone-${topic.tone} ${exploreTopic === topic.id ? 'active' : ''}`} onClick={() => chooseExploreTopic(topic.id)}>{topic.preview?.thumbnailUrl ? <img src={topic.preview.thumbnailUrl} alt="" loading="lazy" /> : <span className="dxExploreTopicFallback" />}<span className="dxExploreTopicShade" /><span className="dxExploreTopicLive"><i /> {topic.count} LIVE</span><strong>{topic.label}</strong><small>{formatViewers(topic.viewers)} watching</small></button>)}</div> : <div className="dxGlobalEmpty"><Radio size={25} /><strong>No LIVE categories match these filters right now.</strong><button type="button" onClick={() => { setProvider('all'); setLanguage('All'); setExploreQuery(''); setExploreTopic('all'); }}>Reset filters</button></div>}</section>
      {recentStreams.length > 0 && exploreTopic === 'all' && !effectiveExploreQuery && <section className="dxExploreSection dxExploreRecent"><header className="dxExploreSectionHeader"><div><span><Clock3 size={14} /> RECENTLY WATCHED</span><h2>Jump back in</h2></div></header><div className="dxGlobalGrid dxExploreMiniGrid">{recentStreams.map(stream => <StreamCard key={`recent:${stream.id}`} stream={stream} isFollowing={followingKeys.has(creatorKey(stream))} onOpen={openStream} onToggleFollow={toggleFollow} />)}</div></section>}
      <section className="dxExploreSection dxExploreResults"><header className="dxExploreSectionHeader"><div><span><Sparkles size={14} /> {exploreTopic === 'all' ? 'FOR YOU' : 'CATEGORY'}</span><h2>{selectedTopicLabel}</h2></div><small>{filtered.length ? `${filtered.length} showing` : 'Fresh results every refresh'}</small></header>{loading ? <div className="dxGlobalEmpty"><div className="dxLivePulse" />Loading LIVE streams…</div> : visibleExploreStreams.length ? <div className="dxGlobalGrid">{visibleExploreStreams.map(stream => <StreamCard key={stream.id} stream={stream} isFollowing={followingKeys.has(creatorKey(stream))} onOpen={openStream} onToggleFollow={toggleFollow} />)}</div> : <div className="dxGlobalEmpty"><Radio size={25} /><strong>{providerEmptyMessage(provider, providers, availableProviderCount)}</strong><button type="button" onClick={() => { setExploreTopic('all'); setProvider('all'); setLanguage('All'); setExploreQuery(''); }}>Reset Explore</button></div>}</section>
      {player}
    </section>;
  }

  const pageTitle = mode === 'following' ? 'Following' : 'Recommended for you';
  const pageKicker = mode === 'following' ? 'YOUR CREATORS' : 'LIVE NOW';
  return <section className={`dxGlobalLiveHub dxHubMode-${mode}`}>
    {mode === 'home' ? <div className="dxGlobalHero"><div className="dxHeroCopy"><span className="dxGlobalEyebrow"><Globe2 size={15} /> DROXION LIVE NETWORK</span><h1>Live everywhere.<br /><em>Picked for you.</em></h1><p>Discover YouTube, Twitch and Kick LIVE streams in one personalized home, then watch, chat and support from Droxion.</p><div className="dxHeroProof"><span><Sparkles size={14} /> Personalized</span><span><ShieldCheck size={14} /> Watch inside Droxion</span><span><Radio size={14} /> {totalAvailable || '—'} LIVE now</span></div></div><button type="button" className="dxGlobalRefresh" onClick={() => loadStreams({ manual: true })} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /><span>{refreshing ? 'Refreshing' : 'Refresh LIVE'}</span></button></div> : <div className="dxExploreHeader"><div><span><Compass size={15} /> {pageKicker}</span><h1>{pageTitle}</h1><p>Your followed creators across YouTube, Twitch and Kick, together in one place.</p></div><button type="button" onClick={() => loadStreams({ manual: true })}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh</button></div>}
    <div className="dxControlDeck"><div className="dxGlobalProviderRail" aria-label="LIVE sources">{providerOptions.map(item => { const external = item.id !== 'all' && item.id !== 'droxion'; const enabled = external ? providers?.[item.id]?.enabled !== false : true; const active = provider === item.id; const count = external ? Number(providers?.[item.id]?.available || 0) : totalAvailable; return <button type="button" key={item.id} className={`${active ? 'active' : ''} ${enabled ? '' : 'disabled'} ${providerClass(item.id)}`} onClick={() => setProvider(item.id)} disabled={!enabled && external}><span>{item.label}</span>{count > 0 && <small>{count}</small>}</button>; })}</div><div className="dxGlobalCategoryRail" aria-label="LIVE categories"><span className="dxFilterLabel"><Filter size={13} /></span>{CATEGORIES.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    {notice && <div className="dxGlobalNotice">{notice}</div>}
    {!notice && !loading && missingProviders.length > 0 && <div className="dxGlobalSetupNotice"><Search size={16} /><span>{missingProviders.map(item => item[0].toUpperCase() + item.slice(1)).join(', ')} discovery will turn on automatically after its server credentials are added.</span></div>}
    <div className="dxSectionHead"><div><span>{pageKicker}</span><strong>{mode === 'home' && provider !== 'all' ? `${providerOptions.find(item => item.id === provider)?.label || 'LIVE'} streams` : pageTitle}</strong></div><small>{filtered.length ? `${filtered.length} showing` : 'Fresh results every refresh'}</small></div>
    {mode === 'following' && !currentUserId ? <div className="dxGlobalEmpty"><Heart size={26} /><strong>Sign in to build your followed LIVE list on Droxion.</strong></div> : provider !== 'droxion' && <>{loading ? <div className="dxGlobalEmpty"><div className="dxLivePulse" />Loading LIVE streams…</div> : filtered.length ? <div className="dxGlobalGrid">{filtered.map(stream => <StreamCard key={stream.id} stream={stream} isFollowing={followingKeys.has(creatorKey(stream))} onOpen={openStream} onToggleFollow={toggleFollow} />)}</div> : <div className="dxGlobalEmpty">{mode === 'following' ? <Heart size={25} /> : <Radio size={25} />}<strong>{mode === 'following' ? 'None of your followed creators are LIVE in this refresh. Follow more creators from Home or Explore.' : providerEmptyMessage(provider, providers, availableProviderCount)}</strong><button type="button" onClick={() => loadStreams({ manual: true })}>Refresh LIVE</button></div>}</>}
    {(provider === 'all' || provider === 'droxion') && nativeLive && mode === 'home' && <div className="dxNativeLiveSection"><div className="dxNativeLiveHeading"><div><span className="dxProviderBadge droxion">Droxion</span><strong>Native Droxion LIVE</strong></div><p>Droxion creator LIVE.</p></div>{nativeLive}</div>}
    {player}
  </section>;
}
