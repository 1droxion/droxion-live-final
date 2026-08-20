import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (resetError) throw resetError;
      setMessage('If an account exists for this email, a password reset link has been sent. Open the email and choose a new password.');
    } catch (err) {
      setError(err?.message || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-7 shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-3xl font-black tracking-tight">DROXION</div>
          <div className="text-purple-400 mt-2 font-semibold">Reset your password</div>
          <p className="text-gray-400 text-sm mt-2">We will email you a secure reset link.</p>
        </div>

        {error && <div role="alert" className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{error}</div>}
        {message && <div role="status" className="mb-5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">{message}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="reset-email" className="block text-sm mb-2">Email</label>
          <input id="reset-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />
          <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-3 rounded-xl font-bold">{loading ? 'Sending...' : 'Send Reset Email'}</button>
        </form>

        <div className="text-center text-sm text-gray-400 mt-6"><Link to="/login" className="text-purple-400 font-semibold">Back to Login</Link></div>
      </div>
    </div>
  );
}
