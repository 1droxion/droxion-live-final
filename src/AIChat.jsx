// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const host = (u="") => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return ""; } };
const BAD_HOSTS = ["google.com","wikipedia.org","example.com","example.org","m.wikipedia.org"];
const isFilteredSource = (u="") => { const h = host(u); return !h || BAD_HOSTS.includes(h); };

const firstImageUrl = (c) =>
  c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;

const IMAGE_PROXY = `${API_BASE}/img?url=`;
const prox = (u) => (!u || u.startsWith("data:") || u.startsWith(IMAGE_PROXY)) ? u : (IMAGE_PROXY + encodeURIComponent(u));
const unsplash = (q) => (q ? `https://source.unsplash.com/900x600/?${encodeURIComponent(q)}` : null);

const timeAgo = (d) => {
  if (!d) return "";
  const t = typeof d === "string" ? new Date(d).getTime() : +d;
  if (!t || Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h/24); return `${dd}d ago`;
};

const isGreeting = (s="") => /^(hi|hello|hey|yo|sup|hola|namaste)[!\.\s]*$/i.test(s.trim());
const wantsImages = (s="") => /\b(image|images|photo|wallpaper|picture)\b/i.test(s);
const wantsNews = (s="") => /\b(news|headlines|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|temperature|forecast)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|bitcoin|btc|eth|ethereum|price|chart)\b/i.test(s);
const wantsYouTube = (s="") => /\b(youtube|youtu\.be|video|shorts|trailer)\b/i.test(s);
const wantsPreview = (s="") => wantsNews(s) || wantsWeather(s) || wantsCrypto(s) || wantsImages(s) || wantsYouTube(s);

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // live panel (typing only)
  const [focused, setFocused] = useState(false);
  const [textSug, setTextSug] = useState([]);
  const [news, setNews] = useState([]);
  const [weather, setWeather] = useState(null);
  const [crypto, setCrypto] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const scrollRef = useRef(null);
  const panelRef = useRef(null);
  const composerRef = useRef(null);
  const [panelH, setPanelH] = useState(0);
  const [composerH, setComposerH] = useState(96);

  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });

  /* ----- CSS injection for consistent structure ----- */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name","viewport"); document.head.appendChild(meta); }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");

    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html, body { height: 100%; background:#000; color:#fff; margin:0; padding:0; }
      * { -webkit-tap-highlight-color: transparent; }
      .glass { background: var(--glass); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .pill { font-size:11px; padding:2px 8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:999px; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .tile { position:relative; width:100%; padding-top:66.6%; overflow:hidden; border-radius:12px; }
      .tile > img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* measure panel & composer height for scroll padding */
  useEffect(() => {
    if (!panelRef.current) return;
    const ro = new ResizeObserver(() => setPanelH(panelRef.current?.offsetHeight || 0));
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [panelRef.current]);

  useEffect(() => {
    if (!composerRef.current) return;
    const ro = new ResizeObserver(() => setComposerH(composerRef.current?.offsetHeight || 96));
    ro.observe(composerRef.current);
    return () => ro.disconnect();
  }, [composerRef.current]);

  /* text suggestions */
  useEffect(() => {
    const q = input.trim();
    clearTimeout(suggestTimer.current);
    if (!focused || q.length < 1) { setTextSug([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setTextSug((data?.suggestions || []).slice(0, 8));
      } catch { setTextSug([]); }
    }, 120);
    return () => clearTimeout(suggestTimer.current);
  }, [input, focused]);

  /* realtime previews */
  useEffect(() => {
    const q = input.trim();
    clearTimeout(previewTimer.current);
    if (!focused || q.length < 1 || !wantsPreview(q)) return;

    setLoadingPanel(true);
    cancelPrev.current.cancel?.();
    const src = axios.CancelToken.source();
    cancelPrev.current = { cancel: () => src.cancel("new query") };

    previewTimer.current = setTimeout(async () => {
      try {
        const [rn, rw, rc] = await Promise.all([
          wantsNews(q)    ? axios.post(`${API_BASE}/realtime`, { query: q, intent: "news"    }, { cancelToken: src.token }).catch(()=>null) : null,
          wantsWeather(q) ? axios.post(`${API_BASE}/realtime`, { query: q, intent: "weather" }, { cancelToken: src.token }).catch(()=>null) : null,
          wantsCrypto(q)  ? axios.post(`${API_BASE}/realtime`, { query: q, intent: "crypto"  }, { cancelToken: src.token }).catch(()=>null) : null,
        ]);
        setNews(rn?.data?.cards || []);
        setWeather(rw?.data?.cards?.[0] || null);
        setCrypto(rc?.data?.cards || []);
      } finally { setLoadingPanel(false); }
    }, 150);

    return () => clearTimeout(previewTimer.current);
  }, [input, focused]);

  /* auto-scroll only on new messages */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1000);
    } catch {}
  };

  /* send message */
  const handleSend = async (text = input) => {
    const content = text.trim(); if (!content) return;
    setTyping(true);
    setMessages((p) => [...p, { role: "user", content }]);
    setInput(""); setTextSug([]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
      const md = res.data?.reply || res.data?.text || "";
      let cards = (res.data?.cards || []).filter((c)=> !(c?.url && isFilteredSource(c.url)));
      setMessages((p) => [...p, { role: "assistant", content: md, cards }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "⚠️ Error or connection failed.", cards: [] }]);
    } finally { setTyping(false); }
  };

  /* render helpers */
  const SmartImage = ({ url, title }) => {
    if (!url) return null;
    return (
      <img src={prox(url)} alt={title || ""} className="w-full h-full object-cover"
        onError={(e)=>{ e.currentTarget.src = unsplash(title || "image"); }} />
    );
  };

  const SourceChips = ({ cards=[] }) => {
    const links = cards.filter((c)=>c.url && !isFilteredSource(c.url));
    if (!links.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {links.slice(0,6).map((c,i)=>(
          <a key={i} href={c.url} target="_blank" rel="noreferrer"
             className="pill hover:bg:white hover:text-black transition">
            {c.source || host(c.url)}
          </a>
        ))}
      </div>
    );
  };

  const renderCards = (cards) => (!cards?.length ? null :
    <div className="grid grid-cols-1 gap-3">
      {cards.map((c,i)=>(
        <div key={i} className="tile glass"><SmartImage url={firstImageUrl(c) || c.url} title={c.title} /></div>
      ))}
    </div>
  );

  /* UI */
  return (
    <div className="h-screen w-full flex flex-col" style={{ height:"100svh" }}>
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Live</div>
        </div>
      </header>

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ paddingBottom: panelH + composerH + 32 }}>
        <div className="max-w-4xl mx-auto w-full px-3">
          <div className="space-y-4">
            {messages.map((msg,i)=>(
              <div key={i} className={`rounded-xl p-4 ${msg.role==="user" ? "glass-2":"glass"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase text-gray-400">{msg.role==="user"?"You":"Droxion"}</div>
                  {msg.role!=="user" && msg.content && (
                    <button onClick={()=>copyMessage(i)} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1">
                      <FaRegCopy /> {copiedIdx===i ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
                {msg.content && (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {msg.content}
                  </ReactMarkdown>
                )}
                <SourceChips cards={msg.cards || []} />
                {renderCards(msg.cards)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview panel while typing */}
      {focused && wantsPreview(input) && (
        <div ref={panelRef} className="fixed inset-x-0 bottom-[88px] z-40">
          <div className="max-w-4xl mx-auto px-3">
            <div className="glass rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">Live Results</div>
              {/* News row */}
              <div className="flex gap-2 overflow-x-auto">
                {news.map((c,i)=>(
                  <div key={i} className="min-w-[70%] max-w-[70%]">
                    <div className="tile glass"><SmartImage url={firstImageUrl(c)||unsplash(c.title)} title={c.title}/></div>
                    <div className="text-xs mt-1">{c.source||host(c.url)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div ref={composerRef} className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 px-3 py-2">
              <textarea value={input} onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleSend(); }}}
                onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),150)}
                placeholder="Type a message..." className="w-full bg-transparent outline-none resize-none" rows={1}/>
            </div>
            <button onClick={()=>handleSend(input)} className="h-10 px-4 rounded-2xl bg-white text-black font-semibold">➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;