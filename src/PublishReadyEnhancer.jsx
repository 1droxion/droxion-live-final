import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './publish-ready.css';

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function nativePlatform() {
  try {
    const platform = window.Capacitor?.getPlatform?.();
    if (platform === 'ios' || platform === 'android') return platform;
    if (window.Capacitor?.isNativePlatform?.()) return platform || 'native';
  } catch {}
  return '';
}

export default function PublishReadyEnhancer() {
  useEffect(() => {
    let timerInterval = null;
    let timerStartedAt = null;
    let contextBusy = false;

    function addDeleteAccount() {
      const menu = document.querySelector('.lpPage .lpMenu');
      if (!menu || menu.querySelector('.publishDeleteAccount')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'publishDeleteAccount';
      button.innerHTML = '<span class="lpIcon">🗑️</span><span><strong>Delete Account</strong><small>Permanently delete your Droxion account and data</small></span><span aria-hidden="true">›</span>';
      button.addEventListener('click', async () => {
        if (!window.confirm('Delete your Droxion account permanently? This cannot be undone.')) return;
        if (!window.confirm('Are you sure? Your profile, LIVE data, messages and account access will be deleted.')) return;
        button.disabled = true;
        const { error } = await supabase.functions.invoke('delete-my-account', { body: {} });
        if (error) {
          button.disabled = false;
          window.alert(error.message || 'Could not delete account.');
          return;
        }
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        window.location.assign('/login');
      });
      menu.appendChild(button);
    }

    function addHomeSearch() {
      const page = document.querySelector('.liveOnlyHome');
      if (!page || page.querySelector('.publishLiveSearch')) return;
      const wrap = document.createElement('div');
      wrap.className = 'publishLiveSearch';
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search LIVE creators';
      input.setAttribute('aria-label', 'Search live creators');
      wrap.appendChild(input);
      const head = page.querySelector('.liveOnlyHomeHead');
      if (head) page.insertBefore(wrap, head); else page.prepend(wrap);

      const apply = () => {
        const query = input.value.trim().toLowerCase();
        page.querySelectorAll('.liveFeedCard').forEach(card => {
          const haystack = (card.textContent || '').toLowerCase();
          card.style.display = !query || haystack.includes(query) ? '' : 'none';
        });
      };
      input.addEventListener('input', apply);
    }

    function addNativePaymentGuard() {
      const platform = nativePlatform();
      if (!platform) return;

      document.querySelectorAll('.liveBuyCoinsV4').forEach(button => {
        button.style.display = 'none';
      });

      const sheet = document.querySelector('.walletSheet');
      if (!sheet || sheet.dataset.nativeBillingGuard === 'true') return;
      sheet.dataset.nativeBillingGuard = 'true';
      sheet.querySelectorAll('.walletGrid button, .paypalBox').forEach(node => {
        node.style.display = 'none';
      });
      const heading = Array.from(sheet.querySelectorAll('h3')).find(node => node.textContent?.trim() === 'Buy Coins');
      if (heading) {
        const note = document.createElement('div');
        note.className = 'publishBillingNotice';
        note.textContent = platform === 'ios'
          ? 'Coin purchases use Apple In-App Purchase on iPhone. Store products are being connected for the App Store release.'
          : 'Coin purchases use Google Play Billing on Android. Store products are being connected for the Play Store release.';
        heading.insertAdjacentElement('afterend', note);
      }
    }

    async function refreshLiveContext() {
      if (contextBusy) return;
      const room = document.querySelector('.liveRoomV4');
      if (!room) {
        timerStartedAt = null;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        return;
      }
      contextBusy = true;
      try {
        const { data } = await supabase.rpc('droxion_current_live_context');
        if (!data?.active) return;
        timerStartedAt = data.started_at ? new Date(data.started_at).getTime() : Date.now();
        let badge = room.querySelector('.publishLiveTimer');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'publishLiveTimer';
          room.querySelector('.liveTopV4')?.appendChild(badge);
        }
        const update = () => {
          if (!badge || !document.body.contains(badge) || !timerStartedAt) return;
          badge.textContent = formatDuration(Date.now() - timerStartedAt);
        };
        update();
        if (!timerInterval) timerInterval = setInterval(update, 1000);

        const isViewer = data.is_host === false;
        if (isViewer && !room.querySelector('.publishSafetyButton')) addLiveSafety(room);
      } finally {
        contextBusy = false;
      }
    }

    function addLiveSafety(room) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'publishSafetyButton';
      button.setAttribute('aria-label', 'LIVE safety options');
      button.textContent = '•••';

      const backdrop = document.createElement('div');
      backdrop.className = 'publishSafetyBackdrop';
      backdrop.hidden = true;
      backdrop.innerHTML = `
        <div class="publishSafetySheet" role="dialog" aria-modal="true" aria-label="LIVE safety options">
          <div class="publishSafetyHead"><strong>LIVE Safety</strong><button type="button" data-close>×</button></div>
          <p>Report harmful content or block this creator.</p>
          <div class="publishReportGrid">
            <button type="button" data-report="harassment">Harassment</button>
            <button type="button" data-report="hate">Hate</button>
            <button type="button" data-report="sexual">Sexual content</button>
            <button type="button" data-report="violence">Violence</button>
            <button type="button" data-report="spam">Spam / scam</button>
            <button type="button" data-report="underage">Underage concern</button>
            <button type="button" data-report="other">Other</button>
          </div>
          <button type="button" class="publishBlockButton" data-block>Block creator</button>
        </div>`;

      button.addEventListener('click', () => { backdrop.hidden = false; });
      backdrop.addEventListener('click', event => {
        if (event.target === backdrop || event.target.closest('[data-close]')) backdrop.hidden = true;
      });
      backdrop.querySelectorAll('[data-report]').forEach(reportButton => {
        reportButton.addEventListener('click', async () => {
          const category = reportButton.getAttribute('data-report') || 'other';
          const { data, error } = await supabase.rpc('droxion_report_current_live', { p_category: category, p_details: null });
          if (error || !data?.allowed) window.alert(error?.message || 'Could not submit report.');
          else window.alert('Report submitted. Thank you for helping keep Droxion safe.');
          backdrop.hidden = true;
        });
      });
      backdrop.querySelector('[data-block]')?.addEventListener('click', async () => {
        if (!window.confirm('Block this creator? You will no longer see their LIVE broadcasts.')) return;
        const { data, error } = await supabase.rpc('droxion_block_current_live');
        if (error || !data?.allowed) {
          window.alert(error?.message || 'Could not block this creator.');
          return;
        }
        backdrop.hidden = true;
        room.querySelector('.liveBackButton')?.click();
      });

      room.appendChild(button);
      room.appendChild(backdrop);
    }

    const run = () => {
      addDeleteAccount();
      addHomeSearch();
      addNativePaymentGuard();
      refreshLiveContext();
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = setInterval(run, 2500);

    return () => {
      observer.disconnect();
      clearInterval(poll);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, []);

  return null;
}
