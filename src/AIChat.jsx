// src/AIChat.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isPlaceholderUrl = (u="") => {
  try {
    const h = new URL(u).hostname.replace(/^www\./,"");
    if (!h) return true;
    // filter junk sources that showed in your screenshot
    if (["google.com","wikipedia.org","m.wikipedia.org"].includes(h)) return true;
    if ((/^example\.(com|org)$/i).test(h)) return true;
    return false;
  } catch { return true; }
};
const firstImageUrl = (c) => c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;

const IMAGE_PROXY = `${API_BASE}/img?url=`;
const isProxied = (u="") => u.startsWith(IMAGE_PROXY);
const prox = (u) => {
  if (!u) return null;
  if (u.startsWith("data:")) return u;
  if (isProxied(u)) return u;
  return IMAGE_PROXY + encodeURIComponent(u);
};

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

// intent helpers
const isGreeting = (s="") => /^(hi|hello|hey|yo|sup|hola|namaste)[!\.\s]*$/i.test(s.trim());
const wantsImages = (s="") => {
  const q = s.trim().toLowerCase();
  return /^images?:\s*/.test(q) || /\b(show\s+(me\s+)?)?(images?|photos?|pictures?)\b/.test(q) || /\bwallpaper\b/.test(q);
};
const wantsNews = (s="") => /\b(news|headlines|latest news|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|temperature|forecast)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|bitcoin|btc|ethereum|eth|price|chart)\b/i.test(s);

const getYouTubeId = (raw) => {
  try {
    const txt = raw.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;
    const hasHttp = /^https?:\/\//i.test(txt);
    const u = new URL(hasHttp ? txt : `https://youtube.com/results?search_query=${encodeURIComponent(txt)}`);
    const h = u.hostname.replace("www.", "");
    if (h.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0] === "shorts" || p[0] === "embed") return p[1];
    }
    if (h.includes("youtu.be")) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]) return p[0];
    }
  } catch {}
  const m = raw.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/* ---------- preview helper: strict for web, fallback allowed for news ---------- */
const bestPreview = (card, allowFallback = false) => {
  const direct = firstImageUrl(card);
  if (direct) return { prox: prox(direct), orig: direct, title: card.title || card.source || "preview" };

  if (!allowFallback) return null;

  try {
    if (card.url && /^https?:\/\//i.test(card.url) && !isPlaceholderUrl(card.url)) {
      const shot = `${API_BASE}/img?url=${encodeURIComponent(
        `https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(card.url)}`
      )}`;
      return { prox: shot, orig: card.url, title: card.title || "preview" };
    }
  } catch {}

  const ph = unsplash(card.title || card.source || "news");
  return ph ? { prox: ph, orig: ph, title: card.title || "preview" } : null;
};

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]); // {role, content?, cards?, followups?}
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // live panel state
  const [textSuggestions, setTextSuggestions] = useState([]);
  const [inputFocused, setInputFocused] = useState(false);
  const [liveNews, setLiveNews] = useState([]);        // keep old while loading
  const [liveWeather, setLiveWeather] = useState(null);
  const [liveCrypto, setLiveCrypto] = useState([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  // top ribbon (optional)
  const [headlines, setHeadlines] = useState([]);
  const [headlineStamp, setHeadlineStamp] = useState("");

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });

  /* meta + CSS */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "viewport"); document.head.appendChild(meta); }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");

    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html, body { height: 100%; background:#000; color:#fff; margin:0; padding:0; }
      body { overscroll-behavior-y: none; }
      * { -webkit-tap-highlight-color: transparent; }
      textarea, input { font-size: 16px !important; }
      img, iframe, video { max-width: 100% !important; height: auto !important; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .glass { background: var(--glass); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .pill { font-size:11px; padding:2px 8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:999px; }
      .suggestions-panel {
        max-height: min(52vh, calc(100svh - 180px));
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        touch-action: pan-y;
      }
      .gpu { will-change: transform; transform: translateZ(0); -webkit-backface-visibility: hidden; backface-visibility: hidden; }
      .hscroll { overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; }
      .hitem { min-width: 78%; max-width: 78%; scroll-snap-align:start; }
      @media (min-width:480px){ .hitem{ min-width: 52%; max-width: 52%; } }
      @media (min-width:768px){ .hitem{ min-width: 33%; max-width: 33%; } }
      .skel { background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
      @keyframes shimmer { 0%{background-position: 200% 0} 100%{background-position: -200% 0} }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* text suggestions (debounced) */
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(suggestTimer.current);
    if (!inputFocused || q.length < 2) { setTextSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setTextSuggestions((data?.suggestions || []).slice(0, 8));
      } catch { setTextSuggestions([]); }
    }, 220);
    return () => clearTimeout(suggestTimer.current);
  }, [input, inputFocused]);

  /* live previews while typing (no flicker: keep previous while loading next) */
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(previewTimer.current);

    if (!inputFocused || q.length < 2) {
      // keep previous previews visible; don't clear to avoid blink
      return;
    }

    previewTimer.current = setTimeout(async () => {
      setLoadingPreviews(true);

      // cancel in-flight requests for older keystrokes
      cancelPrev.current.cancel?.();
      const src = axios.CancelToken.source();
      cancelPrev.current = { cancel: () => src.cancel("new query") };

      // show three lanes always (like your screenshot)
      const askNews = true;
      const askWeather = true;
      const askCrypto = true;

      try {
        const reqs = [];
        if (askNews) reqs.push(axios.post(`${API_BASE}/realtime`, { query: q, intent: "news" }, { cancelToken: src.token }).catch(()=>null));
        if (askWeather) reqs.push(axios.post(`${API_BASE}/realtime`, { query: q, intent: "weather" }, { cancelToken: src.token }).catch(()=>null));
        if (askCrypto) reqs.push(axios.post(`${API_BASE}/realtime`, { query: q, intent: "crypto" }, { cancelToken: src.token }).catch(()=>null));
        const resps = await Promise.all(reqs);

        let i = 0;
        if (askNews) {
          const r = resps[i++]; 
          const cards = (r?.data?.cards || [])
            .filter(Boolean)
            .filter((c)=> !(c?.url && isPlaceholderUrl(c.url)))
            .filter((c)=> !!(bestPreview(c,true))); // must have decent preview
          setLiveNews(cards.slice(0, 10));
        }
        if (askWeather) {
          const r = resps[i++]; 
          const cards = (r?.data?.cards || []).filter(Boolean);
          const w = cards.find((c)=>c.type==="weather") || cards[0] || null;
          setLiveWeather(w);
        }
        if (askCrypto) {
          const r = resps[i++]; 
          const cards = (r?.data?.cards || []).filter(Boolean).slice(0, 6);
          setLiveCrypto(cards);
        }
      } catch(e) {
        // ignore cancellation
      } finally {
        setLoadingPreviews(false);
      }
    }, 300);

    return () => clearTimeout(previewTimer.current);
  }, [input, inputFocused]);

  /* optional: top headlines on mount */
  const loadHeadlines = async () => {
    try {
      const r = await axios.post(`${API_BASE}/realtime`, { query: "top news today", intent: "news" });
      const cards = (r.data?.cards || [])
        .filter(Boolean)
        .filter((c)=> !(c?.url && isPlaceholderUrl(c.url)))
        .filter((c)=> !!(bestPreview(c,true)));
      setHeadlines(cards.slice(0, 12));
      const now = new Date();
      setHeadlineStamp(`Here are some of the top news items as of ${now.toLocaleDateString(undefined,{ year:"numeric", month:"long", day:"numeric"})}:`);
    } catch { setHeadlines([]); setHeadlineStamp(""); }
  };
  useEffect(() => { loadHeadlines(); }, []);

  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1200);
    } catch {}
  };

  const fetchFollowups = async (q) => {
    try {
      const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q, mode: "followup" } });
    const arr = (data?.suggestions || []).filter(Boolean);
      return (arr.length ? arr : ["Explain more", "Pros & cons", "Give steps", "Show sources"]).slice(0, 4);
    } catch {
      return ["Explain more", "Pros & cons", "Give steps", "Show sources"];
    }
  };

  const pushWithFollowups = async (md, cards, q) => {
    setMessages((p) => [...p, { role: "assistant", content: md, cards }]);
    const followups = await fetchFollowups(q);
    setMessages((p) => {
      const last = p[p.length - 1];
      if (!last || last.role !== "assistant") return p;
      const copy = [...p];
      copy[copy.length - 1] = { ...last, followups };
      return copy;
    });
  };

  /* ---------------------- send ---------------------- */
  const handleSend = async (text = input) => {
    const content = (text || "").trim(); if (!content) return;
    setTyping(true);
    setMessages((p) => [...p, { role: "user", content }]);
    setInput("");
    // keep live previews visible; don't clear to avoid blink
    setTextSuggestions([]);

    try {
      if (isGreeting(content)) {
        const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
        await pushWithFollowups(r.data?.reply || r.data?.text || "👋", [], content);
        setTyping(false); return;
      }

      const lower = content.toLowerCase();

      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: q });
          let cards = Array.isArray(r.data?.cards) ? r.data.cards : [];
          cards = cards
            .filter((c) => !(c?.url && isPlaceholderUrl(c.url)))
            .filter((c)=> c.type!=="news" || !!bestPreview(c,true));
          const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;
          await pushWithFollowups(md, cards, content);
        } catch { await pushWithFollowups("Google preview is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/search`, { prompt: q });
          const results = (r.data?.results || [])
            .filter((it) => !isPlaceholderUrl(it.url))
            .map((it) => ({
              type:"web",
              title: it.title,
              url: it.url,
              image: it.image || null,
              source: it.source,
              snippet: it.snippet
            }));
          await pushWithFollowups(results.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, results, content);
        } catch { await pushWithFollowups("Search is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      if (wantsNews(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "news" });
        const cards = (r.data?.cards || [])
          .filter(Boolean)
          .filter((c)=> !(c?.url && isPlaceholderUrl(c.url)))
          .filter((c)=> !!bestPreview(c,true));
        await pushWithFollowups(r.data?.markdown || "Top news:", cards, content);
        setTyping(false); return;
      }
      if (wantsWeather(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "weather" });
        const cards = (r.data?.cards || []).filter(Boolean);
        await pushWithFollowups(r.data?.markdown || "Weather:", cards, content);
        setTyping(false); return;
      }
      if (wantsCrypto(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "crypto" });
        const cards = (r.data?.cards || []).filter(Boolean);
        await pushWithFollowups(r.data?.markdown || "Crypto:", cards, content);
        setTyping(false); return;
      }

      // YouTube
      const ytKW = ["youtube","yt ","youtu.be","youtube.com","video","trailer","shorts","song","watch "];
      if (ytKW.some((k) => lower.includes(k)) || lower.startsWith("youtube:")) {
        const directId = getYouTubeId(content);
        if (directId) {
          await pushWithFollowups("", [{ type:"youtube", url:`https://www.youtube.com/watch?v=${directId}` }], content);
        } else {
          try {
            const res = await axios.post(`${API_BASE}/search-youtube`, { prompt: content });
            const url = res.data?.url;
            await pushWithFollowups(url ? "" : "I couldn't find a video for that.", url ? [{ type:"youtube", url }] : [], content);
          } catch { await pushWithFollowups("YouTube search is unavailable right now.", [], content); }
        }
        setTyping(false); return;
      }

      // Images (explicit only)
      if (wantsImages(content)) {
        const q = content.replace(/^images?:\s*/i, "") || content;
        try {
          const rr = await axios.post(`${API_BASE}/realtime`, { query: q, intent: "images" });
          let cards = Array.isArray(rr.data?.cards) ? rr.data.cards.filter(Boolean) : [];
          cards = cards.filter((c) => !(c?.url && isPlaceholderUrl(c.url)));
          if (!cards.length && Array.isArray(rr.data?.images) && rr.data.images.length) {
            cards = [{ type:"gallery", images: rr.data.images }];
          }
          if (!cards.length) cards = [{ type:"gallery", images: [unsplash(q), unsplash(q+" photo")].filter(Boolean) }];
          await pushWithFollowups(`### Images for **${q}**`, cards, content);
        } catch {
          await pushWithFollowups(`### Images for **${q}**`, [{ type:"gallery", images:[unsplash(q)] }], content);
        }
        setTyping(false); return;
      }

      // default chat
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
      const md = res.data?.reply || res.data?.text || "";
      let cards = (res.data?.cards || [])
        .filter((c) => !(c?.url && isPlaceholderUrl(c.url)))
        .map((c) => {
          const u = firstImageUrl(c);
          return u ? { ...c, image: u } : c;
        });
      await pushWithFollowups(md, cards, content);
    } catch {
      await pushWithFollowups("⚠️ Error or connection failed.", [], content);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  /* ---------------------- render ---------------------- */
  const SmartImage = ({ url, title }) => {
    if (!url) return null;
    const proxUrl = prox(url);
    return (
      <img
        src={proxUrl}
        data-orig={url}
        alt=""
        className="w-full rounded-lg glass"
        loading="lazy"
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={(e)=>{
          const el = e.currentTarget;
          const tried = el.dataset.fallback || "0";
          if (tried === "0") { el.dataset.fallback = "1"; el.src = el.dataset.orig; return; }
          if (tried === "1") { el.dataset.fallback = "2"; el.src = unsplash(title || "image"); return; }
          el.style.display = "none";
        }}
      />
    );
  };

  const HeadlineCard = ({ card }) => {
    const pv = bestPreview(card, true);
    return (
      <a href={card.url} target="_blank" rel="noreferrer" className="hitem pr-3">
        <div className="rounded-xl overflow-hidden glass">
          {pv ? (
            <img
              src={pv.prox}
              data-orig={pv.orig}
              alt=""
              className="w-full aspect-[16/9] object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={(e)=>{ e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="aspect-[16/9] skel" />
          )}
          <div className="p-3">
            <div className="text-[11px] text-gray-400 mb-1">{card.source || (card.url ? host(card.url) : "")}</div>
            <div className="text-sm font-semibold line-clamp-2 leading-tight">{card.title}</div>
            <div className="text-[11px] text-gray-500 mt-1">{timeAgo(card.publishedAt || card.time)}</div>
          </div>
        </div>
      </a>
    );
  };

  const CryptoMiniCard = ({ c }) => (
    <a href={c.url} target="_blank" rel="noreferrer" className="glass rounded-lg p-3 block">
      <div className="text-sm font-semibold">{c.title || c.symbol || "Crypto"}</div>
      <div className="text-xs text-gray-400">{c.meta || c.source || (c.url ? host(c.url) : "")}</div>
      {c.price && <div className="text-base mt-1">{c.price}</div>}
      {typeof c.change !== "undefined" && (
        <div className={`text-xs mt-1 ${String(c.change).startsWith("-") ? "text-red-400" : "text-green-400"}`}>
          {c.change}
        </div>
      )}
    </a>
  );

  const WeatherMiniCard = ({ w }) => (
    <div className="glass rounded-lg p-3 flex items-center gap-3">
      {w?.icon && <SmartImage url={w.icon} title={w.title} />}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{w?.title || "Weather"}</div>
        <div className="text-xs text-gray-400 truncate">{w?.subtitle || w?.meta}</div>
      </div>
    </div>
  );

  const SmartCard = ({ card }) => {
    if (!card) return null;

    if (card.type === "youtube") {
      const vid = getYouTubeId(card.url || "");
      if (!vid) return null;
      return (
        <div className="embed-responsive embed-16by9 rounded overflow-hidden glass">
          <iframe
            src={`https://www.youtube.com/embed/${vid}`}
            title={card.title || "YouTube"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      );
    }

    if (card.type === "weather") {
      return <WeatherMiniCard w={card} />;
    }

    if (card.type === "gallery" && Array.isArray(card.images)) {
      const urls = card.images
        .map((it) => (typeof it === "string" ? it : (it.url || it.thumbnail || it.thumb)))
        .filter(Boolean);
      if (!urls.length) return null;
      return (
        <div className="grid grid-cols-2 gap-2">
          {urls.slice(0, 10).map((u, i) => <SmartImage key={i} url={u} title="image" />)}
        </div>
      );
    }

    if (card.type === "image") {
      const u = firstImageUrl(card) || card.url;
      if (!u) return null;
      return <SmartImage url={u} title={card.title} />;
    }

    if (["web","link","wiki","news","stock","crypto"].includes(card.type)) {
      if (card.url && isPlaceholderUrl(card.url)) return null;
      const pv = bestPreview(card, card.type === "news");
      return (
        <a href={card.url} target="_blank" rel="noreferrer" className="block glass rounded-lg p-3 hover:bg-white/10 transition">
          {pv && (
            <img
              src={pv.prox}
              data-orig={pv.orig}
              alt=""
              className="w-full rounded mb-2"
              loading="lazy"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={(e)=>{ e.currentTarget.style.display = "none"; }}
            />
          )}
          {card.title && <div className="text-sm font-semibold leading-snug">{card.title}</div>}
          <div className="text-xs text-gray-400 mt-1">
            {card.source || (card.url ? host(card.url) : "")}{card.time ? ` • ${card.time}` : ""}
          </div>
          {card.snippet && <div className="text-xs text-gray-300 mt-1">{card.snippet}</div>}
          {card.description && <div className="text-xs text-gray-300 mt-1">{card.description}</div>}
          {card.meta && <div className="text-[11px] text-gray-400 mt-1">{card.meta}</div>}
        </a>
      );
    }

    if (card.html) return <div className="prose prose-invert max-w-none glass rounded-lg p-3" dangerouslySetInnerHTML={{ __html: card.html }} />;
    if (card.text) return <div className="glass rounded-lg p-3 text-sm">{card.text}</div>;
    return null;
  };

  const renderCards = (cards) =>
    !cards?.length ? null : <div className="grid grid-cols-1 gap-3">{cards.map((c,i)=><SmartCard key={i} card={c} />)}</div>;

  /* ---------------------- UI ---------------------- */
  return (
    <div className="h-screen w-full flex flex-col" style={{ height: "100svh" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60 gpu">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-bold tracking-tight text-lg">Droxion</div>
            <div className="text-xs text-gray-400">• Lite</div>
          </div>
          <button
            onClick={loadHeadlines}
            className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition"
            title="Refresh headlines"
          >
            News
          </button>
        </div>
      </header>

      {/* Scroll container */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch", padding: "12px 0 16px", height: "calc(100svh - 48px - 96px)" }}
      >
        <div className="max-w-4xl mx-auto w-full px-3">

          {/* Recent Headlines */}
          {headlines.length > 0 && (
            <div className="mb-4">
              <div className="text-lg font-semibold mb-2">Recent Headlines</div>
              <div className="hscroll pb-1 -mx-3 pl-3 pr-6">
                <div className="flex gap-3">
                  {headlines.map((c, i) => <HeadlineCard key={i} card={c} />)}
                </div>
              </div>
              {headlineStamp && <div className="text-sm text-gray-300 mt-3">{headlineStamp}</div>}
              <div className="border-t border-white/10 mt-4" />
            </div>
          )}

          {/* Chat thread */}
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const hasCards = !!msg.cards?.length;
              return (
                <div key={i} className={`rounded-xl p-4 ${isUser ? "glass-2" : "glass"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-gray-400">{isUser ? "You" : "Droxion"}</div>
                    {!isUser && msg.content && (
                      <button
                        onClick={() => copyMessage(i)}
                        className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                        title="Copy"
                      >
                        <FaRegCopy />
                        {copiedIdx === i ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>

                  {msg.content && (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        img: (props) => (
                          <img
                            {...props}
                            src={prox(props.src)}
                            data-orig={props.src}
                            className="rounded-lg my-2 w-full glass"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            onError={(e)=>{
                              const el = e.currentTarget;
                              const tried = el.dataset.fallback || "0";
                              if (tried === "0") { el.dataset.fallback = "1"; el.src = el.dataset.orig; return; }
                              if (tried === "1") { el.dataset.fallback = "2"; el.src = unsplash("image"); return; }
                              el.style.display = "none";
                            }}
                          />
                        ),
                        iframe: (props) => (
                          <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass">
                            <iframe {...props} allowFullScreen />
                          </div>
                        ),
                        a: ({ node, ...props }) => (
                          <a {...props} className="underline decoration-gray-600 hover:text-gray-200" target="_blank" rel="noreferrer" />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}

                  {!isUser && hasCards && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.cards
                        .filter((c) => ["web","news","link","wiki","stock","crypto"].includes(c.type) && !(c.url && isPlaceholderUrl(c.url)))
                        .slice(0, 5)
                        .map((c, idx) => (
                          <a key={idx} href={c.url} target="_blank" rel="noreferrer" className="pill hover:bg:white hover:text-black transition">
                            {c.source || (c.url ? host(c.url) : "source")}
                          </a>
                        ))}
                    </div>
                  )}

                  {hasCards && <div className="mt-3">{renderCards(msg.cards)}</div>}

                  {!isUser && Array.isArray(msg.followups) && msg.followups.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {msg.followups.map((f, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(f)}
                          className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {typing && (
              <div className="glass rounded-xl p-4">
                <div className="h-4 w-24 bg-white/10 mb-2 rounded" />
                <div className="h-3 w-full bg-white/10 mb-1 rounded" />
                <div className="h-3 w-4/5 bg-white/10 mb-1 rounded" />
                <div className="h-3 w-3/5 bg-white/10 rounded" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview Panel — shows while typing; no blink */}
      {inputFocused && (textSuggestions.length > 0 || liveNews.length > 0 || liveWeather || liveCrypto.length > 0) && (
        <div className="fixed inset-x-0 bottom-[88px] z-40 gpu" onTouchMove={(e)=>e.stopPropagation()}>
          <div className="max-w-4xl mx-auto px-3">
            <div className="glass rounded-xl p-2 suggestions-panel">
              {/* NEWS */}
              <div className="mb-2">
                <div className="px-1 text-xs text-gray-400 mb-1">Recent Headlines</div>
                <div className="hscroll pb-1 -mx-2 pl-2 pr-4">
                  <div className="flex gap-2">
                    { (liveNews.length ? liveNews : Array.from({length:3})).map((c, i) =>
                      c ? <HeadlineCard key={i} card={c} /> :
                      <div key={i} className="hitem pr-3">
                        <div className="rounded-xl overflow-hidden glass">
                          <div className="aspect-[16/9] skel" />
                          <div className="p-3">
                            <div className="h-3 w-24 skel rounded mb-2" />
                            <div className="h-3 w-40 skel rounded" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* WEATHER + CRYPTO row */}
              <div className="grid grid-cols-2 gap-2 px-1 mb-2">
                <div>{liveWeather ? <WeatherMiniCard w={liveWeather} /> : <div className="glass rounded-lg p-6 skel" />}</div>
                <div className="grid grid-cols-1 gap-2">
                  { (liveCrypto.length? liveCrypto.slice(0,2) : [null, null]).map((c,i)=>
                    c ? <CryptoMiniCard key={i} c={c} /> : <div key={i} className="glass rounded-lg p-6 skel" />
                  )}
                </div>
              </div>

              {/* text suggestions */}
              {textSuggestions.length > 0 && (
                <>
                  <div className="px-1 flex justify-between items-center">
                    <div className="text-xs text-gray-400">Suggestions</div>
                    <button
                      onClick={() => { setTextSuggestions([]); }}
                      className="text-xs px-2 py-1 rounded border border-white/12 hover:bg-white hover:text-black transition"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-2">
                    {textSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        className="w-full text-left text-sm border border-white/10 rounded-md px-3 py-2 hover:bg-white/10 transition mb-2 last:mb-0"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur gpu"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2 focus-within:border-white/25 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                rows={1}
                inputMode="text"
                placeholder=""
                className="w-full bg-transparent outline-none resize-none leading-[1.6]"
                style={{ height: 44, maxHeight: 44, overflowY: "auto" }}
                aria-label="Type your message"
              />
            </div>
            <button
              onClick={() => handleSend(input)}
              className="shrink-0 h-10 px-4 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 active:scale-[0.99] transition"
              title="Send"
            >
              ➤
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex gap-2 flex-wrap mt-2">
            {["Cinematic","Anime","Futuristic","Fantasy","Realistic"].map((s) => (
              <button
                key={s}
                onClick={() => handleSend(`steps to do ${s.toLowerCase()} project`)}
                className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;