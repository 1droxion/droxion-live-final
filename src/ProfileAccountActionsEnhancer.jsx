import { useEffect } from 'react';
import { supabase } from './supabaseClient';
import './profile-account-actions.css';

export default function ProfileAccountActionsEnhancer() {
  useEffect(() => {
    let deleting = false;

    function hideMainProfileActions() {
      document.querySelectorAll('.lpMenu .lpLogout, .lpMenu .publishDeleteAccount').forEach(node => {
        node.classList.add('profileAccountActionHidden');
        node.setAttribute('aria-hidden', 'true');
        node.tabIndex = -1;
      });
    }

    function addEditProfileActions() {
      const page = document.querySelector('.lpPage');
      if (!page) return;

      const title = page.querySelector('.lpSubHead h2')?.textContent?.trim();
      const editor = page.querySelector('.lpEditor');
      if (title !== 'Edit Profile' || !editor || editor.querySelector('.profileEditAccountActions')) return;

      const section = document.createElement('section');
      section.className = 'profileEditAccountActions';
      section.setAttribute('aria-label', 'Account actions');
      section.innerHTML = `
        <div class="profileEditAccountHead">
          <strong>Account</strong>
          <span>Sign out or permanently remove your Droxion account.</span>
        </div>
        <button type="button" class="profileEditLogout">
          <span class="profileEditActionIcon" aria-hidden="true">↪</span>
          <span><strong>Log Out</strong><small>Sign out of this device</small></span>
          <span class="profileEditChevron" aria-hidden="true">›</span>
        </button>
        <button type="button" class="profileEditDelete">
          <span class="profileEditActionIcon" aria-hidden="true">⌫</span>
          <span><strong>Delete Account</strong><small>Permanently delete your Droxion account and data</small></span>
          <span class="profileEditChevron" aria-hidden="true">›</span>
        </button>
      `;

      section.querySelector('.profileEditLogout')?.addEventListener('click', async () => {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        window.location.assign('/login');
      });

      section.querySelector('.profileEditDelete')?.addEventListener('click', async event => {
        if (deleting) return;
        if (!window.confirm('Delete your Droxion account permanently? This cannot be undone.')) return;
        if (!window.confirm('Are you sure? Your profile, LIVE data, messages and account access will be deleted.')) return;

        deleting = true;
        const button = event.currentTarget;
        button.disabled = true;
        button.classList.add('isDeleting');

        const label = button.querySelector('strong');
        if (label) label.textContent = 'Deleting Account…';

        const { error } = await supabase.functions.invoke('delete-my-account', { body: {} });
        if (error) {
          deleting = false;
          button.disabled = false;
          button.classList.remove('isDeleting');
          if (label) label.textContent = 'Delete Account';
          window.alert(error.message || 'Could not delete account.');
          return;
        }

        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        window.location.assign('/login');
      });

      editor.appendChild(section);
    }

    const run = () => {
      hideMainProfileActions();
      addEditProfileActions();
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(run, 1500);

    return () => {
      observer.disconnect();
      window.clearInterval(poll);
    };
  }, []);

  return null;
}
