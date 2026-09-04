import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, Info, Play } from 'lucide-react';
import { supabase } from './supabaseClient';
import './profile-content-tabs-enhancer.css';

function tabId(button) {
  const label = String(button?.textContent || '').trim().toLowerCase();
  if (label.startsWith('live replay')) return 'replays';
  if (label === 'about') return 'about';
  return 'reels';
}

function formatReplayDate(value) {
  if (!value) return 'Completed LIVE';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Completed LIVE';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfileContentTabsEnhancer() {
  const [portalHost, setPortalHost] = useState(null);
  const [activeTab, setActiveTab] = useState('reels');
  const [profile, setProfile] = useState(null);
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const ensureHost = () => {
      const tabs = document.querySelector('.creatorProfileContentTabs');
      if (!(tabs instanceof HTMLElement)) {
        setPortalHost(current => current?.isConnected ? current : null);
        return;
      }

      let host = tabs.nextElementSibling;
      if (!(host instanceof HTMLElement) || !host.classList.contains('profileTabsEnhancerHost')) {
        host = document.createElement('div');
        host.className = 'profileTabsEnhancerHost';
        tabs.insertAdjacentElement('afterend', host);
      }
      setPortalHost(current => current === host ? current : host);
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleClick = event => {
      const button = event.target?.closest?.('.creatorProfileContentTabs button');
      if (!(button instanceof HTMLButtonElement)) return;
      setActiveTab(tabId(button));
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    const syncVisibility = () => {
      const tabs = document.querySelector('.creatorProfileContentTabs');
      if (!(tabs instanceof HTMLElement)) return;

      const buttons = Array.from(tabs.querySelectorAll('button'));
      buttons.forEach(button => {
        const id = tabId(button);
        const selected = id === activeTab;
        button.classList.toggle('active', selected);
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
      });

      const container = tabs.parentElement;
      if (container) {
        container.querySelectorAll('.creatorProfileClipsTitle, .profileClipsGrid, .profileClipsEmpty, .profileClipsNotice').forEach(node => {
          if (node instanceof HTMLElement) node.hidden = activeTab !== 'reels';
        });
      }

      const host = tabs.nextElementSibling;
      if (host instanceof HTMLElement && host.classList.contains('profileTabsEnhancerHost')) {
        host.hidden = activeTab === 'reels';
      }
    };

    syncVisibility();
    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reels') return undefined;
    let alive = true;

    (async () => {
      setLoading(true);
      setErrorText('');
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const userId = authData?.user?.id;
        if (!userId) throw new Error('Sign in to view your profile details.');

        const profilePromise = supabase
          .from('droxion_profiles')
          .select('display_name,username,bio,country,language')
          .eq('user_id', userId)
          .maybeSingle();

        const replayPromise = activeTab === 'replays'
          ? supabase
              .from('droxion_live_clips')
              .select('id,session_id,video_url,thumbnail_url,caption,duration_seconds,published_at,created_at')
              .eq('creator_id', userId)
              .eq('status', 'ready')
              .eq('clip_type', 'auto')
              .order('published_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .limit(60)
          : Promise.resolve({ data: [], error: null });

        const [profileResult, replayResult] = await Promise.all([profilePromise, replayPromise]);
        if (profileResult.error) throw profileResult.error;
        if (replayResult.error) throw replayResult.error;
        if (!alive) return;
        setProfile(profileResult.data || null);
        if (activeTab === 'replays') setReplays(replayResult.data || []);
      } catch (error) {
        if (alive) setErrorText(error?.message || 'Could not load this profile section.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [activeTab]);

  if (!portalHost || activeTab === 'reels') return null;

  return createPortal(
    activeTab === 'replays' ? (
      <section className="profileEnhancedPanel" aria-label="Live replays">
        <div className="profileEnhancedHeading"><Clock3 size={19} /><div><strong>LIVE replays</strong><span>One saved replay highlight from each completed LIVE.</span></div></div>
        {loading && <div className="profileEnhancedState">Loading LIVE replays…</div>}
        {!loading && errorText && <div className="profileEnhancedState error">{errorText}</div>}
        {!loading && !errorText && replays.length === 0 && <div className="profileEnhancedState"><Play size={22} /><strong>No LIVE replays yet</strong><span>Finish a qualifying LIVE and its saved replay highlight will appear here.</span></div>}
        {!loading && !errorText && replays.length > 0 && (
          <div className="profileReplayGrid">
            {replays.map(replay => (
              <article className="profileReplayCard" key={replay.id}>
                <video src={replay.video_url} poster={replay.thumbnail_url || undefined} controls playsInline preload="metadata" />
                <div><strong>{replay.caption || 'LIVE replay highlight'}</strong><span>{formatReplayDate(replay.published_at || replay.created_at)}{replay.duration_seconds ? ` · ${replay.duration_seconds}s` : ''}</span></div>
              </article>
            ))}
          </div>
        )}
      </section>
    ) : (
      <section className="profileEnhancedPanel" aria-label="About profile">
        <div className="profileEnhancedHeading"><Info size={19} /><div><strong>About</strong><span>Your public creator details.</span></div></div>
        {loading && <div className="profileEnhancedState">Loading profile…</div>}
        {!loading && errorText && <div className="profileEnhancedState error">{errorText}</div>}
        {!loading && !errorText && (
          <div className="profileAboutCard">
            <h3>{profile?.display_name || profile?.username || 'Droxion Creator'}</h3>
            <p>{profile?.bio || 'No bio added yet. Use Edit profile to tell viewers about yourself.'}</p>
            <dl>
              <div><dt>Username</dt><dd>{profile?.username ? `@${profile.username}` : 'Not set'}</dd></div>
              <div><dt>Country</dt><dd>{profile?.country || 'Not set'}</dd></div>
              <div><dt>Language</dt><dd>{profile?.language || 'Not set'}</dd></div>
            </dl>
          </div>
        )}
      </section>
    ),
    portalHost
  );
}
