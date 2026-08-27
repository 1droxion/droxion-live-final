import { useCallback, useEffect, useState } from 'react';
import { Download, Film, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './creator-live-clips.css';

function formatDuration(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function formatCount(value) {
  const count = Number(value || 0);
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(count / 1_000_000).toFixed(1).replace('.0', '')}M`;
}

export default function CreatorLiveClips({ currentUserId }) {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  const loadClips = useCallback(async ({ quiet = false } = {}) => {
    if (!currentUserId) {
      setClips([]);
      setLoading(false);
      return;
    }
    if (!quiet) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('droxion_live_clips')
        .select('id,creator_id,session_id,video_url,thumbnail_url,caption,duration_seconds,views_count,likes_count,comments_count,shares_count,published_at,created_at,highlight_score,status,storage_path,clip_type,camera_facing')
        .eq('creator_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setClips(Array.isArray(data) ? data : []);
      setNotice('');
    } catch (error) {
      setNotice(error?.message || 'Could not load your LIVE clips.');
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    setLoading(true);
    loadClips({ quiet: true });
  }, [loadClips]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const channel = supabase
      .channel(`creator-clips:${currentUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'droxion_live_clips',
        filter: `creator_id=eq.${currentUserId}`
      }, () => loadClips({ quiet: true }))
      .subscribe();
    return () => {
      try { Promise.resolve(supabase.removeChannel(channel)).catch(() => {}); } catch {}
    };
  }, [currentUserId, loadClips]);

  async function shareClip(clip) {
    const shareData = {
      title: 'Droxion LIVE Highlight',
      text: clip.caption || 'Watch my LIVE highlight on Droxion.',
      url: `${window.location.origin}/?clip=${clip.id}`
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        setNotice('Clip link copied.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice('Could not share this clip.');
    }
  }

  async function downloadClip(clip) {
    if (!clip?.video_url) return;
    try {
      const response = await fetch(clip.video_url);
      if (!response.ok) throw new Error('download');
      const blob = await response.blob();
      const extension = String(blob.type || '').includes('webm') ? 'webm' : 'mp4';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `droxion-live-clip-${clip.id}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      window.open(clip.video_url, '_blank', 'noopener,noreferrer');
    }
  }

  async function deleteClip(clip) {
    if (!clip?.id || busyId) return;
    if (!window.confirm('Delete this LIVE clip permanently?')) return;
    setBusyId(clip.id);
    setNotice('');
    try {
      const { data: prepared, error: prepareError } = await supabase.rpc('droxion_prepare_clip_delete', { p_clip_id: clip.id });
      if (prepareError) throw prepareError;
      const storagePath = prepared?.storage_path || clip.storage_path;
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from('droxion-live-clips').remove([storagePath]);
        if (storageError) {
          await supabase.rpc('droxion_set_clip_visibility', { p_clip_id: clip.id, p_hidden: false });
          throw storageError;
        }
      }
      const { error: finalizeError } = await supabase.rpc('droxion_finalize_clip_delete', { p_clip_id: clip.id });
      if (finalizeError) throw finalizeError;
      setClips(current => current.filter(item => item.id !== clip.id));
      setNotice('Clip deleted.');
    } catch (error) {
      setNotice(error?.message || 'Could not delete this clip.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="creatorClipsPanel" aria-label="My LIVE Clips">
      <div className="creatorClipsHead">
        <div>
          <span className="creatorClipsIcon"><Film size={18} /></span>
          <div><strong>My LIVE Clips</strong><small>Best moments are cut automatically after LIVE.</small></div>
        </div>
        <button type="button" onClick={() => loadClips()} disabled={refreshing} aria-label="Refresh clips"><RefreshCw size={17} /></button>
      </div>

      {notice && <div className="creatorClipsNotice">{notice}</div>}

      {loading ? (
        <div className="creatorClipsEmpty">Loading your clips…</div>
      ) : clips.length === 0 ? (
        <div className="creatorClipsEmpty"><strong>No LIVE clips yet</strong><span>Go LIVE for at least 15–30 seconds. After you end, Droxion will process up to 2 highlights here and in Feed.</span></div>
      ) : (
        <div className="creatorClipsGrid">
          {clips.map(clip => (
            <article className="creatorClipCard" key={clip.id}>
              <div className="creatorClipMedia">
                <video src={clip.video_url} poster={clip.thumbnail_url || undefined} preload="metadata" playsInline controls />
                <span>{formatDuration(clip.duration_seconds)}</span>
                {clip.clip_type === 'auto' && <b>AUTO</b>}
              </div>
              <div className="creatorClipInfo">
                <strong>{clip.caption || 'From LIVE on Droxion'}</strong>
                <small>{formatCount(clip.views_count)} views · {formatCount(clip.likes_count)} likes · {formatCount(clip.comments_count)} comments</small>
                <div className="creatorClipActions">
                  <button type="button" onClick={() => shareClip(clip)}><Share2 size={16} /> Share</button>
                  <button type="button" onClick={() => downloadClip(clip)}><Download size={16} /> Save</button>
                  <button type="button" className="danger" disabled={busyId === clip.id} onClick={() => deleteClip(clip)}><Trash2 size={16} /> {busyId === clip.id ? 'Deleting…' : 'Delete'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
