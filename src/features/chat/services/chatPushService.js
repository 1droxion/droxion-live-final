import { supabase } from '../../../supabaseClient';

export async function queueDirectMessagePush(messageId) {
  const id = String(messageId || '').trim();
  if (!id) return false;

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || '';
    if (!token) return false;

    const response = await fetch('/api/notifications/chat-message', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messageId: id })
    });

    return response.ok;
  } catch {
    // Push delivery must never make a successfully persisted chat message fail.
    return false;
  }
}
