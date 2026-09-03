import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaApple } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "./supabaseClient";
import { signInWithSocialProvider } from "./features/auth/services/socialAuthService";

const TERMS_VERSION = "2026-08-29-guideline-1-2";

function platformName() {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [error, setError] = useState("");

  const resetComplete = new URLSearchParams(location.search).get("reset") === "success";
  const legalReturnState = { from: "/login" };

  // OAuth leaves this page. If a user cancels or presses Back in Apple/Google,
  // browsers may restore this exact page from the back-forward cache instead of
  // remounting React. Always unlock the social buttons on return so a refresh is
  // never required.
  useEffect(() => {
    const recoverSocialButtons = () => {
      if (window.location.pathname === "/login") setSocialLoading("");
    };

    window.addEventListener("pageshow", recoverSocialButtons);
    window.addEventListener("popstate", recoverSocialButtons);
    window.addEventListener("focus", recoverSocialButtons);
    return () => {
      window.removeEventListener("pageshow", recoverSocialButtons);
      window.removeEventListener("popstate", recoverSocialButtons);
      window.removeEventListener("focus", recoverSocialButtons);
    };
  }, []);

  const requireTerms = () => {
    if (acceptedTerms) return true;
    setError("You must agree to Droxion's Terms of Use and Community Guidelines before signing in.");
    return false;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!requireTerms()) return;
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (loginError) throw loginError;

      const { error: termsError } = await supabase.rpc("droxion_record_terms_acceptance", {
        p_terms_version: TERMS_VERSION,
        p_platform: platformName(),
      });
      if (termsError) throw new Error("Signed in, but we could not record your Terms acceptance. Please try again.");

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setError("");
    if (!requireTerms()) return;
    setSocialLoading(provider);
    try {
      await signInWithSocialProvider(provider);
    } catch (err) {
      setError(err?.message || `Unable to sign in with ${provider}.`);
      setSocialLoading("");
    }
  };

  const busy = loading || Boolean(socialLoading);

  return (
    <div className="min-h-[100dvh] bg-[#07070b] text-white overflow-y-auto">
      <div className="w-full flex justify-center px-4 py-5 sm:py-8">
        <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl">
          <div className="text-center mb-7">
            <div className="text-3xl font-black tracking-tight leading-none">DROXION</div>
            <div className="text-purple-400 mt-3 font-semibold">Meet the world. Live.</div>
            <p className="text-gray-400 text-sm mt-2">Sign in to your 21+ Droxion account</p>
          </div>

          {resetComplete && !error && (
            <div role="status" className="mb-5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">
              Password updated. Sign in with your new password.
            </div>
          )}

          {error && (
            <div role="alert" className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin}>
            <label className="block text-sm mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm">Password</label>
              <Link to="/forgot-password" className="text-xs text-purple-400 font-semibold hover:text-purple-300">Forgot password?</Link>
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

            <label className="flex items-start gap-3 mb-5 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 accent-purple-500" />
              <span className="text-xs leading-5 text-gray-300">
                I agree to Droxion's <Link to="/terms" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Terms of Use (EULA)</Link> and <Link to="/community-guidelines" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Community Guidelines</Link>. I understand Droxion has <strong className="text-white">zero tolerance for objectionable content and abusive users</strong>.
              </span>
            </label>

            <button type="submit" disabled={busy || !acceptedTerms} className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-white/70 disabled:cursor-not-allowed py-3 rounded-xl font-bold transition-colors">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-gray-500"><span className="h-px flex-1 bg-white/10" /><span>or continue with</span><span className="h-px flex-1 bg-white/10" /></div>

          <div className="grid gap-3">
            <button type="button" disabled={busy || !acceptedTerms} onClick={() => handleSocialLogin('apple')} className="w-full min-h-12 rounded-xl bg-white text-black font-extrabold flex items-center justify-center gap-3 disabled:bg-[#d7d7d9] disabled:text-black/70 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors">
              <FaApple aria-hidden="true" size={22} />
              {socialLoading === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
            </button>
            <button type="button" disabled={busy || !acceptedTerms} onClick={() => handleSocialLogin('google')} className="w-full min-h-12 rounded-xl border border-[#dadce0] bg-white text-[#3c4043] font-semibold flex items-center justify-center gap-3 disabled:bg-[#e7e7e9] disabled:text-[#5f6368] disabled:cursor-not-allowed hover:bg-[#f8f9fa] transition-colors">
              <FcGoogle aria-hidden="true" size={21} />
              {socialLoading === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] leading-4 text-gray-500">
            If you cancel Apple or Google sign in, just return here — the buttons unlock automatically.
          </p>

          <div className="text-center text-sm text-gray-400 mt-5">
            New to Droxion? <Link to="/signup" className="text-purple-400 font-semibold">Create account</Link>
          </div>
          <div className="text-center text-xs text-gray-600 mt-4">Droxion is for adults age 21+.</div>
        </div>
      </div>
    </div>
  );
}
