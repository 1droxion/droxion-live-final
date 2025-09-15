// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";
import "./AIChat.css";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const normHost = (u = "") => {
  try { return new URL(u).hostname.toLowerCase().replace(/^www\./,"").replace(/^m\./,""); }
  catch { return ""; }
};
const host = (u) => normHost(u);

// allow google/wiki/etc; keep only placeholders blocked
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

// tolerant to “wether / wheather / whether”
const wantsWeather = (s = "") => {
  const q = s.trim().toLowerCase();
  if (/\b(weather|temp|temperature|forecast|rain|humidity|wind)\b/.test(q)) return true;
  if (/\bwether\b/.test(q)) return true;
  if (/\bwheather\b/.test(q)) return true;
  if (/^(whether|wether)$/i.test(q)) return true;
  return false;
};

const wantsCrypto  = (s="") => /\b(crypto|bitcoin|btc|ethereum|eth|price|chart)\b/i.test(s);

// gate for showing “Sources”
const isSearchy = (s="") => {
  const q = s.toLowerCase();
  return (
    q.startsWith("google:") || q.startsWith("search:") ||
    /\b(now|today|latest|breaking|live|update|news)\b/.test(q) ||
    /\b(price|stock|chart|net worth|time|weather|forecast|crypto|btc|eth)\b/.test(q) ||
    wantsNews(q) || wantsWeather(q) || wantsCrypto(q)
  );
};

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
  // News / Biz
  "forbes.com","bloomberg.com","reuters.com","cnbc.com","apnews.com","ft.com","wsj.com","nytimes.com",
  "theguardian.com","bbc.com","bbc.co.uk","npr.org","hindustantimes.com","livemint.com","moneycontrol.com","economictimes.com",
  // Crypto
  "coindesk.com","cointelegraph.com","coinmarketcap.com","coingecko.com","messari.io","defillama.com",
  // Finance trackers
  "finance.yahoo.com","google.com","tradingview.com","marketwatch.com","morningstar.com","nasdaq.com","seekingalpha.com","sec.gov",
  // Weather / Time
  "weather.com","accuweather.com","time.is","timeanddate.com",
  // Tech / Knowledge
  "techcrunch.com","theverge.com","wired.com","arstechnica.com","wikipedia.org","medium.com"
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

/* ---------- WEATHER HELPERS & CARD ---------- */
const n = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
const pick = (obj, keys, d=null) => {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") return obj[k];
  return d;
};
const fmtTemp = (c, f) => {
  if (n(c)!=null && n(f)!=null) return `${Math.round(c)}°C / ${Math.round(f)}°F`;
  if (n(c)!=null) return `${Math.round(c)}°C`;
  if (n(f)!=null) return `${Math.round(f)}°F`;
  return "";
};
const fmtSpeed = (kph, mph) => {
  if (n(kph)!=null && n(mph)!=null) return `${Math.round(kph)} km/h • ${Math.round(mph)} mph`;
  if (n(kph)!=null) return `${Math.round(kph)} km/h`;
  if (n(mph)!=null) return `${Math.round(mph)} mph`;
  return "";
};
const hourLabel = (ts) => {
  try {
    const d = new Date(ts);
    let h = d.getHours();
    const am = h < 12;
    h = h % 12 || 12;
    return `${h}${am ? "am" : "pm"}`;
  } catch { return ""; }
};

const normalizeWeatherCard = (raw) => {
  if (!raw) return null;
  const title = pick(raw, ["title","location","name"], "Weather");
  const subtitle = pick(raw, ["subtitle","meta","condition","text","desc"], "");
  const icon = pick(raw, ["icon","icon_url","image"]);
  const temp_c = pick(raw, ["temp_c","tempC","temperature_c","temperatureC","temp"]);
  const temp_f = pick(raw, ["temp_f","tempF","temperature_f","temperatureF"]);
  const feels_c = pick(raw, ["feels_like_c","feels_c","feelsLike_c","feelsLikeC","feels_like"]);
  const feels_f = pick(raw, ["feels_like_f","feels_f","feelsLike_f","feelsLikeF"]);
  const humidity = pick(raw, ["humidity","humid","rh"]);
  const wind_kph = pick(raw, ["wind_kph","windKph","wind_km_h"]);
  const wind_mph = pick(raw, ["wind_mph","windMph"]);
  const precip = pick(raw, ["precip_mm","precip","rain_mm","rainChance","rain_chance"]);
  const hourly = Array.isArray(raw.hourly) ? raw.hourly : (Array.isArray(raw.hours) ? raw.hours : []);
  const daily = Array.isArray(raw.daily) ? raw.daily : (Array.isArray(raw.days) ? raw.days : []);
  const loc = pick(raw, ["loc","place","city"]);
  const when = pick(raw, ["when","time","as_of","updated"]);

  return {
    type: "weather",
    title: loc ? `${title} — ${loc}` : title,
    subtitle: subtitle || (when ? `As of ${new Date(when).toLocaleTimeString()}` : ""),
    icon, temp_c, temp_f, feels_c, feels_f, humidity, wind_kph, wind_mph, precip, hourly, daily
  };
};

/* ---------------------- ORGANIZER ---------------------- */
/** Turn raw markdown into: Title → Summary → Steps → Chart → Full Answer */
const extractTitle = (md="") => {
  const h1 = md.match(/^\s*#\s+(.+)/m);
  if (h1) return h1[1].trim();
  const firstLine = md.split("\n").find(x => x.trim());
  if (!firstLine) return "Answer";
  // bold first sentence
  const s = firstLine.replace(/[*_#>]+/g,"").trim();
  const end = s.indexOf(". ") >= 0 ? s.indexOf(". ") + 1 : Math.min(90, s.length);
  return s.slice(0,end).trim();
};

const extractSummary = (md="") => {
  const lines = md.split("\n").map(l=>l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[-*•]\s+/.test(l)).slice(0,4).map(l => l.replace(/^[-*•]\s+/, ""));
  if (bullets.length >= 2) return bullets.slice(0,3);
  const para = lines.find(l => /^[A-Za-z0-9]/.test(l));
  if (!para) return [];
  const sents = para.split(/(?<=[.!?])\s+/).slice(0,3);
  return sents;
};

const extractSteps = (md="") => {
  const blocks = md.split("\n");
  const numbered = blocks.filter(l => /^\d+\.\s+/.test(l)).slice(0,12).map(l => l.replace(/^\d+\.\s+/,""));
  if (numbered.length) return numbered;
  const dots = blocks.filter(l => /^[-*•]\s+/.test(l)).slice(0,8).map(l => l.replace(/^[-*•]\s+/, ""));
  return dots;
};

const parsePairs = (md="") => {
  // lines like "Label: 12" => for a simple bar chart
  const out = [];
  md.split("\n").forEach(l => {
    const m = l.match(/^\s*[-*]?\s*([^:]{2,40})\s*:\s*(-?\d+(\.\d+)?)/);
    if (m) out.push({ label: m[1].trim(), value: parseFloat(m[2]) });
  });
  return out.slice(0,8);
};

/* ---------- Weather card ---------- */
const WeatherCard = ({ card }) => {
  if (!card) return null;
  const T = (() => {
    const c = card.temp_c, f = card.temp_f;
    if (typeof c==="number" && typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`;
    if (typeof c==="number") return `${Math.round(c)}°C`;
    if (typeof f==="number") return `${Math.round(f)}°F`;
    return "";
  })();
  const FEELS = (() => {
    const c = card.feels_c, f = card.feels_f;
    if (typeof c==="number" && typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`;
    if (typeof c==="number") return `${Math.round(c)}°C`;
    if (typeof f==="number") return `${Math.round(f)}°F`;
    return "";
  })();
  const WIND = (() => {
    const k = card.wind_kph, m = card.wind_mph;
    if (typeof k==="number" && typeof m==="number") return `${Math.round(k)} km/h • ${Math.round(m)} mph`;
    if (typeof k==="number") return `${Math.round(k)} km/h`;
    if (typeof m==="number") return `${Math.round(m)} mph`;
    return "";
  })();
  const RH = (typeof card.humidity==="number") ? `${Math.round(card.humidity)}%` : "";
  const RAIN = (card.precip!=null && card.precip!=="") ? `${card.precip}${typeof card.precip==="number" ? " mm" : ""}` : "";

  const hrs = (card.hourly || []).slice(0, 8).map(h => ({
    t: pick(h, ["time","ts","timestamp","date"]),
    icon: pick(h, ["icon","icon_url","image"]),
    c: pick(h, ["temp_c","tempC","temperature_c","temperatureC","temp"]),
    f: pick(h, ["temp_f","tempF","temperature_f","temperatureF"]),
    text: pick(h, ["text","condition","desc"])
  }));
  const days = (card.daily || []).slice(0, 3).map(d => ({
    day: pick(d, ["day","name","weekday","label"]),
    icon: pick(d, ["icon","icon_url","image"]),
    min_c: pick(d, ["min_c","minC","low_c","lowC","min"]),
    min_f: pick(d, ["min_f","minF","low_f","lowF"]),
    max_c: pick(d, ["max_c","maxC","high_c","highC","max"]),
    max_f: pick(d, ["max_f","maxF","high_f","highF"]),
    text: pick(d, ["text","condition","desc"])
  }));

  const hourLabel = (ts) => {
    try {
      const d = new Date(ts);
      let h = d.getHours();
      const am = h < 12;
      h = h % 12 || 12;
      return `${h}${am ? "am" : "pm"}`;
    } catch { return ""; }
  };

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
          {T && <div className="wstat"><div className="wlabel">Temperature</div><div className="wval">{T}</div></div>}
          {FEELS && <div className="wstat"><div className="wlabel">Feels like</div><div className="wval">{FEELS}</div></div>}
          {RH && <div className="wstat"><div className="wlabel">Humidity</div><div className="wval">{RH}</div></div>}
          {WIND && <div className="wstat"><div className="wlabel">Wind</div><div className="wval">{WIND}</div></div>}
          {RAIN && <div className="wstat"><div className="wlabel">Precip</div><div className="wval">{RAIN}</div></div>}
        </div>
      )}

      {hrs.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Next hours</div>
          <div className="w-hscroll flex gap-8 overflow-x-auto -mx-1 px-1 pb-1">
            {hrs.map((h, i) => (
              <div key={i} className="w-hour glass rounded-lg p-2 min-w-[86px] text-center">
                <div className="text-[11px] text-gray-400">{h.t ? hourLabel(h.t) : (h.text || "").split(" ")[0]}</div>
                {h.icon && <img src={h.icon} alt="" className="mx-auto my-1 h-8 w-8 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="text-sm font-semibold">{(() => {
                  const c=h.c, f=h.f;
                  if (typeof c==="number" && typeof f==="number") return `${Math.round(c)}°C / ${Math.round(f)}°F`;
                  if (typeof c==="number") return `${Math.round(c)}°C`;
                  if (typeof f==="number") return `${Math.round(f)}°F`;
                  return "-";
                })()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {days.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-400 mb-1">Next days</div>
          <div className="grid grid-cols-3 gap-2">
            {days.map((d, i) => (
              <div key={i} className="glass rounded-lg p-2 text-center">
                <div className="text-[11px] text-gray-400 truncate">{d.day || `Day ${i+1}`}</div>
                {d.icon && <img src={d.icon} alt="" className="mx-auto my-1 h-8 w-8 object-contain" loading="lazy" referrerPolicy="no-referrer" />}
                <div className="text-xs font-semibold">{(() => {
                  const c=d.max_c, f=d.max_f;
                  const labelHi = (typeof c==="number" && typeof f==="number") ? `${Math.round(c)}°C / ${Math.round(f)}°F` : (typeof c==="number" ? `${Math.round(c)}°C` : (typeof f==="number" ? `${Math.round(f)}°F` : ""));
                  const lc=d.min_c, lf=d.min_f;
                  const labelLo = (typeof lc==="number" && typeof lf==="number") ? `${Math.round(lc)}°C / ${Math.round(lf)}°F` : (typeof lc==="number" ? `${Math.round(lc)}°C` : (typeof lf==="number" ? `${Math.round(lf)}°F` : ""));
                  return `${labelHi} / ${labelLo}`;
                })()}</div>
                {d.text && <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{d.text}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------- component ---------------------- */

// local memory (device)
const STORAGE_KEY = "droxion.chat.v1";
const MEM_KEY = "droxion.mem.v1";
const loadMem = () => { try { return JSON.parse(localStorage.getItem(MEM_KEY) || "[]"); } catch { return []; } };
const saveMem = (arr) => { try { localStorage.setItem(MEM_KEY, JSON.stringify(arr.slice(-100))); } catch {} };

// ensure we always have some media (images) for bland answers
const ensureImagesFor = async (query) => {
  try {
    const r = await axios.post(`${API_BASE}/realtime`, { query, intent: "images" });
    const cards = Array.isArray(r.data?.cards) ? r.data.cards.filter(Boolean) : [];
    const grid = cards.find(c => c.type === "images-grid" && Array.isArray(c.images));
    if (grid) return [grid];
    const imgs = cards.flatMap(c => Array.isArray(c.images) ? c.images : (c.image ? [c.image] : []));
    if (imgs.length) return [{ type: "gallery", images: imgs.slice(0,12) }];
  } catch {}
  return [];
};

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

  const inputRef = useRef(null);
  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });
  const scrollRef = useRef(null);

  // restore chat from local storage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) setMessages(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  /* keyboard-safe */
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
        const w = wcards.find((c)=>c.type==="weather") || wcards[0] || null;
        setWeather(w ? normalizeWeatherCard(w) : null);

        setCrypto((rc?.data?.cards || []).filter(Boolean).slice(0,6));
      } catch { /* silent */ }
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
    setMessages((p) => [...p, { role: "user", content }]);
    setInput("");
    setTextSug([]);

    try {
      // memory commands
      if (/^remember\s*:/i.test(content)) {
        const fact = content.replace(/^remember\s*:/i,"").trim();
        if (fact) {
          const mem = loadMem(); mem.push({ fact, t: Date.now() }); saveMem(mem);
          await pushWithFollowups(`✅ Remembered: **${fact}**`, [], content);
        } else {
          await pushWithFollowups("What should I remember? Use `remember: your fact`.", [], content);
        }
        return;
      }
      if (/^what did you remember|^show memory/i.test(content)) {
        const mem = loadMem();
        const md = mem.length
          ? `### Memory\n${mem.map(m => `- ${m.fact}`).join("\n")}`
          : "I haven't saved any memory yet. Use `remember: <fact>`.";
        await pushWithFollowups(md, [], content);
        return;
      }

      if (isGreeting(content)) {
        const r = await axios.post(`${API_BASE}/chat`, { prompt: content, memory: loadMem().slice(-5).map(m=>m.fact) });
        await pushWithFollowups(r.data?.reply || r.data?.text || "👋", [], content);
        return;
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
        return;
      }

      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: q });
          let cards = rankAndTrim((r.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image })), 12, true);
          const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;

          // ensure media
          const hasMedia = cards.some(c => ["images-grid","gallery","youtube","weather"].includes(c.type) || isYouTube(c.url || ""));
          if (!hasMedia) cards = cards.concat(await ensureImagesFor(q));

          await pushWithFollowups(md, cards, content);
        } catch { await pushWithFollowups("Preview is unavailable right now.", [], content); }
        return;
      }

      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/search`, { prompt: q });
          let cards = rankAndTrim(
            (r.data?.results || []).filter(Boolean).map(it => ({ type:"web", title: it.title, url: it.url, image: it.image || null, source: it.source, snippet: it.snippet })), 12, true
          );
          // ensure media
          const hasMedia = cards.some(c => ["images-grid","gallery","youtube","weather"].includes(c.type) || isYouTube(c.url || ""));
          if (!hasMedia) cards = cards.concat(await ensureImagesFor(q));

          await pushWithFollowups(cards.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, cards, content);
        } catch { await pushWithFollowups("Search is unavailable right now.", [], content); }
        return;
      }

      if (wantsNews(content)) {
        let r = null, cards = [];
        try {
          r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "news" });
          cards = rankAndTrim((r.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image, type: c.type || "news" })), 12, true)
            .filter(c => !!bestPreview(c, true));
        } catch {}
        if (!cards.length && news.length) cards = news.slice(0,10);
        // ensure media
        const hasMedia = cards.some(c => ["images-grid","gallery","youtube","weather"].includes(c.type) || isYouTube(c.url || ""));
        if (!hasMedia) cards = cards.concat(await ensureImagesFor(content));
        await pushWithFollowups((r?.data?.markdown || "Top news:"), cards, content);
        return;
      }

      if (wantsWeather(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "weather" });
        const rawCards = (r.data?.cards || []).filter(Boolean);
        const normalized = rawCards
          .map(c => (c.type==="weather" ? c : { ...c, type:"weather" }))
          .map(normalizeWeatherCard)
          .filter(Boolean);
        const cards = normalized.length ? normalized : rawCards;
        await pushWithFollowups(r.data?.markdown || "Weather:", cards, content);
        return;
      }

      if (wantsCrypto(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "crypto" });
        let cards = (r.data?.cards || []).filter(Boolean);
        // ensure media
        const hasMedia = cards.some(c => ["images-grid","gallery","youtube","weather"].includes(c.type) || isYouTube(c.url || ""));
        if (!hasMedia) cards = cards.concat(await ensureImagesFor(content));
        await pushWithFollowups(r.data?.markdown || "Crypto:", cards, content);
        return;
      }

      // default chat
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content, memory: loadMem().slice(-5).map(m=>m.fact) });
      const md = res.data?.reply || res.data?.text || "";
      let cards = rankAndTrim((res.data?.cards || []).filter(Boolean).map(c => ({ ...c, image: firstImageUrl(c) || c.image })), 12, true);
      // ensure media
      const hasMedia = cards.some(c => ["images-grid","gallery","youtube","weather"].includes(c.type) || isYouTube(c.url || ""));
      if (!hasMedia) cards = cards.concat(await ensureImagesFor(content));
      await pushWithFollowups(md, cards, content);
    } catch {
      await pushWithFollowups("⚠️ Error or connection failed.", [], content);
    }
  };

  /* ---------------------- render helpers ---------------------- */
  const SmartImage = ({ url, title }) => {
    if (!url) return null;
    const elRef = useRef(null);
    const proxyFirst = (() => {
      try {
        const h = new URL(url).hostname;
        return /(^|\.)(images\.unsplash\.com|source\.unsplash\.com|lexica\.art|cdn\.stability\.ai)$/i.test(h);
      } catch { return false; }
    })();

    useEffect(() => {
      const el = elRef.current; if (!el) return;
      el.dataset.step = proxyFirst ? "proxy" : "orig";
      el.src = proxyFirst ? toProxy(url) : url;
    }, [url]);

    const onErr = (e) => {
      const el = e.currentTarget;
      const step = el.dataset.step || "orig";
      if (step === "orig")   { el.dataset.step = "proxy";    el.src = toProxy(url); return; }
      if (step === "proxy")  { el.dataset.step = "fallback"; el.src = unsplash(title || "image") || ""; return; }
      el.style.display = "none";
    };
    return (
      <img
        ref={elRef}
        alt=""
        className="w-full rounded-lg glass"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onErr}
        onLoad={(e)=>{ e.currentTarget.style.opacity = 1; }}
        style={{ opacity: 0, transition: "opacity .2s ease" }}
      />
    );
  };

  const LinkPreview = ({ card }) => {
    const [img, setImg] = useState(null);
    const [tried, setTried] = useState(false);
    const pv = bestPreview(card, true);

    useEffect(() => {
      let mounted = true;
      const need = !firstImageUrl(card) && !pv;
      const run = async () => {
        if (!need || tried || !card?.url) return;
        setTried(true);
        try {
          const { data } = await axios.get(`${API_BASE}/preview`, { params: { url: card.url } });
          if (mounted && data?.image) setImg(data.image);
        } catch {}
      };
      run();
      return () => { mounted = false; };
    }, [card?.url]); // eslint-disable-line react-hooks/exhaustive-deps

    if (firstImageUrl(card)) return <SmartImage url={firstImageUrl(card)} title={card.title} />;
    if (pv?.prox) return <SmartImage url={pv.prox} title={card.title} />;
    if (img) return <SmartImage url={img} title={card.title} />;

    const fav = faviconFor(card.url);
    return (
      <a href={card.url} target="_blank" rel="noreferrer" className="favicon-only hover:bg-white/10 transition">
        {fav && <img src={fav} alt="" width={16} height={16} style={{ borderRadius: 4 }} />}
        <div className="min-w-0">
          <div className="src-title truncate">{card.title || displaySource(card)}</div>
          <div className="src-sub truncate">{displaySource(card)}</div>
        </div>
      </a>
    );
  };

  const MediaBlock = ({ cards = [] }) => {
    if (!cards.length) return null;
    return (
      <div className="grid grid-cols-1 gap-8 mt-3">
        {cards.map((card, i) => {
          if (card.type === "images-grid" && Array.isArray(card.images)) {
            const items = card.images.slice(0, 12);
            return (
              <div key={i} className="grid grid-cols-2 gap-2">
                {items.map((it, j) => {
                  const u = typeof it === "string" ? it : (it.url || "");
                  const href = typeof it === "object" ? (it.pageUrl || it.url || "#") : u;
                  return (
                    <a key={j} href={href} target="_blank" rel="noreferrer" className="block">
                      <SmartImage url={u} title={it.title || "image"} />
                      {it.source && <div className="mt-1 text-[10px] text-gray-400">{it.source}</div>}
                    </a>
                  );
                })}
              </div>
            );
          }

          if (card.type === "weather") {
            return <WeatherCard key={i} card={normalizeWeatherCard(card)} />;
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

  const buildLinkSets = (cards = [], searchy = false) => {
    const links = (cards || []).filter(c =>
      ["web","link","wiki","news","stock","crypto"].includes(c.type) &&
      c.url && !isFilteredSource(c.url)
    );
    const sorted = dedupeCards(links).sort((a,b) => scoreCard(b) - scoreCard(a));
    const byHost = {};
    for (const c of sorted) { const h = host(c.url); if (!byHost[h]) byHost[h] = c; }

    const pref = ["forbes.com","bloomberg.com","reuters.com","cnbc.com","finance.yahoo.com","coinmarketcap.com","coingecko.com"];
    if (searchy) pref.push("google.com","wikipedia.org","youtube.com","youtu.be");

    const quickActions = [];
    for (const ph of pref) {
      const k = Object.keys(byHost).find(h => h===ph || h.endsWith("."+ph));
      if (k) quickActions.push(byHost[k]);
    }

    const grid = Object.values(byHost)
      .filter(c => !/^(google\.com|wikipedia\.org)$/.test(host(c.url)) || searchy)
      .sort((a,b)=> scoreCard(b)-scoreCard(a))
      .slice(0,6);

    return { quickActions, grid };
  };

  /* ---------------------- UI: organized answer ---------------------- */
  const OrganizedAnswer = ({ md, index }) => {
    const title = extractTitle(md);
    const summary = extractSummary(md);
    const steps = extractSteps(md);
    const pairs = parsePairs(md); // label: number
    return (
      <>
        <div className="org-title">{title}</div>

        {summary.length > 0 && (
          <div className="org-section">
            <div className="org-sub">Summary</div>
            <ul className="org-list">
              {summary.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {steps.length > 0 && (
          <div className="org-section">
            <div className="org-sub">Step-by-step</div>
            <ol className="org-steps">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}

        {pairs.length > 0 && (
          <div className="org-section">
            <div className="org-sub">Quick Chart</div>
            <div className="bars">
              {pairs.map((p, i) => {
                const max = Math.max(...pairs.map(x=>Math.abs(x.value)), 1);
                const w = Math.round(Math.min(100, (Math.abs(p.value)/max)*100));
                return (
                  <div key={i} className="bar-row">
                    <div className="bar-label">{p.label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${w}%` }} />
                    </div>
                    <div className="bar-val">{p.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="org-section">
          <div className="org-sub">Full answer</div>
          <div className="answer expanded">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}
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
              {md}
            </ReactMarkdown>
          </div>
        </div>
      </>
    );
  };

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
              const mediaCards = cards.filter(c => ["youtube","image","gallery","images-grid","weather"].includes(c.type) || isYouTube(c.url || ""));

              const userPrompt = messages[i-1]?.role === "user" ? (messages[i-1]?.content || "") : msg.content || "";
              const showSearchy = isSearchy(userPrompt);
              const isRealtimeCard = (cards||[]).some(c => ["news","crypto","weather","time","wiki"].includes(c.type));

              const hasPreviewable = (cards||[]).some(c => firstImageUrl(c) || (c.url && !isFilteredSource(c.url)));
              const shouldShowSources = (!isUser) && (showSearchy || isRealtimeCard) && hasPreviewable;

              const linkSets = buildLinkSets(cards, shouldShowSources);

              const qp = encodeURIComponent(userPrompt || "");
              const googleUrl = `https://www.google.com/search?q=${qp}`;
              const newsUrl = `https://www.google.com/search?q=${qp ? qp + "+latest+news" : "latest+news"}`;

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

                  {/* User text */}
                  {isUser && <div className="answer expanded">{msg.content}</div>}

                  {/* Assistant: Organized view */}
                  {!isUser && msg.content && (
                    <>
                      <OrganizedAnswer md={msg.content} index={i} />
                      {/* manual toggle if you ever want compact view:
                      <button className="toggle-more underline decoration-gray-600" onClick={()=>setExpandedIdx(expandedIdx===i?null:i)}>
                        {expandedIdx===i ? "Show less" : "Show more"}
                      </button>
                      */}
                    </>
                  )}

                  {/* Media between answer and sources */}
                  {!isUser && <MediaBlock cards={mediaCards} />}

                  {/* Quick actions – base pills + HQ pills (max 2) */}
                  {!isUser && (
                    <div className="actions-row">
                      <a href={googleUrl} target="_blank" rel="noreferrer" className="action-btn hover:bg-white hover:text-black transition">
                          google: {userPrompt || "search"}
                      </a>
                      <a href={newsUrl} target="_blank" rel="noreferrer" className="action-btn hover:bg-white hover:text-black transition">
                          search: {userPrompt ? `${userPrompt} latest news` : "latest news"}
                      </a>
                      {linkSets.quickActions.slice(0,2).map((c,idx)=>(
                        <a key={`qa-${idx}`} href={c.url} target="_blank" rel="noreferrer" className="action-btn hover:bg-white hover:text-black transition">
                          {displaySource(c).replace(/^m\./,"")}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Sources grid – trimmed */}
                  {shouldShowSources && linkSets.grid.length>0 && (
                    <div className="mt-3">
                      <div className="small-label mb-1">Sources</div>
                      <div className="sources-grid">
                        {linkSets.grid.map((c,idx)=> (
                          <div key={idx}>
                            <LinkPreview card={c} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-ups */}
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

      {/* LIVE PREVIEW PANEL */}
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
                <div>
                  {weather ? (
                    <WeatherCard card={weather} />
                  ) : (
                    <div className="glass rounded-lg p-6 skel" />
                  )}
                </div>
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

      {/* Composer */}
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