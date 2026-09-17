import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Facebook,
  Film,
  Home,
  Instagram,
  Link2,
  Music2,
  Play,
  Plus,
  Radio,
  Rocket,
  Settings,
  Sparkles,
  Upload,
  WandSparkles,
  Youtube,
  Zap
} from 'lucide-react';
import './creator-autopilot-studio.css';

const CHANNELS = [
  {
    id: 'youtube',
    name: 'YouTube',
    purpose: 'Source videos + Shorts publishing',
    icon: Youtube,
    env: 'VITE_YOUTUBE_OAUTH_URL'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    purpose: 'Publish Reels automatically',
    icon: Instagram,
    env: 'VITE_INSTAGRAM_OAUTH_URL'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    purpose: 'Direct short-form publishing',
    icon: Music2,
    env: 'VITE_TIKTOK_OAUTH_URL'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    purpose: 'Publish Reels automatically',
    icon: Facebook,
    env: 'VITE_FACEBOOK_OAUTH_URL'
  }
];

const NAV = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'create', label: 'Create', icon: WandSparkles },
  { id: 'channels', label: 'Channels', icon: Link2 },
  { id: 'autopilot', label: 'Autopilot', icon: Zap },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 }
];

function envValue(name) {
  return import.meta.env?.[name] || '';
}

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <article className="studioMetric">
      <div className="studioMetricIcon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="studioEmpty">
      <div className="studioEmptyIcon"><Icon size={24} /></div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export default function CreatorAutopilotStudio({ initialTab = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [notice, setNotice] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);

  const oauthReady = useMemo(() => {
    return Object.fromEntries(CHANNELS.map(channel => [channel.id, Boolean(envValue(channel.env))]));
  }, []);

  const configuredCount = Object.values(oauthReady).filter(Boolean).length;

  function connectChannel(channel) {
    const url = envValue(channel.env);
    if (!url) {
      setNotice(`${channel.name} OAuth is not configured yet. Add ${channel.env} after the provider app is approved.`);
      return;
    }
    window.location.assign(url);
  }

  function createFromUrl(event) {
    event.preventDefault();
    const clean = videoUrl.trim();
    if (!clean) {
      setNotice('Paste a YouTube or video URL first.');
      return;
    }
    const apiUrl = envValue('VITE_DROXION_AUTOPILOT_API_URL');
    if (!apiUrl) {
      setNotice('The Droxion processing API is not connected yet. The Creator Studio UI is ready; the processing endpoint is the next backend step.');
      return;
    }
    window.location.assign(`${apiUrl.replace(/\/$/, '')}/new?url=${encodeURIComponent(clean)}`);
  }

  function toggleAutopilot() {
    if (configuredCount === 0) {
      setNotice('Connect at least one publishing provider before turning on Autopilot.');
      setActiveTab('channels');
      return;
    }
    setAutopilotEnabled(value => !value);
    setNotice('');
  }

  return (
    <div className="studioShell">
      <aside className="studioSidebar">
        <div className="studioBrand">
          <div className="studioBrandMark">D</div>
          <div><strong>Droxion</strong><span>Creator OS</span></div>
        </div>

        <nav className="studioNav" aria-label="Creator Studio navigation">
          {NAV.map(item => {
            const Icon = item.icon;
            const selected = item.id === activeTab;
            return (
              <button
                type="button"
                key={item.id}
                className={selected ? 'active' : ''}
                onClick={() => { setActiveTab(item.id); setNotice(''); }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="studioSidebarFoot">
          <div className="studioPlanBadge"><Sparkles size={15} /><span>Creator Preview</span></div>
          <Link to="/"><Radio size={16} /> Open Droxion LIVE</Link>
        </div>
      </aside>

      <main className="studioMain">
        <header className="studioTopbar">
          <div>
            <span className="studioEyebrow">DROXION CREATOR AUTOPILOT</span>
            <h1>{NAV.find(item => item.id === activeTab)?.label || 'Creator Studio'}</h1>
          </div>
          <div className="studioTopActions">
            <button type="button" className="studioGhostButton"><Settings size={17} /> Settings</button>
            <button type="button" className="studioPrimaryButton" onClick={() => setActiveTab('create')}><Plus size={17} /> Create</button>
          </div>
        </header>

        {notice && (
          <div className="studioNotice" role="status">
            <Circle size={10} fill="currentColor" />
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>Dismiss</button>
          </div>
        )}

        {activeTab === 'overview' && (
          <section className="studioSection">
            <div className="studioHero">
              <div className="studioHeroCopy">
                <span className="studioHeroPill"><Rocket size={14} /> New Droxion</span>
                <h2>Your content.<br />Everywhere. Automatically.</h2>
                <p>Connect your channels once. Droxion will turn long-form videos into short-form content, prepare publishing, and become the control center for your creator workflow.</p>
                <div className="studioHeroActions">
                  <button type="button" className="studioPrimaryButton studioLarge" onClick={() => setActiveTab('channels')}>Connect channels <ArrowRight size={17} /></button>
                  <button type="button" className="studioGhostButton studioLarge" onClick={() => setActiveTab('create')}>Create from a video</button>
                </div>
              </div>
              <div className="studioAutopilotCard">
                <div className="studioAutopilotHead">
                  <div><span>Autopilot</span><strong>{autopilotEnabled ? 'Running' : 'Not started'}</strong></div>
                  <button type="button" className={`studioToggle ${autopilotEnabled ? 'on' : ''}`} onClick={toggleAutopilot} aria-label="Toggle Autopilot"><span /></button>
                </div>
                <div className="studioFlow">
                  <div><CheckCircle2 size={17} /><span>Detect new source video</span></div>
                  <ChevronRight size={16} />
                  <div><Sparkles size={17} /><span>Create best clips</span></div>
                  <ChevronRight size={16} />
                  <div><Clock3 size={17} /><span>Schedule & publish</span></div>
                </div>
                <small>Autopilot stays off until channel OAuth and the processing backend are configured.</small>
              </div>
            </div>

            <div className="studioMetricsGrid">
              <Metric label="Clips created" value="0" detail="Ready for first source video" icon={Film} />
              <Metric label="Published" value="0" detail="Connect publishing channels" icon={Play} />
              <Metric label="Total views" value="0" detail="Analytics begins after publishing" icon={Activity} />
              <Metric label="Channels ready" value={`${configuredCount}/4`} detail="OAuth integrations configured" icon={Link2} />
            </div>

            <div className="studioTwoCol">
              <div className="studioPanel">
                <div className="studioPanelHead"><div><span>NEXT STEP</span><h3>Finish creator onboarding</h3></div><Zap size={20} /></div>
                <div className="studioChecklist">
                  <button type="button" onClick={() => setActiveTab('channels')}><Circle size={15} /><span><strong>Connect YouTube</strong><small>Use it as the first source channel.</small></span><ChevronRight size={16} /></button>
                  <button type="button" onClick={() => setActiveTab('channels')}><Circle size={15} /><span><strong>Connect Instagram + TikTok</strong><small>Add destinations for automatic publishing.</small></span><ChevronRight size={16} /></button>
                  <button type="button" onClick={() => setActiveTab('create')}><Circle size={15} /><span><strong>Create the first clip batch</strong><small>Paste one long-form video URL.</small></span><ChevronRight size={16} /></button>
                </div>
              </div>

              <div className="studioPanel">
                <div className="studioPanelHead"><div><span>CONTENT PIPELINE</span><h3>Nothing to manage yet</h3></div><Clock3 size={20} /></div>
                <EmptyState icon={Film} title="Your first batch will appear here" action={<button type="button" className="studioTextButton" onClick={() => setActiveTab('create')}>Create your first batch <ArrowRight size={15} /></button>}>
                  Once the processing backend is connected, Droxion will show clip status, publishing state and performance here.
                </EmptyState>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'channels' && (
          <section className="studioSection">
            <div className="studioSectionIntro">
              <span>CONNECT ONCE</span>
              <h2>Your channels power Autopilot.</h2>
              <p>Droxion should request only the permissions needed for reading source content and publishing creator-approved posts. Connections are not marked active until the provider OAuth flow is configured.</p>
            </div>
            <div className="studioChannelGrid">
              {CHANNELS.map(channel => {
                const Icon = channel.icon;
                const ready = oauthReady[channel.id];
                return (
                  <article key={channel.id} className="studioChannelCard">
                    <div className={`studioChannelIcon ${channel.id}`}><Icon size={24} /></div>
                    <div className="studioChannelCopy">
                      <h3>{channel.name}</h3>
                      <p>{channel.purpose}</p>
                      <span className={ready ? 'ready' : 'pending'}>{ready ? 'OAuth URL configured' : 'OAuth setup required'}</span>
                    </div>
                    <button type="button" onClick={() => connectChannel(channel)}>{ready ? 'Connect' : 'Setup'} <ArrowRight size={15} /></button>
                  </article>
                );
              })}
            </div>
            <div className="studioSecurityNote">
              <CheckCircle2 size={18} />
              <div><strong>Professional connection model</strong><span>Provider access tokens must be stored server-side, encrypted, refreshable and revocable. Droxion should never ask creators for social-media passwords.</span></div>
            </div>
          </section>
        )}

        {activeTab === 'create' && (
          <section className="studioSection">
            <div className="studioSectionIntro">
              <span>CREATE</span>
              <h2>Turn one video into a content system.</h2>
              <p>Start with a source URL. The production pipeline will analyze the long-form video, create vertical clips, captions and publishing metadata.</p>
            </div>
            <div className="studioCreateCard">
              <form onSubmit={createFromUrl}>
                <label htmlFor="studio-video-url">Video URL</label>
                <div className="studioUrlRow">
                  <div className="studioUrlInput"><Link2 size={18} /><input id="studio-video-url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
                  <button className="studioPrimaryButton" type="submit">Generate clips <Sparkles size={17} /></button>
                </div>
              </form>
              <div className="studioDivider"><span>or</span></div>
              <button type="button" className="studioUploadButton" onClick={() => setNotice('Direct uploads will be enabled with the processing/storage backend.')}>
                <Upload size={22} />
                <span><strong>Upload a long video</strong><small>MP4, MOV or WebM</small></span>
              </button>
            </div>
            <div className="studioPipelinePreview">
              {['Analyze full video', 'Find strongest moments', 'Reframe + captions', 'Write hooks + metadata', 'Schedule + publish', 'Learn from performance'].map((step, index) => (
                <div key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong></div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'autopilot' && (
          <section className="studioSection">
            <div className="studioSectionIntro">
              <span>AUTOPILOT</span>
              <h2>One switch for the creator workflow.</h2>
              <p>When the backend and provider connections are live, Autopilot will detect new source videos, generate approved outputs and publish according to creator settings.</p>
            </div>
            <div className="studioAutopilotSettings">
              <div className="studioAutopilotStatus">
                <div className="studioAutopilotOrb"><Zap size={27} /></div>
                <div><span>AUTOPILOT STATUS</span><h3>{autopilotEnabled ? 'Running' : 'Off'}</h3><p>{autopilotEnabled ? 'Droxion is ready to process configured sources.' : 'Connect channels first, then switch Autopilot on.'}</p></div>
                <button type="button" className={`studioToggle studioBigToggle ${autopilotEnabled ? 'on' : ''}`} onClick={toggleAutopilot} aria-label="Toggle Autopilot"><span /></button>
              </div>
              <div className="studioSettingsList">
                <div><span><Youtube size={17} /> Source</span><strong>YouTube uploads</strong></div>
                <div><span><Film size={17} /> Clips per source</span><strong>5–10</strong></div>
                <div><span><Clock3 size={17} /> Publishing</span><strong>Smart schedule</strong></div>
                <div><span><Sparkles size={17} /> Optimization</span><strong>Performance learning</strong></div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'analytics' && (
          <section className="studioSection">
            <div className="studioSectionIntro">
              <span>ANALYTICS</span>
              <h2>One view across every channel.</h2>
              <p>Real analytics will populate after connected-platform publishing begins. This page intentionally shows no sample or invented performance data.</p>
            </div>
            <div className="studioMetricsGrid">
              <Metric label="Views" value="0" detail="Across connected destinations" icon={Activity} />
              <Metric label="Clips" value="0" detail="Published by Droxion" icon={Film} />
              <Metric label="Publishing success" value="—" detail="Waiting for first post" icon={CheckCircle2} />
              <Metric label="Best format" value="—" detail="Learning begins after data" icon={Sparkles} />
            </div>
            <div className="studioPanel studioAnalyticsEmpty">
              <EmptyState icon={BarChart3} title="Performance learning starts after your first posts">
                Droxion will compare hooks, topics, duration, posting times and destinations only after real creator data is available.
              </EmptyState>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
