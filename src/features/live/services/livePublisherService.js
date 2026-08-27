import { Track } from 'livekit-client';

const PUBLISH_RETRY_DELAYS_MS = [0, 180, 520];
const CONFIRM_POLL_MS = 120;
const CONFIRM_TIMEOUT_MS = 4000;

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function mediaTrackOf(track) {
  return track?.mediaStreamTrack || track || null;
}

function facingFromTrack(track) {
  const settings = track?.getSettings?.() || {};
  const text = String(settings.facingMode || track?.label || '').toLowerCase();
  return text.includes('environment') || text.includes('rear') || text.includes('back')
    ? 'environment'
    : 'user';
}

function dimensionsFromTrack(track) {
  const settings = track?.getSettings?.() || {};
  const width = Number(settings.width || 0);
  const height = Number(settings.height || 0);
  return height >= width
    ? { width: 720, height: 1280, frameRate: 30 }
    : { width: 1280, height: 720, frameRate: 30 };
}

function localPublication(room, source) {
  const direct = room?.localParticipant?.getTrackPublication?.(source);
  if (direct?.track) return direct;
  const publications = room?.localParticipant?.trackPublications?.values
    ? Array.from(room.localParticipant.trackPublications.values())
    : [];
  return publications.find(publication =>
    publication?.track && (publication.source === source || publication.track?.source === source)
  ) || null;
}

async function waitForPublication(room, source) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CONFIRM_TIMEOUT_MS) {
    const publication = localPublication(room, source);
    const mediaTrack = mediaTrackOf(publication?.track);
    if (publication?.track && mediaTrack?.readyState === 'live') return publication;
    await wait(CONFIRM_POLL_MS);
  }
  throw new Error(source === Track.Source.Camera
    ? 'LIVE camera publication was not stable.'
    : 'LIVE microphone publication was not stable.');
}

async function publishWithRetry(room, track, options, stage, logFailure) {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = mediaTrackOf(track);
    if (!mediaTrack || mediaTrack.readyState !== 'live') {
      throw new Error(stage === 'camera'
        ? 'LIVE camera track ended before publishing.'
        : 'LIVE microphone track ended before publishing.');
    }

    try {
      const publication = await room.localParticipant.publishTrack(track, options);
      if (publication?.track) return publication;
      lastError = new Error(`LIVE ${stage} publication has no local track.`);
    } catch (error) {
      lastError = error;
      await logFailure?.(`v2-publish-${stage}`, error, {
        trackId: mediaTrack.id || '',
        readyState: mediaTrack.readyState || '',
        muted: Boolean(mediaTrack.muted)
      });
    }
  }
  throw lastError || new Error(`LIVE ${stage} could not publish.`);
}

function replaceStreamTracks(stream, localTracks) {
  const nextTracks = localTracks
    .map(mediaTrackOf)
    .filter(track => track && track.readyState !== 'ended');
  const keep = new Set(nextTracks);

  stream.getTracks().forEach(track => {
    if (keep.has(track)) return;
    try { stream.removeTrack(track); } catch {}
    try { track.stop(); } catch {}
  });

  nextTracks.forEach(track => {
    if (!stream.getTracks().includes(track)) {
      try { stream.addTrack(track); } catch {}
    }
  });
}

export async function publishHostMediaV2({ room, stream, logFailure }) {
  if (!room || !stream) throw new Error('LIVE room or camera stream is missing.');

  const browserVideo = stream.getVideoTracks().find(track => track.readyState === 'live');
  const browserAudio = stream.getAudioTracks().find(track => track.readyState === 'live');
  if (!browserVideo) throw new Error('LIVE camera track is missing.');
  if (!browserAudio) throw new Error('LIVE microphone track is missing.');

  const videoPublication = await publishWithRetry(room, browserVideo, {
    source: Track.Source.Camera,
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
    videoCodec: undefined
  }, 'camera', logFailure);

  const confirmedVideo = await waitForPublication(room, Track.Source.Camera);
  const videoMediaTrack = mediaTrackOf(confirmedVideo.track || videoPublication.track);
  if (!videoMediaTrack || videoMediaTrack.readyState !== 'live') {
    throw new Error('LIVE camera was published but its track is not live.');
  }

  const audioPublication = await publishWithRetry(room, browserAudio, {
    source: Track.Source.Microphone
  }, 'microphone', logFailure);
  const confirmedAudio = await waitForPublication(room, Track.Source.Microphone);

  // This is the important handoff used by the previously working LIVE path:
  // keep the exact LocalTracks owned by LiveKit in the same MediaStream used by
  // the local preview. It prevents the browser preview track and published
  // track from drifting apart or one being stopped independently.
  replaceStreamTracks(stream, [confirmedVideo.track, confirmedAudio.track]);

  const publishedVideo = mediaTrackOf(confirmedVideo.track);
  const publishedAudio = mediaTrackOf(confirmedAudio.track);
  if (publishedVideo?.enabled === false) publishedVideo.enabled = true;
  if (publishedAudio?.enabled === false) publishedAudio.enabled = true;

  return {
    videoPublication: confirmedVideo,
    audioPublication: confirmedAudio,
    videoCapture: {
      facingMode: facingFromTrack(publishedVideo),
      resolution: dimensionsFromTrack(publishedVideo)
    }
  };
}
