import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Heart, MessageCircle, MoreVertical, Radio, Share2, Trash2, UserPlus, Volume2, VolumeX, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './short-feed.css';

function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
}

function avatar(profile, className = '') {
  if (profile?.avatar_url) return <img className={className} src={profile.avatar_url} alt={profile.display_name || 'Creator'} />;
  return <span className={`${className} sfAvatarFallback`} aria-hidden="true" />;
}

function safePlay(video) {
  if (!video) return;
  try {
    const result = video.play?.();
    if (result?.catch) result.catch(() => {});
  } catch {}
}

export default function ShortFeed({ currentUserId, onWatchLive, onStartLive }) {
  const [clips, setClips] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [liveCreators, setLiveCreators] = useState({});
  const [liked, setLiked] = useState(new Set());
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [notice, setNotice] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [drawerRows, setDrawerRows] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [actionClip, setActionClip] = useState(null);
  const [deletingClipId, setDeletingClipId] = useState('');
  const videoRefs = useRef(new Map());
  const viewed = useRef(new Set());
  const lastTap = useRef({ clipId: '', at: 0 });

  const creatorIds = useMemo(() => [...new Set(clips.map(clip => clip.creator_id).filter(Boolean))], [clips]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      const { data: clipRows, error } = await supabase
        .from('droxion_live_clips')
        .select('id,creator_id,session_id,video_url,thumbnail_url,caption,duration_seconds,views_count,likes_count,comments_count,shares_count,published_at,created_at,highlight_score,storage_path,camera_facing')
        .eq('status', 'ready')
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('highlight_score', { ascending: false })
        .limit(50);

      if (!alive) return;
      if (error) {
        setNotice('Could not load the highlight feed.');
        setClips([]);
        setLoading(false);
        return;
      }
      setClips(clipRows || []);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!creatorIds.length) { setProfiles({}); setLiveCreators({}); return; }
    let alive = true;
    (async () => {
      const [profileResult, liveResult] = await Promise.all([
        supabase.from('droxion_profiles').select('user_id,display_name,username,avatar_url').in('user_id', creatorIds),
        supabase.rpc('droxion_live_feed')
      ]);
      if (!alive) return;
      const profileMap = {};
      (profileResult.data || []).forEach(row => { profileMap[row.user_id] = row; });
      setProfiles(profileMap);
      const liveMap = {};
      (liveResult.data || []).forEach(row => { if (row?.user_id) liveMap[row.user_id] = row; });
      setLiveCreators(liveMap);
    })();
    return () => { alive = false; };
  }, [creatorIds.join('|')]);

  useEffect(() => {
    if (!currentUserId || !clips.length) { setLiked(new Set()); setFollowing(new Set()); return; }
    let alive = true;
    const clipIds = clips.map(item => item.id);
    (async () => {
      const [likesResult, followsResult] = await Promise.all([
        supabase.from('droxion_clip_likes').select('clip_id').eq('user_id', currentUserId).in('clip_id', clipIds),
        creatorIds.length
          ? supabase.from('droxion_follows').select('followed_id').eq('follower_id', currentUserId).in('followed_id', creatorIds)
          : Promise.resolve({ data: [] })
      ]);
      if (!alive) return;
      setLiked(new Set((likesResult.data || []).map(row => row.clip_id)));
      setFollowing(new Set((followsResult.data || []).map(row => row.followed_id)));
    })();
    return () => { alive = false; };
  }, [currentUserId, clips, creatorIds.join('|')]);

  useEffect(() => {
    if (!clips.length) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target;
        const clipId = video.dataset.clipId;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.62) {
          safePlay(video);
          if (clipId && !viewed.current.has(clipId)) {
            viewed.current.add(clipId);
            supabase.rpc('droxion_record_clip_view', { p_clip_id: clipId }).then(({ data }) => {
              if (data == null) return;
              setClips(current => current.map(item => item.id === clipId ? { ...item, views_count: Number(data) } : item));
            });
          }
        } else if (entry.intersectionRatio < 0.3) {
          video.pause?.();
        }
      });
    }, { threshold: [0, 0.3, 0.62, 0.85, 1] });

    videoRefs.current.forEach(video => observer.observe(video));
    const retry = window.setInterval(() => {
      videoRefs.current.forEach(video => {
        const rect = video.getBoundingClientRect();
        const visible = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
        const ratio = rect.height ? visible / rect.height : 0;
        if (ratio >= 0.62 && (video.paused || video.ended)) {
          try { if (video.ended) video.currentTime = 0; } catch {}
          safePlay(video);
        }
      });
    }, 700);

    return () => {
      observer.disconnect();
      window.clearInterval(retry);
    };
  }, [clips.length]);

  useEffect(() => {
    videoRefs.current.forEach(video => {
      video.muted = muted;
      if (!video.paused || muted) safePlay(video);
    });
  }, [muted]);

  async function toggleLike(clipId) {
    if (!currentUserId) { setNotice('Sign in to like highlights.'); return; }
    const { data, error } = await supabase.rpc('droxion_toggle_clip_like', { p_clip_id: clipId });
    if (error || !data) { setNotice(error?.message || 'Could not update like.'); return; }
    setLiked(current => {
      const next = new Set(current);
      if (data.liked) next.add(clipId); else next.delete(clipId);
      return next;
    });
    setClips(current => current.map(item => item.id === clipId ? { ...item, likes_count: Number(data.likes_count || 0) } : item));
  }

  async function toggleFollow(creatorId) {
    if (!currentUserId || !creatorId || creatorId === currentUserId) return;
    const isFollowing = following.has(creatorId);
    const query = isFollowing
      ? supabase.from('droxion_follows').delete().eq('follower_id', currentUserId).eq('followed_id', creatorId)
      : supabase.from('droxion_follows').insert({ follower_id: currentUserId, followed_id: creatorId });
    const { error } = await query;
    if (error) { setNotice(error.message || 'Could not update follow.'); return; }
    setFollowing(current => {
      const next = new Set(current);
      if (isFollowing) next.delete(creatorId); else next.add(creatorId);
      return next;
    });
  }

  async function loadLikes(clip) {
    setActionClip(null);
    setDrawer({ type: 'likes', clip });
    setDrawerRows([]);
    setDrawerLoading(true);
    const { data: rows } = await supabase.from('droxion_clip_likes').select('user_id,created_at').eq('clip_id', clip.id).order('created_at', { ascending: false }).limit(200);
    const ids = [...new Set((rows || []).map(row => row.user_id))];
    let profileRows = [];
    if (ids.length) {
      const result = await supabase.from('droxion_profiles').select('user_id,display_name,username,avatar_url').in('user_id', ids);
      profileRows = result.data || [];
    }
    const map = Object.fromEntries(profileRows.map(row => [row.user_id, row]));
    setDrawerRows((rows || []).map(row => ({ ...row, profile: map[row.user_id] || {} })));
    setDrawerLoading(false);
  }

  async function loadComments(clip) {
    setActionClip(null);
    setDrawer({ type: 'comments', clip });
    setDrawerRows([]);
    setDrawerLoading(true);
    const { data: rows } = await supabase.from('droxion_clip_comments').select('id,user_id,body,created_at').eq('clip_id', clip.id).order('created_at', { ascending: false }).limit(200);
    const ids = [...new Set((rows || []).map(row => row.user_id))];
    let profileRows = [];
    if (ids.length) {
      const result = await supabase.from('droxion_profiles').select('user_id,display_name,username,avatar_url').in('user_id', ids);
      profileRows = result.data || [];
    }
    const map = Object.fromEntries(profileRows.map(row => [row.user_id, row]));
    setDrawerRows((rows || []).map(row => ({ ...row, profile: map[row.user_id] || {} })));
    setDrawerLoading(false);
  }

  async function sendComment() {
    const body = commentDraft.trim();
    const clip = drawer?.clip;
    if (!body || !clip?.id || !currentUserId) return;
    const { data, error } = await supabase.rpc('droxion_add_clip_comment', { p_clip_id: clip.id, p_body: body });
    if (error) { setNotice(error.message || 'Could not add comment.'); return; }
    setCommentDraft('');
    setClips(current => current.map(item => item.id === clip.id ? { ...item, comments_count: Number(data?.comments_count || item.comments_count || 0) } : item));
    await loadComments({ ...clip, comments_count: Number(data?.comments_count || 0) });
  }

  async function shareClip(clip) {
    setActionClip(null);
    const profile = profiles[clip.creator_id] || {};
    const shareData = {
      title: `${profile.display_name || 'Droxion creator'} · LIVE Highlight`,
      text: clip.caption || 'Watch this LIVE highlight on Droxion.',
      url: `${window.location.origin}/#clip-${clip.id}`
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) await navigator.clipboard.writeText(shareData.url);
      else return setNotice('Sharing is not available on this device.');
      const { data } = await supabase.rpc('droxion_record_clip_share', { p_clip_id: clip.id });
      if (data != null) setClips(current => current.map(item => item.id === clip.id ? { ...item, shares_count: Number(data) } : item));
      if (!navigator.share) setNotice('Highlight link copied.');
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice('Could not share this highlight.');
    }
  }

  async function downloadClip(clip) {
    setActionClip(null);
    try {
      const response = await fetch(clip.video_url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const extension = String(blob.type || '').includes('webm') ? 'webm' : 'mp4';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `droxion-live-highlight-${clip.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice('Highlight download started.');
    } catch {
      window.open(clip.video_url, '_blank', 'noopener,noreferrer');
      setNotice('Opened the highlight so you can save it.');
    }
  }

  async function deleteOwnClip(clip) {
    if (!clip?.id || clip.creator_id !== currentUserId || deletingClipId) return;
    const confirmed = window.confirm('Delete this LIVE highlight permanently? This cannot be undone.');
    if (!confirmed) return;

    setDeletingClipId(clip.id);
    setActionClip(null);
    const { data: prepared, error: prepareError } = await supabase.rpc('droxion_prepare_clip_delete', { p_clip_id: clip.id });
    if (prepareError) {
      setNotice(prepareError.message || 'Could not delete this highlight.');
      setDeletingClipId('');
      return;
    }

    const storagePath = prepared?.storage_path || clip.storage_path;
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from('droxion-live-clips').remove([storagePath]);
      if (storageError) {
        await supabase.rpc('droxion_set_clip_visibility', { p_clip_id: clip.id, p_hidden: false });
        setNotice('Could not remove the video file. Please try again.');
        setDeletingClipId('');
        return;
      }
    }

    const { error: finalizeError } = await supabase.rpc('droxion_finalize_clip_delete', { p_clip_id: clip.id });
    if (finalizeError) {
      setNotice('Video file was removed, but cleanup is still pending.');
      setClips(current => current.filter(item => item.id !== clip.id));
      setDeletingClipId('');
      return;
    }

    viewed.current.delete(clip.id);
    setClips(current => current.filter(item => item.id !== clip.id));
    setNotice('Highlight deleted.');
    setDeletingClipId('');
  }

  function handleVideoTap(clip) {
    const now = Date.now();
    const previous = lastTap.current;
    if (previous.clipId === clip.id && now - previous.at < 300) {
      if (!liked.has(clip.id)) toggleLike(clip.id);
      lastTap.current = { clipId: '', at: 0 };
      return;
    }
    lastTap.current = { clipId: clip.id, at: now };
  }

  function toggleSound(clipId) {
    const nextMuted = !muted;
    setMuted(nextMuted);
    const video = videoRefs.current.get(clipId);
    if (video) {
      video.muted = nextMuted;
      safePlay(video);
    }
  }

  if (loading) return <section className="sfPage sfEmpty"><div className="sfLoader" /><strong>Loading highlights…</strong></section>;

  if (!clips.length) return (
    <section className="sfPage sfEmpty">
      <div className="sfEmptyMark"><Radio size={30} /></div>
      <h2>Your LIVE highlights will appear here</h2>
      <p>After creators finish qualifying LIVEs, Droxion will publish the strongest short moments into this feed.</p>
      <button type="button" onClick={onStartLive}>Start a LIVE</button>
    </section>
  );

  return (
    <section className="sfPage" aria-label="Droxion highlight feed">
      {clips.map(clip => {
        const profile = profiles[clip.creator_id] || {};
        const live = liveCreators[clip.creator_id];
        const isLiked = liked.has(clip.id);
        const isFollowing = following.has(clip.creator_id);
        const isOwner = clip.creator_id === currentUserId;
        return (
          <article className="sfSlide" key={clip.id}>
            <video
              ref={node => { if (node) videoRefs.current.set(clip.id, node); else videoRefs.current.delete(clip.id); }}
              data-clip-id={clip.id}
              data-camera-facing={clip.camera_facing || 'user'}
              className="sfVideo"
              src={clip.video_url}
              poster={clip.thumbnail_url || undefined}
              autoPlay
              playsInline
              muted={muted}
              loop
              preload="auto"
              onCanPlay={event => safePlay(event.currentTarget)}
              onEnded={event => { try { event.currentTarget.currentTime = 0; } catch {}; safePlay(event.currentTarget); }}
              onStalled={event => window.setTimeout(() => safePlay(event.currentTarget), 250)}
              onWaiting={event => window.setTimeout(() => safePlay(event.currentTarget), 180)}
              onPointerUp={() => handleVideoTap(clip)}
            />
            <div className="sfShade" />
            <div className="sfTopLine">
              <span>LIVE HIGHLIGHT</span>
              <div className="sfTopActions">
                {live && <button type="button" className="sfLiveNow" onClick={() => onWatchLive?.(clip.creator_id)}><Radio size={14} /> LIVE NOW</button>}
                <button type="button" className="sfMoreButton" onClick={() => setActionClip(clip)} aria-label="Highlight options"><MoreVertical size={20} /></button>
              </div>
            </div>

            <div className="sfCreatorBlock">
              <div className="sfCreatorRow">
                {avatar(profile, 'sfCreatorAvatar')}
                <div><strong>{profile.display_name || profile.username || 'Droxion Creator'}</strong><span>{profile.username ? `@${profile.username}` : 'Droxion creator'}</span></div>
                {!isOwner && <button className={isFollowing ? 'following' : ''} type="button" onClick={() => toggleFollow(clip.creator_id)}>{isFollowing ? 'Following' : 'Follow'}</button>}
              </div>
              <p>{clip.caption || 'A highlight from LIVE on Droxion.'}</p>
              {live && <button className="sfWatchLive" type="button" onClick={() => onWatchLive?.(clip.creator_id)}><Radio size={15} /> Watch LIVE</button>}
            </div>

            <div className="sfRail">
              <button type="button" className={isLiked ? 'liked' : ''} onClick={() => toggleLike(clip.id)}><Heart size={28} fill={isLiked ? 'currentColor' : 'none'} /><span>{compactNumber(clip.likes_count)}</span></button>
              <button type="button" onClick={() => loadLikes(clip)} aria-label="See who liked this highlight"><span className="sfTinyLabel">Liked by</span></button>
              <button type="button" onClick={() => loadComments(clip)}><MessageCircle size={27} /><span>{compactNumber(clip.comments_count)}</span></button>
              <button type="button" onClick={() => shareClip(clip)}><Share2 size={27} /><span>{compactNumber(clip.shares_count)}</span></button>
              <button type="button" onClick={() => toggleSound(clip.id)}>{muted ? <VolumeX size={25} /> : <Volume2 size={25} />}<span>{muted ? 'Sound' : 'Mute'}</span></button>
            </div>

            <div className="sfViewCount">{compactNumber(clip.views_count)} views</div>
          </article>
        );
      })}

      {notice && <div className="sfNotice">{notice}</div>}

      {actionClip && <div className="sfActionBackdrop" onClick={() => setActionClip(null)}>
        <div className="sfActionSheet" onClick={event => event.stopPropagation()}>
          <div className="sfActionHandle" />
          <button type="button" onClick={() => shareClip(actionClip)}><Share2 size={20} /><span><strong>Share</strong><small>Send this Droxion highlight</small></span></button>
          <button type="button" onClick={() => downloadClip(actionClip)}><Download size={20} /><span><strong>Download video</strong><small>Save a copy to your device</small></span></button>
          {actionClip.creator_id === currentUserId && <button type="button" className="danger" disabled={deletingClipId === actionClip.id} onClick={() => deleteOwnClip(actionClip)}><Trash2 size={20} /><span><strong>Delete video</strong><small>Permanently remove your highlight</small></span></button>}
          <button type="button" className="cancel" onClick={() => setActionClip(null)}>Cancel</button>
        </div>
      </div>}

      {drawer && <div className="sfDrawerBackdrop" onClick={() => setDrawer(null)}>
        <div className="sfDrawer" onClick={event => event.stopPropagation()}>
          <div className="sfDrawerHead"><strong>{drawer.type === 'likes' ? 'Liked by' : 'Comments'}</strong><button type="button" onClick={() => setDrawer(null)}><X size={20} /></button></div>
          <div className="sfDrawerBody">
            {drawerLoading && <div className="sfDrawerEmpty">Loading…</div>}
            {!drawerLoading && drawerRows.length === 0 && <div className="sfDrawerEmpty">{drawer.type === 'likes' ? 'No likes yet.' : 'No comments yet.'}</div>}
            {!drawerLoading && drawerRows.map(row => <div className="sfPersonRow" key={drawer.type === 'likes' ? row.user_id : row.id}>
              {avatar(row.profile, 'sfListAvatar')}
              <div><strong>{row.profile?.display_name || row.profile?.username || 'Droxion user'}</strong>{drawer.type === 'comments' && <p>{row.body}</p>}</div>
              {drawer.type === 'likes' && row.user_id !== currentUserId && <UserPlus size={17} />}</div>)}
          </div>
          {drawer.type === 'comments' && <div className="sfCommentComposer"><input value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={500} placeholder="Add a comment…" onKeyDown={event => { if (event.key === 'Enter') sendComment(); }} /><button type="button" disabled={!commentDraft.trim()} onClick={sendComment}>Post</button></div>}
        </div>
      </div>}
    </section>
  );
}
