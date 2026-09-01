import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

const TERMS_VERSION = "2026-08-29-guideline-1-2";

function platformName() {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
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
  const [acceptedSafetyTerms, setAcceptedSafetyTerms] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCountry = country.trim();

    if (!cleanName || !dateOfBirth || !cleanCountry || !language || !cleanEmail || !password) {
      setError("Please complete all required fields.");
      return;
    }
    if (!is21OrOlder(dateOfBirth)) {
      setError("Droxion is only available to people age 21 or older.");
      return;
    }
    if (!acceptedSafetyTerms) {
      setError("You must agree to Droxion's Terms of Use and Community Guidelines before creating an account.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

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
      setError(err?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-[#111118] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-3xl font-black tracking-tight">DROXION</div>
          <div className="mt-2 text-purple-400 font-semibold">Meet the world. Live.</div>
          <p className="text-sm text-gray-400 mt-2">Create your 21+ Droxion account</p>
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

        <form onSubmit={handleSignup}>
          <label htmlFor="name" className="block mb-2 text-sm font-medium">Full Name</label>
          <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full p-3 mb-4 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required />

          <label htmlFor="dob" className="block mb-2 text-sm font-medium">Date of Birth</label>
          <input id="dob" type="date" min="1900-01-01" max={getMaximumBirthDate()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full p-3 mb-2 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required />
          <p className="text-xs text-gray-500 mb-4">You must be 21 or older to use Droxion.</p>

          <label htmlFor="gender" className="block mb-2 text-sm font-medium">Gender <span className="text-gray-500 font-normal">(Optional)</span></label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-3 mb-4 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500">
            <option value="">Prefer not to provide</option>
            <option value="man">Man</option>
            <option value="woman">Woman</option>
            <option value="nonbinary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>

          <label htmlFor="country" className="block mb-2 text-sm font-medium">Country</label>
          <input id="country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States, India, Canada..." className="w-full p-3 mb-4 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required />

          <label htmlFor="language" className="block mb-2 text-sm font-medium">Main Language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-3 mb-4 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required>
            <option value="English">English</option><option value="Hindi">Hindi</option><option value="Spanish">Spanish</option><option value="Portuguese">Portuguese</option><option value="French">French</option><option value="Arabic">Arabic</option><option value="German">German</option><option value="Japanese">Japanese</option><option value="Korean">Korean</option><option value="Other">Other</option>
          </select>

          <label htmlFor="email" className="block mb-2 text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full p-3 mb-4 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required />

          <label htmlFor="password" className="block mb-2 text-sm font-medium">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" className="w-full p-3 mb-5 rounded-xl bg-[#191922] text-white border border-white/10 outline-none focus:border-purple-500" required />

          <label className="flex items-start gap-3 mb-6 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <input type="checkbox" checked={acceptedSafetyTerms} onChange={(e) => setAcceptedSafetyTerms(e.target.checked)} className="mt-1" required />
            <span className="text-xs leading-5 text-gray-300">
              I confirm I am 21+ and agree to Droxion's <Link to="/terms" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Terms of Use (EULA)</Link> and <Link to="/community-guidelines" state={legalReturnState} className="text-purple-400 underline" onClick={(e) => e.stopPropagation()}>Community Guidelines</Link>. I understand Droxion has <strong className="text-white">zero tolerance for objectionable content and abusive users</strong>.
            </span>
          </label>

          <button type="submit" disabled={loading || !acceptedSafetyTerms} className="w-full bg-purple-600 hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 text-white py-3 px-4 rounded-xl font-bold transition">{loading ? "Creating account..." : "Create Droxion Account"}</button>
        </form>

        <div className="text-sm mt-6 text-center text-gray-400">Already have an account? <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold">Login</Link></div>
        <div className="text-sm mt-3 text-center"><Link to="/forgot-password" className="text-purple-400 hover:text-purple-300 font-semibold">Reset password</Link></div>
        <div className="text-xs text-center text-gray-600 mt-5">Droxion is an adults-only 21+ social discovery platform.</div>
      </div>
    </div>
  );
}

export default Signup;
