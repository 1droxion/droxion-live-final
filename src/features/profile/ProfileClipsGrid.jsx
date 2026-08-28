import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, Heart, Play, Share2, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './profile-clips-grid.css';

function compact(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(1).replace('.0', '')}M`;
}

export default function ProfileClipsGrid({ currentUserId }) {
  const [clips, setClips] = useState([]);
  const [activeClip, setActiveClip] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!currentUserId) return setClips([]);
    const { data, error } = await supabase
      .from('droxion_live_clips')
      .select('id,creator_id,video_url,thumbnail_url,caption,duration_seconds,views_count,likes_count,comments_count,shares_count,published_at,created_at,status,storage_path,clip_type')
      .eq('creator_id', currentUserId)
      .eq('status', 'ready')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) {
      setNotice(error.message || 'Could not load clips.');
      return;
    }
    setClips(data || []);
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const channel = supabase
      .channel(`profile-clips-grid:${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'droxion_live_clips', filter: `creator_id=eq.${currentUserId}` }, load)
      .subscribe();
    return () => { try { Promise.resolve(supabase.removeChannel(channel)).catch(() => {}); } catch {} };
  }, [currentUserId, load]);

  async function shareClip(clip) {
    const url = `${window.location.origin}/?clip=${clip.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Droxion LIVE Highlight', text: clip.caption || 'Watch my LIVE highlight on Droxion.', url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setNotice('Clip link copied.'); }
    } catch (error) {
      if (error?.name !== 'AbortError') setNotice('Could not share this clip.');
    }
  }

  async function downloadClip(clip) {
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
    if (!clip?.id || busyId || !window.confirm('Delete this LIVE clip permanently?')) return;
    setBusyId(clip.id);
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
      setActiveClip(null);
      setClips(current => current.filter(item => item.id !== clip.id));
    } catch (error) {
      setNotice(error?.message || 'Could not delete this clip.');
    } finally {
      setBusyId('');
    }
  }

  if (!clips.length) return <div className="profileClipsEmpty"><Play size={24} /><strong>No LIVE clips yet</strong><span>End a LIVE after at least 30–60 seconds and your best moments will appear here.</span></div>;

  return (
    <>
      {notice && <div className="profileClipsNotice">{notice}</div>}
      <div className="profileClipsGrid">
        {clips.map(clip => (
          <button type="button" className="profileClipTile" key={clip.id} onClick={() => setActiveClip(clip)}>
            <video src={clip.video_url} poster={clip.thumbnail_url || undefined} preload="metadata" muted playsInline />
            <span className="profileClipShade" />
            <span className="profileClipPlay"><Play size={20} fill="currentColor" /></span>
            <span className="profileClipViews"><Eye size={13} /> {compact(clip.views_count)}</span>
            {clip.clip_type === 'auto' && <b>AUTO</b>}
          </button>
        ))}
      </div>

      {activeClip && (
        <div className="profileClipViewer" role="dialog" aria-modal="true" aria-label="LIVE clip">
          <video src={activeClip.video_url} autoPlay controls playsInline loop />
          <button className="profileClipClose" type="button" onClick={() => setActiveClip(null)} aria-label="Close clip"><X size={22} /></button>
          <div className="profileClipViewerInfo">
            <strong>{activeClip.caption || 'From LIVE on Droxion'}</strong>
            <span><Eye size={14} /> {compact(activeClip.views_count)} <Heart size={14} /> {compact(activeClip.likes_count)}</span>
            <div>
              <button type="button" onClick={() => shareClip(activeClip)}><Share2 size={17} /> Share</button>
              <button type="button" onClick={() => downloadClip(activeClip)}><Download size={17} /> Save</button>
              <button type="button" className="danger" disabled={busyId === activeClip.id} onClick={() => deleteClip(activeClip)}><Trash2 size={17} /> {busyId === activeClip.id ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
