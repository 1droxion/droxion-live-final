import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Camera, ChevronRight, Coins, Edit3, HelpCircle, LogOut, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import './live-profile.css';

function ageFromDob(value) {
  if (!value) return null;
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export default function LiveProfile({ coins = 0, onOpenWallet }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [creator, setCreator] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [view, setView] = useState('main');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [networkMode, setNetworkMode] = useState('followers');
  const [networkRows, setNetworkRows] = useState([]);
  const [support, setSupport] = useState({ subject: '', message: '' });
  const [cameraState, setCameraState] = useState('Not tested');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth?.user || null;
    setUser(currentUser);
    if (!currentUser) return;
    const [profileResult, statsResult, creatorResult, earningsResult] = await Promise.all([
      supabase.from('droxion_profiles').select('*').eq('user_id', currentUser.id).maybeSingle(),
      supabase.rpc('droxion_follow_stats'),
      supabase.from('droxion_creator_accounts').select('status').eq('user_id', currentUser.id).maybeSingle(),
      supabase.from('droxion_creator_earnings').select('amount_cents').eq('user_id', currentUser.id)
    ]);
    setProfile(profileResult.data || null);
    setFollowers(Number(statsResult.data?.followers || 0));
    setFollowing(Number(statsResult.data?.following || 0));
    setCreator(creatorResult.data || null);
    setEarnings((earningsResult.data || []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0));
  }

  const age = useMemo(() => ageFromDob(profile?.date_of_birth), [profile?.date_of_birth]);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  async function saveProfile() {
    if (!user?.id || !profile) return;
    setSaving(true); setNotice('');
    const { error } = await supabase.from('droxion_profiles').update({
      display_name: profile.display_name?.trim() || null,
      username: profile.username?.trim().toLowerCase() || null,
      bio: profile.bio?.trim() || null,
      country: profile.country?.trim() || null,
      language: profile.language?.trim() || null,
      interests: Array.isArray(profile.interests) ? profile.interests : []
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) setNotice(error.message); else { setNotice('Profile updated.'); setView('main'); }
  }

  async function savePrivacy() {
    if (!user?.id || !profile) return;
    setSaving(true); setNotice('');
    const { error } = await supabase.from('droxion_profiles').update({
      discovery_enabled: profile.discovery_enabled !== false,
      show_country: profile.show_country !== false,
      allow_messages: profile.allow_messages !== false,
      allow_video_calls: profile.allow_video_calls !== false
    }).eq('user_id', user.id);
    setSaving(false);
    setNotice(error ? error.message : 'Privacy settings saved.');
  }

  async function loadNetwork(mode) {
    setNetworkMode(mode); setView('network'); setNotice('');
    const { data, error } = await supabase.rpc(mode === 'followers' ? 'droxion_followers' : 'droxion_following');
    if (error) setNotice(error.message); else setNetworkRows(data || []);
  }

  async function testCamera() {
    setCameraState('Requesting permission…'); setNotice('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      setCameraState(`${videoTrack ? 'Camera ready' : 'No camera'} · ${audioTrack ? 'Microphone ready' : 'No microphone'}`);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setCameraState('Permission blocked');
      setNotice(error?.name === 'NotAllowedError' ? 'Camera or microphone permission is blocked for droxion.com. Enable it in your browser site settings.' : error?.message || 'Could not access camera and microphone.');
    }
  }

  async function sendSupport() {
    if (!user?.id || !support.subject.trim() || !support.message.trim()) return setNotice('Subject and message are required.');
    const { error } = await supabase.from('droxion_support_tickets').insert({ user_id: user.id, category: 'Account', subject: support.subject.trim(), message: support.message.trim() });
    if (error) setNotice(error.message); else { setNotice('Support request sent.'); setSupport({ subject: '', message: '' }); }
  }

  async function logout() { await supabase.auth.signOut({ scope: 'local' }); window.location.assign('/login'); }

  function Back({ title }) { return <div className="lpSubHead"><button onClick={() => { setView('main'); setNotice(''); }}><ArrowLeft size={19} /></button><h2>{title}</h2></div>; }

  if (!user) return <section className="lpPage lpSignedOut"><UserRound size={38} /><h2>Sign in to your Droxion profile</h2><a href="/login">Sign in</a></section>;
  if (!profile) return <section className="lpPage"><div className="lpLoading">Loading your profile…</div></section>;

  if (view === 'edit') return <section className="lpPage"><Back title="Edit Profile" /><div className="lpEditor"><label>Display name<input value={profile.display_name || ''} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} /></label><label>Username<input value={profile.username || ''} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} /></label><label>Bio<textarea value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} /></label><div className="lpTwoCol"><label>Country<input value={profile.country || ''} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} /></label><label>Language<input value={profile.language || ''} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))} /></label></div><label>Interests<input value={interests.join(', ')} onChange={e => setProfile(p => ({ ...p, interests: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12) }))} /></label><button className="lpSave" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save Profile'}</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'live-settings') return <section className="lpPage"><Back title="LIVE Settings" /><div className="lpCreatorCard"><div className="lpCreatorTop"><Camera size={19} /><strong>Camera & microphone</strong></div><p className="lpSettingText">Droxion needs camera and microphone permission only when you go LIVE or join a creator on camera.</p><div className="lpStatusBox"><strong>{cameraState}</strong><small>Test permissions before your next LIVE.</small></div><button className="lpSave" onClick={testCamera}>Test Camera & Microphone</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'network') return <section className="lpPage"><Back title="Followers & Following" /><div className="lpSegment"><button className={networkMode === 'followers' ? 'active' : ''} onClick={() => loadNetwork('followers')}>Followers</button><button className={networkMode === 'following' ? 'active' : ''} onClick={() => loadNetwork('following')}>Following</button></div><div className="lpPeopleList">{networkRows.length === 0 ? <div className="lpEmpty">No {networkMode} yet.</div> : networkRows.map(person => <div className="lpPerson" key={person.user_id}>{person.avatar_url ? <img src={person.avatar_url} alt="" /> : <div>{(person.display_name || 'D')[0]}</div>}<span><strong>{person.display_name}</strong><small>{person.country || 'Droxion user'}</small></span></div>)}</div>{notice && <div className="lpNotice">{notice}</div>}</section>;

  if (view === 'privacy') return <section className="lpPage"><Back title="Safety & Privacy" /><div className="lpEditor"><label className="lpToggle"><input type="checkbox" checked={profile.discovery_enabled !== false} onChange={e => setProfile(p => ({ ...p, discovery_enabled: e.target.checked }))} /><span><strong>Appear in LIVE discovery</strong><small>Let people discover your profile and LIVE broadcasts.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.show_country !== false} onChange={e => setProfile(p => ({ ...p, show_country: e.target.checked }))} /><span><strong>Show my country</strong><small>Display your country on Droxion.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.allow_messages !== false} onChange={e => setProfile(p => ({ ...p, allow_messages: e.target.checked }))} /><span><strong>Allow messages</strong><small>Allow eligible users to message you.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.allow_video_calls !== false} onChange={e => setProfile(p => ({ ...p, allow_video_calls: e.target.checked }))} /><span><strong>Allow video interactions</strong><small>Allow eligible LIVE/video interactions.</small></span></label><button className="lpSave" disabled={saving} onClick={savePrivacy}>{saving ? 'Saving…' : 'Save Privacy Settings'}</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'support') return <section className="lpPage"><Back title="Help & Support" /><div className="lpEditor"><label>Subject<input value={support.subject} onChange={e => setSupport(s => ({ ...s, subject: e.target.value }))} placeholder="What do you need help with?" /></label><label>Message<textarea value={support.message} onChange={e => setSupport(s => ({ ...s, message: e.target.value }))} placeholder="Tell us what happened…" /></label><button className="lpSave" onClick={sendSupport}>Send Support Request</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  return <section className="lpPage"><div className="lpHero"><div className="lpAvatarWrap">{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <div className="lpAvatarFallback">{(profile.display_name || 'D')[0]?.toUpperCase()}</div>}{creator?.status === 'approved' && <span className="lpVerified"><BadgeCheck size={18} /></span>}</div><h1>{profile.display_name || profile.username || 'Droxion Creator'}</h1><p>{profile.country || 'Global'} · {profile.language || 'English'}{age ? ` · ${age}` : ' · 21+'}</p>{profile.bio && <div className="lpBio">{profile.bio}</div>}{interests.length > 0 && <div className="lpChips">{interests.slice(0, 5).map(item => <span key={item}>{item}</span>)}</div>}</div><div className="lpStats"><button onClick={() => loadNetwork('followers')}><strong>{followers}</strong><span>Followers</span></button><button onClick={() => loadNetwork('following')}><strong>{following}</strong><span>Following</span></button><div><strong>{creator?.status ? creator.status.toUpperCase() : 'VIEWER'}</strong><span>Creator</span></div></div><button className="lpWallet" type="button" onClick={onOpenWallet}><span className="lpIcon"><Coins size={20} /></span><span><strong>{coins} Droxion Coins</strong><small>Buy coins and manage your wallet</small></span><ChevronRight size={20} /></button><div className="lpCreatorCard"><div className="lpCreatorTop"><Sparkles size={19} /><strong>Creator Center</strong></div><div className="lpCreatorNumbers"><div><strong>${(earnings / 100).toFixed(2)}</strong><span>Lifetime earnings</span></div><div><strong>{creator?.status || 'Not applied'}</strong><span>Creator status</span></div></div></div><div className="lpMenu"><button onClick={() => setView('edit')}><span className="lpIcon"><Edit3 size={20} /></span><span><strong>Edit Profile</strong><small>Name, bio, country, language and interests</small></span><ChevronRight size={20} /></button><button onClick={() => setView('live-settings')}><span className="lpIcon"><Camera size={20} /></span><span><strong>LIVE Settings</strong><small>Test camera, microphone and permissions</small></span><ChevronRight size={20} /></button><button onClick={() => loadNetwork('followers')}><span className="lpIcon"><Users size={20} /></span><span><strong>Followers & Following</strong><small>See your Droxion network</small></span><ChevronRight size={20} /></button><button onClick={() => setView('privacy')}><span className="lpIcon"><ShieldCheck size={20} /></span><span><strong>Safety & Privacy</strong><small>Discovery and interaction permissions</small></span><ChevronRight size={20} /></button><button onClick={() => setView('support')}><span className="lpIcon"><HelpCircle size={20} /></span><span><strong>Help & Support</strong><small>Send a support request</small></span><ChevronRight size={20} /></button><button className="lpLogout" onClick={logout}><span className="lpIcon"><LogOut size={20} /></span><span><strong>Log Out</strong><small>Sign out of this device</small></span><ChevronRight size={20} /></button></div></section>;
}
