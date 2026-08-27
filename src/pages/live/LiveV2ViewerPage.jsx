import { Link, useParams } from 'react-router-dom';
import RemoteLiveMedia from '../../features/live/components/RemoteLiveMedia';
import { useLiveViewer } from '../../features/live/hooks/useLiveViewer';
import { LIVE_PHASE_LABEL } from '../../features/live/types/liveState';
import '../../features/live/styles/live-v2.css';

export default function LiveV2ViewerPage() {
  const { sessionId = '' } = useParams();
  const { state, videoTrack, audioTrack } = useLiveViewer(sessionId);

  return (
    <main className="liveV2Page liveV2ViewerPage">
      <header className="liveV2Header">
        <div>
          <strong>DROXION LIVE V2</strong>
          <span>viewer test</span>
        </div>
        <Link to="/">Back to Droxion</Link>
      </header>

      <section className="liveV2StatusBar">
        <span className={`liveV2StatusDot liveV2StatusDot-${state.phase}`} />
        <strong>{LIVE_PHASE_LABEL[state.phase] || state.phase}</strong>
      </section>

      <section className="liveV2Stage">
        <RemoteLiveMedia videoTrack={videoTrack} audioTrack={audioTrack} />
      </section>

      {state.error && <div className="liveV2Error">{state.error}</div>}
      <section className="liveV2SessionCard"><strong>Session</strong><code>{sessionId}</code></section>
    </main>
  );
}
