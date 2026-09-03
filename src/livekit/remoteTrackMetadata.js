const metadataByTrack = new WeakMap();

export function rememberRemoteTrackMetadata(track, publication) {
  if (!track) return null;
  const metadata = {
    name: String(publication?.trackName || publication?.name || publication?.track?.name || track?.name || ''),
    source: publication?.source || publication?.track?.source || track?.source || '',
    sid: String(publication?.trackSid || publication?.sid || '')
  };
  metadataByTrack.set(track, metadata);
  return metadata;
}

export function remoteTrackMetadata(track) {
  return track ? (metadataByTrack.get(track) || null) : null;
}

export function forgetRemoteTrackMetadata(track) {
  if (track) metadataByTrack.delete(track);
}
