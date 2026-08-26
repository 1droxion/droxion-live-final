// Keep this workaround scoped to START LIVE only. Some clients complete the
// PostgREST write on the server but stay blocked while the Supabase RPC wrapper
// reads the response body. The browser owns the session ID, the v2 RPC persists
// that exact ID, and the caller receives deterministic JSON once the server
// accepts the request.
if (typeof window !== 'undefined' && !window.__droxionLiveStartResponseBridge) {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const method = String(
      init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET'
    ).toUpperCase();

    const isLiveStart =
      method === 'POST' &&
      /\/rest\/v1\/rpc\/droxion_start_live(?:\?|$)/.test(url);

    if (!isLiveStart) return nativeFetch(input, init);

    const sessionId = globalThis.crypto?.randomUUID?.();
    if (!sessionId) return nativeFetch(input, init);

    let payload = {};
    let bodyText = init?.body;

    if (!bodyText && typeof input !== 'string' && input?.clone) {
      try {
        bodyText = await input.clone().text();
      } catch {}
    }

    try {
      payload = JSON.parse(String(bodyText || '{}'));
    } catch {}

    const nextUrl = url.replace('/rpc/droxion_start_live', '/rpc/droxion_start_live_v2');
    const response = await nativeFetch(nextUrl, {
      ...init,
      body: JSON.stringify({ ...payload, p_session_id: sessionId })
    });

    if (!response.ok) return response;

    return new Response(
      JSON.stringify({
        is_live: true,
        session_id: sessionId,
        title: payload.p_title || 'Live on Droxion',
        tags: Array.isArray(payload.p_tags) ? payload.p_tags : [],
        orientation: payload.p_orientation === 'horizontal' ? 'horizontal' : 'vertical',
        allow_guest_requests: payload.p_allow_guest_requests !== false
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  };

  window.__droxionLiveStartResponseBridge = true;
}
