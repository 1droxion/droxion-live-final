import { supabase } from '../../../supabaseClient';

const TERMS_VERSION = '2026-08-29-guideline-1-2';
const OAUTH_TERMS_KEY = 'droxion.oauth.terms';

function platformName() {
  try {
    return window.Capacitor?.getPlatform?.() || 'web';
  } catch {
    return 'web';
  }
}

function callbackUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/auth/callback`;
}

export function rememberOAuthTermsAcceptance() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(OAUTH_TERMS_KEY, JSON.stringify({
    termsVersion: TERMS_VERSION,
    platform: platformName(),
    acceptedAt: new Date().toISOString(),
  }));
}

export async function signInWithSocialProvider(provider) {
  if (!['google', 'apple'].includes(provider)) {
    throw new Error('Unsupported sign-in provider.');
  }

  rememberOAuthTermsAcceptance();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl(),
      skipBrowserRedirect: false,
    },
  });

  if (error) throw error;
  return data;
}

export async function finalizeOAuthLogin() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData?.session?.user) throw new Error('Sign-in session could not be verified.');

  let acceptance = null;
  try {
    acceptance = JSON.parse(window.sessionStorage.getItem(OAUTH_TERMS_KEY) || 'null');
  } catch {
    acceptance = null;
  }

  if (!acceptance?.termsVersion) {
    throw new Error('Terms acceptance could not be verified. Please sign in again.');
  }

  const { error: termsError } = await supabase.rpc('droxion_record_terms_acceptance', {
    p_terms_version: acceptance.termsVersion,
    p_platform: acceptance.platform || platformName(),
  });
  if (termsError) throw new Error('Signed in, but we could not record your Terms acceptance. Please try again.');

  window.sessionStorage.removeItem(OAUTH_TERMS_KEY);
  return sessionData.session;
}
