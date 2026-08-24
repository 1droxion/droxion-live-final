import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './creator-v11.css';

const dollars = value => `$${(Number(value || 0) / 100).toFixed(2)}`;

async function getCreatorData() {
  const [{ data: wallet }, { data: recent }, analyticsResult] = await Promise.all([
    supabase.rpc('droxion_creator_wallet_status'),
    supabase.rpc('droxion_my_recent_live_gifts', { p_limit: 25 }),
    supabase.rpc('droxion_creator_analytics')
  ]);

  return {
    wallet: wallet || null,
    recent: recent || [],
    analytics: analyticsResult?.error ? null : (analyticsResult?.data || null)
  };
}

function removeExistingModal() {
  document.querySelector('.creatorV11Backdrop')?.remove();
}

async function openCreatorCenter() {
  removeExistingModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'creatorV11Backdrop';
  backdrop.innerHTML = `
    <section class="creatorV11Sheet" role="dialog" aria-modal="true" aria-label="Creator analytics">
      <header><div><span>DROXION CREATOR</span><h2>Creator Analytics</h2></div><button type="button" data-close aria-label="Close">×</button></header>
      <div class="creatorV11Loading">Loading creator data…</div>
    </section>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop || event.target.closest('[data-close]')) close();
  });

  const sheet = backdrop.querySelector('.creatorV11Sheet');
  try {
    const { wallet, analytics, recent } = await getCreatorData();
    if (!document.body.contains(backdrop)) return;

    const recentHtml = recent.length
      ? recent.slice(0, 10).map(row => `
          <div class="creatorV11GiftRow">
            <span class="creatorV11Emoji">${row.emoji || '🎁'}</span>
            <div><strong>${row.sender_name || 'Droxion supporter'}</strong><small>${row.gift_name || 'Gift'} · ${row.cost_coins || 0} coins</small></div>
            <b>${dollars(row.creator_coins || 0)}</b>
          </div>`).join('')
      : '<div class="creatorV11Empty">Your recent LIVE gifts will appear here.</div>';

    sheet.innerHTML = `
      <header><div><span>DROXION CREATOR</span><h2>Creator Analytics</h2></div><button type="button" data-close aria-label="Close">×</button></header>
      <div class="creatorV11Balance">
        <span>Available creator balance</span>
        <strong>${dollars(wallet?.available_cents || 0)}</strong>
        <small>${Number(wallet?.available_coins || 0).toLocaleString()} creator coins</small>
      </div>
      <div class="creatorV11Grid">
        <div><span>Last 7 days</span><strong>${dollars(analytics?.last_7d_creator_coins || 0)}</strong></div>
        <div><span>Last 30 days</span><strong>${dollars(analytics?.last_30d_creator_coins || 0)}</strong></div>
        <div><span>Supporters</span><strong>${Number(analytics?.unique_supporters || 0).toLocaleString()}</strong></div>
        <div><span>LIVE gifts</span><strong>${Number(analytics?.lifetime_gifts || recent.length || 0).toLocaleString()}</strong></div>
      </div>
      ${analytics?.top_supporter_name ? `<div class="creatorV11Top"><span>Top supporter</span><strong>${analytics.top_supporter_name}</strong><small>${Number(analytics.top_supporter_spend_coins || 0).toLocaleString()} coins across ${Number(analytics.top_supporter_gifts || 0).toLocaleString()} gifts</small></div>` : ''}
      <h3>Recent LIVE gifts</h3>
      <div class="creatorV11GiftList">${recentHtml}</div>`;
    sheet.querySelector('[data-close]')?.addEventListener('click', close);
  } catch (error) {
    if (!document.body.contains(backdrop)) return;
    sheet.innerHTML = `<header><div><span>DROXION CREATOR</span><h2>Creator Analytics</h2></div><button type="button" data-close>×</button></header><div class="creatorV11Empty">${error?.message || 'Creator analytics could not be loaded.'}</div>`;
    sheet.querySelector('[data-close]')?.addEventListener('click', close);
  }
}

export default function CreatorV11Enhancer() {
  useEffect(() => {
    let liveTimer = null;
    let liveBusy = false;
    let lastLiveRefreshAt = 0;

    function enhanceProfile() {
      const page = document.querySelector('.lpPage');
      if (!page || page.querySelector('.creatorV11Entry')) return;
      const creatorCard = page.querySelector('.lpCreatorCard');
      if (!creatorCard || !page.querySelector('.lpCreatorNumbers')) return;

      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'creatorV11Entry';
      entry.innerHTML = '<span><b>Creator Analytics</b><small>Earnings, supporters and recent LIVE gifts</small></span><strong>›</strong>';
      entry.addEventListener('click', openCreatorCenter);
      creatorCard.appendChild(entry);
    }

    async function refreshLiveEarnings(force = false) {
      const room = document.querySelector('.liveRoomV4');
      if (!room) {
        if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
        lastLiveRefreshAt = 0;
        return;
      }
      const now = Date.now();
      if (!force && now - lastLiveRefreshAt < 4500) return;
      if (liveBusy) return;
      liveBusy = true;
      lastLiveRefreshAt = now;
      try {
        const { data: context } = await supabase.rpc('droxion_current_live_context');
        if (!context?.active || context?.is_host !== true) {
          room.querySelector('.creatorV11LiveEarnings')?.remove();
          return;
        }

        let summary = null;
        const summaryResult = await supabase.rpc('droxion_live_creator_summary', { p_session_id: context.session_id });
        if (!summaryResult.error && summaryResult.data?.allowed) {
          summary = summaryResult.data;
        } else {
          const recentResult = await supabase.rpc('droxion_my_recent_live_gifts', { p_limit: 100 });
          const started = context.started_at ? new Date(context.started_at).getTime() : 0;
          const duringLive = (recentResult.data || []).filter(row => new Date(row.created_at).getTime() >= started);
          summary = {
            total_gifts: duringLive.length,
            creator_coins: duringLive.reduce((sum, row) => sum + Number(row.creator_coins || 0), 0),
            unique_supporters: new Set(duringLive.map(row => row.sender_id)).size
          };
        }

        let badge = room.querySelector('.creatorV11LiveEarnings');
        if (!badge) {
          badge = document.createElement('button');
          badge.type = 'button';
          badge.className = 'creatorV11LiveEarnings';
          badge.addEventListener('click', openCreatorCenter);
          room.querySelector('.liveTopV4')?.appendChild(badge);
        }
        badge.innerHTML = `<span>LIVE EARNINGS</span><strong>${dollars(summary?.creator_coins || 0)}</strong><small>${Number(summary?.total_gifts || 0)} gifts · ${Number(summary?.unique_supporters || 0)} supporters</small>`;
      } catch {
      } finally {
        liveBusy = false;
      }

      if (!liveTimer) liveTimer = setInterval(() => refreshLiveEarnings(true), 5000);
    }

    const run = () => {
      enhanceProfile();
      refreshLiveEarnings();
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = setInterval(run, 2500);

    return () => {
      observer.disconnect();
      clearInterval(poll);
      if (liveTimer) clearInterval(liveTimer);
      removeExistingModal();
    };
  }, []);

  return null;
}
