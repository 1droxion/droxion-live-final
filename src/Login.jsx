import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FaApple, FaTwitch, FaYoutube } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { SiKick } from "react-icons/si";
import { supabase } from "./supabaseClient";
import { signInWithSocialProvider } from "./features/auth/services/socialAuthService";
import "./auth-premium.css";

const TERMS_VERSION = "2026-08-29-guideline-1-2";

function platformName() {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
}

function friendlyAuthError(error) {
  const message = String(error?.message || "").trim();
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first, then try again.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Wait a moment and try again.";
  return message || "Unable to sign in. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const termsRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [error, setError] = useState("");
  const [termsAttention, setTermsAttention] = useState(false);

  const resetComplete = new URLSearchParams(location.search).get("reset") === "success";
  const legalReturnState = { from: "/login" };

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
    setError("Please agree to the Terms of Use and Community Guidelines first.");
    setTermsAttention(true);
    window.setTimeout(() => setTermsAttention(false), 1800);
    try { termsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }); } catch {}
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
      setError(friendlyAuthError(err));
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
      setError(friendlyAuthError(err));
      setSocialLoading("");
    }
  };

  const busy = loading || Boolean(socialLoading);

  return (
    <main className="authPremium login">
      <div className="authPremiumInner">
        <aside className="authSide" aria-hidden="true">
          STREAM<br />CREATE<br />CONNECT
          <i />
          <small>REAL PEOPLE.<br />REAL MOMENTS.</small>
        </aside>

        <section className="authCard" aria-label="Droxion sign in">
          <div className="authBrand">
            <div className="authLogo">D</div>
            <div className="authBrandText"><strong>DROXION</strong><span>Meet the world. Live.</span></div>
          </div>
          <p className="authSubtitle">Sign in to your 21+ Droxion account</p>

          {resetComplete && !error && <div role="status" className="authAlert success">Password updated. Sign in with your new password.</div>}
          {error && <div role="alert" aria-live="polite" className="authAlert error">{error}</div>}

          <form className="authForm" onSubmit={handleLogin}>
            <label className="authLabel" htmlFor="login-email">Email</label>
            <div className="authField">
              <Mail size={18} />
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" required placeholder="you@example.com" />
            </div>

            <div className="authLabel"><label htmlFor="login-password">Password</label><Link to="/forgot-password">Forgot password?</Link></div>
            <div className="authField">
              <LockKeyhole size={18} />
              <input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" />
              <button type="button" className="authEye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>

            <label ref={termsRef} className={`authTerms ${termsAttention ? "attention" : ""}`}>
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => { setAcceptedTerms(e.target.checked); if (e.target.checked) setError(""); }} />
              <span>
                I agree to Droxion's <Link to="/terms" state={legalReturnState} onClick={(e) => e.stopPropagation()}>Terms of Use (EULA)</Link> and <Link to="/community-guidelines" state={legalReturnState} onClick={(e) => e.stopPropagation()}>Community Guidelines</Link>. I understand Droxion has <strong>zero tolerance for objectionable content and abusive users</strong>.
                {!acceptedTerms && <em>Required before any sign in.</em>}
              </span>
            </label>

            <button type="submit" disabled={busy} className="authPrimary">{loading ? "Signing in..." : <>Sign In <ArrowRight size={18} /></>}</button>
          </form>

          <div className="authDivider"><span>or continue with</span></div>
          <div className="authSocialGrid">
            <button type="button" disabled={busy} onClick={() => handleSocialLogin("apple")} className="authSocial"><FaApple size={22} />{socialLoading === "apple" ? "Opening Apple…" : "Continue with Apple"}</button>
            <button type="button" disabled={busy} onClick={() => handleSocialLogin("google")} className="authSocial"><FcGoogle size={22} />{socialLoading === "google" ? "Opening Google…" : "Continue with Google"}</button>
          </div>

          <div className="authProviderStrip">
            <span>Creators can connect their accounts after signing in</span>
            <div className="authProviders">
              <span className="authProvider youtube"><FaYoutube />YouTube</span>
              <span className="authProvider twitch"><FaTwitch />Twitch</span>
              <span className="authProvider kick"><SiKick />Kick</span>
            </div>
          </div>

          <div className="authMeta">New to Droxion? <Link to="/signup">Create account</Link><br />Droxion is for adults age 21+.</div>
        </section>

        <aside className="authSide right" aria-hidden="true">
          MORE<br />THAN A<br />PLATFORM
          <i />
          <small>A GLOBAL STAGE<br />FOR REAL YOU.</small>
        </aside>
      </div>
      <div className="authFooterBrand"><strong>DROXION</strong><span>Meet the world. Live.</span></div>
    </main>
  );
}
