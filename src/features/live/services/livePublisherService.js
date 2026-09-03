import { Track } from 'livekit-client';
import { mediaTrackSnapshot, publicationSnapshot, recordScreenShareDiagnostic } from '../../../livekit/screenShareDiagnostics';

const PUBLISH_RETRY_DELAYS_MS = [0, 180, 520];
const CONFIRM_POLL_MS = 120;
const CONFIRM_TIMEOUT_MS = 5000;

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
  return {
    width: width || (height > width ? 720 : 1280),
    height: height || (height > width ? 1280 : 720),
    frameRate
  };
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

async function waitForPublication(room, source, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CONFIRM_TIMEOUT_MS) {
    const publication = localPublication(room, source);
    const mediaTrack = mediaTrackOf(publication?.track);
    if (publication?.track && mediaTrack?.readyState === 'live') return publication;
    await wait(CONFIRM_POLL_MS);
  }
  throw new Error(`${label || 'LIVE video'} publication was not stable.`);
}

async function publishWithRetry(room, track, options, stage, logFailure) {
  let lastError = null;
  for (const delay of PUBLISH_RETRY_DELAYS_MS) {
    if (delay) await wait(delay);
    const mediaTrack = mediaTrackOf(track);
    if (!mediaTrack || mediaTrack.readyState !== 'live') {
      throw new Error(`LIVE ${stage} track ended before publishing.`);
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

function liveTracks(stream) {
  return {
    videos: stream.getVideoTracks().filter(track => track.readyState === 'live'),
    audio: stream.getAudioTracks().find(track => track.readyState === 'live') || null
  };
}

function studioVideoTracks(stream, videos) {
  const studio = stream?.__droxionStudio || null;
  if (!studio) return null;
  const screen = videos.find(track => track.__droxionSource === 'screen') || videos[0] || null;
  const camera = studio.mode === 'screen_camera'
    ? (videos.find(track => track.__droxionSource === 'camera') || videos.find(track => track !== screen) || null)
    : null;
  return { studio, screen, camera };
}

function safeSegment(value, fallback = '') {
  return String(value ?? fallback).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').slice(0, 48);
}

function facecamTrackName(studio = {}) {
  const position = studio.facecamPosition || {};
  const x = Math.round(Number(position.x || 0) * 1000);
  const y = Math.round(Number(position.y || 0) * 1000);
  const size = Math.round(Number(position.size || 0) * 1000);
  return [
    'droxion_facecam',
    safeSegment(studio.orientation, 'horizontal'),
    safeSegment(studio.layout, 'free_facecam'),
    `${x}-${y}-${size}`
  ].join('__');
}

function screenTrackName(studio = {}) {
  return [
    'droxion_screen',
    safeSegment(studio.orientation, 'horizontal'),
    safeSegment(studio.layout, studio.orientation === 'vertical' ? 'split_70_30' : 'free_facecam')
  ].join('__');
}

function facecamPublishOptions(studio = {}) {
  return {
    source: Track.Source.Camera,
    name: facecamTrackName(studio),
    simulcast: true,
    videoEncoding: { maxBitrate: 1_200_000, maxFramerate: 30 },
    videoCodec: undefined
  };
}

async function publishAudio(room, browserAudio, logFailure) {
  if (!browserAudio) throw new Error('LIVE microphone track is missing.');
  await publishWithRetry(room, browserAudio, {
    source: Track.Source.Microphone,
    name: 'droxion_live_audio'
  }, 'microphone', logFailure);
  return waitForPublication(room, Track.Source.Microphone, 'LIVE microphone');
}

async function publishScreenTrack(room, screenTrack, logFailure, studio = {}) {
  if (!screenTrack) throw new Error('LIVE screen-share track is missing.');
  const settings = screenTrack.getSettings?.() || {};
  const requestedFps = Number(settings.frameRate || 0);
  const maxFramerate = requestedFps > 35 ? 60 : 30;
  const maxBitrate = maxFramerate > 30 ? 4_000_000 : 3_000_000;

  recordScreenShareDiagnostic('host-publish-start', {
    track: mediaTrackSnapshot(screenTrack),
    requestedMaxFramerate: maxFramerate,
    requestedMaxBitrate: maxBitrate
  });

  await publishWithRetry(room, screenTrack, {
    source: Track.Source.ScreenShare,
    name: screenTrackName(studio),
    simulcast: true,
    videoEncoding: { maxBitrate, maxFramerate },
    videoCodec: undefined
  }, 'screen', logFailure);
  const publication = await waitForPublication(room, Track.Source.ScreenShare, 'LIVE screen');
  recordScreenShareDiagnostic('host-published', {
    track: mediaTrackSnapshot(mediaTrackOf(publication.track)),
    publication: publicationSnapshot(publication)
  });
  return publication;
}

async function publishCameraTrack(room, cameraTrack, logFailure, { facecam = false, studio = null } = {}) {
  if (!cameraTrack) throw new Error(facecam ? 'LIVE facecam track is missing.' : 'LIVE camera track is missing.');
  await publishWithRetry(room, cameraTrack, facecam ? facecamPublishOptions(studio || {}) : {
    source: Track.Source.Camera,
    name: 'droxion_camera',
    simulcast: true,
    videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 },
    videoCodec: undefined
  }, facecam ? 'facecam' : 'camera', logFailure);
  return waitForPublication(room, Track.Source.Camera, facecam ? 'LIVE facecam' : 'LIVE camera');
}

export async function refreshLiveFacecamLayout({ room, stream, logFailure }) {
  if (!room || !stream?.__droxionStudio || stream.__droxionStudio.mode !== 'screen_camera') return null;
  const { videos } = liveTracks(stream);
  const studioTracks = studioVideoTracks(stream, videos);
  if (!studioTracks?.camera) return null;

  const current = localPublication(room, Track.Source.Camera);
  const currentTrack = current?.track || studioTracks.camera;
  const mediaTrack = mediaTrackOf(currentTrack);
  if (!mediaTrack || mediaTrack.readyState !== 'live') return null;
  const wasMuted = Boolean(current?.isMuted);

  try {
    if (current?.track) await room.localParticipant.unpublishTrack(current.track, false);
    const publication = await publishWithRetry(
      room,
      currentTrack,
      facecamPublishOptions(stream.__droxionStudio),
      'facecam-layout-refresh',
      logFailure
    );
    if (wasMuted) await publication?.mute?.();
    return publication;
  } catch (error) {
    await logFailure?.('v2-facecam-layout-refresh', error, {
      trackId: mediaTrack.id || '',
      readyState: mediaTrack.readyState || ''
    });
    throw error;
  }
}

export async function publishHostMediaV2({ room, stream, logFailure }) {
  if (!room || !stream) throw new Error('LIVE room or media stream is missing.');

  const { videos, audio } = liveTracks(stream);
  if (!videos.length) throw new Error('LIVE video track is missing.');
  if (!audio) throw new Error('LIVE microphone track is missing.');

  const studioTracks = studioVideoTracks(stream, videos);
  if (studioTracks) {
    const screenPublication = await publishScreenTrack(room, studioTracks.screen, logFailure, studioTracks.studio);
    const cameraPublication = studioTracks.camera
      ? await publishCameraTrack(room, studioTracks.camera, logFailure, { facecam: true, studio: studioTracks.studio })
      : null;
    const audioPublication = await publishAudio(room, audio, logFailure);

    const screenMediaTrack = mediaTrackOf(screenPublication.track);
    const cameraMediaTrack = mediaTrackOf(cameraPublication?.track);
    const audioMediaTrack = mediaTrackOf(audioPublication.track);
    if (screenMediaTrack?.enabled === false) screenMediaTrack.enabled = true;
    if (cameraMediaTrack?.enabled === false) cameraMediaTrack.enabled = true;
    if (audioMediaTrack?.enabled === false) audioMediaTrack.enabled = true;

    return {
      videoPublication: screenPublication,
      screenPublication,
      cameraPublication,
      audioPublication,
      videoCapture: {
        source: 'screen',
        resolution: dimensionsFromTrack(screenMediaTrack),
        motionOptimized: true,
        hasFacecam: Boolean(cameraPublication)
      }
    };
  }

  const browserVideo = videos[0];
  const videoPublication = await publishCameraTrack(room, browserVideo, logFailure);
  const audioPublication = await publishAudio(room, audio, logFailure);

  replaceStreamTracks(stream, [videoPublication.track, audioPublication.track]);

  const publishedVideo = mediaTrackOf(videoPublication.track);
  const publishedAudio = mediaTrackOf(audioPublication.track);
  if (publishedVideo?.enabled === false) publishedVideo.enabled = true;
  if (publishedAudio?.enabled === false) publishedAudio.enabled = true;

  return {
    videoPublication,
    audioPublication,
    videoCapture: {
      source: 'camera',
      facingMode: facingFromTrack(publishedVideo),
      resolution: dimensionsFromTrack(publishedVideo),
      motionOptimized: false,
      hasFacecam: false
    }
  };
}