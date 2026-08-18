import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Radio, Search, Send, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import './droxion-chat.css';

const TABS = ['messages', 'following', 'requests'];

function avatar(person) {
  return person?.avatar_url ? <img src={person.avatar_url} alt="" /> : <div className="dcAvatar">{(person?.display_name || 'D')[0]}</div>;
}

export default function DroxionChat() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('messages');
  const [following, setFollowing] = useState([]);
  const [liveIds, setLiveIds] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const current = auth?.user || null;
    setUser(current);
    if (!current) return;
    const [followingResult, liveResult, messageResult] = await Promise.all([
      supabase.rpc('droxion_following'),
      supabase.rpc('droxion_live_feed'),
      supabase.from('droxion_direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').order('created_at', { ascending: false }).limit(200)
    ]);
    setFollowing(followingResult.data || []);
    setLiveIds(new Set((liveResult.data || []).map(row => row.user_id)));
    setMessages(messageResult.data || []);
  }

  useEffect(() => { load(); const timer = setInterval(load, 7000); return () => clearInterval(timer); }, []);

  const people = useMemo(() => {
    const map = new Map(following.map(person => [person.user_id, person]));
    messages.forEach(row => {
      const other = row.sender_id === user?.id ? row.recipient_id : row.sender_id;
      if (other && !map.has(other)) map.set(other, { user_id: other, display_name: 'Droxion user' });
    });
    return [...map.values()];
  }, [following, messages, user?.id]);

  const threads = useMemo(() => {
    const latest = new Map();
    messages.forEach(row => {
      const other = row.sender_id === user?.id ? row.recipient_id : row.sender_id;
      if (!other || latest.has(other)) return;
      const person = people.find(item => item.user_id === other) || { user_id: other, display_name: 'Droxion user' };
      latest.set(other, { ...person, last: row.body, at: row.created_at, unread: row.recipient_id === user?.id && !row.read_at });
    });
    return [...latest.values()];
  }, [messages, people, user?.id]);

  const activeMessages = useMemo(() => active ? messages.filter(row => (row.sender_id === user?.id && row.recipient_id === active.user_id) || (row.recipient_id === user?.id && row.sender_id === active.user_id)).reverse() : [], [messages, active, user?.id]);

  async function send() {
    const body = draft.trim();
    if (!active?.user_id || !body) return;
    const { data, error } = await supabase.rpc('droxion_send_direct_message', { p_recipient_id: active.user_id, p_body: body });
    if (error || data?.allowed === false) return setNotice(error?.message || 'Message could not be sent.');
    setDraft(''); setNotice(''); await load();
  }

  if (!user) return <section className="dcPage dcSignedOut"><MessageCircle size={34} /><h1>Chat</h1><p>Sign in to message people you follow.</p><a href="/login">Sign in</a></section>;

  if (active) return <section className="dcPage dcThread"><header><button onClick={() => setActive(null)}>‹</button>{avatar(active)}<div><strong>{active.display_name}</strong><span>{liveIds.has(active.user_id) ? '● LIVE now' : 'Droxion'}</span></div></header><div className="dcMessages">{activeMessages.length === 0 ? <div className="dcEmpty"><MessageCircle size={26} /><strong>Start the conversation</strong><span>Keep messages respectful and safe.</span></div> : activeMessages.map(row => <div key={row.id} className={`dcBubble ${row.sender_id === user.id ? 'mine' : ''}`}><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString()}</small></div>)}</div><div className="dcComposer"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message…" maxLength={1000}/><button onClick={send}><Send size={18}/></button></div>{notice && <div className="dcNotice">{notice}</div>}</section>;

  const source = tab === 'messages' ? threads : tab === 'following' ? following : [];
  const visible = source.filter(person => !query.trim() || String(person.display_name || '').toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="dcPage"><div className="dcHero"><span>CONNECT</span><h1>Chat</h1><p>Messages, people you follow and message requests.</p></div><div className="dcTabs">{TABS.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div><label className="dcSearch"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people or conversations"/></label>{tab === 'requests' ? <div className="dcEmpty"><Users size={28}/><strong>No message requests</strong><span>New requests will appear here after request controls are enabled.</span></div> : visible.length === 0 ? <div className="dcEmpty"><MessageCircle size={28}/><strong>{tab === 'messages' ? 'No conversations yet' : 'Not following anyone yet'}</strong><span>Follow creators from LIVE streams to connect here.</span></div> : <div className="dcList">{visible.map(person => <button key={person.user_id} onClick={() => setActive(person)}>{avatar(person)}<div><strong>{person.display_name || 'Droxion user'}</strong><span>{person.last || person.country || 'Droxion'}</span></div>{liveIds.has(person.user_id) && <em><Radio size={10}/> LIVE</em>}{person.unread && <b/>}</button>)}</div>}</section>;
}
