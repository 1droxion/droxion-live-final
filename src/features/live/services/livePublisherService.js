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
  const frameRate = Number(settings.frameRate || 0) || 30;
  return height >= width
    ? { width: 720, height: 1280, frameRate }
    : { width: 1280, height: 720, frameRate };
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
  if (source === Track.Source.ScreenShare) throw new Error('LIVE screen share publication was not stable.');
  if (source === Track.Source.Camera) throw new Error('LIVE camera publication was not stable.');
  throw new Error('LIVE microphone publication was not stable.');
}

async function publishWithRetry(room, track, options, stage, logFailure) {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = mediaTrackOf(track);
    if (!mediaTrack || mediaTrack.readyState !== 'live') throw new Error(`LIVE ${stage} track ended before publishing.`);
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
  const nextTracks = localTracks.map(mediaTrackOf).filter(track => track && track.readyState !== 'ended');
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

function sourceHint(track) {
  return String(track?.__droxionSource || '').toLowerCase();
}

export async function publishHostMediaV2({ room, stream, logFailure }) {
  if (!room || !stream) throw new Error('LIVE room or media stream is missing.');

  const browserVideos = stream.getVideoTracks().filter(track => track.readyState === 'live');
  const browserAudio = stream.getAudioTracks().find(track => track.readyState === 'live');
  if (!browserVideos.length) throw new Error('LIVE video track is missing.');
  if (!browserAudio) throw new Error('LIVE microphone track is missing.');

  const studioMode = Boolean(stream.__droxionStudio);
  const screenTrack = browserVideos.find(track => sourceHint(track) === 'screen') || (studioMode ? browserVideos[0] : null);
  const cameraTrack = browserVideos.find(track => sourceHint(track) === 'camera') || (!studioMode ? browserVideos[0] : null);
  const confirmedTracks = [];
  let confirmedScreen = null;
  let confirmedCamera = null;

  if (screenTrack) {
    try { screenTrack.contentHint = 'motion'; } catch {}
    await publishWithRetry(room, screenTrack, {
      source: Track.Source.ScreenShare,
      simulcast: true,
      videoEncoding: { maxBitrate: 5_500_000, maxFramerate: 60 },
      videoCodec: undefined
    }, 'screen', logFailure);
    confirmedScreen = await waitForPublication(room, Track.Source.ScreenShare);
    confirmedTracks.push(confirmedScreen.track);
  }

  if (cameraTrack) {
    await publishWithRetry(room, cameraTrack, {
      source: Track.Source.Camera,
      simulcast: true,
      videoEncoding: studioMode
        ? { maxBitrate: 1_500_000, maxFramerate: 30 }
        : { maxBitrate: 2_500_000, maxFramerate: 30 },
      videoCodec: undefined
    }, 'camera', logFailure);
    confirmedCamera = await waitForPublication(room, Track.Source.Camera);
    confirmedTracks.push(confirmedCamera.track);
  }

  await publishWithRetry(room, browserAudio, { source: Track.Source.Microphone }, 'microphone', logFailure);
  const confirmedAudio = await waitForPublication(room, Track.Source.Microphone);
  confirmedTracks.push(confirmedAudio.track);

  replaceStreamTracks(stream, confirmedTracks);
  confirmedTracks.forEach(track => {
    const mediaTrack = mediaTrackOf(track);
    if (mediaTrack?.enabled === false) mediaTrack.enabled = true;
  });

  const primaryVideo = mediaTrackOf(confirmedScreen?.track || confirmedCamera?.track);
  return {
    videoPublication: confirmedCamera || confirmedScreen,
    screenPublication: confirmedScreen,
    cameraPublication: confirmedCamera,
    audioPublication: confirmedAudio,
    videoCapture: {
      facingMode: confirmedCamera ? facingFromTrack(mediaTrackOf(confirmedCamera.track)) : 'screen',
      resolution: dimensionsFromTrack(primaryVideo),
      motionOptimized: Boolean(confirmedScreen)
    }
  };
}
