import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Radio, Search, Send, UserRound, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import './droxion-chat.css';

const TABS = ['messages', 'following', 'requests'];

function avatar(person) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt="" />;
  return <div className="dcAvatar dcAvatarEmpty"><UserRound size={22} /></div>;
}

function sameMessageList(current, next) {
  if (current.length !== next.length) return false;
  return current.every((row, index) => {
    const other = next[index];
    return row?.id === other?.id
      && row?.sender_id === other?.sender_id
      && row?.recipient_id === other?.recipient_id
      && row?.body === other?.body
      && row?.created_at === other?.created_at
      && row?.read_at === other?.read_at;
  });
}

export default function DroxionChat() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('messages');
  const [following, setFollowing] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [liveIds, setLiveIds] = useState(new Set());
  const [messages, setMessages] = useState([]);
  const [active, setActive] = useState(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const userIdRef = useRef(null);
  const activeIdRef = useRef(null);
  const loadRequestRef = useRef(0);

  async function load(currentUser) {
    const currentId = currentUser?.id || userIdRef.current;
    if (!currentId || userIdRef.current !== currentId) return;

    const requestId = ++loadRequestRef.current;
    const [followingResult, participantResult, liveResult, messageResult] = await Promise.all([
      supabase.rpc('droxion_following'),
      supabase.rpc('droxion_chat_participants'),
      supabase.rpc('droxion_live_feed'),
      supabase.from('droxion_direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').order('created_at', { ascending: false }).limit(200)
    ]);

    // Never let a slower, older refresh overwrite newer chat state.
    if (requestId !== loadRequestRef.current || userIdRef.current !== currentId) return;

    if (!followingResult.error) setFollowing(followingResult.data || []);
    if (!participantResult.error) setParticipants(participantResult.data || []);
    else if (!followingResult.error) setParticipants(followingResult.data || []);
    if (!liveResult.error) {
      const nextIds = new Set((liveResult.data || []).map(row => row.user_id));
      setLiveIds(current => current.size === nextIds.size && [...current].every(id => nextIds.has(id)) ? current : nextIds);
    }
    if (!messageResult.error) {
      const nextMessages = messageResult.data || [];
      setMessages(current => sameMessageList(current, nextMessages) ? current : nextMessages);
    }
  }

  useEffect(() => {
    let mounted = true;

    const applyUser = nextUser => {
      if (!mounted) return;
      const nextId = nextUser?.id || null;
      const changed = userIdRef.current !== nextId;

      if (!changed) {
        if (nextUser) setUser(current => current?.id === nextId ? current : nextUser);
        return;
      }

      userIdRef.current = nextId;
      loadRequestRef.current += 1;
      activeIdRef.current = null;
      setUser(nextUser || null);
      setFollowing([]);
      setParticipants([]);
      setLiveIds(new Set());
      setMessages([]);
      setActive(null);
      setBlockedByMe(false);
      setDraft('');
      setNotice('');
      setQuery('');
      setTab('messages');
      setSending(false);
    };

    // Read the locally restored session once instead of re-checking auth every
    // few seconds. Transient auth/network responses must not wipe an open chat.
    supabase.auth.getSession().then(({ data }) => {
      applyUser(data?.session?.user || null);
    }).catch(() => {});

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user || null);
    });

    return () => {
      mounted = false;
      loadRequestRef.current += 1;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let disposed = false;
    const refresh = () => { if (!disposed) load(user); };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      loadRequestRef.current += 1;
    };
  }, [user?.id]);

  useEffect(() => {
    const currentId = user?.id;
    if (!currentId) return undefined;

    const syncMessage = row => {
      if (!row?.id || (row.sender_id !== currentId && row.recipient_id !== currentId)) return;

      // Invalidate any in-flight poll that may have started before this event.
      loadRequestRef.current += 1;
      setMessages(current => {
        const next = current.filter(item => item.id !== row.id);
        next.push(row);
        next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return next.slice(0, 200);
      });
    };

    const channel = supabase
      .channel(`droxion-direct-messages-${currentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'droxion_direct_messages', filter: `recipient_id=eq.${currentId}` }, payload => syncMessage(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'droxion_direct_messages', filter: `sender_id=eq.${currentId}` }, payload => syncMessage(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'droxion_direct_messages', filter: `recipient_id=eq.${currentId}` }, payload => syncMessage(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'droxion_direct_messages', filter: `sender_id=eq.${currentId}` }, payload => syncMessage(payload.new))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const people = useMemo(() => {
    const map = new Map();
    [...following, ...participants].forEach(person => { if (person?.user_id) map.set(person.user_id, person); });
    messages.forEach(row => {
      const other = row.sender_id === user?.id ? row.recipient_id : row.sender_id;
      if (other && !map.has(other)) map.set(other, { user_id: other, display_name: 'Droxion member' });
    });
    return [...map.values()];
  }, [following, participants, messages, user?.id]);

  const threads = useMemo(() => {
    const latest = new Map();
    messages.forEach(row => {
      const other = row.sender_id === user?.id ? row.recipient_id : row.sender_id;
      if (!other || latest.has(other)) return;
      const person = people.find(item => item.user_id === other) || { user_id: other, display_name: 'Droxion member' };
      latest.set(other, { ...person, last: row.body, at: row.created_at, unread: row.recipient_id === user?.id && !row.read_at });
    });
    return [...latest.values()];
  }, [messages, people, user?.id]);

  const activeMessages = useMemo(() => active ? messages.filter(row => (row.sender_id === user?.id && row.recipient_id === active.user_id) || (row.recipient_id === user?.id && row.sender_id === active.user_id)).reverse() : [], [messages, active, user?.id]);

  useEffect(() => {
    activeIdRef.current = active?.user_id || null;
  }, [active?.user_id]);

  useEffect(() => {
    if (!active?.user_id) return;
    const refreshed = people.find(item => item.user_id === active.user_id);
    if (refreshed) {
      setActive(current => {
        if (!current) return current;
        const changed = Object.keys(refreshed).some(key => current[key] !== refreshed[key]);
        return changed ? { ...current, ...refreshed } : current;
      });
    }
  }, [people, active?.user_id]);

  async function openThread(person) {
    const threadId = person?.user_id;
    if (!threadId) return;
    activeIdRef.current = threadId;
    setDraft('');
    setNotice('');
    setBlockedByMe(false);
    setActive(person);

    if (user?.id) {
      const [{ data: ownBlock }, readResult] = await Promise.all([
        supabase.from('droxion_blocks').select('blocked_user_id').eq('blocker_id', user.id).eq('blocked_user_id', threadId).maybeSingle(),
        supabase.from('droxion_direct_messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).eq('sender_id', threadId).is('read_at', null)
      ]);
      if (activeIdRef.current !== threadId) return;
      setBlockedByMe(Boolean(ownBlock));
      if (readResult.error) setNotice('Could not update message status.');
      await load(user);
    }
  }

  function closeThread() {
    activeIdRef.current = null;
    setActive(null);
    setBlockedByMe(false);
    setDraft('');
    setNotice('');
    setSending(false);
  }

  async function unblock() {
    if (!user?.id || !active?.user_id) return;
    const threadId = active.user_id;
    const { error } = await supabase.from('droxion_blocks').delete().eq('blocker_id', user.id).eq('blocked_user_id', threadId);
    if (activeIdRef.current !== threadId) return;
    if (error) return setNotice(error.message || 'Could not unblock this account.');
    setBlockedByMe(false);
    setActive(current => current ? { ...current, blocked: false } : current);
    setNotice('Account unblocked.');
    await load(user);
  }

  async function send() {
    const body = draft.trim();
    const threadId = active?.user_id;
    if (!user?.id || !threadId || !body || sending || active?.blocked || active?.allow_messages === false) return;

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('droxion_send_direct_message', { p_recipient_id: threadId, p_body: body });
      if (error || data?.allowed === false) {
        if (activeIdRef.current !== threadId) return;
        const message = error?.message || 'Message could not be sent.';
        if (/Messaging is unavailable|not accepting messages/i.test(message)) setNotice('You cannot message this account right now.');
        else setNotice(message);
        return;
      }

      if (activeIdRef.current === threadId) {
        setDraft('');
        setNotice('');
      }
      await load(user);
    } finally {
      if (activeIdRef.current === threadId) setSending(false);
    }
  }

  if (!user) return <section className="dcPage dcSignedOut"><MessageCircle size={34} /><h1>Chat</h1><p>Sign in to message people you follow.</p><a href="/login">Sign in</a></section>;

  if (active) {
    const blocked = Boolean(active.blocked);
    const messagesDisabled = active.allow_messages === false;
    const unavailable = blocked || messagesDisabled;
    return <section className="dcPage dcThread"><header><button onClick={closeThread}>‹</button>{avatar(active)}<div><strong>{active.display_name || 'Droxion member'}</strong>{liveIds.has(active.user_id) && <span className="dcLiveStatus">● LIVE now</span>}</div></header><div className="dcMessages">{activeMessages.length === 0 ? <div className="dcEmpty"><MessageCircle size={26} /><strong>Start the conversation</strong><span>Keep messages respectful and safe.</span></div> : activeMessages.map(row => <div key={row.id} className={`dcBubble ${row.sender_id === user.id ? 'mine' : ''}`}><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString()}</small></div>)}</div>{unavailable ? <div className="dcThreadStatus dcUnavailable"><span>{blockedByMe ? 'You blocked this account.' : blocked ? 'Messaging is unavailable for this account.' : 'This account is not accepting messages.'}</span>{blockedByMe && <button type="button" onClick={unblock}>Unblock</button>}</div> : <div className="dcComposer"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent?.isComposing) { e.preventDefault(); send(); } }} placeholder="Message…" maxLength={1000}/><button onClick={send} disabled={sending || !draft.trim()}><Send size={18}/></button></div>}{notice && <div className="dcThreadStatus">{notice}</div>}</section>;
  }

  const source = tab === 'messages' ? threads : tab === 'following' ? following : [];
  const visible = source.filter(person => !query.trim() || String(person.display_name || '').toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="dcPage"><div className="dcHero"><span>CONNECT</span><h1>Chat</h1><p>Messages, people you follow and message requests.</p></div><div className="dcTabs">{TABS.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div><label className="dcSearch"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people or conversations"/></label>{tab === 'requests' ? <div className="dcEmpty"><Users size={28}/><strong>No message requests</strong><span>New requests will appear here when someone contacts you for the first time.</span></div> : visible.length === 0 ? <div className="dcEmpty"><MessageCircle size={28}/><strong>{tab === 'messages' ? 'No conversations yet' : 'Not following anyone yet'}</strong><span>Follow creators from LIVE streams to connect here.</span></div> : <div className="dcList">{visible.map(person => <button key={person.user_id} onClick={() => openThread(person)}>{avatar(person)}<div><strong>{person.display_name || 'Droxion member'}</strong>{(person.last || person.country) && <span>{person.last || person.country}</span>}</div>{liveIds.has(person.user_id) && <em><Radio size={10}/> LIVE</em>}{person.unread && <b/>}</button>)}</div>}</section>;
}
