import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoaderCircle, Plus } from 'lucide-react';
import { supabase } from './supabaseClient';
import './profile-avatar.css';

const BUCKET = 'droxion-avatars';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFor(file) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function ownedPath(url, userId) {
  if (!url || !userId) return '';
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return '';
  const path = decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
  return path.startsWith(`${userId}/`) ? path : '';
}

function PlusBadge({ uploading }) {
  return uploading ? <LoaderCircle size={16} className="lpAvatarSpinner" /> : <Plus size={17} strokeWidth={3} />;
}

export default function ProfileAvatarEnhancer() {
  useEffect(() => {
    let cleanupCurrent = null;
    let observer = null;

    async function wireAvatar() {
      const wrap = document.querySelector('.lpHero .lpAvatarWrap');
      if (!wrap || wrap.dataset.avatarEditable === 'true') return;

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId || !document.body.contains(wrap)) return;

      wrap.dataset.avatarEditable = 'true';
      wrap.setAttribute('role', 'button');
      wrap.setAttribute('tabindex', '0');
      wrap.setAttribute('aria-label', 'Change profile photo');
      wrap.classList.add('lpAvatarEditable');

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.className = 'lpAvatarNativeInput';
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;

      const badge = document.createElement('span');
      badge.className = 'lpAvatarPlusBadge';
      badge.setAttribute('aria-hidden', 'true');
      wrap.appendChild(badge);
      wrap.appendChild(input);
      const badgeRoot = createRoot(badge);
      badgeRoot.render(<PlusBadge uploading={false} />);

      function openPicker(event) {
        if (event?.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event?.preventDefault?.();
        if (!wrap.classList.contains('uploading')) input.click();
      }

      async function onFile(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!ALLOWED.has(file.type)) {
          window.alert('Choose a JPG, PNG or WebP profile photo.');
          return;
        }
        if (file.size > MAX_BYTES) {
          window.alert('Profile photo must be 5 MB or smaller.');
          return;
        }

        wrap.classList.add('uploading');
        badgeRoot.render(<PlusBadge uploading />);

        const oldImage = wrap.querySelector('img');
        const oldUrl = oldImage?.src || '';
        const oldPath = ownedPath(oldUrl, userId);
        const path = `${userId}/avatar-${Date.now()}.${extensionFor(file)}`;

        try {
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: false
          });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          const avatarUrl = publicData?.publicUrl;
          if (!avatarUrl) throw new Error('Could not create profile photo URL.');

          const { error: updateError } = await supabase
            .from('droxion_profiles')
            .update({ avatar_url: avatarUrl })
            .eq('user_id', userId);
          if (updateError) throw updateError;

          const fallback = wrap.querySelector('.lpAvatarFallback');
          let image = wrap.querySelector('img');
          if (!image) {
            image = document.createElement('img');
            image.alt = 'Profile';
            if (fallback) fallback.replaceWith(image); else wrap.insertBefore(image, wrap.firstChild);
          }
          image.src = `${avatarUrl}?v=${Date.now()}`;

          if (oldPath && oldPath !== path) {
            supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {});
          }
        } catch (error) {
          supabase.storage.from(BUCKET).remove([path]).catch(() => {});
          window.alert(error?.message || 'Could not update profile photo.');
        } finally {
          wrap.classList.remove('uploading');
          badgeRoot.render(<PlusBadge uploading={false} />);
        }
      }

      wrap.addEventListener('click', openPicker);
      wrap.addEventListener('keydown', openPicker);
      input.addEventListener('change', onFile);

      cleanupCurrent = () => {
        wrap.removeEventListener('click', openPicker);
        wrap.removeEventListener('keydown', openPicker);
        input.removeEventListener('change', onFile);
        badgeRoot.unmount();
        input.remove();
        badge.remove();
        delete wrap.dataset.avatarEditable;
        wrap.classList.remove('lpAvatarEditable', 'uploading');
        wrap.removeAttribute('role');
        wrap.removeAttribute('tabindex');
        wrap.removeAttribute('aria-label');
      };
    }

    wireAvatar();
    observer = new MutationObserver(() => {
      const active = document.querySelector('.lpHero .lpAvatarWrap');
      if (!active && cleanupCurrent) {
        cleanupCurrent();
        cleanupCurrent = null;
      }
      wireAvatar();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      cleanupCurrent?.();
    };
  }, []);

  return null;
}
