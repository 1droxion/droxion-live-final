import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LocalLiveVideo from '../../features/live/components/LocalLiveVideo';
import { useLiveBroadcast } from '../../features/live/hooks/useLiveBroadcast';
import { LIVE_PHASE, LIVE_PHASE_LABEL, isLiveBusy } from '../../features/live/types/liveState';
import '../../features/live/styles/live-v2.css';

export default function LiveV2Page() {
  const { state, mediaStream, ensurePreview, stopPreview, startBroadcast, endBroadcast } = useLiveBroadcast();
  const [title, setTitle] = useState('Live on Droxion');
  const [orientation, setOrientation] = useState('vertical');

  const viewerUrl = useMemo(() => {
    if (!state.sessionId || typeof window === 'undefined') return '';
    return `${window.location.origin}/live-v2/view/${state.sessionId}`;
  }, [state.sessionId]);

  const busy = isLiveBusy(state.phase);
  const active = [LIVE_PHASE.LIVE, LIVE_PHASE.RECONNECTING, LIVE_PHASE.CONNECTING].includes(state.phase)
    && Boolean(state.sessionId);

  return (
    <main className="liveV2Page">
      <header className="liveV2Header">
        <div>
          <strong>DROXION LIVE V2</strong>
          <span>isolated transport test</span>
        </div>
        <Link to="/">Back to Droxion</Link>
      </header>

      <section className="liveV2StatusBar">
        <span className={`liveV2StatusDot liveV2StatusDot-${state.phase}`} />
        <strong>{LIVE_PHASE_LABEL[state.phase] || state.phase}</strong>
        <span>{state.transportState}</span>
        {state.phase === LIVE_PHASE.LIVE && <span>{state.viewerCount} viewer{state.viewerCount === 1 ? '' : 's'}</span>}
      </section>

      <section className={`liveV2Stage ${orientation === 'horizontal' ? 'liveV2Horizontal' : ''}`}>
        {mediaStream ? <LocalLiveVideo stream={mediaStream} /> : <div className="liveV2Placeholder">Camera preview will appear here.</div>}
        {state.phase === LIVE_PHASE.LIVE && <div className="liveV2Badge">LIVE</div>}
      </section>

      {state.error && <div className="liveV2Error">{state.error}</div>}

      <section className="liveV2Controls">
        <label>
          <span>LIVE title</span>
          <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} disabled={active || busy} />
        </label>
        <label>
          <span>Orientation</span>
          <select value={orientation} onChange={event => setOrientation(event.target.value)} disabled={active || busy}>
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>

        <div className="liveV2Buttons">
          {!mediaStream && !active && <button type="button" onClick={() => ensurePreview({ orientation })} disabled={busy}>Open camera preview</button>}
          {mediaStream && !active && <button type="button" className="liveV2Secondary" onClick={stopPreview} disabled={busy}>Close preview</button>}
          {!active && <button type="button" className="liveV2Primary" onClick={() => startBroadcast({ title, orientation })} disabled={busy}>{state.phase === LIVE_PHASE.STARTING ? 'Starting…' : 'Start LIVE'}</button>}
          {active && <button type="button" className="liveV2Danger" onClick={endBroadcast} disabled={state.phase === LIVE_PHASE.ENDING}>End LIVE</button>}
        </div>
      </section>

      {viewerUrl && <section className="liveV2SessionCard">
        <strong>Second-phone viewer test</strong>
        <code>{state.sessionId}</code>
        <a href={viewerUrl} target="_blank" rel="noreferrer">{viewerUrl}</a>
        <button type="button" onClick={() => navigator.clipboard?.writeText(viewerUrl)}>Copy viewer link</button>
      </section>}

      <section className="liveV2Checklist">
        <strong>V2 acceptance test</strong>
        <ol>
          <li>Camera preview opens.</li>
          <li>Start LIVE reaches “You are live”.</li>
          <li>Second signed-in phone opens viewer link and receives video + audio.</li>
          <li>Heartbeat keeps the server session active.</li>
          <li>End LIVE disconnects transport and server state.</li>
        </ol>
      </section>
    </main>
  );
}
