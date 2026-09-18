import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig, getSupabaseUser } from '../../../server/paypal-lib.js';

function backendUrl() {
  return (process.env.DROXION_BACKEND_URL || process.env.VITE_BACKEND_URL || 'https://droxion-backend.onrender.com').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const auth = String(req.headers.authorization || '');
    const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const jobId = String(req.body?.jobId || '');
    if (!jobId) return res.status(400).json({ error: 'jobId is required.' });

    const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: job, error: jobError } = await admin
      .from('creator_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return res.status(404).json({ error: 'Processing job not found.' });
    if (!['uploaded', 'failed'].includes(job.status)) {
      return res.status(409).json({ error: `Job is already ${job.status}.`, job });
    }

    const { data: sourceSigned, error: sourceError } = await admin.storage
      .from(job.source_bucket || 'droxion-creator-sources')
      .createSignedUrl(job.source_path, 60 * 30);
    if (sourceError || !sourceSigned?.signedUrl) {
      throw sourceError || new Error('Could not sign creator source.');
    }

    const outputCount = 3;
    const outputs = [];
    for (let index = 1; index <= outputCount; index += 1) {
      const path = `${user.id}/${job.id}/clip-${index}.mp4`;
      const { data, error } = await admin.storage
        .from('droxion-creator-clips')
        .createSignedUploadUrl(path, { upsert: true });
      if (error || !data?.signedUrl) throw error || new Error('Could not create clip upload destination.');
      outputs.push({ path, signed_url: data.signedUrl, token: data.token });
    }

    await admin
      .from('creator_processing_jobs')
      .update({
        status: 'processing',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .eq('user_id', user.id);

    const workerResponse = await fetch(`${backendUrl()}/creator/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        source_url: sourceSigned.signedUrl,
        outputs: outputs.map(item => ({ path: item.path, signed_url: item.signed_url }))
      }),
      signal: AbortSignal.timeout(115000)
    });

    const workerPayload = await workerResponse.json().catch(() => ({}));
    if (!workerResponse.ok || !workerPayload?.ok) {
      const message = workerPayload?.error || `Worker failed with status ${workerResponse.status}.`;
      await admin
        .from('creator_processing_jobs')
        .update({
          status: 'failed',
          error_message: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('user_id', user.id);
      throw new Error(message);
    }

    const clipRows = [];
    for (const clip of workerPayload.clips || []) {
      const { data: signed } = await admin.storage
        .from('droxion-creator-clips')
        .createSignedUrl(clip.path, 60 * 60);
      clipRows.push({ ...clip, preview_url: signed?.signedUrl || null });
    }

    const metadata = {
      ...(job.metadata || {}),
      processor: workerPayload.processor || 'ffmpeg-v1',
      source_duration_seconds: workerPayload.source_duration_seconds || null,
      clips: clipRows
    };

    const { data: updated, error: updateError } = await admin
      .from('creator_processing_jobs')
      .update({
        status: 'complete',
        metadata,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id)
      .eq('user_id', user.id)
      .select('id,status,youtube_title,source_filename,metadata,error_message,updated_at')
      .single();

    if (updateError) throw updateError;
    return res.status(200).json({ job: updated });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Could not process creator job.' });
  }
}
