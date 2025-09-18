// src/AIChat.jsx — Droxion (single + menu, images preserved, no card trimming in messages) — FIXED
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";
import {
  FiMoon, FiSun, FiPlus,
  FiCamera, FiImage, FiFile,
  FiCpu, FiSearch, FiBook, FiAperture, FiGlobe,
  FiArrowRight
} from "react-icons/fi";
import "./AIChat.css";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const normHost = (u = "") => {
  try {
    const url = new URL(u);
    if (url.protocol === "blob:" || url.protocol === "data:") return "";
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return "";
  }
};
const host = (u) => normHost(u);
const isBlobUrl = (u = "") => {
  try {
    const p = new URL(u).protocol;
    return p === "blob:" || p === "data:";
  } catch {
    return false;
  }
};

const BAD_HOSTS = ["example.com", "example.org"];
const isFilteredSource = (u = "") => {
  const h = host(u);
  return !h || BAD_HOSTS.some((b) => h === b || h.endsWith("." + b));
};

// ⬇️ Keep your original working selector
const firstImageUrl = (c) =>
  c?.image_url ||
  c?.image ||
  c?.thumbnail ||
  c?.thumb ||
  c?.thumb_url ||
  c?.ogImage ||
  null;

const IMAGE_PROXY = `${API_BASE}/img?url=`;
const toProxy = (u = "") =>
  !u || isBlobUrl(u) || !/^https?:/i.test(u)
    ? u
    : `${IMAGE_PROXY}${encodeURIComponent(u)}`;
const unsplash = (q) =>
  q ? `https://source.unsplash.com/900x600/?${encodeURIComponent(q)}` : null;

const timeAgo = (d) => {
  if (!d) return "";
  const t = typeof d === "string" ? new Date(d).getTime() : +d;
  if (!t || Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  return `${dd}d ago`;
};

/* small youtube helpers */
const isYouTube = (raw = "") => {
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./, "");
    return h.includes("youtube.com") || h.includes("youtu.be");
  } catch {
    return /youtu\.?be/.test(raw);
  }
};
const youTubeIdFromUrl = (raw = "") => {
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./, "");
    if (h.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0] === "shorts" || p[0] === "embed") return p[1];
    }
    if (h.includes("youtu.be")) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]) return p[0];
    }
  } catch {}
  const m = raw && raw.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/* ---------------------- quick intent ---------------------- */
const wantsImages  = (s="") => { const q=s.trim().toLowerCase(); return /^images?:\s*/.test(q) || /\b(show\s+(me\s+)?)?(images?|photos?|pictures?)\b/.test(q) || /\bwallpaper\b/.test(q); };
const wantsNews    = (s="") => /\b(news|headlines|latest news|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|temperature|forecast|rain|humidity|wind)\b/i.test(s);
const wantsCrypto  = (s="") => /\b(crypto|bitcoin|btc|ethereum|eth|price|chart)\b/i.test(s);
const isSearchy = (s="") => {
  const q = s.toLowerCase();
  return q.startsWith("google:") || q.startsWith("search:") ||
    /\b(now|today|latest|breaking|live|update|news|price|stock|chart|weather|forecast|crypto|btc|eth)\b/.test(q) ||
    wantsNews(q) || wantsWeather(q) || wantsCrypto(q);
};

/* ---------------------- ranking for PREVIEW only ---------------------- */
const HQ = [
  "forbes.com","bloomberg.com","reuters.com","cnbc.com","apnews.com","ft.com","wsj.com","nytimes.com",
  "theguardian.com","bbc.com","npr.org","coindesk.com","cointelegraph.com",
  "finance.yahoo.com","google.com","marketwatch.com","nasdaq.com","sec.gov","wikipedia.org"
];
const rankHost = (h) =>
  !h ? -50
  : BAD_HOSTS.some(b => h===b || h.endsWith("."+b)) ? -200
  : (HQ.some(g => h===g || h.endsWith("."+g)) ? 100 : 10);

const dedupeCards = (arr=[]) => {
  const seen=new Set();
  return arr.filter(c=>{
    const key=(host(c.url||"")||"")+ "::" + (c.title||"").toLowerCase().slice(0,80);
    if(seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const rankAndTrim = (cards=[], limit=12) =>
  dedupeCards(cards.filter(c => !!c && !!c.url && !isFilteredSource(c.url)))
    .sort((a,b)=> (rankHost(host(b.url||"")) - rankHost(host(a.url||""))))
    .slice(0, limit);

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

/* ---------------------- Weather card ---------------------- */
function WeatherCard({ card }) {
  if (!card) return null;
  const pick = (o,ks,d=null)=>{ for(const k of ks) if(o && o[k]!=null && o[k] !== "") return o[k]; return d; };
  const T = (()=>{ const c=card.temp_c, f=card.temp_f; if(typeof c==="number"&&typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`; if(typeof c==="number") return `${Math.round(c)}°C`; if(typeof f==="number") return `${Math.round(f)}°F`; return ""; })();
  const FEELS = (()=>{ const c=card.feels_c, f=card.feels_f; if(typeof c==="number"&&typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`; if(typeof c==="number") return `${Math.round(c)}°C`; if(typeof f==="number") return `${Math.round(f)}°F`; return ""; })();
  const WIND = (()=>{ const k=card.wind_kph, m=card.wind_mph; if(typeof k==="number"&&typeof m==="number") return `${Math.round(k)} km/h • ${Math.round(m)} mph`; if(typeof k==="number") return `${Math.round(k)} km/h`; if(typeof m==="number") return `${Math.round(m)} mph`; return "";})();
  const RH = (typeof card.humidity === "number") ? `${Math.round(card.humidity)}%` : "";
  const RAIN = (card.precip != null && card.precip !== "") ? `${card.precip}${typeof card.precip === "number" ? " mm" : ""}` : "";
  const hourLabel = (ts)=>{ try{ const d=new Date(ts); let h=d.getHours(); const am=h<12; h=h%12||12; return `${h}${am?"am":"pm"}`;}catch{return"";} };
  const hrs=(card.hourly||[]).slice(0,8).map(h=>({ t:pick(h,["time","ts","timestamp","date"]), icon:pick(h,["icon","icon_url","image"]), c:pick(h,["temp_c","tempC","temperature_c","temperatureC","temp"]), f:pick(h,["temp_f","tempF","temperature_f","temperatureF"]), text:pick(h,["text","condition","desc"]) }));
  const days=(card.daily||[]).slice(0,3).map(d=>({ day:pick(d,["day","name","weekday","label"]), icon:pick(d,["icon","icon_url","image"]), min_c:pick(d,["min_c","minC","low_c","lowC"]), min_f:pick(d,["min_f","minF","low_f","lowF"]), max_c:pick(d,["max_c","maxC","high_c","highC"]), max_f:pick(d,["max_f","maxF","high_f","highF"]), text:pick(d,["text","condition","desc"]) }));

  return (
    <div className="weather-card glass rounded-xl p-3">
      <div className="flex items-center gap-3">
        {card.icon && <img src={card.icon} alt="" className="w-12 h-12 rounded-md bg-white/5 border border-white/10 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{card.title || "Weather"}</div>
          <div className="text-xs text-gray-400 truncate">{card.subtitle || ""}</div>
        </div>
      </div>
      {(T || FEELS || RH || WIND || RAIN) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
          {T     && <div className="wstat"><div className="wlabel">Temperature</div><div className="wval">{T}</div></div>}
          {FEELS && <div className="wstat"><div className="wlabel">Feels like</div><div className="wval">{FEELS}</div></div>}
          {RH    && <div className="wstat"><div className="wlabel">Humidity</div><div className="wval">{RH}</div></div>}
          {WIND  && <div className="wstat"><div className="wlabel">Wind</div><div className="wval">{WIND}</div></div>}
          {RAIN  && <div className="wstat"><div className="wlabel">Precip</div><div className="wval">{RAIN}</div></div>}
        </div>
      )}
      {hrs.length>0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Next hours</div>
          <div className="w-hscroll flex gap-8 overflow-x-auto -mx-1 px-1 pb-1">
            {hrs.map((h,i)=>(
              <div key={i} className="w-hour glass rounded-lg p-2 min-w-[86px] text-center">
                <div className="text-[11px] text-gray-400">{h.t ? hourLabel(h.t) : (h.text || "").split(" ")[0]}</div>
                {h.icon && <img src={h.icon} alt="" className="mx-auto my-1 h-8 w-8 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="text-sm font-semibold">{(()=>{
                  const c=h.c, f=h.f;
                  if(typeof c==="number" && typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`;
                  if(typeof c==="number") return `${Math.round(c)}°C`;
                  if(typeof f==="number") return `${Math.round(f)}°F`;
                  return "-";
                })()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {days.length>0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Next days</div>
          <div className="grid grid-cols-3 gap-2">
            {days.map((d,i)=>(
              <div key={i} className="glass rounded-lg p-2 text-center">
                <div className="text-[11px] text-gray-400 truncate">{d.day || `Day ${i+1}`}</div>
                {d.icon && <img src={d.icon} alt="" className="mx-auto my-1 h-8 w-8 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="text-xs font-semibold">
                  {(()=>{
                    const c=d.max_c, f=d.max_f, lc=d.min_c, lf=d.min_f;
                    const hi = (typeof c==="number"&&typeof f==="number")?`${Math.round(c)}°C / ${Math.round(f)}°F`: (typeof c==="number")?`${Math.round(c)}°C`:(typeof f==="number")?`${Math.round(f)}°F`:"";
                    const lo = (typeof lc==="number"&&typeof lf==="number")?`${Math.round(lc)}°C / ${Math.round(lf)}°F`: (typeof lc==="number")?`${Math.round(lc)}°C`:(typeof lf==="number")?`${Math.round(lf)}°F`:"";
                    return `${hi} / ${lo}`;
                  })()}
                </div>
                {d.text && <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{d.text}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- Tools Menu (single + menu) ---------------------- */
function ToolsMenu({
  onSendImageFile,
  onSendAnyFile,
  onToggleAgent, agentOn,
  onDeepResearch,
  onSetPersona,
  onCreateImage,
  webSearchOn, onToggleWebSearch,
  onClearAll,
  onNewChat,
  onClose
}) {
  const camRef = useRef(null);
  const photosRef = useRef(null);
  const filesRef = useRef(null);

  // ❌ Do NOT close the menu before the picker returns (iOS)
  const pickCamera = () => camRef.current?.click();
  const pickPhotos = () => photosRef.current?.click();
  const pickFiles  = () => filesRef.current?.click();

  const handleCamFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onSendImageFile?.(f, { source: "camera" });
    e.target.value = "";
    onClose?.(); // close AFTER
  };
  const handlePhotoFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onSendImageFile?.(f, { source: "photos" });
    e.target.value = "";
    onClose?.();
  };
  const handleAnyFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onSendAnyFile?.(f);
    e.target.value = "";
    onClose?.();
  };

  const wrap = (fn) => () => { try { fn?.(); } finally { onClose?.(); } };

  return (
    <div className="menu-panel">
      {/* hidden inputs */}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCamFile} />
      <input ref={photosRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
      <input ref={filesRef} type="file" className="hidden" onChange={handleAnyFile} />

      <button className="menu-item" onClick={pickCamera}><FiCamera className="icon" /><span>Camera</span></button>
      <button className="menu-item" onClick={pickPhotos}><FiImage className="icon" /><span>Photos</span></button>
      <button className="menu-item" onClick={pickFiles}><FiFile className="icon" /><span>Files</span></button>

      <hr className="menu-sep" />

      <button className={`menu-item ${agentOn ? "active":""}`} onClick={wrap(onToggleAgent)}><FiCpu className="icon" /><span>Agent mode {agentOn?"On":"Off"}</span></button>
      <button className="menu-item" onClick={wrap(onDeepResearch)}><FiSearch className="icon" /><span>Deep research</span></button>
      <button className="menu-item" onClick={wrap(() => onSetPersona?.("teacher"))}><FiBook className="icon" /><span>Study &amp; learn</span></button>
      <button className="menu-item" onClick={wrap(onCreateImage)}><FiAperture className="icon" /><span>Create image</span></button>
      <button className={`menu-item ${webSearchOn ? "active":""}`} onClick={wrap(onToggleWebSearch)}><FiGlobe className="icon" /><span>Web search {webSearchOn?"On":"Off"}</span></button>

      <hr className="menu-sep" />

      <button className="menu-item" onClick={wrap(onNewChat)}><FiPlus className="icon" /><span>New chat</span></button>
      <button className="menu-item danger" onClick={wrap(onClearAll)}><span>Clear chat + memory</span></button>
    </div>
  );
}

/* ---------------------- main component ---------------------- */
function AIChat() {
  // chat + ui
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing] = useState(false);

  // live preview
  const [focused, setFocused] = useState(false);
  const [textSug, setTextSug] = useState([]);
  const [news, setNews] = useState([]);
  const [weather, setWeather] = useState(null);
  const [crypto, setCrypto] = useState([]);

  // toggles
  const [theme, setTheme] = useState(() => localStorage.getItem("drox.theme") || "dark");
  const [agentOn, setAgentOn] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(true);
  const [persona, setPersona] = useState("");

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });

  // 🔧 for safe in-place replacement of the temp image message
  const tempImageMsgIndexRef = useRef(-1);

  const STORAGE_KEY = "droxion.chat.v1";
  const MEM_KEY = "droxion.mem.v1";

  // restore & persist chat
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) setMessages(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);
  useEffect(() => {
    localStorage.setItem("drox.theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // keyboard-safe viewport
  useEffect(() => {
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
      vv?.removeEventListener("resize", handleVV);
      vv?.removeEventListener("scroll", handleVV);
      window.removeEventListener("orientationchange", handleVV);
    };
  }, []);

  // ✅ usage tracking only (one ping/day/device)
  useEffect(() => {
    const KEY = "droxion.track.last";
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(KEY);
    if (last !== today) {
      localStorage.setItem(KEY, today);
      axios.post(`${API_BASE}/track`, { type: "ping", date: today }).catch(() => {});
    }
  }, []);

  /* ---------------------- suggestions + live previews ---------------------- */
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

  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(previewTimer.current);
    if (!focused || q.length < 1) return;
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
          (rn?.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image, type: c.type || "news" })), 10
        ).filter(c => !!bestPreview(c, true));
        setNews(newsRanked);

        const wcards = (rw?.data?.cards || []).filter(Boolean);
        const w = wcards.find((c)=>c.type==="weather") || wcards[0] || null;
        setWeather(w || null);

        setCrypto((rc?.data?.cards || []).filter(Boolean).slice(0,6));
      } catch {}
    }, 350);
    return () => clearTimeout(previewTimer.current);
  }, [input, focused]);

  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
    } catch {}
  };

  const fetchFollowups = async (q) => {
    try {
      const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q, mode: "followup" } });
      const arr = (data?.suggestions || []).filter(Boolean);
      return (arr.length ? arr : ["Explain more","Pros & cons","Give steps"]).slice(0,3);
    } catch { return ["Explain more","Pros & cons","Give steps"]; }
  };

  const pushWithFollowups = async (md, cards, q, meta={}) => {
    setMessages((p) => [...p, { role: "assistant", content: md, cards, meta }]);
    const followups = await fetchFollowups(q);
    setMessages((p) => {
      const last = p[p.length-1]; if (!last || last.role!=="assistant") return p;
      const copy = [...p]; copy[copy.length-1] = { ...last, followups }; return copy;
    });
  };

  /* ---------------------- send handlers — NO TRIMMING of cards ---------------------- */
  const handleSend = async (text = input) => {
    const content = (text || "").trim(); if (!content) return;
    setMessages((p) => [...p, { role: "user", content }]);
    setInput(""); setTextSug([]);

    try {
      const lower = content.toLowerCase();

      /* 🔥 IMAGES INTENT — build a grid no matter what the backend says */
      if (wantsImages(content)) {
        let cards = [];
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "images", web: webSearchOn });
          cards = (r.data?.cards || []).filter(Boolean);
        } catch {}

        const hasImages =
          cards.some(c => c?.type === "gallery" || c?.type === "image" || c?.type === "images-grid" || firstImageUrl(c));

        if (!hasImages) {
          const q = content.replace(/^images?:\s*/i, "").trim() || "wallpaper";
          const urls = Array.from({ length: 10 }).map((_, i) =>
            `https://source.unsplash.com/600x400/?${encodeURIComponent(q)}&sig=${i + 1}`
          );
          cards = [{ type: "images-grid", images: urls }];
        }

        const md = `Here are some images. Tap any card to open.`;
        await pushWithFollowups(md, cards, content, { suppressSources: true });
        return;
      }
      /* 🔥 end images branch */

      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        const r = await axios.post(`${API_BASE}/realtime`, { query: q, web: webSearchOn });
        const cards = (r.data?.cards || []).filter(Boolean);
        const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;
        await pushWithFollowups(md, cards, content);
        return;
      }

      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        const r = await axios.post(`${API_BASE}/search`, { prompt: q, web: webSearchOn });
        const cards = (r.data?.results || []).filter(Boolean).map(it => ({
          type:"web", title: it.title, url: it.url, image: it.image || null, source: it.source, snippet: it.snippet
        }));
        await pushWithFollowups(cards.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, cards, content);
        return;
      }

      if (wantsNews(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "news", web: webSearchOn });
        const cards = (r.data?.cards || []).filter(Boolean);
        await pushWithFollowups((r?.data?.markdown || "Top news:"), cards, content);
        return;
      }

      if (wantsWeather(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "weather" });
        const cards = (r.data?.cards || []).filter(Boolean);
        await pushWithFollowups(r.data?.markdown || "Weather:", cards, content);
        return;
      }

      if (wantsCrypto(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "crypto", web: webSearchOn });
        const cards = (r.data?.cards || []).filter(Boolean);
        await pushWithFollowups(r.data?.markdown || "Crypto:", cards, content);
        return;
      }

      // ---- default chat ----
      const res = await axios.post(`${API_BASE}/chat`, {
        prompt: content, memory: [], persona, web: webSearchOn, agent: agentOn
      });
      const md = res.data?.reply || res.data?.text || "";
      const cards = (res.data?.cards || []).filter(Boolean);
      await pushWithFollowups(md, cards, content);
    } catch {
      await pushWithFollowups("Error or connection failed.", [], content, {suppressSources:true});
    }
  };

  /* ---------------------- Image uploader — FIXED index handling ---------------------- */
  const sendImageForAnalysis = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      await pushWithFollowups("Please pick an image file (JPG/PNG/WEBP).", [], "not image", { suppressSources: true });
      return;
    }

    // local preview URL
    let localUrl = "";
    try { localUrl = URL.createObjectURL(file); } catch {}

    // Insert temp message and capture its true index using functional setState
    const tempMsg = {
      role: "assistant",
      content: "Analyzing your image...",
      cards: localUrl ? [{ type: "gallery", images: [localUrl] }] : [],
      meta: { suppressSources: true, localPreview: true }
    };
    setMessages((prev) => {
      const next = [...prev, tempMsg];
      tempImageMsgIndexRef.current = next.length - 1;
      return next;
    });

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("prompt", input || "Analyze this image and explain key details.");
      form.append("agent", String(agentOn));
      form.append("web", String(webSearchOn));
      form.append("persona", persona);

      const r = await axios.post(`${API_BASE}/analyze-image`, form, { headers: { "Content-Type": "multipart/form-data" } });

      const md = r.data?.ai_description || r.data?.summary || r.data?.reply || "Image analyzed.";
      const cards = Array.isArray(r.data?.cards) ? r.data.cards.filter(Boolean) : [];
      const backendHasImage = cards.some((c) =>
        c?.type === "gallery" || c?.type === "image" || Boolean(firstImageUrl(c))
      );
      const finalCards = backendHasImage ? cards : [{ type: "gallery", images: [localUrl] }, ...cards];

      // Replace temp message safely at captured index
      setMessages((prev) => {
        const copy = [...prev];
        const idx = tempImageMsgIndexRef.current;
        if (idx >= 0 && idx < copy.length) {
          copy[idx] = { role: "assistant", content: md, cards: finalCards, meta: { fromImage: true } };
        } else {
          // fallback: append
          copy.push({ role: "assistant", content: md, cards: finalCards, meta: { fromImage: true } });
        }
        return copy;
      });
      setInput("");
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        const idx = tempImageMsgIndexRef.current;
        if (idx >= 0 && idx < copy.length) {
          copy[idx] = { ...copy[idx], content: "Image analysis failed. Please try again." };
        }
        return copy;
      });
    } finally {
      if (localUrl) setTimeout(() => URL.revokeObjectURL(localUrl), 60000);
      tempImageMsgIndexRef.current = -1;
    }
  };

  /* ---------------------- organized render helpers ---------------------- */
  const extractTitle = (md="") => {
    const h1 = md.match(/^\s*#\s+(.+)/m); if (h1) return h1[1].trim();
    const firstLine = md.split("\n").find(x => x.trim()); if (!firstLine) return "Answer";
    const s = firstLine.replace(/[*_#>]+/g,"").trim();
    const end = s.indexOf(". ") >= 0 ? s.indexOf(". ") + 1 : Math.min(90, s.length);
    return s.slice(0,end).trim();
  };
  const extractSummary = (md="") => {
    const lines = md.split("\n").map(l=>l.trim()).filter(Boolean);
    const bullets = lines.filter(l => /^[-*•]\s+/.test(l)).slice(0,3).map(l => l.replace(/^[-*•]\s+/, ""));
    if (bullets.length>=2) return bullets;
    const para = lines.find(l => /^[A-Za-z0-9]/.test(l)); if (!para) return [];
    return para.split(/(?<=[.!?])\s+/).slice(0,3);
  };
  const extractSteps = (md="") => {
    const blocks = md.split("\n");
    const numbered = blocks.filter(l => /^\d+\.\s+/.test(l)).slice(0,10).map(l => l.replace(/^\d+\.\s+/,""));
    if (numbered.length) return numbered;
    const dots = blocks.filter(l => /^[-*•]\s+/.test(l)).slice(0,6).map(l => l.replace(/^[-*•]\s+/, ""));
    return dots;
  };

  const OrganizedAnswer = ({ md }) => {
    const title = extractTitle(md);
    const summary = extractSummary(md);
    const steps = extractSteps(md);
    return (
      <>
        <div className="org-title">{title}</div>
        {summary.length>0 && (<div className="org-section"><div className="org-sub">Summary</div><ul className="org-list">{summary.map((s,i)=><li key={i}>{s}</li>)}</ul></div>)}
        {steps.length>0 && (<div className="org-section"><div className="org-sub">Step-by-step</div><ol className="org-steps">{steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div>)}
        <div className="org-section">
          <div className="org-sub">Full answer</div>
          <div className="answer expanded">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
              components={{
                img: (props) => {
                  const src = props.src || "";
                  return (
                    <img {...props} src={src} className="rounded-lg my-2 w-full glass" loading="lazy" referrerPolicy="no-referrer"
                      onError={(e)=>{ const el=e.currentTarget; const step=el.dataset.step||"orig";
                        if(step==="orig"){ el.dataset.step="proxy"; el.src = toProxy(src); return; }
                        if(step==="proxy"){ el.dataset.step="fallback"; el.src = unsplash("image"); return; }
                        el.style.display="none"; }} />
                  );
                },
                iframe: (p) => <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass"><iframe {...p} allowFullScreen /></div>,
                a: ({node, ...p}) => <a {...p} className="underline decoration-gray-600 hover:text-gray-200" target="_blank" rel="noreferrer" />,
                code: ({node, inline, className, children, ...p}) => inline
                  ? <code className={className} {...p}>{children}</code>
                  : <pre className={className} style={{ position:"relative" }}>
                      <button className="code-copy-btn" onClick={() => navigator.clipboard.writeText(String(children || ""))} title="Copy code">Copy</button>
                      <code {...p}>{children}</code>
                    </pre>,
              }}
            >
              {md}
            </ReactMarkdown>
          </div>
        </div>
      </>
    );
  };

  /* ---------------------- Media block (images, youtube, weather) ---------------------- */
  function MediaBlock({ cards = [] }) {
    if (!cards || cards.length === 0) return null;

    return (
      <div className="grid grid-cols-1 gap-8 mt-3">
        {cards.map((card, i) => {
          // Images grid
          if (card?.type === "images-grid" && Array.isArray(card.images)) {
            const items = card.images.slice(0, 12);
            return (
              <div key={`img-grid-${i}`} className="grid grid-cols-2 gap-2">
                {items.map((it, j) => {
                  const u = typeof it === "string" ? it : (it?.url || "");
                  if (!u) return null;
                  return (
                    <a key={`img-${i}-${j}`} href={u} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={u}
                        alt=""
                        className="w-full rounded-lg glass"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    </a>
                  );
                })}
              </div>
            );
          }

          // Gallery
          if (card?.type === "gallery" && Array.isArray(card.images)) {
            const urls = card.images
              .map((it) => (typeof it === "string" ? it : (it?.url || it?.thumbnail || it?.thumb)))
              .filter(Boolean)
              .slice(0, 12);
            return (
              <div key={`gallery-${i}`} className="grid grid-cols-2 gap-2">
                {urls.map((u, j) => (
                  <img
                    key={`gal-${i}-${j}`}
                    src={u}
                    alt=""
                    className="w-full rounded-lg glass"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            );
          }

          // Single image
          if (card?.type === "image" && card.url) {
            return (
              <img
                key={`image-${i}`}
                src={card.url}
                alt=""
                className="w-full rounded-lg glass"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            );
          }

          // Weather
          if (card?.type === "weather") {
            return <WeatherCard key={`wx-${i}`} card={card} />;
          }

          // YouTube
          if (card?.type === "youtube" || (card?.url && isYouTube(card.url))) {
            const id = youTubeIdFromUrl(card.url || "");
            if (!id) return null;
            return (
              <div key={`yt-${i}`} className="embed-responsive embed-16by9 rounded overflow-hidden glass" style={{ maxHeight: 280 }}>
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
  }

  /* ---------------------- + menu helpers ---------------------- */
  const clearAll = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MEM_KEY);
  };
  const newChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setInput("");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  };

  const [menuOpen, setMenuOpen] = useState(false);

  /* ---------------------- render ---------------------- */
  return (
    <div className="flex flex-col min-h-[100svh]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2 flex-wrap relative">
          <div className="brand text-lg font-bold">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
              className="pill-btn"
              title="Toggle theme"
            >
              {theme === "dark" ? <FiMoon /> : <FiSun />}
              <span style={{ marginLeft: 6 }}>{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
            <button onClick={() => setMenuOpen(v => !v)} className="pill-btn" title="Tools">
              <FiPlus />
            </button>
          </div>
        </div>
      </header>

      {/* Tools menu outside header to avoid tag mismatch */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 999, background: "transparent" }} />
          <div style={{ position: "fixed", right: 8, top: 56, zIndex: 1000 }}>
            <ToolsMenu
              onSendImageFile={(f) => sendImageForAnalysis(f)}
              onSendAnyFile={(f) => { /* optional */ }}
              onToggleAgent={() => setAgentOn(v => {
                const nv = !v;
                setMessages(p => [...p, { role: "assistant", content: `Agent mode ${nv ? "enabled" : "disabled"}.`, meta: { suppressSources: true } }]);
                return nv;
              })}
              agentOn={agentOn}
              onDeepResearch={() => {
                const q = (input || "").trim(); if (!q) return;
                setMessages(p => [...p, { role: "assistant", content: "Researching…", meta: { suppressSources: true } }]);
                axios.post(`${API_BASE}/deepsearch`, { q, agent: agentOn })
                  .then(r => setMessages(p => {
                    const copy = [...p];
                    copy[copy.length - 1] = { role: "assistant", content: r.data?.answer || `Deep research on **${q}**`, cards: (r.data?.cards || []) };
                    return copy;
                  }))
                  .catch(() => setMessages(p => {
                    const copy = [...p];
                    copy[copy.length - 1] = { role: "assistant", content: "Deep research failed.", meta: { suppressSources: true } };
                    return copy;
                  }));
              }}
              onSetPersona={(p) => { setPersona(p); setMessages(m => [...m, { role: "assistant", content: `Persona set to **${p}**.`, meta: { suppressSources: true } }]); }}
              onCreateImage={() => handleSend(`create image: ${input || "cinematic portrait"}`)}
              webSearchOn={webSearchOn}
              onToggleWebSearch={() => { setWebSearchOn(v => {
                const nv = !v;
                setMessages(m => [...m, { role: "assistant", content: `Web search ${nv ? "enabled" : "disabled"}.`, meta: { suppressSources: true } }]);
                return nv;
              }); }}
              onClearAll={clearAll}
              onNewChat={newChat}
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </>
      )}

      {/* chat scroll area */}
      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-4xl mx-auto w-full px-3 pb-32 pt-3">
          <div className="space-y-4">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const mediaCards = (msg.cards || []).filter(c =>
                ["youtube", "image", "images", "gallery", "images-grid", "weather"].includes(c.type) ||
                (c?.url && isYouTube(c.url))
              );
              return (
                <div key={i} className={`msg ${isUser ? "glass-2" : "glass"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="small-label">{isUser ? "You" : "Droxion"}</div>
                    {!isUser && msg.content && (
                      <button onClick={() => copyMessage(i)} className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1" title="Copy">
                        <FaRegCopy /> Copy
                      </button>
                    )}
                  </div>
                  {isUser && <div className="answer expanded">{msg.content}</div>}
                  {!isUser && msg.content && <OrganizedAnswer md={msg.content} />}
                  {!isUser && mediaCards.length > 0 && <MediaBlock cards={mediaCards} />}
                  {!isUser && Array.isArray(msg.followups) && msg.followups.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-8">
                      {msg.followups.slice(0, 3).map((s, idx) => (
                        <button key={idx} onClick={() => handleSend(s)} className="action-btn">{s}</button>
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

      {/* Fixed preview while typing */}
      {focused && (
        <div className={`fixed-preview fixed-panel ${input.length ? "dim-while-typing" : ""}`}>
          <div className="max-w-4xl mx-auto px-3">
            <div className="panel glass rounded-xl p-2 suggestions-panel">
              <div className="mb-2">
                <div className="px-1 text-xs text-gray-400 mb-1">Recent Headlines</div>
                <div className="hscroll pb-1 -mx-2 pl-2 pr-4">
                  <div className="flex gap-2">
                    {(news.length ? news : Array.from({ length: 3 })).map((c, i) =>
                      c ? (
                        <a key={i} href={c.url} target="_blank" rel="noreferrer" className="hitem pr-3">
                          <div className="rounded-xl overflow-hidden glass">
                            {(() => {
                              const pv = bestPreview(c, true);
                              return pv ? (
                                <img src={pv.prox} alt="" className="w-full aspect-[16/9] object-cover" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              ) : (
                                <div className="aspect-[16/9] skel" />
                              );
                            })()}
                            <div className="p-3">
                              <div className="text-[11px] text-gray-400 mb-1">{displaySource(c)}</div>
                              <div className="text-sm font-semibold line-clamp-2 leading-tight">{c.title}</div>
                              <div className="text:[11px] text-gray-500 mt-1">{timeAgo(c.publishedAt || c.time)}</div>
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
                <div>{weather ? (<WeatherCard card={weather} />) : (<div className="glass rounded-lg p-6 skel" />)}</div>
                <div className="grid grid-cols-1 gap-2">
                  {(crypto.length ? crypto.slice(0, 2) : [null, null]).map((c, i) =>
                    c ? (
                      <a key={i} href={c.url} target="_blank" rel="noreferrer" className="glass rounded-lg p-3 block">
                        <div className="text-sm font-semibold">{c.title || c.symbol || "Crypto"}</div>
                        <div className="text-xs text-gray-400">{c.meta || c.source || (c.url ? host(c.url) : "")}</div>
                        {c.price && <div className="text-base mt-1">{c.price}</div>}
                        {typeof c.change !== "undefined" && (
                          <div className={`text-xs mt-1 ${String(c.change).startsWith("-") ? "text-red-400" : "text-green-400"}`}>
                            {c.change}
                          </div>
                        )}
                      </a>
                    ) : (
                      <div key={i} className="glass rounded-lg p-6 skel" />
                    )
                  )}
                </div>
              </div>

              {textSug.length > 0 && (
                <div className="mt-1">
                  <div className="px-1 text-xs text-gray-400 mb-1">Suggestions</div>
                  {textSug.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="w-full text-left text-sm border border-white/10 rounded-md px-3 py-2 hover:bg-white/10 transition mb-2 last:mb-0"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composer — clean (no image button in middle) */}
      <div className="fixed-bottom z-50 border-t border-white/10 bg-black/80 backdrop-blur" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2 focus-within:border-white/25 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                rows={1}
                inputMode="text"
                placeholder=""
                className="w-full bg-transparent outline-none resize-none leading-[1.6]"
                style={{ height: 44, maxHeight: 44, overflowY: "auto" }}
                aria-label="Type your message"
              />
            </div>
            <button onClick={() => handleSend(input)} className="shrink-0 h-10 px-4 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 active:scale-[0.99] transition" title="Send">
              <FiArrowRight />
            </button>
          </div>

          <div className="flex gap-2 flex-wrap mt-2">
            {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((s) => (
              <button key={s} onClick={() => handleSend(`steps to do ${s.toLowerCase()} project`)} className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
/* END render */

export default AIChat;