import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { History, PhoneCall, UserCheck, Users, WalletCards, X } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function GlobalEnhancements() {
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState(null);
  const [profileTab, setProfileTab] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);

  useEffect(() => {
    let stopped = false;
    let hasUser = false;
    let busy = false;

    const authListener = supabase.auth.onAuthStateChange((_event, session) => {
      hasUser = Boolean(session?.user?.id);
      if (!hasUser) setIncoming(null);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!stopped) hasUser = Boolean(data?.session?.user?.id);
    });

    async function poll() {
      if (stopped || busy || !hasUser || document.visibilityState === 'hidden') return;
      if (document.querySelector('.liveRoomV4, .liveSetupOverlay')) return;
      busy = true;
      try {
        const { data } = await supabase.rpc('droxion_incoming_direct_call');
        if (!stopped) setIncoming(data?.call_id ? data : null);
      } catch {
      } finally {
        busy = false;
      }
    }

    const wake = () => {
      if (document.visibilityState !== 'hidden') poll();
    };

    poll();
    const timer = setInterval(poll, 8000);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      authListener?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const check = () => {
      try {
        setProfileTab(
          window.localStorage.getItem('droxion-active-tab') === 'profile' &&
          window.location.pathname === '/'
        );
      } catch {
        setProfileTab(false);
      }
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profileTab) {
      setProfileTarget(null);
      return undefined;
    }

    let lastLogout = null;

    const attach = () => {
      const settings = document.querySelector('.droxionProfilePage .settingsList');
      if (!settings) return;

      const nativeButtons = Array.from(settings.children).filter(
        element => element.tagName === 'BUTTON' && !element.classList.contains('profileEnhancementOption')
      );
      const logout = nativeButtons[nativeButtons.length - 1] || null;

      if (lastLogout && lastLogout !== logout) {
        lastLogout.classList.remove('profileLogoutButton');
        lastLogout.style.removeProperty('order');
      }

      if (logout) {
        logout.classList.add('profileLogoutButton');
        logout.style.order = '99';
        lastLogout = logout;
      }

      setProfileTarget(current => current === settings ? current : settings);
    };

    attach();
    const timer = setInterval(attach, 1200);

    return () => {
      clearInterval(timer);
      if (lastLogout) {
        lastLogout.classList.remove('profileLogoutButton');
        lastLogout.style.removeProperty('order');
      }
      setProfileTarget(null);
    };
  }, [profileTab]);

  async function respond(accept) {
    if (!incoming?.call_id) return;
    const id = incoming.call_id;
    const { data } = await supabase.rpc('droxion_respond_direct_call', {
      p_call_id: id,
      p_accept: accept
    });
    setIncoming(null);
    if (accept && data?.allowed) navigate(`/direct-call?call=${encodeURIComponent(id)}`);
  }

  const shortcuts = [
    ['followers', 'Followers', 'People who follow you', Users],
    ['following', 'Following', 'People you follow', UserCheck],
    ['history', 'History', 'People you already connected with', History],
    ['earnings', 'Earnings & PayPal', 'Creator balance, payouts and PayPal', WalletCards]
  ];

  const profileOptions = profileTarget && profileTab
    ? createPortal(
        <>
          {shortcuts.map(([key, label, subtitle, Icon]) => (
            <button
              key={key}
              type="button"
              className="profileEnhancementOption"
              onClick={() => navigate(`/profile-tools?view=${key}`)}
              style={{ order: 10 }}
            >
              <span className="profileEnhancementIcon"><Icon size={20} /></span>
              <div>
                <strong>{label}</strong>
                <div>{subtitle}</div>
              </div>
              <span>›</span>
            </button>
          ))}
        </>,
        profileTarget
      )
    : null;

  return (
    <>
      <style>{`
        .droxionProfilePage .settingsList > button.profileEnhancementOption::before{display:none!important}
        .droxionProfilePage .settingsList > button.profileLogoutButton::before{
          content:'↪'!important;display:grid!important;place-items:center!important;font-size:20px!important;
          background:linear-gradient(135deg,#7f1d1d,#dc2626)!important
        }
        .profileEnhancementIcon{
          width:42px;height:42px;flex:0 0 42px;border-radius:14px;display:grid;place-items:center;
          background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.24),transparent 28%),linear-gradient(135deg,#8b5cf6,#4f46e5);
          color:#fff;box-shadow:0 9px 22px rgba(124,58,237,.25)
        }
        @media(max-width:600px){.profileEnhancementIcon{width:38px;height:38px;flex-basis:38px;border-radius:12px}}
      `}</style>

      {profileOptions}

      {incoming && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,.82)', display: 'grid', placeItems: 'center', padding: 20, backdropFilter: 'blur(10px)' }}>
          <div style={{ width: 'min(92vw,390px)', background: '#111019', border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, textAlign: 'center', color: '#f8fafc', boxShadow: '0 28px 70px rgba(0,0,0,.46)' }}>
            <button onClick={() => respond(false)} style={{ float: 'right', border: 0, background: 'transparent', color: '#fff' }}><X /></button>
            {incoming.avatar_url ? (
              <img src={incoming.avatar_url} alt={incoming.display_name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', marginTop: 14, border: '3px solid #8b5cf6' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'grid', placeItems: 'center', margin: '14px auto 0', fontSize: 32, fontWeight: 900 }}>{(incoming.display_name || 'D')[0]}</div>
            )}
            <h2>{incoming.display_name || 'Droxion user'}</h2>
            <p style={{ color: '#aaa6b5' }}>{incoming.country || 'Global'} · Incoming video call</p>
            <p style={{ color: '#777283', fontSize: 13 }}>Caller pays 50 coins when connected, then 5 coins every 10 seconds.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => respond(false)} style={{ minHeight: 50, border: '1px solid rgba(239,68,68,.25)', borderRadius: 14, background: '#291217', color: '#fca5a5', fontWeight: 900 }}>Decline</button>
              <button onClick={() => respond(true)} style={{ minHeight: 50, border: 0, borderRadius: 14, background: '#16a34a', color: '#fff', fontWeight: 900, display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}><PhoneCall size={19} /> Accept</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}