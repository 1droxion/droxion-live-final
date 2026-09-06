import { supabase } from '../../../supabaseClient';

const TERMS_VERSION = '2026-08-29-guideline-1-2';
const OAUTH_TERMS_KEY = 'droxion.oauth.terms';
const NATIVE_OAUTH_CALLBACK = 'com.droxion.live://auth/callback';
const TERMS_MAX_AGE_MS = 60 * 60 * 1000;

export function platformName() {
  try {
    return window.Capacitor?.getPlatform?.() || 'web';
  } catch {
    return 'web';
  }
}

export function isNativePlatform() {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.Capacitor?.isNativePlatform === 'function') return Boolean(window.Capacitor.isNativePlatform());
    return platformName() !== 'web';
  } catch {
    return false;
  }
}

function callbackUrl() {
  if (typeof window === 'undefined') return undefined;
  return isNativePlatform() ? NATIVE_OAUTH_CALLBACK : `${window.location.origin}/auth/callback`;
}

function writeOAuthAcceptance(value) {
  if (typeof window === 'undefined') return;
  const encoded = JSON.stringify(value);
  try { window.sessionStorage.setItem(OAUTH_TERMS_KEY, encoded); } catch {}
  // Native OAuth leaves the WebView for the system browser. localStorage is
  // intentionally used as a durable fallback because sessionStorage may not
  // survive a cold app return on every Android/iOS WebView implementation.
  try { window.localStorage.setItem(OAUTH_TERMS_KEY, encoded); } catch {}
}

function readOAuthAcceptance() {
  if (typeof window === 'undefined') return null;
  let raw = '';
  try { raw = window.sessionStorage.getItem(OAUTH_TERMS_KEY) || ''; } catch {}
  if (!raw) {
    try { raw = window.localStorage.getItem(OAUTH_TERMS_KEY) || ''; } catch {}
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const acceptedAt = Date.parse(parsed?.acceptedAt || '');
    if (!parsed?.termsVersion || !Number.isFinite(acceptedAt) || Date.now() - acceptedAt > TERMS_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearOAuthAcceptance() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(OAUTH_TERMS_KEY); } catch {}
  try { window.localStorage.removeItem(OAUTH_TERMS_KEY); } catch {}
}

export function rememberOAuthTermsAcceptance() {
  writeOAuthAcceptance({
    termsVersion: TERMS_VERSION,
    platform: platformName(),
    acceptedAt: new Date().toISOString(),
  });
}

export async function signInWithSocialProvider(provider) {
  if (!['google', 'apple'].includes(provider)) {
    throw new Error('Unsupported sign-in provider.');
  }

  rememberOAuthTermsAcceptance();
  const native = isNativePlatform();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl(),
      skipBrowserRedirect: native,
    },
  });

  if (error) throw error;

  if (native) {
    if (!data?.url) throw new Error(`${provider === 'apple' ? 'Apple' : 'Google'} sign in could not be opened.`);
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({
      url: data.url,
      windowName: '_self',
      presentationStyle: 'popover',
    });
  }

  return data;
}

async function establishSessionFromNativeCallback(url) {
  const callback = new URL(url);
  const errorDescription = callback.searchParams.get('error_description') || callback.searchParams.get('error');
  if (errorDescription) throw new Error(errorDescription);

  const code = callback.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const hash = new URLSearchParams(String(callback.hash || '').replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  // Some provider/browser combinations complete the Supabase session before
  // the app receives the return URL. Let finalizeOAuthLogin verify that case.
}

export async function completeNativeOAuthUrl(url) {
  if (!url || !String(url).startsWith(NATIVE_OAUTH_CALLBACK)) return false;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.close().catch(() => {});
  } catch {}

  await establishSessionFromNativeCallback(url);
  await finalizeOAuthLogin();
  return true;
}

export async function finalizeOAuthLogin() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session?.user) throw new Error('Sign-in session could not be verified.');

  const acceptance = readOAuthAcceptance();
  if (!acceptance?.termsVersion) {
    throw new Error('Terms acceptance could not be verified. Please sign in again.');
  }

  const { error: termsError } = await supabase.rpc('droxion_record_terms_acceptance', {
    p_terms_version: acceptance.termsVersion,
    p_platform: acceptance.platform || platformName(),
  });
  if (termsError) throw new Error('Signed in, but we could not record your Terms acceptance. Please try again.');

  clearOAuthAcceptance();
  return sessionData.session;
}
