// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const normHost = (u = "") => {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./,"").replace(/^m\./,""); }
  catch { return ""; }
};
const host = (u) => normHost(u);

// we allow google/wiki/forbes/etc; keep only placeholders blocked
const BAD_HOSTS = ["example.com","example.org"];
const isFilteredSource = (u="") => {
  const h = host(u);
  return !h || BAD_HOSTS.some(b => h===b || h.endsWith("."+b));
};

const firstImageUrl = (c) =>
  c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;

const IMAGE_PROXY = `${API_BASE}/img?url=`;
const toProxy = (u) => `${IMAGE_PROXY}${encodeURIComponent(u)}`;
const unsplash = (q) => (q ? `https://source.unsplash.com/900x600/?${encodeURIComponent(q)}` : null);
const faviconFor = (u="") => {
  const h = host(u); if (!h) return null;
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(h)}`;
};

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

const isGreeting   = (s="") => /^(hi|hello|hey|yo|sup|hola|namaste)[!\.\s]*$/i.test(s.trim());
const wantsImages  = (s="") => { const q=s.trim().toLowerCase(); return /^images?:\s*/.test(q) || /\b(show\s+(me\s+)?)?(images?|photos?|pictures?)\b/.test(q) || /\bwallpaper\b/.test(q); };
const wantsNews    = (s="") => /\b(news|headlines|latest news|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|temperature|forecast)\b/i.test(s);
const wantsCrypto  = (s="") => /\b(crypto|bitcoin|btc|ethereum|eth|price|chart)\b/i.test(s);

/* --------- YouTube helpers --------- */
const getYouTubeId = (raw="") => {
  try {
    const txt = raw.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;
    const url = new URL(txt);
    const h = url.hostname.replace(/^www\./,"");
    if (h.includes("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const p = url.pathname.split("/").filter(Boolean);
      if (p[0]==="shorts" || p[0]==="embed") return p[1];
    }
    if (h.includes("youtu.be")) {
      const p = url.pathname.split("/").filter(Boolean);
      if (p[0]) return p[0];
    }
  } catch {}
  const m = raw.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};
const isYouTube = (u="") => {
  const h = host(u);
  return h.includes("youtube.com") || h.includes("youtu.be");
};

/* --------- ranking & cleaning --------- */
const HQ = [
  "forbes.com","bloomberg.com","reuters.com","cnbc.com",
  "apnews.com","ft.com","wsj.com","nytimes.com","theguardian.com","bbc.com","bbc.co.uk",
  "coindesk.com","cointelegraph.com"
];
const rankHost = (h) => {
  if (!h) return -50;
  if (BAD_HOSTS.some(b => h===b || h.endsWith("."+b))) return -200;
  if (HQ.some(g => h===g || h.endsWith("."+g))) return 100;
  if (/\b(news|finance|market|money|business|times|post|today)\b/.test(h)) return 40;
  return 10;
};
const scoreCard = (c) => {
  const h = host(c.url || "");
  let s = rankHost(h);
  if (c.type === "news") s += 10;
  if (firstImageUrl(c)) s += 6;
  if ((c.title||"").length > 0) s += 3;
  return s;
};
const dedupeCards = (arr=[]) => {
  const seen = new Set();
  return arr.filter(c => {
    const key = (host(c.url||"")||"")+ "::" + (c.title||"").toLowerCase().slice(0,80);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const rankAndTrim = (cards=[], limit=12, allowWikiFallback=false) => {
  let filtered = (cards||[]).filter(Boolean).filter(c => !!c.url && !(c?.url && isFilteredSource(c.url)));
  filtered = dedupeCards(filtered).sort((a,b) => scoreCard(b) - scoreCard(a));
  if (!filtered.length && allowWikiFallback) {
    const wiki = (cards||[]).find(c => (host(c.url||"")||"").includes("wikipedia.org"));
    if (wiki && wiki.url) filtered = [wiki];
  }
  return filtered.slice(0, limit);
};
const displaySource = (c) => host(c?.url || "") || (c?.source || "").replace(/\s+[-–]\s+.*/,"");

const bestPreview = (card, allowFallback=false) => {
  const direct = firstImageUrl(card);
  if (direct) return { prox: direct, orig: direct, title: card.title || card.source || "preview" };
  if (!allowFallback) return null;
  if (card.url && !isFilteredSource(card.url)) {
    const shot = `https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(card.url)}`;
    return { prox: shot, orig: card.url, title: card.title || "preview" };
  }
  const ph = unsplash(card.title || card.source || "news");
  return ph ? { prox: ph, orig: ph, title: card.title || "preview" } : null;
};

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // live preview (while typing)
  const [focused, setFocused] = useState(false);
  const [textSug, setTextSug] = useState([]);
  const [news, setNews] = useState([]);
  const [weather, setWeather] = useState(null);
  const [crypto, setCrypto] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const inputRef = useRef(null);
  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });

  // keyboard/scroll
  const scrollRef = useRef(null);

  /* base CSS + keyboard-safe fixes */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name","viewport");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");

    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); --kb:0px; }
      html, body { height: 100%; background:#000; color:#fff; margin:0; padding:0; }
      * { -webkit-tap-highlight-color: transparent; }
      .glass { background: var(--glass); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .pill { font-size:11px; padding:2px 8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:999px; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .suggestions-panel { max-height: min(52vh, calc(100svh - 180px)); overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; touch-action: pan-y; }
      .hscroll { overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; }
      .hitem { min-width: 78%; max-width: 78%; scroll-snap-align:start; }
      @media (min-width:480px){ .hitem{ min-width: 52%; max-width: 52%; } }
      @media (min-width:768px){ .hitem{ min-width: 33%; max-width: 33%; } }
      .skel { background: linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12), rgba(255,255,255,.06)); background-size: 200% 100%; animation: shimmer 1.1s infinite; }
      @keyframes shimmer { 0%{background-position: 200% 0} 100%{background-position: -200% 0} }

      /* keyboard-aware fixed elements */
      .fixed-bottom { position: fixed; left:0; right:0; bottom: calc(env(safe-area-inset-bottom) + var(--kb)); }
      .fixed-preview { position: fixed; left:0; right:0; bottom: calc(88px + var(--kb)); overflow-anchor: none; }

      /* scroll container padding so input is never hidden */
      .chat-scroll { scroll-padding-bottom: 160px; overscroll-behavior: contain; }

      /* --- NEW: structured message layout --- */
      .msg { padding:12px; border-radius:12px; }
      .answer { font-size:14px; line-height:1.55; display:-webkit-box; -webkit-line-clamp:6; -webkit-box-orient:vertical; overflow:hidden; }
      .answer.expanded { -webkit-line-clamp:unset; max-height:none; }
      .small-label { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#9ca3af; }
      .actions-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
      .action-btn { font-size:12px; padding:6px 10px; border:1px solid rgba(255,255,255,.12); border-radius:999px; background:rgba(255,255,255,.06); }
      .sources-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
      .src-tile { display:flex; align-items:center; gap:8px; padding:8px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10); }
      .src-title { font-size:12px; line-height:1.3; color:#e5e7eb; }
      .src-sub { font-size:11px; color:#9ca3af; }
      .toggle-more { margin-top:6px; font-size:12px; color:#cbd5e1; }
      .dim-while-typing { opacity:.7; filter:blur(1px); transition:opacity .2s, filter .2s; }
    `;
    document.head.appendChild(style);

    // visualViewport -> compute keyboard height to push fixed bars up
    const vv = window.visualViewport;
    const handleVV = () => {
      if (!vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb", kb + "px");
    };
    handleVV();
    vv?.addEventListener("resize", handleVV);
    vv?.addEventListener("scroll", handleVV);
    window.addEventListener("orientationchange", handleVV);

    return () => {
      document.head.removeChild(style);
      vv?.removeEventListener("resize", handleVV);
      vv?.removeEventListener("scroll", handleVV);
      window.removeEventListener("orientationchange", handleVV);
    };
  }, []);

  /* text suggestions */
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(suggestTimer.current);
    if (!focused || q.length < 1) { setTextSug([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setTextSug((data?.suggestions || []).slice(0, 8));
      } catch { setTextSug([]); }
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [input, focused]);

  /* live previews (news/weather/crypto) while typing */
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(previewTimer.current);
    if (!focused || q.length < 1) return;

    setLoadingPanel(true);
    cancelPrev.current.cancel?.();
    const src = axios.CancelToken.source();
    cancelPrev.current = { cancel: () => src.cancel("new query") };

    previewTimer.current = setTimeout(async () => {
      try {
        const reqs = [
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "news"   }, { cancelToken: src.token }).catch(()=>null),
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "weather"}, { cancelToken: src.token }).catch(()=>null),
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "crypto" }, { cancelToken: src.token }).catch(()=>null),
        ];
        const [rn, rw, rc] = await Promise.all(reqs);

        const newsRanked = rankAndTrim(
          (rn?.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image, type: c.type || "news" })),
          10, true
        ).filter(c => !!bestPreview(c, true));
        setNews(newsRanked.length ? newsRanked : news);

        const wcards = (rw?.data?.cards || []).filter(Boolean);
        setWeather(wcards.find((c)=>c.type==="weather") || wcards[0] || null);

        setCrypto((rc?.data?.cards || []).filter(Boolean).slice(0,6));
      } finally { setLoadingPanel(false); }
    }, 350);
    return () => clearTimeout(previewTimer.current);
  }, [input, focused]);

  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1000);
    } catch {}
  };

  const fetchFollowups = async (q) => {
    try {
      const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q, mode: "followup" } });
      const arr = (data?.suggestions || []).filter(Boolean);
      return (arr.length ? arr : ["Explain more","Pros & cons","Give steps"]).slice(0,3);
    } catch { return ["Explain more","Pros & cons","Give steps"]; }
  };

  const pushWithFollowups = async (md, cards, q) => {
    setMessages((p) => [...p, { role: "assistant", content: md, cards }]);
    const followups = await fetchFollowups(q);
    setMessages((p) => {
      const last = p[p.length-1]; if (!last || last.role!=="assistant") return p;
      const copy = [...p]; copy[copy.length-1] = { ...last, followups }; return copy;
    });
  };

  /* ---------------------- send ---------------------- */
  const handleSend = async (text = input) => {
    const content = (text || "").trim(); if (!content) return;
    setTyping(true);
    setMessages((p) => [...p, { role: "user", content }]);
    setInput("");
    setTextSug([]);

    try {
      if (isGreeting(content)) {
        const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
        await pushWithFollowups(r.data?.reply || r.data?.text || "👋", [], content);
        setTyping(false); return;
      }

      const lower = content.toLowerCase();

      // YouTube search / embed
      if (lower.startsWith("youtube:") || /\byoutube( video)?\b/.test(lower)) {
        const q = content.replace(/^youtube:\s*/i, "").trim() || content;
        try {
          const r = await axios.post(`${API_BASE}/search-youtube`, { prompt: q });
          const url = r.data?.url;
          if (url) {
            await pushWithFollowups(`### YouTube\nFound a video for **${q}**.`, [{ type: "youtube", url, title: q }], content);
          } else {
            await pushWithFollowups(`Couldn't find a YouTube result for **${q}**.`, [], content);
          }
        } catch {
          await pushWithFollowups("YouTube search is unavailable right now.", [], content);
        }
        setTyping(false); return;
      }

      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: q });
          const cards = rankAndTrim((r.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image })), 12, true);
          const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;
          await pushWithFollowups(md, cards, content);
        } catch { await pushWithFollowups("Preview is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/search`, { prompt: q });
          const results = rankAndTrim(
            (r.data?.results || []).filter(Boolean).map(it => ({ type:"web", title: it.title, url: it.url, image: it.image || null, source: it.source, snippet: it.snippet })), 12, true
          );
          await pushWithFollowups(results.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, results, content);
        } catch { await pushWithFollowups("Search is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      if (wantsNews(content)) {
        let r = null, cards = [];
        try {
          r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "news" });
          cards = rankAndTrim((r.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image, type: c.type || "news" })), 12, true)
            .filter(c => !!bestPreview(c, true));
        } catch {}
        if (!cards.length && news.length) cards = news.slice(0,10);
        await pushWithFollowups((r?.data?.markdown || "Top news:"), cards, content);
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

      if (wantsImages(content)) {
        const q = content.replace(/^images?:\s*/i, "") || content;
        try {
          const rr = await axios.post(`${API_BASE}/realtime`, { query: q, intent: "images" });
          let cards = Array.isArray(rr.data?.cards) ? rr.data.cards.filter(Boolean) : [];
          cards = cards.filter((c)=> !(c?.url && isFilteredSource(c.url)));
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
      const cards = rankAndTrim((res.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image })), 12, true);
      await pushWithFollowups(md, cards, content);
    } catch {
      await pushWithFollowups("⚠️ Error or connection failed.", [], content);
    } finally { setTyping(false); }
  };

  /* ---------------------- render helpers ---------------------- */
  const SmartImage = ({ url, title }) => {
    if (!url) return null;
    const elRef = useRef(null);
    useEffect(() => { const el = elRef.current; if (!el) return; el.dataset.step = "orig"; el.src = url; }, [url]);
    const onErr = (e) => {
      const el = e.currentTarget;
      const step = el.dataset.step || "orig";
      if (step === "orig")   { el.dataset.step = "proxy";    el.src = toProxy(url); return; }
      if (step === "proxy")  { el.dataset.step = "fallback"; el.src = unsplash(title || "image") || ""; return; }
      el.style.display = "none";
    };
    return <img ref={elRef} alt="" className="w-full rounded-lg glass" loading="lazy" referrerPolicy="no-referrer" onError={onErr} />;
  };

  // Compact media block (YouTube, gallery, weather)
  const MediaBlock = ({ cards = [] }) => {
    if (!cards.length) return null;
    return (
      <div className="grid grid-cols-1 gap-8 mt-3">
        {cards.map((card, i) => {
          if (card.type === "weather") {
            return (
              <div key={i} className="glass rounded-lg p-3 flex items-center gap-3">
                {card?.icon && <SmartImage url={card.icon} title={card.title} />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{card?.title || "Weather"}</div>
                  <div className="text-xs text-gray-400 truncate">{card?.subtitle || card?.meta}</div>
                </div>
              </div>
            );
          }
          if (card.type === "gallery" && Array.isArray(card.images)) {
            const urls = card.images.map((it)=> typeof it==="string" ? it : (it.url || it.thumbnail || it.thumb)).filter(Boolean).slice(0,10);
            if (!urls.length) return null;
            return <div key={i} className="grid grid-cols-2 gap-2">{urls.map((u,j)=><SmartImage key={j} url={u} title="image" />)}</div>;
          }
          if (card.type === "youtube" || isYouTube(card.url || "")) {
            const id = getYouTubeId(card.url || ""); if (!id) return null;
            return (
              <div key={i} className="embed-responsive embed-16by9 rounded overflow-hidden glass" style={{ maxHeight: 280 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${id}`}
                  title={card.title || "YouTube"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  // Sources & actions builders
  const buildLinkSets = (cards = []) => {
    const links = (cards || []).filter(c => ["web","link","wiki","news","stock","crypto"].includes(c.type) && c.url && !isFilteredSource(c.url));
    // prioritize high-quality domains first
    const sorted = dedupeCards(links).sort((a,b) => scoreCard(b) - scoreCard(a));
    // quick actions: Forbes/Bloomberg/Reuters/CNBC + Google + Wikipedia + YouTube if present
    const pref = ["forbes.com","bloomberg.com","reuters.com","cnbc.com","google.com","wikipedia.org","youtube.com","youtu.be"];
    const byHost = {};
    for (const c of sorted) {
      const h = host(c.url);
      if (!byHost[h]) byHost[h] = c;
    }
    const quickActions = [];
    for (const ph of pref) {
      const k = Object.keys(byHost).find(h => h===ph || h.endsWith("."+ph));
      if (k) quickActions.push(byHost[k]);
    }
    // sources grid = top 6 unique hosts (HQ first)
    const grid = Object.values(byHost).sort((a,b)=> scoreCard(b)-scoreCard(a)).slice(0,6);
    return { quickActions, grid };
  };

  const SourceTile = ({ c }) => {
    const fav = faviconFor(c.url);
    const ttl = (c.title || "").replace(/\s+[-–]\s+.*$/,"").slice(0, 60);
    return (
      <a href={c.url} target="_blank" rel="noreferrer" className="src-tile hover:bg-white/10 transition">
        {fav && <img src={fav} alt="" width={16} height={16} style={{ borderRadius: 4 }} />}
        <div className="min-w-0">
          <div className="src-title truncate">{ttl || (host(c.url) || "source")}</div>
          <div className="src-sub truncate">{displaySource(c)}</div>
        </div>
      </a>
    );
  };

  /* ---------------------- UI ---------------------- */
  const [expandedIdx, setExpandedIdx] = useState(null);

  return (
    <div className="flex flex-col min-h-[100svh]">
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
        </div>
      </header>

      {/* chat scroll area */}
      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling:"touch" }}>
        <div className="max-w-4xl mx-auto w-full px-3 pb-32 pt-3">
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const cards = msg.cards || [];
              // split media vs links
              const mediaCards = cards.filter(c => ["youtube","image","gallery","weather"].includes(c.type) || isYouTube(c.url || ""));
              const linkSets = buildLinkSets(cards);
              const hasAnything = cards.length>0 || (msg.content && msg.content.length>0);

              return (
                <div key={i} className={`msg ${isUser ? "glass-2" : "glass"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="small-label">{isUser ? "You" : "Droxion"}</div>
                    {!isUser && msg.content && (
                      <button onClick={()=>copyMessage(i)} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1" title="Copy">
                        <FaRegCopy /> {copiedIdx===i ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>

                  {/* Answer (line clamp, toggle) */}
                  {!isUser && msg.content && (
                    <>
                      <div className={`answer ${expandedIdx===i ? "expanded" : ""}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            img: (props) => {
                              const src = props.src;
                              return (
                                <img
                                  {...props}
                                  src={src}
                                  className="rounded-lg my-2 w-full glass"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e)=>{
                                    const el=e.currentTarget;
                                    const step=el.dataset.step||"orig";
                                    if(step==="orig"){ el.dataset.step="proxy"; el.src = toProxy(src); return; }
                                    if(step==="proxy"){ el.dataset.step="fallback"; el.src = unsplash("image"); return; }
                                    el.style.display="none";
                                  }}
                                />
                              );
                            },
                            iframe: (props) => <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass"><iframe {...props} allowFullScreen /></div>,
                            a: ({node, ...props}) => <a {...props} className="underline decoration-gray-600 hover:text-gray-200" target="_blank" rel="noreferrer" />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <button className="toggle-more underline decoration-gray-600" onClick={()=>setExpandedIdx(expandedIdx===i?null:i)}>
                        {expandedIdx===i ? "Show less" : "Show more"}
                      </button>
                    </>
                  )}

                  {/* Media between answer and sources */}
                  {!isUser && <MediaBlock cards={mediaCards} />}

                  {/* Quick actions */}
                  {!isUser && linkSets.quickActions.length>0 && (
                    <div className="actions-row">
                      {linkSets.quickActions.slice(0,5).map((c,idx)=>(
                        <a key={idx} href={c.url} target="_blank" rel="noreferrer" className="action-btn hover:bg-white hover:text-black transition">
                          {displaySource(c).replace(/^m\./,"")}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Sources grid */}
                  {linkSets.grid.length>0 && (
                    <div className="mt-3">
                      <div className="small-label mb-1">Sources</div>
                      <div className="sources-grid">
                        {linkSets.grid.map((c,idx)=> <SourceTile key={idx} c={c} />)}
                      </div>
                    </div>
                  )}

                  {/* Follow-ups under sources */}
                  {!isUser && Array.isArray(msg.followups) && msg.followups.length>0 && (
                    <div className="mt-3 flex flex-wrap gap-8">
                      {msg.followups.slice(0,3).map((s,idx)=>(
                        <button key={idx} onClick={()=>handleSend(s)} className="action-btn">
                          {s}
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

      {/* LIVE PREVIEW PANEL – keyboard safe, dims while typing */}
      {focused && (
        <div className={`fixed-preview fixed-panel ${input.length ? "dim-while-typing" : ""}`}>
          <div className="max-w-4xl mx-auto px-3">
            <div className="panel glass rounded-xl p-2 suggestions-panel">
              <div className="mb-2">
                <div className="px-1 text-xs text-gray-400 mb-1">Recent Headlines</div>
                <div className="hscroll pb-1 -mx-2 pl-2 pr-4">
                  <div className="flex gap-2">
                    {(news.length ? news : Array.from({length:3})).map((c,i)=>
                      c ? (
                        <a key={i} href={c.url} target="_blank" rel="noreferrer" className="hitem pr-3">
                          <div className="rounded-xl overflow-hidden glass">
                            {(() => {
                              const pv = bestPreview(c, true);
                              return pv
                                ? <img src={pv.prox} alt="" className="w-full aspect-[16/9] object-cover" loading="lazy" referrerPolicy="no-referrer" onError={(e)=>{ e.currentTarget.style.display="none"; }} />
                                : <div className="aspect-[16/9] skel" />;
                            })()}
                            <div className="p-3">
                              <div className="text-[11px] text-gray-400 mb-1">{displaySource(c)}</div>
                              <div className="text-sm font-semibold line-clamp-2 leading-tight">{c.title}</div>
                              <div className="text-[11px] text-gray-500 mt-1">{timeAgo(c.publishedAt || c.time)}</div>
                            </div>
                          </div>
                        </a>
                      ) : (
                        <div key={i} className="hitem pr-3">
                          <div className="rounded-xl overflow-hidden glass">
                            <div className="aspect-[16/9] skel" />
                            <div className="p-3">
                              <div className="h-3 w-24 skel rounded mb-2" />
                              <div className="h-3 w-40 skel rounded" />
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-1 mb-2">
                <div>{weather ? (
                  <div className="glass rounded-lg p-3 flex items-center gap-3">
                    {weather?.icon && <SmartImage url={weather.icon} title={weather.title} />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{weather?.title || "Weather"}</div>
                      <div className="text-xs text-gray-400 truncate">{weather?.subtitle || weather?.meta}</div>
                    </div>
                  </div>
                ) : <div className="glass rounded-lg p-6 skel" />}</div>
                <div className="grid grid-cols-1 gap-2">
                  {(crypto.length ? crypto.slice(0,2) : [null,null]).map((c,i)=> c ? (
                    <a key={i} href={c.url} target="_blank" rel="noreferrer" className="glass rounded-lg p-3 block">
                      <div className="text-sm font-semibold">{c.title || c.symbol || "Crypto"}</div>
                      <div className="text-xs text-gray-400">{c.meta || c.source || (c.url ? host(c.url) : "")}</div>
                      {c.price && <div className="text-base mt-1">{c.price}</div>}
                      {typeof c.change!=="undefined" && (
                        <div className={`text-xs mt-1 ${String(c.change).startsWith("-")?"text-red-400":"text-green-400"}`}>{c.change}</div>
                      )}
                    </a>
                  ) : <div key={i} className="glass rounded-lg p-6 skel" />)}
                </div>
              </div>

              {textSug.length>0 && (
                <div className="mt-1">
                  <div className="px-1 text-xs text-gray-400 mb-1">Suggestions</div>
                  {textSug.map((s,i)=>(
                    <button key={i} onClick={()=>handleSend(s)} className="w-full text-left text-sm border border-white/10 rounded-md px-3 py-2 hover:bg-white/10 transition mb-2 last:mb-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composer – keyboard aware */}
      <div className="fixed-bottom z-50 border-t border-white/10 bg-black/80 backdrop-blur" style={{ paddingBottom:"max(env(safe-area-inset-bottom), 12px)" }}>
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2 focus-within:border-white/25 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e)=>setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleSend(); }}}
                onFocus={()=>setFocused(true)}
                onBlur={()=>setTimeout(()=>setFocused(false),150)}
                rows={1}
                inputMode="text"
                placeholder=""
                className="w-full bg-transparent outline-none resize-none leading-[1.6]"
                style={{ height:44, maxHeight:44, overflowY:"auto" }}
                aria-label="Type your message"
              />
            </div>
            <button onClick={()=>handleSend(input)} className="shrink-0 h-10 px-4 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 active:scale-[0.99] transition" title="Send">
              ➤
            </button>
          </div>

          <div className="flex gap-2 flex-wrap mt-2">
            {["Cinematic","Anime","Futuristic","Fantasy","Realistic"].map((s)=>(
              <button key={s} onClick={()=>handleSend(`steps to do ${s.toLowerCase()} project`)} className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition">
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