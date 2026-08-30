import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Banknote, Camera, ChevronRight, Coins, Edit3, HelpCircle, Landmark, LogOut, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react';
import { supabase } from './supabaseClient';
import './live-profile.css';
import './profile-account-actions.css';

const DROXION_API_ORIGIN = 'https://www.droxion.com';

function ageFromDob(value) {
  if (!value) return null;
  const dob = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const month = now.getMonth() - dob.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export default function LiveProfile({ coins = 0, onOpenWallet, initialView = 'main', initialNetworkMode = 'followers', onExit }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [creator, setCreator] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [creatorWallet, setCreatorWallet] = useState(null);
  const [payoutProfile, setPayoutProfile] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [view, setView] = useState(initialView || 'main');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [networkMode, setNetworkMode] = useState(initialNetworkMode || 'followers');
  const [networkRows, setNetworkRows] = useState([]);
  const [support, setSupport] = useState({ subject: '', message: '' });
  const [cameraState, setCameraState] = useState('Not tested');
  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [payoutForm, setPayoutForm] = useState({ amount: '', paypalEmail: '' });
  const [bankSetupUrl, setBankSetupUrl] = useState('');
  const [payoutQuote, setPayoutQuote] = useState(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (initialView === 'network') loadNetwork(initialNetworkMode || 'followers');
  }, [initialView, initialNetworkMode]);

  async function authToken() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again.');
    return session.access_token;
  }

  async function loadAll() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const currentUser = auth?.user || null;
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        return;
      }
      const [profileResult, statsResult, creatorResult, earningsResult, walletResult, payoutProfileResult, payoutResult] = await Promise.all([
        supabase.from('droxion_profiles').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabase.rpc('droxion_follow_stats'),
        supabase.from('droxion_creator_accounts').select('status').eq('user_id', currentUser.id).maybeSingle(),
        supabase.from('droxion_creator_earnings').select('amount_cents').eq('user_id', currentUser.id),
        supabase.rpc('droxion_creator_wallet_status'),
        supabase.rpc('droxion_payout_profile_status'),
        supabase.from('droxion_payout_requests').select('id,provider,creator_coins,amount_cents,currency,status,created_at,paypal_email,destination_country,destination_currency,destination_amount,provider_fee').order('created_at', { ascending: false }).limit(10)
      ]);
      setProfile(profileResult.data || null);
      setFollowers(Number(statsResult.data?.followers || 0));
      setFollowing(Number(statsResult.data?.following || 0));
      setCreator(creatorResult.data || null);
      setEarnings((earningsResult.data || []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0));
      setCreatorWallet(walletResult.data || null);
      setPayoutProfile(payoutProfileResult.data || null);
      setPayouts(payoutResult.data || []);
    } catch (error) {
      console.error('Droxion profile load error:', error);
      setNotice('Unable to load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const age = useMemo(() => ageFromDob(profile?.date_of_birth), [profile?.date_of_birth]);
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const availableCents = Number(creatorWallet?.available_cents || 0);
  const minimumPayout = Number(creatorWallet?.minimum_payout_coins || 1000);
  const bankReady = payoutProfile?.ready === true;
  const payoutCurrency = payoutProfile?.currency || '';
  const payoutCountry = payoutProfile?.country_code || '';

  async function saveProfile() {
    if (!user?.id || !profile) return;
    setSaving(true); setNotice('');
    const { error } = await supabase.from('droxion_profiles').update({
      display_name: profile.display_name?.trim() || null,
      username: profile.username?.trim().toLowerCase() || null,
      bio: profile.bio?.trim() || null,
      country: profile.country?.trim() || null,
      language: profile.language?.trim() || null,
      interests: Array.isArray(profile.interests) ? profile.interests : []
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) setNotice(error.message); else { setNotice('Profile updated.'); setView('main'); }
  }

  async function savePrivacy() {
    if (!user?.id || !profile) return;
    setSaving(true); setNotice('');
    const { error } = await supabase.from('droxion_profiles').update({
      discovery_enabled: profile.discovery_enabled !== false,
      show_country: profile.show_country !== false,
      allow_messages: profile.allow_messages !== false,
      allow_video_calls: profile.allow_video_calls !== false
    }).eq('user_id', user.id);
    setSaving(false);
    setNotice(error ? error.message : 'Privacy settings saved.');
  }

  async function loadNetwork(mode) {
    setNetworkMode(mode); setView('network'); setNotice('');
    const { data, error } = await supabase.rpc(mode === 'followers' ? 'droxion_followers' : 'droxion_following');
    if (error) setNotice(error.message); else setNetworkRows(data || []);
  }

  async function testCamera() {
    setCameraState('Requesting permission…'); setNotice('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      setCameraState(`${videoTrack ? 'Camera ready' : 'No camera'} · ${audioTrack ? 'Microphone ready' : 'No microphone'}`);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setCameraState('Permission blocked');
      setNotice(error?.name === 'NotAllowedError' ? 'Camera or microphone permission is blocked for droxion.com. Enable it in your browser site settings.' : error?.message || 'Could not access camera and microphone.');
    }
  }

  async function sendSupport() {
    if (!user?.id || !support.subject.trim() || !support.message.trim()) return setNotice('Subject and message are required.');
    const { error } = await supabase.from('droxion_support_tickets').insert({ user_id: user.id, category: 'Account', subject: support.subject.trim(), message: support.message.trim() });
    if (error) setNotice(error.message); else { setNotice('Support request sent.'); setSupport({ subject: '', message: '' }); }
  }

  function payoutFailureMessage(reason, data) {
    if (reason === 'minimum_payout') return `Minimum withdrawal is $${(Number(data?.minimum_payout_coins || minimumPayout) / 100).toFixed(2)}.`;
    if (reason === 'invalid_paypal_email') return 'Enter a valid PayPal email.';
    if (reason === 'insufficient_creator_coins') return 'Not enough available creator balance.';
    if (reason === 'payout_already_pending') return 'You already have a payout being processed.';
    if (reason === 'bank_setup_required') return 'Complete secure bank payout setup before withdrawing to a bank.';
    if (reason === 'bank_setup_incomplete') return 'Your bank payout verification is not complete yet.';
    return data?.message || data?.error || 'Could not create withdrawal request.';
  }

  async function startBankSetup() {
    if (saving) return;
    setSaving(true); setNotice('');
    try {
      const token = await authToken();
      const response = await fetch(`${DROXION_API_ORIGIN}/api/trolley/widget-url`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.widgetUrl) throw new Error(payload?.error || 'Could not start secure bank setup.');
      setBankSetupUrl(payload.widgetUrl);
      setView('bank-setup');
    } catch (error) {
      setNotice(error?.message || 'Could not start secure bank setup.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshBankStatus() {
    setSaving(true); setNotice('');
    try {
      const token = await authToken();
      const response = await fetch(`${DROXION_API_ORIGIN}/api/trolley/status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not refresh bank payout status.');
      await loadAll();
      if (payload?.ready) {
        setNotice(`Bank payout ready: ${payload.country} · ${payload.currency}.`);
        setView('withdraw');
      } else {
        setNotice('Bank setup is saved, but verification is not complete yet.');
      }
    } catch (error) {
      setNotice(error?.message || 'Could not refresh bank payout status.');
    } finally {
      setSaving(false);
    }
  }

  async function cancelBankQuote() {
    const requestId = payoutQuote?.requestId;
    if (!requestId) { setPayoutQuote(null); return; }
    setSaving(true); setNotice('');
    try {
      const { data, error } = await supabase.rpc('droxion_cancel_quoted_payout', { p_request_id: requestId });
      if (error) throw error;
      if (!data?.cancelled) throw new Error('This payout can no longer be cancelled.');
      setPayoutQuote(null);
      await loadAll();
      setNotice('Bank payout quote cancelled. Your balance was restored.');
    } catch (error) {
      setNotice(error?.message || 'Could not cancel payout quote.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmBankPayout() {
    if (!payoutQuote?.requestId || saving) return;
    setSaving(true); setNotice('');
    try {
      const token = await authToken();
      const response = await fetch(`${DROXION_API_ORIGIN}/api/trolley/confirm-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: payoutQuote.requestId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Could not start bank payout.');
      setPayoutQuote(null);
      setPayoutForm(current => ({ ...current, amount: '' }));
      await loadAll();
      setNotice(`Bank payout submitted in ${payload.destinationCurrency || payoutCurrency}.`);
    } catch (error) {
      setNotice(error?.message || 'Could not start bank payout.');
    } finally {
      setSaving(false);
    }
  }

  async function submitWithdrawal() {
    if (saving) return;
    const dollars = Number(payoutForm.amount);
    if (!Number.isFinite(dollars) || dollars <= 0) return setNotice('Enter a valid withdrawal amount.');
    const cents = Math.round(dollars * 100);
    if (cents < minimumPayout) return setNotice(`Minimum withdrawal is $${(minimumPayout / 100).toFixed(2)}.`);
    if (cents > availableCents) return setNotice('Withdrawal amount is higher than your available creator balance.');
    if (payoutMethod === 'bank' && !bankReady) return startBankSetup();

    setSaving(true); setNotice('');
    try {
      const token = await authToken();

      if (payoutMethod === 'paypal') {
        const response = await fetch(`${DROXION_API_ORIGIN}/api/paypal/creator-payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ paypalEmail: payoutForm.paypalEmail.trim(), creatorCoins: cents })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setNotice(payoutFailureMessage(payload?.reason, payload));
          return;
        }
        setPayoutForm(current => ({ ...current, amount: '' }));
        await loadAll();
        setNotice(`PayPal withdrawal submitted. Status: ${String(payload.status || 'PENDING').toLowerCase()}.`);
      } else {
        const response = await fetch(`${DROXION_API_ORIGIN}/api/trolley/quote-payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ creatorCoins: cents })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
          setNotice(payoutFailureMessage(payload?.reason, payload));
          return;
        }
        setPayoutQuote(payload);
        await loadAll();
        setNotice('Review the local-currency payout quote before confirming.');
      }
    } catch (error) {
      setNotice(error?.message || 'Could not create withdrawal request.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    window.location.assign('/login');
  }

  async function deleteAccount() {
    if (deleting) return;
    if (!window.confirm('Delete your Droxion account permanently? This cannot be undone.')) return;
    if (!window.confirm('Are you sure? Your profile, LIVE data, messages and account access will be deleted.')) return;
    setDeleting(true); setNotice('');
    const { error } = await supabase.functions.invoke('delete-my-account', { body: {} });
    if (error) { setDeleting(false); setNotice(error.message || 'Could not delete account.'); return; }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    window.location.assign('/login');
  }

  function Back({ title, target = 'main' }) {
    const goBack = () => {
      setNotice('');
      if (target === 'main' && typeof onExit === 'function' && initialView !== 'main') {
        onExit();
        return;
      }
      setView(target);
    };
    return <div className="lpSubHead"><button onClick={goBack}><ArrowLeft size={19} /></button><h2>{title}</h2></div>;
  }

  if (loading) return <section className="lpPage"><div className="lpLoading">Loading your profile…</div></section>;
  if (!user) return <section className="lpPage lpSignedOut"><UserRound size={38} /><h2>Sign in to your Droxion profile</h2><a href="/login">Sign in</a></section>;
  if (!profile) return <section className="lpPage"><div className="lpLoading">Loading your profile…</div></section>;

  if (view === 'bank-setup') return <section className="lpPage"><Back title="Secure Bank Setup" target="withdraw" /><div className="lpCreatorCard"><div className="lpCreatorTop"><ShieldCheck size={19} /><strong>Provider-secured setup</strong></div><p className="lpSettingText">Your bank and identity details are entered directly with the payout provider. Droxion only keeps safe payout IDs, country, currency and masked bank details.</p></div>{bankSetupUrl ? <iframe title="Secure bank payout setup" src={bankSetupUrl} style={{ width: '100%', minHeight: '680px', border: 0, borderRadius: '18px', background: '#fff' }} /> : <div className="lpEmpty">Unable to load bank setup.</div>}<button className="lpSave" disabled={saving} onClick={refreshBankStatus}>{saving ? 'Checking…' : 'I Finished Setup — Check Status'}</button>{notice && <div className="lpNotice">{notice}</div>}</section>;

  if (view === 'edit') return <section className="lpPage"><Back title="Edit Profile" /><div className="lpEditor"><label>Display name<input value={profile.display_name || ''} onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))} /></label><label>Username<input value={profile.username || ''} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} /></label><label>Bio<textarea value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} /></label><div className="lpTwoCol"><label>Country<input value={profile.country || ''} onChange={e => setProfile(p => ({ ...p, country: e.target.value }))} /></label><label>Language<input value={profile.language || ''} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))} /></label></div><label>Interests<input value={interests.join(', ')} onChange={e => setProfile(p => ({ ...p, interests: e.target.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12) }))} /></label><button className="lpSave" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save Profile'}</button>{notice && <div className="lpNotice">{notice}</div>}<section className="profileEditAccountActions" aria-label="Account actions"><div className="profileEditAccountHead"><strong>Account</strong><span>Sign out or permanently remove your Droxion account.</span></div><button type="button" className="profileEditLogout" onClick={logout}><span className="profileEditActionIcon" aria-hidden="true"><LogOut size={19} /></span><span><strong>Log Out</strong><small>Sign out of this device</small></span><span className="profileEditChevron" aria-hidden="true">›</span></button><button type="button" className={`profileEditDelete${deleting ? ' isDeleting' : ''}`} onClick={deleteAccount} disabled={deleting}><span className="profileEditActionIcon" aria-hidden="true"><Trash2 size={19} /></span><span><strong>{deleting ? 'Deleting Account…' : 'Delete Account'}</strong><small>Permanently delete your Droxion account and data</small></span><span className="profileEditChevron" aria-hidden="true">›</span></button></section></div></section>;

  if (view === 'live-settings') return <section className="lpPage"><Back title="LIVE Settings" /><div className="lpCreatorCard"><div className="lpCreatorTop"><Camera size={19} /><strong>Camera & microphone</strong></div><p className="lpSettingText">Droxion needs camera and microphone permission only when you go LIVE or join a creator on camera.</p><div className="lpStatusBox"><strong>{cameraState}</strong><small>Test permissions before your next LIVE.</small></div><button className="lpSave" onClick={testCamera}>Test Camera & Microphone</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'network') return <section className="lpPage"><Back title="Followers & Following" /><div className="lpSegment"><button className={networkMode === 'followers' ? 'active' : ''} onClick={() => loadNetwork('followers')}>Followers</button><button className={networkMode === 'following' ? 'active' : ''} onClick={() => loadNetwork('following')}>Following</button></div><div className="lpPeopleList">{networkRows.length === 0 ? <div className="lpEmpty">No {networkMode} yet.</div> : networkRows.map(person => <div className="lpPerson" key={person.user_id}>{person.avatar_url ? <img src={person.avatar_url} alt="" /> : <div>{(person.display_name || 'D')[0]}</div>}<span><strong>{person.display_name}</strong><small>{person.country || 'Droxion user'}</small></span></div>)}</div>{notice && <div className="lpNotice">{notice}</div>}</section>;

  if (view === 'privacy') return <section className="lpPage"><Back title="Safety & Privacy" /><div className="lpEditor"><label className="lpToggle"><input type="checkbox" checked={profile.discovery_enabled !== false} onChange={e => setProfile(p => ({ ...p, discovery_enabled: e.target.checked }))} /><span><strong>Appear in LIVE discovery</strong><small>Let people discover your profile and LIVE broadcasts.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.show_country !== false} onChange={e => setProfile(p => ({ ...p, show_country: e.target.checked }))} /><span><strong>Show my country</strong><small>Display your country on Droxion.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.allow_messages !== false} onChange={e => setProfile(p => ({ ...p, allow_messages: e.target.checked }))} /><span><strong>Allow messages</strong><small>Allow eligible users to message you.</small></span></label><label className="lpToggle"><input type="checkbox" checked={profile.allow_video_calls !== false} onChange={e => setProfile(p => ({ ...p, allow_video_calls: e.target.checked }))} /><span><strong>Allow video interactions</strong><small>Allow eligible LIVE/video interactions.</small></span></label><button className="lpSave" disabled={saving} onClick={savePrivacy}>{saving ? 'Saving…' : 'Save Privacy Settings'}</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'support') return <section className="lpPage"><Back title="Help & Support" /><div className="lpEditor"><label>Subject<input value={support.subject} onChange={e => setSupport(s => ({ ...s, subject: e.target.value }))} placeholder="What do you need help with?" /></label><label>Message<textarea value={support.message} onChange={e => setSupport(s => ({ ...s, message: e.target.value }))} placeholder="Tell us what happened…" /></label><button className="lpSave" onClick={sendSupport}>Send Support Request</button>{notice && <div className="lpNotice">{notice}</div>}</div></section>;

  if (view === 'withdraw') return <section className="lpPage"><Back title="Withdraw Earnings" /><div className="lpCreatorCard"><div className="lpCreatorTop"><Banknote size={19} /><strong>Creator balance</strong></div><div className="lpPayoutBalance"><strong>${(availableCents / 100).toFixed(2)}</strong><span>Available to withdraw</span></div><small className="lpPayoutHelp">Minimum withdrawal: ${(minimumPayout / 100).toFixed(2)} · Payouts use your verified withdrawal destination.</small></div><div className="lpEditor"><div className="lpSegment"><button className={payoutMethod === 'paypal' ? 'active' : ''} onClick={() => { setPayoutMethod('paypal'); setPayoutQuote(null); setNotice(''); }}>PayPal</button><button className={payoutMethod === 'bank' ? 'active' : ''} onClick={() => { setPayoutMethod('bank'); setPayoutQuote(null); setNotice(''); }}>Bank Transfer</button></div><label>Amount (USD balance)<input inputMode="decimal" value={payoutForm.amount} onChange={e => { setPayoutForm(f => ({ ...f, amount: e.target.value })); setPayoutQuote(null); }} placeholder="25.00" /></label>{payoutMethod === 'paypal' ? <label>PayPal email<input type="email" value={payoutForm.paypalEmail} onChange={e => setPayoutForm(f => ({ ...f, paypalEmail: e.target.value }))} placeholder="you@example.com" /></label> : <div className="lpStatusBox">{bankReady ? <><strong>{payoutCountry} · {payoutCurrency}</strong><small>{payoutProfile?.bank_name ? `${payoutProfile.bank_name}${payoutProfile.account_last4 ? ` · •••• ${payoutProfile.account_last4}` : ''}` : 'Secure bank payout destination verified.'}</small><small>The provider uses your verified payout country and converts the USD creator balance to the supported local payout currency.</small><button type="button" className="lpSave" disabled={saving} onClick={startBankSetup}>Update Bank Details</button></> : <><strong>Secure bank setup required</strong><small>Droxion does not collect or store your raw bank account number.</small><small>Complete provider verification to activate a supported bank route and local currency.</small><button type="button" className="lpSave" disabled={saving} onClick={startBankSetup}>{saving ? 'Opening…' : 'Set Up Bank Payout'}</button></>}</div>}{payoutQuote && payoutMethod === 'bank' && <div className="lpCreatorCard"><div className="lpCreatorTop"><Landmark size={19} /><strong>Review payout quote</strong></div><div className="lpCreatorNumbers"><div><strong>${Number(payoutQuote.sourceAmount || 0).toFixed(2)}</strong><span>From creator balance</span></div><div><strong>{payoutQuote.destinationAmount == null ? 'Provider quote' : Number(payoutQuote.destinationAmount).toFixed(2)} {payoutQuote.destinationCurrency || payoutCurrency}</strong><span>Estimated local payout</span></div></div>{payoutQuote.fxRate ? <small className="lpPayoutHelp">FX rate: {Number(payoutQuote.fxRate).toFixed(6)}</small> : null}{payoutQuote.providerFee != null ? <small className="lpPayoutHelp">Estimated provider fee: {Number(payoutQuote.providerFee).toFixed(2)} {payoutQuote.destinationCurrency || payoutCurrency}</small> : null}<div className="lpSegment"><button disabled={saving} onClick={cancelBankQuote}>Cancel</button><button className="active" disabled={saving} onClick={confirmBankPayout}>{saving ? 'Processing…' : 'Confirm Payout'}</button></div></div>}<button className="lpSave" disabled={saving || availableCents < minimumPayout || Boolean(payoutQuote)} onClick={submitWithdrawal}>{saving ? 'Submitting…' : payoutMethod === 'bank' && !bankReady ? 'Set Up Bank Payout' : payoutMethod === 'bank' ? 'Get Local Currency Quote' : 'Request Withdrawal'}</button>{notice && <div className="lpNotice">{notice}</div>}</div><div className="lpPayoutHistory"><h3>Recent withdrawals</h3>{payouts.length === 0 ? <div className="lpEmpty">No withdrawal requests yet.</div> : payouts.map(row => <div className="lpPayoutRow" key={row.id}><div><strong>${(Number(row.amount_cents || 0) / 100).toFixed(2)}</strong><span>{row.provider === 'trolley' ? `Bank${row.destination_country ? ` · ${row.destination_country}` : ''}${row.destination_currency ? ` · ${row.destination_currency}` : ''}` : `PayPal${row.paypal_email ? ` · ${row.paypal_email}` : ''}`}</span>{row.provider === 'trolley' && Number(row.destination_amount || 0) > 0 && row.destination_currency && <small>Destination: {Number(row.destination_amount).toFixed(2)} {row.destination_currency}</small>}</div><b className={`lpPayoutStatus ${row.status}`}>{row.status}</b></div>)}</div></section>;

  return <section className="lpPage"><div className="lpHero"><div className="lpAvatarWrap">{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile" /> : <div className="lpAvatarFallback">{(profile.display_name || 'D')[0]?.toUpperCase()}</div>}{creator?.status === 'approved' && <span className="lpVerified"><BadgeCheck size={18} /></span>}</div><h1>{profile.display_name || profile.username || 'Droxion Creator'}</h1><p>{profile.country || 'Global'} · {profile.language || 'English'}{age ? ` · ${age}` : ' · 21+'}</p>{profile.bio && <div className="lpBio">{profile.bio}</div>}{interests.length > 0 && <div className="lpChips">{interests.slice(0, 5).map(item => <span key={item}>{item}</span>)}</div>}</div><div className="lpStats"><button onClick={() => loadNetwork('followers')}><strong>{followers}</strong><span>Followers</span></button><button onClick={() => loadNetwork('following')}><strong>{following}</strong><span>Following</span></button><div><strong>{creator?.status ? creator.status.toUpperCase() : 'VIEWER'}</strong><span>Creator</span></div></div><button className="lpWallet" type="button" onClick={onOpenWallet}><span className="lpIcon"><Coins size={20} /></span><span><strong>{coins} Droxion Coins</strong><small>Buy coins and manage your wallet</small></span><ChevronRight size={20} /></button><div className="lpCreatorCard"><div className="lpCreatorTop"><Sparkles size={19} /><strong>Creator Center</strong></div><div className="lpCreatorNumbers"><div><strong>${(earnings / 100).toFixed(2)}</strong><span>Lifetime earnings</span></div><div><strong>${(availableCents / 100).toFixed(2)}</strong><span>Available balance</span></div></div></div><div className="lpMenu"><span className="publishDeleteAccount profileAccountActionHidden" aria-hidden="true" /><button onClick={() => setView('withdraw')}><span className="lpIcon"><Landmark size={20} /></span><span><strong>Withdraw Earnings</strong><small>PayPal or secure local bank payout</small></span><ChevronRight size={20} /></button><button onClick={() => setView('edit')}><span className="lpIcon"><Edit3 size={20} /></span><span><strong>Edit Profile</strong><small>Name, bio, country, language and interests</small></span><ChevronRight size={20} /></button><button onClick={() => setView('privacy')}><span className="lpIcon"><ShieldCheck size={20} /></span><span><strong>Safety & Privacy</strong><small>Discovery and interaction permissions</small></span><ChevronRight size={20} /></button><button onClick={() => setView('support')}><span className="lpIcon"><HelpCircle size={20} /></span><span><strong>Help & Support</strong><small>Send a support request</small></span><ChevronRight size={20} /></button><button className="lpLogout" onClick={logout}><span className="lpIcon"><LogOut size={20} /></span><span><strong>Log Out</strong><small>Sign out of this device</small></span><ChevronRight size={20} /></button></div></section>;
}
