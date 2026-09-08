import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Plus, Radio, Trash2, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import './droxion-multistream.css';

const PLATFORMS = [
  ['youtube', 'YouTube'],
  ['facebook', 'Facebook'],
  ['twitch', 'Twitch'],
  ['kick', 'Kick'],
  ['tiktok', 'TikTok'],
  ['custom', 'Custom RTMP'],
];

async function invokeMultistream(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sign in to use multistream.');
  const { data, error } = await supabase.functions.invoke('livekit-multistream', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(data?.error || error.message || 'Multistream request failed.');
  if (data?.error) throw new Error(data.error);
  return data || {};
}

function platformName(value) {
  return PLATFORMS.find(([id]) => id === value)?.[1] || 'Custom RTMP';
}

export default function DroxionMultistream() {
  const [hostVisible, setHostVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ platform: 'youtube', label: '', rtmpUrl: '' });
  const lastStartedSessionRef = useRef('');
  const stopInFlightRef = useRef(false);

  const enabledCount = useMemo(() => destinations.filter(item => item.enabled).length, [destinations]);

  const refresh = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const data = await invokeMultistream({ action: 'list' });
      setDestinations(Array.isArray(data.destinations) ? data.destinations : []);
      setSession(data.session || null);
      return data;
    } catch (error) {
      if (!quiet) setNotice(error?.message || 'Could not load multistream settings.');
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncHostVisibility = () => setHostVisible(Boolean(document.querySelector('.prodLiveHost')));
    syncHostVisibility();
    const observer = new MutationObserver(syncHostVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hostVisible) {
      setOpen(false);
      return;
    }
    refresh(true);
  }, [hostVisible, refresh]);

  useEffect(() => {
    if (!hostVisible) return undefined;
    let cancelled = false;

    const reconcile = async () => {
      try {
        const { data: context, error } = await supabase.rpc('droxion_current_live_context');
        if (cancelled || error) return;
        const activeHostSession = context?.active && context?.is_host === true && context?.session_id
          ? String(context.session_id)
          : '';
        const state = await refresh(true);
        if (cancelled || !state) return;
        const enabled = (state.destinations || []).filter(item => item.enabled).length;
        const activeMultistream = state.session && ['starting', 'active', 'stopping'].includes(state.session.status);

        if (activeHostSession && enabled > 0 && !activeMultistream && lastStartedSessionRef.current !== activeHostSession) {
          lastStartedSessionRef.current = activeHostSession;
          setNotice('Starting your LIVE everywhere…');
          try {
            const started = await invokeMultistream({ action: 'start', sessionId: activeHostSession });
            if (cancelled) return;
            setSession(started.session || null);
            setNotice(`LIVE is streaming to ${enabled} destination${enabled === 1 ? '' : 's'}.`);
          } catch (startError) {
            lastStartedSessionRef.current = '';
            if (!cancelled) setNotice(startError?.message || 'Could not start external streams.');
          }
          return;
        }

        if (!activeHostSession && activeMultistream && !stopInFlightRef.current) {
          stopInFlightRef.current = true;
          try {
            await invokeMultistream({ action: 'stop' });
            if (!cancelled) {
              setSession(null);
              setNotice('External streams stopped.');
            }
          } finally {
            stopInFlightRef.current = false;
            lastStartedSessionRef.current = '';
          }
        }
      } catch {}
    };

    reconcile();
    const timer = window.setInterval(reconcile, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hostVisible, refresh]);

  async function saveDestination(event) {
    event.preventDefault();
    const rtmpUrl = form.rtmpUrl.trim();
    if (!rtmpUrl) {
      setNotice('Paste the RTMP/RTMPS server URL with your stream key.');
      return;
    }
    setLoading(true);
    setNotice('Saving destination…');
    try {
      const data = await invokeMultistream({
        action: 'upsert',
        platform: form.platform,
        label: form.label.trim(),
        rtmpUrl,
        enabled: true,
      });
      setDestinations(data.destinations || []);
      setForm(current => ({ ...current, label: '', rtmpUrl: '' }));
      setNotice(`${platformName(form.platform)} saved securely.`);
    } catch (error) {
      setNotice(error?.message || 'Could not save destination.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleDestination(item) {
    setLoading(true);
    try {
      const data = await invokeMultistream({
        action: 'upsert',
        id: item.id,
        platform: item.platform,
        label: item.label,
        enabled: !item.enabled,
      });
      setDestinations(data.destinations || []);
      setNotice(`${platformName(item.platform)} ${item.enabled ? 'disabled' : 'enabled'}.`);
    } catch (error) {
      setNotice(error?.message || 'Could not update destination.');
    } finally {
      setLoading(false);
    }
  }

  async function removeDestination(item) {
    if (!window.confirm(`Remove ${platformName(item.platform)} from multistream?`)) return;
    setLoading(true);
    try {
      const data = await invokeMultistream({ action: 'delete', id: item.id });
      setDestinations(data.destinations || []);
      setNotice('Destination removed.');
    } catch (error) {
      setNotice(error?.message || 'Could not remove destination.');
    } finally {
      setLoading(false);
    }
  }

  if (!hostVisible) return null;

  const active = session && ['starting', 'active', 'stopping'].includes(session.status);

  return (
    <>
      <button
        type="button"
        className={`droxionMultistreamLauncher ${active ? 'isLive' : ''}`}
        onClick={() => { setOpen(true); refresh(); }}
        aria-label="Open multistream destinations"
      >
        <Globe2 size={18} />
        <span>{active ? 'LIVE everywhere' : 'Go LIVE everywhere'}</span>
        {enabledCount > 0 && <b>{enabledCount}</b>}
      </button>

      {open && <div className="droxionMultistreamBackdrop" onClick={() => setOpen(false)}>
        <section className="droxionMultistreamPanel" onClick={event => event.stopPropagation()} aria-label="Droxion multistream setup">
          <header>
            <div><Globe2 size={24} /><span><strong>Go LIVE everywhere</strong><small>One Droxion LIVE → your channels</small></span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={22} /></button>
          </header>

          <div className={`droxionMultistreamStatus ${active ? 'isLive' : ''}`}>
            <Radio size={18} />
            <span><strong>{active ? 'Multistream active' : `${enabledCount} destination${enabledCount === 1 ? '' : 's'} ready`}</strong><small>{active ? `Sending to ${session.destination_count || enabledCount} destination(s)` : 'Enabled destinations start automatically when you go LIVE.'}</small></span>
          </div>

          <div className="droxionMultistreamList">
            {destinations.length === 0 && <div className="droxionMultistreamEmpty"><Globe2 size={28} /><strong>Add your first channel</strong><span>Get the RTMP server + stream key from the platform, combine them into one RTMP/RTMPS URL, and save it here.</span></div>}
            {destinations.map(item => <article key={item.id}>
              <div><strong>{platformName(item.platform)}{item.label ? ` · ${item.label}` : ''}</strong><small>{item.maskedUrl}</small></div>
              <button type="button" className={item.enabled ? 'enabled' : ''} onClick={() => toggleDestination(item)} disabled={loading}>{item.enabled ? 'ON' : 'OFF'}</button>
              <button type="button" className="remove" onClick={() => removeDestination(item)} disabled={loading} aria-label="Remove destination"><Trash2 size={17} /></button>
            </article>)}
          </div>

          <form onSubmit={saveDestination}>
            <div className="droxionMultistreamFormTitle"><Plus size={17} /><strong>Add destination</strong></div>
            <label><span>Platform</span><select value={form.platform} onChange={event => setForm(current => ({ ...current, platform: event.target.value }))}>{PLATFORMS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label><span>Label <small>optional</small></span><input value={form.label} onChange={event => setForm(current => ({ ...current, label: event.target.value }))} maxLength={64} placeholder="Main channel" /></label>
            <label><span>RTMP / RTMPS URL</span><input type="password" autoComplete="off" value={form.rtmpUrl} onChange={event => setForm(current => ({ ...current, rtmpUrl: event.target.value }))} placeholder="rtmps://server/live/your-stream-key" /></label>
            <small className="droxionMultistreamHelp">Your stream URL is stored server-side and is never returned to the app after saving.</small>
            <button type="submit" disabled={loading}><Plus size={17} /> {loading ? 'Saving…' : 'Add channel'}</button>
          </form>

          {notice && <div className="droxionMultistreamNotice">{notice}</div>}
        </section>
      </div>}
    </>
  );
}
