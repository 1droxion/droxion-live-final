import LiveClientDiagnostics from './LiveClientDiagnostics';
import ExternalVerticalLiveFeed from './ExternalVerticalLiveFeed';
import './live-first-app.css';

export default function LiveFirstApp() {
  return (
    <main className="droxionVerticalShell">
      <LiveClientDiagnostics />
      <ExternalVerticalLiveFeed />
      <div className="droxionVerticalBrand" aria-hidden="true">DROXION</div>
    </main>
  );
}
