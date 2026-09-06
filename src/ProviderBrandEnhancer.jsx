import { useEffect } from 'react';
import './provider-brand-enhancer.css';

const ICONS = {
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z"/></svg>`,
  twitch: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.3 2 1.2 5.1v11.2h3.7V22l4.1-4.1h3.2L19.4 11V2H4.3Zm13 8-3.2 3.2h-3.5l-2.8 2.8v-2.8H4.4V4.1h12.9V10Zm-2.4-4.4h-2v4.8h2V5.6Zm-4.1 0h-2v4.8h2V5.6Z"/></svg>`,
  kick: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h5v6h2V7h2V5h2V3h6v5h-2v2h-2v4h2v2h2v5h-6v-2h-2v-2h-2v4H3V3Z"/></svg>`
};

function providerFromText(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('youtube')) return 'youtube';
  if (text.includes('twitch')) return 'twitch';
  if (text.includes('kick')) return 'kick';
  return '';
}

function decorateProviderButton(button) {
  if (!(button instanceof HTMLElement) || button.dataset.providerDecorated === '1') return;
  const provider = providerFromText(button.textContent);
  if (!provider) return;
  const holder = document.createElement('span');
  holder.className = `providerBrandIcon ${provider}`;
  holder.innerHTML = ICONS[provider];
  button.prepend(holder);
  button.dataset.providerDecorated = '1';
}

function decorateProfileMark(mark) {
  if (!(mark instanceof HTMLElement) || mark.dataset.providerDecorated === '1') return;
  const card = mark.closest('.pdConnectionCard');
  const provider = card?.classList.contains('youtube') ? 'youtube' : card?.classList.contains('twitch') ? 'twitch' : card?.classList.contains('kick') ? 'kick' : '';
  if (!provider) return;
  mark.innerHTML = ICONS[provider];
  mark.classList.add('providerBrandMark', provider);
  mark.dataset.providerDecorated = '1';
}

export default function ProviderBrandEnhancer() {
  useEffect(() => {
    const run = () => {
      document.querySelectorAll('.dxGlobalProviderRail button').forEach(decorateProviderButton);
      document.querySelectorAll('.pdConnectionMark').forEach(decorateProfileMark);
      document.querySelectorAll('.pdProvider').forEach(node => {
        if (!(node instanceof HTMLElement) || node.dataset.providerDecorated === '1') return;
        const provider = providerFromText(node.textContent);
        if (!provider) return;
        const icon = document.createElement('span');
        icon.className = `providerBrandInline ${provider}`;
        icon.innerHTML = ICONS[provider];
        node.prepend(icon);
        node.dataset.providerDecorated = '1';
      });
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
