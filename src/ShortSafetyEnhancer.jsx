import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const REASONS = [
  ['sexual_content', 'Sexual content'],
  ['harassment', 'Harassment or bullying'],
  ['hate_or_threats', 'Hate or threats'],
  ['violence_or_danger', 'Violence or dangerous behavior'],
  ['underage', 'Underage concern'],
  ['spam_or_scam', 'Spam or scam'],
  ['illegal_activity', 'Illegal activity'],
  ['other', 'Other']
];

function clipIdFromSlide(slide) {
  return slide?.querySelector?.('video.sfVideo')?.dataset?.clipId || '';
}

function notice(message) {
  let node = document.querySelector('.sfPage .sfSafetyNotice');
  if (!node) {
    node = document.createElement('div');
    node.className = 'sfNotice sfSafetyNotice';
    document.querySelector('.sfPage')?.appendChild(node);
  }
  if (!node) return;
  node.textContent = message;
  window.clearTimeout(Number(node.dataset.timer || 0));
  node.dataset.timer = String(window.setTimeout(() => node.remove(), 3800));
}

export default function ShortSafetyEnhancer() {
  const activeClipId = useRef('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('harassment');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const blockedCreatorIds = useRef(new Set());
  const blockedClipIds = useRef(new Set());

  async function loadClip(clipId) {
    if (!clipId) throw new Error('Highlight is unavailable.');
    const { data, error } = await supabase
      .from('droxion_live_clips')
      .select('id,creator_id,session_id')
      .eq('id', clipId)
      .maybeSingle();
    if (error || !data?.creator_id) throw error || new Error('Highlight is unavailable.');
    return data;
  }

  function applyBlockedHiding() {
    document.querySelectorAll('.sfSlide').forEach(slide => {
      const clipId = clipIdFromSlide(slide);
      if (clipId && blockedClipIds.current.has(clipId)) {
        slide.style.setProperty('display', 'none', 'important');
        slide.setAttribute('aria-hidden', 'true');
      }
    });
  }

  useEffect(() => {
    let observer = null;

    const enhanceSheet = () => {
      const sheet = document.querySelector('.sfActionSheet');
      if (!sheet || sheet.querySelector('[data-droxion-safety-action]')) return;
      const cancel = sheet.querySelector('button.cancel');
      if (!cancel) return;

      const report = document.createElement('button');
      report.type = 'button';
      report.dataset.droxionSafetyAction = 'report';
      report.innerHTML = '<span aria-hidden="true" style="font-size:20px">⚑</span><span><strong>Report</strong><small>Flag objectionable content</small></span>';

      const block = document.createElement('button');
      block.type = 'button';
      block.dataset.droxionSafetyAction = 'block';
      block.className = 'danger';
      block.innerHTML = '<span aria-hidden="true" style="font-size:20px">⊘</span><span><strong>Block User</strong><small>Hide this user and notify Droxion</small></span>';

      sheet.insertBefore(report, cancel);
      sheet.insertBefore(block, cancel);
    };

    const onClick = async event => {
      const more = event.target.closest?.('.sfMoreButton');
      if (more) {
        activeClipId.current = clipIdFromSlide(more.closest('.sfSlide'));
        window.setTimeout(enhanceSheet, 0);
        return;
      }

      const action = event.target.closest?.('[data-droxion-safety-action]');
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const type = action.dataset.droxionSafetyAction;
      document.querySelector('.sfActionBackdrop')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      if (type === 'report') {
        setReason('harassment');
        setDetails('');
        setReportOpen(true);
        return;
      }

      if (type === 'block') {
        if (busy) return;
        try {
          setBusy(true);
          const clip = await loadClip(activeClipId.current);
          const confirmed = window.confirm('Block this creator? Their content will be removed from your feed immediately and Droxion moderation will be notified.');
          if (!confirmed) return;

          const { data, error } = await supabase.rpc('droxion_block_user', {
            p_blocked_user_id: clip.creator_id,
            p_context_type: 'clip',
            p_context_id: clip.id,
            p_session_id: clip.session_id
          });
          if (error || data?.ok === false) throw error || new Error('Could not block user.');

          blockedCreatorIds.current.add(clip.creator_id);
          const { data: creatorClips } = await supabase
            .from('droxion_live_clips')
            .select('id')
            .eq('creator_id', clip.creator_id);
          (creatorClips || []).forEach(row => blockedClipIds.current.add(row.id));
          applyBlockedHiding();
          window.dispatchEvent(new CustomEvent('droxion:user-blocked', { detail: { userId: clip.creator_id } }));
          notice('User blocked. Their content was removed from your feed and Droxion was notified.');
        } catch (error) {
          notice(error?.message || 'Could not block user.');
        } finally {
          setBusy(false);
        }
      }
    };

    document.addEventListener('click', onClick, true);
    observer = new MutationObserver(() => {
      enhanceSheet();
      applyBlockedHiding();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('click', onClick, true);
      observer?.disconnect();
    };
  }, [busy]);

  async function submitReport() {
    if (busy || !activeClipId.current) return;
    setBusy(true);
    try {
      const clip = await loadClip(activeClipId.current);
      const { data, error } = await supabase.rpc('droxion_submit_report', {
        p_reported_user_id: clip.creator_id,
        p_category: reason,
        p_details: details.trim() || null,
        p_target_type: 'clip',
        p_target_id: clip.id,
        p_session_id: clip.session_id
      });
      if (error || data?.ok === false) throw error || new Error('Could not submit report.');
      setReportOpen(false);
      setDetails('');
      notice('Report submitted. Droxion moderation will review it within the safety process.');
    } catch (error) {
      notice(error?.message || 'Could not submit report.');
    } finally {
      setBusy(false);
    }
  }

  if (!reportOpen) return null;

  return (
    <div className="sfActionBackdrop" style={{ zIndex: 3000 }} onClick={() => !busy && setReportOpen(false)}>
      <div className="sfActionSheet" onClick={event => event.stopPropagation()} style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}>
        <div className="sfActionHandle" />
        <div style={{ padding: '4px 16px 12px' }}>
          <strong style={{ display: 'block', fontSize: 18, marginBottom: 4 }}>Report objectionable content</strong>
          <small style={{ color: '#a7a3b2' }}>Choose the reason. Reports are sent to Droxion moderation.</small>
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <select value={reason} onChange={event => setReason(event.target.value)} style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#191922', color: '#fff', padding: '0 12px' }}>
            {REASONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} placeholder="Optional details" style={{ width: '100%', minHeight: 84, marginTop: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#191922', color: '#fff', padding: 12, resize: 'vertical' }} />
          <button type="button" onClick={submitReport} disabled={busy} style={{ width: '100%', height: 48, marginTop: 10, border: 0, borderRadius: 12, background: '#9333ea', color: '#fff', fontWeight: 900 }}>{busy ? 'Submitting…' : 'Submit Report'}</button>
          <button type="button" onClick={() => setReportOpen(false)} disabled={busy} style={{ width: '100%', height: 46, marginTop: 8, border: '1px solid rgba(255,255,255,.10)', borderRadius: 12, background: '#20202a', color: '#fff', fontWeight: 800 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
