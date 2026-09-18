import { useEffect, useMemo, useState } from 'react';
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
import { supabase } from './supabaseClient.js';
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
  const [connections, setConnections] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [youtubeVideosLoading, setYoutubeVideosLoading] = useState(false);
  const [selectedYoutubeVideo, setSelectedYoutubeVideo] = useState(null);
  const [sourceUploadProgress, setSourceUploadProgress] = useState(0);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [createdJob, setCreatedJob] = useState(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [processingJob, setProcessingJob] = useState(false);

  const oauthReady = useMemo(() => {
    return Object.fromEntries(CHANNELS.map(channel => [channel.id, Boolean(envValue(channel.env))]));
  }, []);

  const configuredCount = Object.values(oauthReady).filter(Boolean).length;
  const connectedCount = Object.keys(connections).length;

  async function loadConnections() {
    setConnectionsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token || '';
      if (!accessToken) {
        setConnections({});
        return;
      }
      const response = await fetch('/api/creator/connections', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not load channel connections.');
      const nextConnections = Object.fromEntries((payload.connections || []).map(item => [item.provider, item]));
      setConnections(nextConnections);
      if (nextConnections.youtube) loadYoutubeVideos(accessToken);
      loadLatestJob(accessToken);
    } catch (error) {
      setNotice(error?.message || 'Could not load channel connections.');
    } finally {
      setConnectionsLoading(false);
    }
  }

  async function loadLatestJob(existingAccessToken = '') {
    try {
      let accessToken = existingAccessToken;
      if (!accessToken) {
        const { data } = await supabase.auth.getSession();
        accessToken = data?.session?.access_token || '';
      }
      if (!accessToken) return;
      const response = await fetch('/api/creator/jobs/status', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.job) setCreatedJob(payload.job);
    } catch {}
  }

  async function processCreatedJob() {
    if (!createdJob?.id) {
      setNotice('Upload a source video first.');
      return;
    }
    try {
      setProcessingJob(true);
      setNotice('Processing your source video into Shorts…');
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token || '';
      if (!accessToken) throw new Error('Sign in to Droxion first.');

      const response = await fetch('/api/creator/jobs/process', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId: createdJob.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not process the video.');
      setCreatedJob(payload.job || createdJob);
      setNotice('Shorts are ready for preview.');
    } catch (error) {
      setNotice(error?.message || 'Video processing failed.');
      await loadLatestJob();
    } finally {
      setProcessingJob(false);
    }
  }

  async function loadYoutubeVideos(existingAccessToken = '') {
    setYoutubeVideosLoading(true);
    try {
      let accessToken = existingAccessToken;
      if (!accessToken) {
        const { data } = await supabase.auth.getSession();
        accessToken = data?.session?.access_token || '';
      }
      if (!accessToken) return;
      const response = await fetch('/api/creator/youtube/videos?limit=12', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not load YouTube videos.');
      setYoutubeVideos(payload.videos || []);
    } catch (error) {
      setNotice(error?.message || 'Could not load YouTube videos.');
    } finally {
      setYoutubeVideosLoading(false);
    }
  }

  function chooseYoutubeVideo(video) {
    if (!video?.url) return;
    setVideoUrl(video.url);
    setSelectedYoutubeVideo(video);
    setActiveTab('create');
    setSourcePickerOpen(true);
    setNotice(`Selected "${video.title}". Upload the original video file to start processing.`);
  }

  async function uploadCreatorSource(file) {
    if (!file) return;
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowed.includes(file.type)) {
      setNotice('Use an MP4, MOV, or WebM video file.');
      return;
    }

    try {
      setSourceUploading(true);
      setSourceUploadProgress(5);
      setCreatedJob(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      const userId = sessionData?.session?.user?.id || '';
      if (!accessToken || !userId) throw new Error('Sign in to Droxion before uploading.');

      const safeName = String(file.name || 'source.mp4').replace(/[^a-zA-Z0-9._-]+/g, '-');
      const objectPath = `${userId}/${Date.now()}-${safeName}`;

      setSourceUploadProgress(15);
      const { error: uploadError } = await supabase.storage
        .from('droxion-creator-sources')
        .upload(objectPath, file, {
          cacheControl: '3600',
          contentType: file.type || 'video/mp4',
          upsert: false
        });
      if (uploadError) throw uploadError;

      setSourceUploadProgress(85);
      const response = await fetch('/api/creator/jobs/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourcePath: objectPath,
          sourceFilename: file.name,
          sourceSizeBytes: file.size,
          sourceMimeType: file.type,
          youtubeVideoId: selectedYoutubeVideo?.id || null,
          youtubeTitle: selectedYoutubeVideo?.title || null,
          youtubeUrl: selectedYoutubeVideo?.url || videoUrl || null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not create processing job.');

      setCreatedJob(payload.job || null);
      setSourceUploadProgress(100);
      setSourcePickerOpen(false);
      setNotice('Source uploaded successfully. Droxion created the processing job.');
    } catch (error) {
      setNotice(error?.message || 'Source upload failed.');
      setSourceUploadProgress(0);
    } finally {
      setSourceUploading(false);
    }
  }

  useEffect(() => {
    loadConnections();
    const params = new URLSearchParams(window.location.search);
    if (params.get('youtube') === 'connected') {
      setNotice('YouTube connected successfully. Droxion can now use this channel for Creator Autopilot.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('youtube') === 'error') {
      setNotice(params.get('message') || 'YouTube connection failed.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('connect') === 'youtube') {
      setActiveTab('channels');
      window.history.replaceState({}, '', window.location.pathname);
      connectChannel(CHANNELS[0]);
    }
  }, []);

  async function connectChannel(channel) {
    if (channel.id === 'youtube') {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data?.session?.access_token || '';
        if (!accessToken) {
          window.location.assign('/login?next=%2Fstudio&connect=youtube');
          return;
        }
        const response = await fetch('/api/creator/youtube/start', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ returnPath: '/studio' })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Could not start YouTube connection.');
        window.location.assign(payload.url);
      } catch (error) {
        setNotice(error?.message || 'Could not start YouTube connection.');
      }
      return;
    }

    const url = envValue(channel.env);
    if (!url) {
      setNotice(`${channel.name} OAuth is not configured yet. ${channel.name} will be enabled after YouTube is working end-to-end.`);
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
    if (connectedCount === 0) {
      setNotice('Connect at least one publishing provider before turning on Autopilot.');
      setActiveTab('channels');
      return;
    }
    setAutopilotEnabled(value => !value);
    setNotice('');
  }

  return (
    <div className="studioShell">
      {sourcePickerOpen && selectedYoutubeVideo && (
        <div className="studioSourceModalBackdrop" role="dialog" aria-modal="true" aria-label="Upload source video">
          <div className="studioSourceModal">
            <button type="button" className="studioSourceModalClose" onClick={() => setSourcePickerOpen(false)}>×</button>
            <div className="studioSourceModalThumb">
              {selectedYoutubeVideo.thumbnail ? <img src={selectedYoutubeVideo.thumbnail} alt="" /> : <Youtube size={28} />}
            </div>
            <span className="studioEyebrow">CREATE SHORTS</span>
            <h2>Upload the original video</h2>
            <p>{selectedYoutubeVideo.title}</p>
            <p className="studioSourceModalHelp">Droxion needs the original MP4, MOV or WebM file to create and process the Shorts.</p>
            <button
              type="button"
              className="studioPrimaryButton studioLarge studioSourceModalAction"
              onClick={() => document.getElementById('creator-source-file')?.click()}
              disabled={sourceUploading}
            >
              <Upload size={18} />
              {sourceUploading ? 'Uploading…' : 'Choose original video'}
            </button>
            {(sourceUploading || sourceUploadProgress > 0) && (
              <div className="studioUploadProgress">
                <div><span style={{ width: `${sourceUploadProgress}%` }} /></div>
                <small>{sourceUploading ? `${sourceUploadProgress}% uploaded` : 'Upload complete'}</small>
              </div>
            )}
            <small className="studioSourceModalPrivacy">Private source upload. Droxion does not publish the original file.</small>
          </div>
        </div>
      )}
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
          <Link to="/live-social"><Radio size={16} /> Open Droxion LIVE</Link>
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
              <Metric label="Channels connected" value={`${connectedCount}/4`} detail={connectionsLoading ? 'Checking your channels' : 'Creator accounts connected'} icon={Link2} />
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
                const connection = connections[channel.id];
                const connected = Boolean(connection);
                const ready = channel.id === 'youtube' || oauthReady[channel.id];
                return (
                  <article key={channel.id} className={`studioChannelCard ${connected ? 'connected' : ''}`}>
                    <div className={`studioChannelIcon ${channel.id}`}>
                      {connected && connection?.avatar_url ? <img src={connection.avatar_url} alt="" /> : <Icon size={24} />}
                    </div>
                    <div className="studioChannelCopy">
                      <h3>{connected ? (connection.display_name || channel.name) : channel.name}</h3>
                      <p>{connected ? (connection.handle || channel.purpose) : channel.purpose}</p>
                      <span className={connected ? 'ready' : (ready ? 'pending' : 'pending')}>
                        {connected ? 'Connected to Droxion' : (channel.id === 'youtube' ? 'Ready to connect' : 'OAuth setup required')}
                      </span>
                    </div>
                    <button type="button" onClick={() => connectChannel(channel)} disabled={connected}>
                      {connected ? 'Connected' : (channel.id === 'youtube' ? 'Connect' : 'Setup')} {connected ? <CheckCircle2 size={15} /> : <ArrowRight size={15} />}
                    </button>
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
            {connections.youtube && (
              <div className="studioYoutubeLibrary">
                <div className="studioPanelHead">
                  <div><span>YOUR YOUTUBE</span><h3>Recent uploads</h3></div>
                  <button type="button" className="studioTextButton" onClick={() => loadYoutubeVideos()}>
                    {youtubeVideosLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                {youtubeVideosLoading && youtubeVideos.length === 0 ? (
                  <div className="studioYoutubeLoading">Loading your latest YouTube videos…</div>
                ) : youtubeVideos.length > 0 ? (
                  <div className="studioYoutubeGrid">
                    {youtubeVideos.map(video => (
                      <article key={video.id} className="studioYoutubeVideo">
                        <div className="studioYoutubeThumb">
                          {video.thumbnail ? <img src={video.thumbnail} alt="" /> : <div className="studioYoutubeThumbFallback"><Youtube size={22} /></div>}
                        </div>
                        <div className="studioYoutubeVideoCopy">
                          <strong title={video.title}>{video.title}</strong>
                          <span>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'YouTube upload'}</span>
                        </div>
                        <button type="button" onClick={() => chooseYoutubeVideo(video)}>Create Shorts <ArrowRight size={14} /></button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="studioYoutubeLoading">No YouTube uploads found yet.</div>
                )}
              </div>
            )}

            <div className="studioCreateCard">
              {selectedYoutubeVideo && (
                <div className="studioSelectedSource">
                  <div className="studioSelectedSourceThumb">
                    {selectedYoutubeVideo.thumbnail ? <img src={selectedYoutubeVideo.thumbnail} alt="" /> : <Youtube size={22} />}
                  </div>
                  <div>
                    <span>SELECTED YOUTUBE VIDEO</span>
                    <strong>{selectedYoutubeVideo.title}</strong>
                    <small>Upload the original source file to create Shorts.</small>
                  </div>
                  <button type="button" onClick={() => document.getElementById('creator-source-file')?.click()}>
                    Choose file <Upload size={14} />
                  </button>
                </div>
              )}
              <form onSubmit={createFromUrl}>
                <label htmlFor="studio-video-url">Video URL</label>
                <div className="studioUrlRow">
                  <div className="studioUrlInput"><Link2 size={18} /><input id="studio-video-url" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
                  <button className="studioPrimaryButton" type="submit">Generate clips <Sparkles size={17} /></button>
                </div>
              </form>
              <div className="studioDivider"><span>or</span></div>
              <input
                id="creator-source-file"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                hidden
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  uploadCreatorSource(file);
                }}
              />
              <button
                type="button"
                className="studioUploadButton"
                onClick={() => document.getElementById('creator-source-file')?.click()}
                disabled={sourceUploading}
              >
                <Upload size={22} />
                <span>
                  <strong>{sourceUploading ? 'Uploading source video…' : 'Upload original video'}</strong>
                  <small>MP4, MOV or WebM · private source file</small>
                </span>
              </button>
              {(sourceUploading || sourceUploadProgress > 0) && (
                <div className="studioUploadProgress" aria-live="polite">
                  <div><span style={{ width: `${sourceUploadProgress}%` }} /></div>
                  <small>{sourceUploading ? `${sourceUploadProgress}% uploaded` : 'Upload complete'}</small>
                </div>
              )}
              {createdJob && (
                <div className="studioJobCreated studioJobCreatedWide">
                  <CheckCircle2 size={17} />
                  <div>
                    <strong>{createdJob.status === 'complete' ? 'Shorts ready' : 'Processing job created'}</strong>
                    <span>{createdJob.youtube_title || createdJob.source_filename || 'Creator video'} · {createdJob.status}</span>
                  </div>
                  {['uploaded','failed'].includes(createdJob.status) && (
                    <button type="button" onClick={processCreatedJob} disabled={processingJob}>
                      {processingJob ? 'Processing…' : 'Process now'}
                    </button>
                  )}
                </div>
              )}
              {createdJob?.status === 'complete' && createdJob?.metadata?.clips?.length > 0 && (
                <div className="studioClipResults">
                  <div className="studioPanelHead"><div><span>SHORTS READY</span><h3>Preview clips</h3></div></div>
                  <div className="studioClipGrid">
                    {createdJob.metadata.clips.map((clip, index) => (
                      <article key={clip.path || index} className="studioClipCard">
                        {clip.preview_url ? <video controls playsInline preload="metadata" src={clip.preview_url} /> : <div className="studioClipMissing">Preview unavailable</div>}
                        <div><strong>Clip {index + 1}</strong><span>{Math.round(clip.duration_seconds || 0)} sec</span></div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
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
