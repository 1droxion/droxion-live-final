import { useEffect } from 'react';
import { supabase } from './supabaseClient';

const recent = new Map();

function shouldReport(message) {
  const text = String(message || '');
  if (typeof document !== 'undefined' && document.querySelector('.liveRoomV4')) return true;
  return /livekit|live video|camera|microphone|mediastream|track|reading ['"]?id/i.test(text);
}

function normalizeError(value) {
  if (value instanceof Error) return value;
  if (value?.error instanceof Error) return value.error;
  const message = typeof value === 'string'
    ? value
    : value?.message || value?.reason?.message || String(value?.reason || value || 'Unknown LIVE client error');
  const error = new Error(message);
  if (value?.stack) error.stack = value.stack;
  return error;
}

async function report(stage, value, context = {}) {
  const error = normalizeError(value);
  if (!shouldReport(error.message)) return;

  const key = `${stage}:${error.message}:${String(error.stack || '').slice(0, 240)}`;
  const now = Date.now();
  const previous = recent.get(key) || 0;
  if (now - previous < 5000) return;
  recent.set(key, now);

  try {
    await supabase.rpc('droxion_log_live_client_error', {
      p_stage: stage,
      p_message: String(error.message || 'Unknown LIVE client error').slice(0, 1000),
      p_stack: String(error.stack || '').slice(0, 8000),
      p_context: {
        href: typeof location !== 'undefined' ? location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ...context
      }
    });
  } catch {}
}

export default function LiveClientDiagnostics() {
  useEffect(() => {
    const onError = event => {
      report('window-error', event?.error || event?.message, {
        filename: event?.filename || '',
        line: event?.lineno || 0,
        column: event?.colno || 0
      });
    };
    const onRejection = event => {
      report('unhandled-rejection', event?.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
