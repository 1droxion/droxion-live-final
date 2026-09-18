import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig, getSupabaseUser } from '../../../server/paypal-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');

    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let query = admin
      .from('creator_processing_jobs')
      .select('id,status,youtube_title,source_filename,metadata,error_message,created_at,updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const jobId = String(req.query?.jobId || '');
    if (jobId) query = query.eq('id', jobId);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (data?.metadata?.clips?.length) {
      const clips = [];
      for (const clip of data.metadata.clips) {
        const { data: signed } = await admin.storage
          .from('droxion-creator-clips')
          .createSignedUrl(clip.path, 60 * 60);
        clips.push({ ...clip, preview_url: signed?.signedUrl || clip.preview_url || null });
      }
      data.metadata = { ...data.metadata, clips };
    }

    return res.status(200).json({ job: data || null });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not load creator job.' });
  }
}
