import { getSupabaseConfig, getSupabaseHeaders, getSupabaseUser } from '../../../server/paypal-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);

    const {
      sourcePath,
      sourceFilename,
      sourceSizeBytes,
      sourceMimeType,
      youtubeVideoId,
      youtubeTitle,
      youtubeUrl
    } = req.body || {};

    if (!sourcePath || !String(sourcePath).startsWith(user.id + '/')) {
      return res.status(400).json({ error: 'Invalid creator source path.' });
    }

    const { supabaseUrl } = getSupabaseConfig();
    const headers = {
      ...getSupabaseHeaders(null, true),
      Prefer: 'return=representation'
    };

    const row = {
      user_id: user.id,
      youtube_video_id: youtubeVideoId || null,
      youtube_title: youtubeTitle || null,
      youtube_url: youtubeUrl || null,
      source_bucket: 'droxion-creator-sources',
      source_path: sourcePath,
      source_filename: sourceFilename || null,
      source_size_bytes: Number(sourceSizeBytes || 0) || null,
      source_mime_type: sourceMimeType || null,
      status: 'uploaded',
      metadata: {}
    };

    const response = await fetch(
      `${supabaseUrl}/rest/v1/creator_processing_jobs?select=id,status,created_at,youtube_title,source_filename`,
      { method: 'POST', headers, body: JSON.stringify(row) }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.error || 'Could not create processing job.');

    const job = Array.isArray(payload) ? payload[0] : payload;
    return res.status(201).json({ job });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not create processing job.' });
  }
}
