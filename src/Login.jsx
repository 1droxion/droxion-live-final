import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

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
  const [error, setError] = useState("");

  const resetComplete = new URLSearchParams(location.search).get("reset") === "success";
  const legalReturnState = { from: "/login" };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!acceptedTerms) {
      setError("You must agree to Droxion's Terms of Use and Community Guidelines before signing in.");
      return;
    }

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

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-7 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-3xl font-black tracking-tight">DROXION</div>
          <div className="text-purple-400 mt-2 font-semibold">Meet the world. Live.</div>
          <p className="text-gray-400 text-sm mt-2">Sign in to your 21+ Droxion account</p>
        </div>

        {resetComplete && !error && (
          <div role="status" className="mb-5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">
            Password updated. Sign in with your new password.
          </div>
        )}

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{error}</div>
        )}

        <form onSubmit={handleLogin}>
          <label className="block text-sm mb-2">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="block text-sm">Password</label>
            <Link to="/forgot-password" className="text-xs text-purple-400 font-semibold hover:text-purple-300">Forgot password?</Link>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

          <label className="flex items-start gap-3 mb-6 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1" required />
            <span className="text-xs leading-5 text-gray-300">
              I agree to Droxion's <Link to="/terms" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Terms of Use (EULA)</Link> and <Link to="/community-guidelines" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Community Guidelines</Link>. I understand Droxion has <strong className="text-white">zero tolerance for objectionable content and abusive users</strong>.
            </span>
          </label>

          <button type="submit" disabled={loading || !acceptedTerms} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 py-3 rounded-xl font-bold">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400 mt-6">
          New to Droxion? <Link to="/signup" className="text-purple-400 font-semibold">Create account</Link>
        </div>
        <div className="text-center text-xs text-gray-600 mt-5">Droxion is for adults age 21+.</div>
      </div>
    </div>
  );
}
