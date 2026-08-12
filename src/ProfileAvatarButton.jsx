import { useRef, useState } from 'react';
import { BadgeCheck, LoaderCircle, Plus } from 'lucide-react';
import { supabase } from './supabaseClient';
import './profile-avatar.css';

const AVATAR_BUCKET = 'droxion-avatars';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFor(file) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function ownedAvatarPath(url, userId) {
  if (!url || !userId) return '';
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return '';
  const path = decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : '';
}

export default function ProfileAvatarButton({ userId, profile, creatorStatus, onChanged, onNotice }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  function chooseImage() {
    if (!uploading) inputRef.current?.click();
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId || uploading) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      onNotice?.('Choose a JPG, PNG or WebP profile photo.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onNotice?.('Profile photo must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    onNotice?.('Uploading profile photo…');

    const extension = extensionFor(file);
    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const oldPath = ownedAvatarPath(profile?.avatar_url, userId);

    try {
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = publicData?.publicUrl;
      if (!avatarUrl) throw new Error('Could not create profile photo URL.');

      const { error: profileError } = await supabase
        .from('droxion_profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userId);
      if (profileError) throw profileError;

      onChanged?.(avatarUrl);
      onNotice?.('Profile photo updated.');

      if (oldPath && oldPath !== path) {
        supabase.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => {});
      }
    } catch (error) {
      onNotice?.(error?.message || 'Could not update profile photo.');
      supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
    } finally {
      setUploading(false);
    }
  }

  const initial = (profile?.display_name || profile?.username || 'D')[0]?.toUpperCase() || 'D';

  return (
    <div className="lpAvatarControl">
      <button
        type="button"
        className={`lpAvatarEdit ${uploading ? 'uploading' : ''}`}
        onClick={chooseImage}
        aria-label={profile?.avatar_url ? 'Change profile photo' : 'Add profile photo'}
        disabled={uploading}
      >
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="Profile" />
          : <span className="lpAvatarEditFallback">{initial}</span>}
        <span className="lpAvatarPlus" aria-hidden="true">
          {uploading ? <LoaderCircle size={16} className="lpAvatarSpinner" /> : <Plus size={17} strokeWidth={3} />}
        </span>
        {creatorStatus === 'approved' && <span className="lpAvatarVerified" aria-label="Verified creator"><BadgeCheck size={18} /></span>}
      </button>
      <input
        ref={inputRef}
        className="lpAvatarInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImageChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="lpAvatarHint">Tap photo to change</span>
    </div>
  );
}
