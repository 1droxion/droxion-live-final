import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Eye, EyeOff, Globe2, Languages, LockKeyhole, Mail, UserRound, UsersRound } from "lucide-react";
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
  if (/already registered|already exists|user already/i.test(message)) return "That email is already registered. Sign in instead.";
  if (/rate limit|too many requests/i.test(message)) return "Too many attempts. Wait a moment and try again.";
  return message || "Signup failed. Please try again.";
}

function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("English");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedSafetyTerms, setAcceptedSafetyTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState("");
  const [error, setError] = useState("");
  const legalReturnState = { from: "/signup" };

  const getMaximumBirthDate = () => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - 21);
    return today.toISOString().split("T")[0];
  };

  const is21OrOlder = (birthDate) => {
    if (!birthDate) return false;
    const birth = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 21;
  };

  const passwordScore = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const validate = () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCountry = country.trim();
    if (!cleanName || !dateOfBirth || !cleanCountry || !language || !cleanEmail || !password || !confirmPassword) return "Please complete all required fields.";
    if (!is21OrOlder(dateOfBirth)) return "Droxion is only available to people age 21 or older.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    if (!acceptedSafetyTerms) return "You must agree to Droxion's Terms of Use and Community Guidelines before creating an account.";
    return "";
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCountry = country.trim();

    try {
      setLoading(true);
      const { data: created, error: createError } = await supabase.functions.invoke("signup-auto-confirm", {
        body: {
          email: cleanEmail,
          password,
          full_name: cleanName,
          date_of_birth: dateOfBirth,
          gender: gender || null,
          country: cleanCountry,
          language,
          confirmed21: true,
          accepted_terms: true,
          terms_version: TERMS_VERSION,
        },
      });

      if (createError) throw createError;
      if (!created?.ok) throw new Error(created?.error || "Could not create account.");

      const { error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (loginError) throw loginError;

      const { error: termsError } = await supabase.rpc("droxion_record_terms_acceptance", {
        p_terms_version: TERMS_VERSION,
        p_platform: platformName(),
      });
      if (termsError) throw new Error("Account created, but we could not record your Terms acceptance. Please sign in again.");

      navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider) => {
    setError("");
    if (!acceptedSafetyTerms) {
      setError("Please agree to the Terms of Use and Community Guidelines first.");
      return;
    }
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
    <main className="authPremium signup">
      <div className="authPremiumInner">
        <aside className="authSide" aria-hidden="true">STREAM<br />CONNECT<br />BELONG<i /></aside>

        <section className="authCard" aria-label="Create Droxion account">
          <div className="authBrand">
            <div className="authLogo">D</div>
            <div className="authBrandText"><strong>DROXION</strong><span>Meet the world. Live.</span></div>
          </div>
          <p className="authSubtitle">Create your 21+ Droxion account</p>

          {error && <div role="alert" aria-live="polite" className="authAlert error">{error}</div>}

          <form className="authForm" onSubmit={handleSignup}>
            <label className="authLabel" htmlFor="signup-name">Full Name</label>
            <div className="authField"><UserRound size={17} /><input id="signup-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></div>

            <label className="authLabel" htmlFor="signup-dob">Date of Birth</label>
            <div className="authField"><CalendarDays size={17} /><input id="signup-dob" type="date" min="1900-01-01" max={getMaximumBirthDate()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></div>
            <div className="authInlineHint">You must be 21 or older to use Droxion.</div>

            <label className="authLabel" htmlFor="signup-gender">Gender <span style={{ color: "#737c9c", fontWeight: 600 }}>(Optional)</span></label>
            <div className="authField"><UsersRound size={17} /><select id="signup-gender" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Prefer not to provide</option><option value="man">Man</option><option value="woman">Woman</option><option value="nonbinary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>

            <label className="authLabel" htmlFor="signup-country">Country</label>
            <div className="authField"><Globe2 size={17} /><input id="signup-country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States, India, Canada..." required /></div>

            <label className="authLabel" htmlFor="signup-language">Main Language</label>
            <div className="authField"><Languages size={17} /><select id="signup-language" value={language} onChange={(e) => setLanguage(e.target.value)} required><option value="English">English</option><option value="Hindi">Hindi</option><option value="Spanish">Spanish</option><option value="Portuguese">Portuguese</option><option value="French">French</option><option value="Arabic">Arabic</option><option value="German">German</option><option value="Japanese">Japanese</option><option value="Korean">Korean</option><option value="Other">Other</option></select></div>

            <label className="authLabel" htmlFor="signup-email">Email</label>
            <div className="authField"><Mail size={17} /><input id="signup-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>

            <label className="authLabel" htmlFor="signup-password">Password</label>
            <div className="authField"><LockKeyhole size={17} /><input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" required /><button type="button" className="authEye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            <div className="authPasswordStrength" aria-hidden="true">{[0,1,2,3].map(index => <i key={index} className={index < passwordScore ? "on" : ""} />)}</div>

            <label className="authLabel" htmlFor="signup-confirm">Confirm Password</label>
            <div className="authField"><LockKeyhole size={17} /><input id="signup-confirm" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" required /><button type="button" className="authEye" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>

            <label className="authTerms">
              <input type="checkbox" checked={acceptedSafetyTerms} onChange={(e) => { setAcceptedSafetyTerms(e.target.checked); if (e.target.checked) setError(""); }} required />
              <span>I confirm I am 21+ and agree to Droxion's <Link to="/terms" state={legalReturnState} onClick={(e) => e.stopPropagation()}>Terms of Use (EULA)</Link> and <Link to="/community-guidelines" state={legalReturnState} onClick={(e) => e.stopPropagation()}>Community Guidelines</Link>. I understand Droxion has <strong>zero tolerance for objectionable content and abusive users</strong>.</span>
            </label>

            <button type="submit" disabled={busy || !acceptedSafetyTerms} className="authPrimary">{loading ? "Creating account..." : <>Create account <ArrowRight size={18} /></>}</button>
          </form>

          <div className="authDivider"><span>or continue with</span></div>
          <div className="authCompactRow">
            <button type="button" disabled={busy} className="authSocial" onClick={() => handleSocialSignup("apple")}><FaApple size={20} />{socialLoading === "apple" ? "Opening…" : "Continue with Apple"}</button>
            <button type="button" disabled={busy} className="authSocial" onClick={() => handleSocialSignup("google")}><FcGoogle size={20} />{socialLoading === "google" ? "Opening…" : "Continue with Google"}</button>
          </div>

          <div className="authProviderStrip"><span>Support your favorite creators later — connect channels after you join</span><div className="authProviders"><span className="authProvider youtube"><FaYoutube />YouTube</span><span className="authProvider twitch"><FaTwitch />Twitch</span><span className="authProvider kick"><SiKick />Kick</span></div></div>
          <div className="authMeta">Already have an account? <Link to="/login">Sign in</Link> · <Link to="/forgot-password">Reset password</Link><br />Droxion is an adults-only 21+ platform.</div>
        </section>

        <aside className="authSide right" aria-hidden="true">LIVE<br />CREATORS<br />COMMUNITY<br />EVERYWHERE<i /><small>MORE THAN A STREAM.<br />A COMMUNITY.</small></aside>
      </div>
      <div className="authFooterBrand"><strong>DROXION</strong><span>Meet the world. Live.</span></div>
    </main>
  );
}

export default Signup;
