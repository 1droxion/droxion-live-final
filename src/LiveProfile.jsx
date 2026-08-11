import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Camera, ChevronRight, Coins, Edit3, HelpCircle, LogOut, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const currentUser = auth?.user || null;
      if (!active) return;
      setUser(currentUser);
      if (!currentUser) return;

      const [profileResult, followersResult, followingResult, creatorResult, earningsResult] = await Promise.all([
        supabase.from('droxion_profiles').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabase.from('droxion_follows').select('follower_id', { count: 'exact', head: true }).eq('followed_id', currentUser.id),
        supabase.from('droxion_follows').select('followed_id', { count: 'exact', head: true }).eq('follower_id', currentUser.id),
        supabase.from('droxion_creator_accounts').select('status').eq('user_id', currentUser.id).maybeSingle(),
        supabase.from('droxion_creator_earnings').select('amount_cents').eq('user_id', currentUser.id)
      ]);

      if (!active) return;
      setProfile(profileResult.data || null);
      setFollowers(Number(followersResult.count || 0));
      setFollowing(Number(followingResult.count || 0));
      setCreator(creatorResult.data || null);
      setEarnings((earningsResult.data || []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0));
    })();
    return () => { active = false; };
  }, []);

  const age = useMemo(() => ageFromDob(profile?.date_of_birth), [profile?.date_of_birth]);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];

  async function saveProfile() {
    if (!user?.id || !profile) return;
    setSaving(true);
    setNotice('');
    const { error } = await supabase.from('droxion_profiles').update({
      display_name: profile.display_name?.trim() || null,
      username: profile.username?.trim().toLowerCase() || null,
      bio: profile.bio?.trim() || null,
      country: profile.country?.trim() || null,
      language: profile.language?.trim() || null,
      interests: Array.isArray(profile.interests) ? profile.interests : []
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) setNotice(error.message);
    else {
      setNotice('Profile updated.');
      setEditing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut({ scope: 'local' });
    window.location.assign('/login');
  }

  if (!user) {
    return (
      <section className="lpPage lpSignedOut">
        <UserRound size={38} />
        <h2>Sign in to your Droxion profile</h2>
        <a href="/login">Sign in</a>
      </section>
    );
  }

  if (!profile) {
    return <section className="lpPage"><div className="lpLoading">Loading your profile…</div></section>;
  }

  return (
    <section className="lpPage">
      <div className="lpHero">
        <div className="lpAvatarWrap">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <div className="lpAvatarFallback">{(profile.display_name || 'D')[0]?.toUpperCase()}</div>}
          {creator?.status === 'approved' && <span className="lpVerified"><BadgeCheck size={18} /></span>}
        </div>
        <h1>{profile.display_name || profile.username || 'Droxion Creator'}</h1>
        <p>{profile.country || 'Global'} · {profile.language || 'English'}{age ? ` · ${age}` : ' · 21+'}</p>
        {profile.bio && <div className="lpBio">{profile.bio}</div>}
        {interests.length > 0 && <div className="lpChips">{interests.slice(0, 5).map(item => <span key={item}>{item}</span>)}</div>}
      </div>

      <div className="lpStats">
        <div><strong>{followers}</strong><span>Followers</span></div>
        <div><strong>{following}</strong><span>Following</span></div>
        <div><strong>{creator?.status ? creator.status.toUpperCase() : 'VIEWER'}</strong><span>Creator</span></div>
      </div>

      <button className="lpWallet" type="button" onClick={onOpenWallet}>
        <span className="lpIcon"><Coins size={20} /></span>
        <span><strong>{coins} Droxion Coins</strong><small>Buy coins and manage your wallet</small></span>
        <ChevronRight size={20} />
      </button>

      <div className="lpCreatorCard">
        <div className="lpCreatorTop"><Sparkles size={19} /><strong>Creator Center</strong></div>
        <div className="lpCreatorNumbers">
          <div><strong>${(earnings / 100).toFixed(2)}</strong><span>Lifetime earnings</span></div>
          <div><strong>{creator?.status || 'Not applied'}</strong><span>Creator status</span></div>
        </div>
      </div>

      {editing ? (
        <div className="lpEditor">
          <div className="lpEditorHead"><strong>Edit Profile</strong><button onClick={() => setEditing(false)}>Cancel</button></div>
          <label>Display name<input value={profile.display_name || ''} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} /></label>
          <label>Username<input value={profile.username || ''} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} /></label>
          <label>Bio<textarea value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} /></label>
          <div className="lpTwoCol">
            <label>Country<input value={profile.country || ''} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} /></label>
            <label>Language<input value={profile.language || ''} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))} /></label>
          </div>
          <label>Interests<input value={interests.join(', ')} onChange={e => setProfile(p => ({ ...p, interests: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12) }))} /></label>
          <button className="lpSave" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save Profile'}</button>
          {notice && <div className="lpNotice">{notice}</div>}
        </div>
      ) : (
        <div className="lpMenu">
          <button onClick={() => setEditing(true)}><span className="lpIcon"><Edit3 size={20} /></span><span><strong>Edit Profile</strong><small>Name, bio, country, language and interests</small></span><ChevronRight size={20} /></button>
          <button><span className="lpIcon"><Camera size={20} /></span><span><strong>LIVE Settings</strong><small>Camera, microphone and guest preferences</small></span><ChevronRight size={20} /></button>
          <button><span className="lpIcon"><Users size={20} /></span><span><strong>Followers & Following</strong><small>Manage your Droxion network</small></span><ChevronRight size={20} /></button>
          <button><span className="lpIcon"><ShieldCheck size={20} /></span><span><strong>Safety & Privacy</strong><small>Blocks, reports, discovery and permissions</small></span><ChevronRight size={20} /></button>
          <button><span className="lpIcon"><HelpCircle size={20} /></span><span><strong>Help & Support</strong><small>Get help with your Droxion account</small></span><ChevronRight size={20} /></button>
          <button className="lpLogout" onClick={logout}><span className="lpIcon"><LogOut size={20} /></span><span><strong>Log Out</strong><small>Sign out of this device</small></span><ChevronRight size={20} /></button>
        </div>
      )}
    </section>
  );
}
