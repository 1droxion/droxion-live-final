import { useCallback, useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import '../styles/live-mini-profile-sheet.css';

function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
}

export default function LiveMiniProfileSheet({ userId, currentUserId, fallback = {}, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('droxion_live_profile_card', { p_user_id: userId });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Profile is unavailable.');
      setProfile(row);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function toggleFollow() {
    if (!profile || !currentUserId || profile.is_self || busy) return;
    setBusy(true);
    setError('');
    try {
      const isFollowing = Boolean(profile.is_following);
      const query = isFollowing
        ? supabase.from('droxion_follows').delete().eq('follower_id', currentUserId).eq('followed_id', profile.user_id)
        : supabase.from('droxion_follows').insert({ follower_id: currentUserId, followed_id: profile.user_id });
      const { error: followError } = await query;
      if (followError) throw followError;
      setProfile(current => current ? {
        ...current,
        is_following: !isFollowing,
        followers_count: Math.max(0, Number(current.followers_count || 0) + (isFollowing ? -1 : 1))
      } : current);
    } catch (followError) {
      setError(followError?.message || 'Could not update follow.');
    } finally {
      setBusy(false);
    }
  }

  const displayName = profile?.display_name || fallback.display_name || fallback.sender_name || 'Droxion user';
  const username = profile?.username || fallback.username || '';
  const avatarUrl = profile?.avatar_url || fallback.avatar_url || '';

  return (
    <div className="liveMiniProfileBackdrop" onClick={onClose}>
      <section className="liveMiniProfileSheet" onClick={event => event.stopPropagation()} aria-label={`${displayName} profile`}>
        <div className="liveMiniProfileGrabber" />
        <button type="button" className="liveMiniProfileClose" onClick={onClose} aria-label="Close profile"><X size={20} /></button>

        <div className="liveMiniProfileIdentity">
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <div className="liveMiniProfileAvatarFallback">{displayName.slice(0, 1).toUpperCase()}</div>}
          <div>
            <strong>{displayName}</strong>
            {username && <span>@{username}</span>}
            {profile?.country && <small>{profile.country}</small>}
          </div>
        </div>

        {loading ? (
          <div className="liveMiniProfileLoading">Loading profile…</div>
        ) : error && !profile ? (
          <div className="liveMiniProfileError">{error}</div>
        ) : profile ? (
          <>
            {profile.bio && <p className="liveMiniProfileBio">{profile.bio}</p>}
            <div className="liveMiniProfileStats">
              <div><strong>{compactNumber(profile.followers_count)}</strong><span>Followers</span></div>
              <div><strong>{compactNumber(profile.following_count)}</strong><span>Following</span></div>
            </div>

            {!profile.is_self && currentUserId && (
              <button type="button" className={`liveMiniProfileFollow ${profile.is_following ? 'isFollowing' : ''}`} onClick={toggleFollow} disabled={busy}>
                {profile.is_following ? <Check size={18} /> : <UserPlus size={18} />}
                {busy ? 'Updating…' : profile.is_following ? 'Following' : 'Follow'}
              </button>
            )}
            {profile.is_self && <div className="liveMiniProfileSelf">This is you</div>}
            {error && <div className="liveMiniProfileError">{error}</div>}
          </>
        ) : null}
      </section>
    </div>
  );
}
