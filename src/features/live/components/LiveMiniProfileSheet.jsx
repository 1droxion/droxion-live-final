import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Flag, UserPlus, X } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import '../styles/live-mini-profile-sheet.css';

const REPORT_REASONS = [
  ['sexual_content', 'Sexual content'],
  ['harassment', 'Harassment or bullying'],
  ['hate_or_threats', 'Hate or threats'],
  ['violence_or_danger', 'Violence or dangerous behavior'],
  ['underage', 'Underage concern'],
  ['spam_or_scam', 'Spam or scam'],
  ['illegal_activity', 'Illegal activity'],
  ['other', 'Other']
];

function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
}

export default function LiveMiniProfileSheet({ userId, currentUserId, fallback = {}, onClose, onBlocked }) {
  const [profile, setProfile] = useState(null);
  const [resolvedCurrentUserId, setResolvedCurrentUserId] = useState(currentUserId || '');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyNotice, setSafetyNotice] = useState('');

  useEffect(() => {
    if (currentUserId) {
      setResolvedCurrentUserId(currentUserId);
      return;
    }
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setResolvedCurrentUserId(data?.user?.id || '');
    }).catch(() => {});
    return () => { alive = false; };
  }, [currentUserId]);

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
    if (!profile || !resolvedCurrentUserId || profile.is_self || busy) return;
    setBusy(true);
    setError('');
    try {
      const isFollowing = Boolean(profile.is_following);
      const query = isFollowing
        ? supabase.from('droxion_follows').delete().eq('follower_id', resolvedCurrentUserId).eq('followed_id', profile.user_id)
        : supabase.from('droxion_follows').insert({ follower_id: resolvedCurrentUserId, followed_id: profile.user_id });
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

  async function submitReport() {
    if (!resolvedCurrentUserId || !userId || busy) return;
    setBusy(true);
    setSafetyNotice('');
    try {
      const { data, error: reportError } = await supabase.rpc('droxion_submit_report', {
        p_reported_user_id: userId,
        p_category: reportReason,
        p_details: reportDetails.trim() || null,
        p_target_type: fallback.safety_target_type || 'user',
        p_target_id: fallback.safety_target_id ? String(fallback.safety_target_id) : null,
        p_session_id: fallback.session_id || null
      });
      if (reportError || data?.ok === false) throw reportError || new Error('Could not submit report.');
      setSafetyNotice('Report submitted. Droxion moderation will review it.');
      setReportDetails('');
    } catch (reportError) {
      setSafetyNotice(reportError?.message || 'Could not submit report.');
    } finally {
      setBusy(false);
    }
  }

  async function blockUser() {
    if (!resolvedCurrentUserId || !userId || busy) return;
    const confirmed = window.confirm(`Block ${displayName}? Their content will be removed from your Droxion feed immediately and Droxion moderation will be notified.`);
    if (!confirmed) return;
    setBusy(true);
    setSafetyNotice('');
    try {
      const { data, error: blockError } = await supabase.rpc('droxion_block_user', {
        p_blocked_user_id: userId,
        p_context_type: fallback.safety_target_type || 'user',
        p_context_id: fallback.safety_target_id ? String(fallback.safety_target_id) : null,
        p_session_id: fallback.session_id || null
      });
      if (blockError || data?.ok === false) throw blockError || new Error('Could not block user.');
      onBlocked?.(userId);
      onClose?.();
    } catch (blockError) {
      setSafetyNotice(blockError?.message || 'Could not block user.');
    } finally {
      setBusy(false);
    }
  }

  const displayName = profile?.display_name || fallback.display_name || fallback.sender_name || 'Droxion user';
  const username = profile?.username || fallback.username || '';
  const avatarUrl = profile?.avatar_url || fallback.avatar_url || '';
  const isSelf = profile?.is_self || String(userId || '') === String(resolvedCurrentUserId || '');

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

            {!isSelf && resolvedCurrentUserId && (
              <button type="button" className={`liveMiniProfileFollow ${profile.is_following ? 'isFollowing' : ''}`} onClick={toggleFollow} disabled={busy}>
                {profile.is_following ? <Check size={18} /> : <UserPlus size={18} />}
                {busy ? 'Updating…' : profile.is_following ? 'Following' : 'Follow'}
              </button>
            )}

            {!isSelf && resolvedCurrentUserId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setSafetyOpen(value => !value)} disabled={busy} style={{ minHeight: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.13)', background: 'rgba(255,255,255,.06)', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Flag size={17} /> Report</button>
                <button type="button" onClick={blockUser} disabled={busy} style={{ minHeight: 44, borderRadius: 12, border: '1px solid rgba(248,113,113,.28)', background: 'rgba(239,68,68,.10)', color: '#fca5a5', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Ban size={17} /> Block User</button>
              </div>
            )}

            {safetyOpen && !isSelf && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid rgba(255,255,255,.10)', borderRadius: 14, background: 'rgba(0,0,0,.18)' }}>
                <strong style={{ display: 'block', marginBottom: 8 }}>Report objectionable content or behavior</strong>
                <select value={reportReason} onChange={event => setReportReason(event.target.value)} style={{ width: '100%', minHeight: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: '#191922', color: '#fff', padding: '0 10px' }}>
                  {REPORT_REASONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
                <textarea value={reportDetails} onChange={event => setReportDetails(event.target.value)} maxLength={1000} placeholder="Optional details" style={{ width: '100%', minHeight: 72, marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: '#191922', color: '#fff', padding: 10, resize: 'vertical' }} />
                <button type="button" onClick={submitReport} disabled={busy} style={{ width: '100%', minHeight: 42, marginTop: 8, border: 0, borderRadius: 10, background: '#9333ea', color: '#fff', fontWeight: 900 }}>{busy ? 'Submitting…' : 'Submit Report'}</button>
              </div>
            )}

            {isSelf && <div className="liveMiniProfileSelf">This is you</div>}
            {error && <div className="liveMiniProfileError">{error}</div>}
            {safetyNotice && <div className="liveMiniProfileError" style={{ color: '#ddd6fe' }}>{safetyNotice}</div>}
          </>
        ) : null}
      </section>
    </div>
  );
}
