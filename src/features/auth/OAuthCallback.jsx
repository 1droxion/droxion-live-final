import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { finalizeOAuthLogin } from './services/socialAuthService';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await finalizeOAuthLogin();
        if (active) navigate('/', { replace: true });
      } catch (err) {
        if (active) setError(err?.message || 'Unable to finish sign in.');
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-[#07070b] text-white grid place-items-center px-4">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111118] p-7 text-center shadow-2xl">
        <div className="text-2xl font-black tracking-tight">DROXION</div>
        {!error ? (
          <>
            <div className="mx-auto mt-7 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-purple-400" aria-hidden="true" />
            <p className="mt-5 text-sm text-gray-300">Finishing secure sign in…</p>
          </>
        ) : (
          <>
            <div role="alert" className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
            <button type="button" onClick={() => navigate('/login', { replace: true })} className="mt-5 w-full rounded-xl bg-purple-600 py-3 font-bold hover:bg-purple-500">Back to Sign In</button>
          </>
        )}
      </section>
    </main>
  );
}
