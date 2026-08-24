import { useEffect } from 'react';
import { supabase } from './supabaseClient';

function compactNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
}

function platform() {
  try {
    const value = window.Capacitor?.getPlatform?.();
    if (value === 'ios' || value === 'android') return value;
  } catch {}
  return '';
}

function clipFromArticle(article) {
  const video = article?.querySelector('video.sfVideo');
  const clipId = video?.dataset?.clipId || '';
  const videoUrl = video?.currentSrc || video?.src || '';
  const creator = article?.querySelector('.sfCreatorBlock strong')?.textContent?.trim() || 'Droxion creator';
  const caption = article?.querySelector('.sfCreatorBlock > p')?.textContent?.trim() || 'Watch this LIVE highlight on Droxion.';
  return clipId && videoUrl ? { clipId, videoUrl, creator, caption, article } : null;
}

function notice(message) {
  let node = document.querySelector('.sfPage .sfNativeNotice');
  if (!node) {
    node = document.createElement('div');
    node.className = 'sfNotice sfNativeNotice';
    document.querySelector('.sfPage')?.appendChild(node);
  }
  if (!node) return;
  node.textContent = message;
  window.clearTimeout(Number(node.dataset.timer || 0));
  const timer = window.setTimeout(() => node.remove(), 3200);
  node.dataset.timer = String(timer);
}

async function fetchClipFile(clip) {
  const response = await fetch(clip.videoUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load video file.');
  const blob = await response.blob();
  const type = blob.type || 'video/mp4';
  const extension = type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4';
  return {
    blob,
    extension,
    fileName: `droxion-highlight-${clip.clipId}.${extension}`,
    file: new File([blob], `droxion-highlight-${clip.clipId}.${extension}`, { type })
  };
}

async function recordShare(clipId, article) {
  const { data } = await supabase.rpc('droxion_record_clip_share', { p_clip_id: clipId });
  if (data == null) return;
  const railButtons = article?.querySelectorAll('.sfRail > button');
  const count = railButtons?.[3]?.querySelector('span');
  if (count) count.textContent = compactNumber(data);
}

async function shareClipNative(clip) {
  const url = `${window.location.origin}/#clip-${clip.clipId}`;
  const title = `${clip.creator} · LIVE Highlight`;
  let clipFile = null;
  try { clipFile = await fetchClipFile(clip); } catch {}

  try {
    if (clipFile && navigator.canShare?.({ files: [clipFile.file] }) && navigator.share) {
      await navigator.share({ title, text: clip.caption, files: [clipFile.file] });
    } else if (navigator.share) {
      await navigator.share({ title, text: clip.caption, url });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      notice('Highlight link copied.');
    } else {
      throw new Error('Share unavailable');
    }
    await recordShare(clip.clipId, clip.article);
  } catch (error) {
    if (error?.name !== 'AbortError') notice('Could not share this highlight.');
  }
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function saveClipNative(clip) {
  let clipFile;
  try {
    notice('Saving video…');
    clipFile = await fetchClipFile(clip);
  } catch {
    notice('Could not download this highlight.');
    return;
  }

  if (platform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const data = await blobToBase64(clipFile.blob);
      await Filesystem.writeFile({
        path: `Droxion/${clipFile.fileName}`,
        data,
        directory: Directory.Documents,
        recursive: true
      });
      notice(platform() === 'ios' ? 'Saved to Files on your iPhone.' : 'Saved to Documents on your phone.');
      return;
    } catch (error) {
      console.warn('Native file save failed', error);
    }

    try {
      if (navigator.canShare?.({ files: [clipFile.file] }) && navigator.share) {
        await navigator.share({ title: 'Save Droxion highlight', files: [clipFile.file] });
        notice('Choose Save Video or Save to Files.');
        return;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(clipFile.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = clipFile.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  notice('Video download started.');
}

export default function ShortNativeActionsEnhancer() {
  useEffect(() => {
    let activeClip = null;

    const handler = event => {
      const more = event.target.closest?.('.sfMoreButton');
      if (more) {
        activeClip = clipFromArticle(more.closest('.sfSlide'));
        return;
      }

      const railShare = event.target.closest?.('.sfRail > button:nth-child(4)');
      if (railShare) {
        const clip = clipFromArticle(railShare.closest('.sfSlide'));
        if (!clip) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        shareClipNative(clip);
        return;
      }

      const actionButton = event.target.closest?.('.sfActionSheet > button');
      if (!actionButton || !activeClip) return;
      const text = actionButton.textContent || '';
      const isShare = text.includes('Share') && text.includes('Send this Droxion highlight');
      const isDownload = text.includes('Download video') || text.includes('Save a copy to your device');
      if (!isShare && !isDownload) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      document.querySelector('.sfActionBackdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      if (isShare) shareClipNative(activeClip);
      else saveClipNative(activeClip);
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return null;
}
