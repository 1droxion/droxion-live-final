// Production LIVE transport facade.
//
// The original implementation is preserved in livekitRoomLegacy.js for the
// helper functions used by the compatibility layer. All product-facing imports
// now resolve directly to the proven V2 connection path so the normal Droxion
// design and the isolated V2 test use the same LiveKit transport behavior.
export * from './livekitRoomV2Compat';
export {
  attachStudioAwareRemoteTrack as attachRemoteTrack,
  detachStudioAwareRemoteTrack as detachRemoteTrack
} from './viewerStudioTrackRouter';
