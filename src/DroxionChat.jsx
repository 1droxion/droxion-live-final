import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Radio, Search, Send, UserRound, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import { queueDirectMessagePush } from './features/chat/services/chatPushService';
import './droxion-chat.css';

const TABS = ['messages', 'following', 'requests'];
const PENDING_CHAT_PUSH_KEY = 'droxion.pendingChatPush';

function avatar(person) {
  if (person?.avatar_url) return <img src={person.avatar_url} alt="" />;
  return <div className="dcAvatar dcAvatarEmpty"><UserRound size={22} /></div>;
}

function normalizeChatPush(raw) {
  const senderId = String(raw?.senderId || raw?.sender_id || '').trim();
  if (!senderId) return null;
  return {
    type: 'chat_message',
    messageId: String(raw?.messageId || raw?.message_id || '').trim(),
    senderId,
    senderName: String(raw?.senderName || raw?.sender_name || '').trim()
  };
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

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const current = auth?.user || null;
    setUser(current);
    if (!current) {
      setFollowing([]); setParticipants([]); setMessages([]); setActive(null); setBlockedByMe(false); setDraft('');
      return;
    }
    const [followingResult, participantResult, liveResult, messageResult] = await Promise.all([
      supabase.rpc('droxion_following'),
      supabase.rpc('droxion_chat_participants'),
      supabase.rpc('droxion_live_feed'),
      supabase.from('droxion_direct_messages').select('id,sender_id,recipient_id,body,created_at,read_at').order('created_at', { ascending: false }).limit(200)
    ]);
    setFollowing(followingResult.data || []);
    setParticipants(participantResult.error ? (followingResult.data || []) : (participantResult.data || []));
    setLiveIds(new Set((liveResult.data || []).map(row => row.user_id)));
    setMessages(messageResult.data || []);
  }

  useEffect(() => {
    let lastUserId = null;
    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const nextId = data?.user?.id || null;
      if (lastUserId !== nextId) {
        setActive(null); setBlockedByMe(false); setDraft(''); setNotice(''); setQuery(''); setTab('messages');
        lastUserId = nextId;
      }
      await load();
    };
    boot();
    const timer = setInterval(boot, 7000);
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextId = session?.user?.id || null;
      if (lastUserId !== nextId) {
        setActive(null); setBlockedByMe(false); setDraft(''); setNotice(''); setQuery(''); setTab('messages');
        lastUserId = nextId;
      }
      load();
    });
    return () => { clearInterval(timer); authListener?.subscription?.unsubscribe(); };
  }, []);

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
    if (!active?.user_id) return;
    const refreshed = people.find(item => item.user_id === active.user_id);
    if (refreshed) setActive(current => current ? { ...current, ...refreshed } : current);
  }, [people, active?.user_id]);

  async function openThread(person) {
    setDraft('');
    setNotice('');
    setBlockedByMe(false);
    setTab('messages');
    setActive(person);
    if (user?.id && person?.user_id) {
      const [{ data: ownBlock }, readResult] = await Promise.all([
        supabase.from('droxion_blocks').select('blocked_user_id').eq('blocker_id', user.id).eq('blocked_user_id', person.user_id).maybeSingle(),
        supabase.from('droxion_direct_messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).eq('sender_id', person.user_id).is('read_at', null)
      ]);
      setBlockedByMe(Boolean(ownBlock));
      if (readResult.error) setNotice('Could not update message status.');
      await load();
    }
  }

  useEffect(() => {
    if (!user?.id) return undefined;
    let consuming = false;

    const consumePush = async payloadLike => {
      if (consuming) return;
      const payload = normalizeChatPush(payloadLike);
      if (!payload || payload.senderId === user.id) return;
      consuming = true;
      try {
        const known = people.find(person => String(person.user_id) === payload.senderId);
        let person = known || null;
        if (!person) {
          const { data } = await supabase
            .from('droxion_profiles')
            .select('user_id,display_name,username,avatar_url,country,allow_messages')
            .eq('user_id', payload.senderId)
            .maybeSingle();
          person = data || {
            user_id: payload.senderId,
            display_name: payload.senderName || 'Droxion member'
          };
        }
        if (person?.user_id) await openThread(person);
        try { window.localStorage.removeItem(PENDING_CHAT_PUSH_KEY); } catch {}
      } finally {
        consuming = false;
      }
    };

    const handlePushOpen = event => { consumePush(event?.detail).catch(() => {}); };
    window.addEventListener('droxion:chat-push-open', handlePushOpen);

    try {
      const raw = window.localStorage.getItem(PENDING_CHAT_PUSH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        window.setTimeout(() => consumePush(parsed).catch(() => {}), 0);
      }
    } catch {}

    return () => window.removeEventListener('droxion:chat-push-open', handlePushOpen);
  }, [user?.id, people]);

  function closeThread() { setActive(null); setBlockedByMe(false); setDraft(''); setNotice(''); }

  async function unblock() {
    if (!user?.id || !active?.user_id) return;
    const { error } = await supabase.from('droxion_blocks').delete().eq('blocker_id', user.id).eq('blocked_user_id', active.user_id);
    if (error) return setNotice(error.message || 'Could not unblock this account.');
    setBlockedByMe(false);
    setActive(current => current ? { ...current, blocked: false } : current);
    setNotice('Account unblocked.');
    await load();
  }

  async function send() {
    const body = draft.trim();
    if (!active?.user_id || !body || active?.blocked || active?.allow_messages === false) return;
    const { data, error } = await supabase.rpc('droxion_send_direct_message', { p_recipient_id: active.user_id, p_body: body });
    if (error || data?.allowed === false) {
      const message = error?.message || 'Message could not be sent.';
      if (/Messaging is unavailable|not accepting messages/i.test(message)) setNotice('You cannot message this account right now.');
      else setNotice(message);
      return;
    }
    const messageId = data?.message?.id;
    if (messageId) queueDirectMessagePush(messageId).catch(() => {});
    setDraft(''); setNotice(''); await load();
  }

  if (!user) return <section className="dcPage dcSignedOut"><MessageCircle size={34} /><h1>Chat</h1><p>Sign in to message people you follow.</p><a href="/login">Sign in</a></section>;

  if (active) {
    const blocked = Boolean(active.blocked);
    const messagesDisabled = active.allow_messages === false;
    const unavailable = blocked || messagesDisabled;
    return <section className="dcPage dcThread"><header><button onClick={closeThread}>‹</button>{avatar(active)}<div><strong>{active.display_name || 'Droxion member'}</strong>{liveIds.has(active.user_id) && <span className="dcLiveStatus">● LIVE now</span>}</div></header><div className="dcMessages">{activeMessages.length === 0 ? <div className="dcEmpty"><MessageCircle size={26} /><strong>Start the conversation</strong><span>Keep messages respectful and safe.</span></div> : activeMessages.map(row => <div key={row.id} className={`dcBubble ${row.sender_id === user.id ? 'mine' : ''}`}><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString()}</small></div>)}</div>{unavailable ? <div className="dcThreadStatus dcUnavailable"><span>{blockedByMe ? 'You blocked this account.' : blocked ? 'Messaging is unavailable for this account.' : 'This account is not accepting messages.'}</span>{blockedByMe && <button type="button" onClick={unblock}>Unblock</button>}</div> : <div className="dcComposer"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Message…" maxLength={1000}/><button onClick={send} disabled={!draft.trim()}><Send size={18}/></button></div>}{notice && <div className="dcThreadStatus">{notice}</div>}</section>;
  }

  const source = tab === 'messages' ? threads : tab === 'following' ? following : [];
  const visible = source.filter(person => !query.trim() || String(person.display_name || '').toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="dcPage"><div className="dcHero"><span>CONNECT</span><h1>Chat</h1><p>Messages, people you follow and message requests.</p></div><div className="dcTabs">{TABS.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div><label className="dcSearch"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people or conversations"/></label>{tab === 'requests' ? <div className="dcEmpty"><Users size={28}/><strong>No message requests</strong><span>New requests will appear here when someone contacts you for the first time.</span></div> : visible.length === 0 ? <div className="dcEmpty"><MessageCircle size={28}/><strong>{tab === 'messages' ? 'No conversations yet' : 'Not following anyone yet'}</strong><span>Follow creators from LIVE streams to connect here.</span></div> : <div className="dcList">{visible.map(person => <button key={person.user_id} onClick={() => openThread(person)}>{avatar(person)}<div><strong>{person.display_name || 'Droxion member'}</strong>{(person.last || person.country) && <span>{person.last || person.country}</span>}</div>{liveIds.has(person.user_id) && <em><Radio size={10}/> LIVE</em>}{person.unread && <b/>}</button>)}</div>}</section>;
}
