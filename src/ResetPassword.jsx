import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setReady(Boolean(data?.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated successfully. You can now sign in with your new password.');
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      window.setTimeout(() => navigate('/login?reset=success', { replace: true }), 900);
    } catch (err) {
      setError(err?.message || 'Could not update your password. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-3xl p-7 shadow-2xl">
        <div className="text-center mb-7">
          <div className="text-3xl font-black tracking-tight">DROXION</div>
          <div className="text-purple-400 mt-2 font-semibold">Choose a new password</div>
          <p className="text-gray-400 text-sm mt-2">Enter your new Droxion password below.</p>
        </div>

        {error && <div role="alert" className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">{error}</div>}
        {message && <div role="status" className="mb-5 bg-green-500/10 border border-green-500/30 text-green-300 rounded-xl p-3 text-sm">{message}</div>}

        {!ready ? (
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-5">This reset link is missing, expired, or still loading.</p>
            <Link to="/forgot-password" className="inline-block bg-purple-600 hover:bg-purple-500 py-3 px-5 rounded-xl font-bold">Send a New Reset Link</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="new-password" className="block text-sm mb-2">New Password</label>
            <input id="new-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Minimum 8 characters" className="w-full p-3 mb-5 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

            <label htmlFor="confirm-new-password" className="block text-sm mb-2">Confirm New Password</label>
            <input id="confirm-new-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="Enter it again" className="w-full p-3 mb-6 bg-[#191922] border border-white/10 rounded-xl outline-none focus:border-purple-500" />

            <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 py-3 rounded-xl font-bold">{loading ? 'Updating...' : 'Update Password'}</button>
          </form>
        )}

        <div className="text-center text-sm text-gray-400 mt-6"><Link to="/login" className="text-purple-400 font-semibold">Back to Login</Link></div>
      </div>
    </div>
  );
}
