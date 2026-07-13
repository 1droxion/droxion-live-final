import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);

      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            credits: 10,
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      // If email confirmation is disabled, Supabase returns a session immediately.
      if (data.session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      setMessage(
        "Account created. Check your email and click the confirmation link."
      );
    } catch (err) {
      setError(err?.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#0b1120] px-4">
      <div className="bg-[#111827] p-8 rounded-xl shadow-lg w-full max-w-sm text-white border border-gray-700">
        <h2 className="text-xl font-bold text-center mb-6">
          Create your Droxion account
        </h2>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mb-4 rounded border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300"
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <label htmlFor="name" className="block mb-2 text-sm font-medium">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 mb-4 rounded bg-gray-800 text-white border border-gray-600 outline-none focus:border-green-500"
            required
          />

          <label htmlFor="email" className="block mb-2 text-sm font-medium">
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

          <label htmlFor="password" className="block mb-2 text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
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
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="text-sm mt-4 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
