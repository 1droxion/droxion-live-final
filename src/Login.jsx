import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#0b1120] px-4">
      <div className="bg-[#111827] p-8 rounded-xl shadow-lg w-full max-w-sm text-white border border-gray-700">
        <h2 className="text-xl font-bold text-center mb-6">
          Login to Droxion
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label
            htmlFor="email"
            className="block mb-2 text-sm font-medium"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2.5 mb-4 rounded bg-gray-800 text-white border border-gray-600 outline-none focus:border-green-500"
            required
          />

          <label
            htmlFor="password"
            className="block mb-2 text-sm font-medium"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2.5 mb-6 rounded bg-gray-800 text-white border border-gray-600 outline-none focus:border-green-500"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 text-white py-2.5 px-4 rounded font-semibold"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="text-sm mt-4 text-center">
          <Link
            to="/signup"
            className="text-blue-400 hover:underline"
          >
            Create an account
          </Link>
        </div>

        <div className="text-xs mt-3 text-center text-gray-400">
          Forgot password?{" "}
          <a
            href="mailto:support@droxion.com"
            className="text-blue-400 hover:underline"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
