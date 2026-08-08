import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-7 shadow-2xl">

        <div className="text-center mb-8">
          <div className="text-3xl font-black tracking-tight">
            DROXION
          </div>

          <div className="text-purple-400 mt-2 font-semibold">
            Meet the world. Live.
          </div>

          <p className="text-gray-400 text-sm mt-2">
            Sign in to your 21+ Droxion account
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label className="block text-sm mb-2">
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500"
          />

          <label className="block text-sm mb-2">
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="Your password"
            className="w-full p-3 mb-6 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-3 rounded-xl font-bold"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400 mt-6">
          New to Droxion?{" "}
          <Link
            to="/signup"
            className="text-purple-400 font-semibold"
          >
            Create account
          </Link>
        </div>

        <div className="text-center text-xs text-gray-600 mt-5">
          Droxion is for adults age 21+.
        </div>

      </div>
    </div>
  );
}
