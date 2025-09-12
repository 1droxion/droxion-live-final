// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const normHost = (u="") => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./,""); } catch { return ""; } };
const host = (u) => { const h = normHost(u); return h.replace(/^m\./,""); };
const BAD_HOSTS = ["google.com","news.google.com","maps.google.com","example.com","example.org","wikipedia.org","m.wikipedia.org","en.wikipedia.org"];
const isBadHost = (h="") => BAD_HOSTS.some(b => h===b || h.endsWith("."+b));
const isFilteredSource = (u="") => { const h = host(u); return !h || isBadHost(h); };

const firstImageUrl = (c) => c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;
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
const wantsImages = (s="") => /\b(image|images|photo|picture|wallpaper)\b/i.test(s);
const wantsNews = (s="") => /\b(news|headlines|latest)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|forecast)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|bitcoin|btc|eth|price|chart)\b/i.test(s);
const wantsYouTube = (s="") => /\b(youtube|video|trailer|shorts|watch)\b/i.test(s);
const wantsAnyPreview = (s="") => wantsNews(s)||wantsWeather(s)||wantsCrypto(s)||wantsImages(s)||wantsYouTube(s);

const GOOD_NEWS = ["reuters.com","theguardian.com","bbc.co.uk","bbc.com","apnews.com","nytimes.com","wsj.com","ft.com","bloomberg.com","economist.com"];
const rankHost = (h) => {
  if (!h) return -50;
  if (isBadHost(h)) return -200;
  if (GOOD_NEWS.some(g => h===g || h.endsWith("."+g))) return 90;
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
    const key = (host(c.url||"")||"") + "::" + (c.title||"").toLowerCase().slice(0,80);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const rankAndTrim = (cards=[], limit=10, allowWikiFallback=false) => {
  let filtered = cards.filter(Boolean).filter(c => !(c?.url && isFilteredSource(c.url)));
  filtered = dedupeCards(filtered).sort((a,b) => scoreCard(b) - scoreCard(a));
  if (!filtered.length && allowWikiFallback) {
    const wiki = (cards||[]).find(c => host(c.url||"").includes("wikipedia.org"));
    if (wiki) filtered = [wiki];
  }
  return filtered.slice(0, limit);
};

const bestPreview = (card, allowFallback=false) => {
  const direct = firstImageUrl(card);
  if (direct) return { prox: prox(direct), orig: direct, title: card.title || card.source || "preview" };
  if (!allowFallback) return null;
  if (card.url && !isFilteredSource(card.url)) {
    const shot = prox(`https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(card.url)}`);
    return { prox: shot, orig: card.url, title: card.title || "preview" };
  }
  const ph = unsplash(card.title || card.source || "news");
  return ph ? { prox: ph, orig: ph, title: card.title || "preview" } : null;
};

const getYouTubeId = (raw) => {
  try {
    const txt = raw.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;
    const hasHttp = /^https?:\/\//i.test(txt);
    const u = new URL(hasHttp ? txt : `https://youtube.com/results?search_query=${encodeURIComponent(txt)}`);
    const h = u.hostname.replace("www.","");
    if (h.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]==="shorts" || p[0]==="embed") return p[1];
    }
    if (h.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0];
  } catch {}
  const m = raw.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

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
  const [composerH, setComposerH] = useState(80); // smaller composer

  /* CSS fix */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name","viewport"); document.head.appendChild(meta); }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");

    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html, body { height: 100%; background:#000; color:#fff; margin:0; padding:0; }
      * { -webkit-tap-highlight-color: transparent; }
      textarea { font-size:15px; line-height:1.4; }
      .glass { background: var(--glass); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .suggestions-panel { max-height: 52vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .hscroll { overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; }
      .hitem { min-width: 80%; max-width: 80%; scroll-snap-align:start; }
      @media (min-width:480px){ .hitem{ min-width: 52%; max-width: 52%; } }
      .tile { position:relative; width:100%; padding-top:66.666%; overflow:hidden; border-radius:12px; }
      .tile > img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* Resize observers */
  useEffect(() => {
    if (panelRef.current) {
      const ro = new ResizeObserver(() => setPanelH(panelRef.current?.offsetHeight || 0));
      ro.observe(panelRef.current); return () => ro.disconnect();
    }
  }, []);
  useEffect(() => {
    if (composerRef.current) {
      const ro = new ResizeObserver(() => setComposerH(composerRef.current?.offsetHeight || 80));
      ro.observe(composerRef.current); return () => ro.disconnect();
    }
  }, []);

  /* Suggestions */
  useEffect(() => {
    const q = input.trim();
    if (!focused || q.length < 1) { setTextSug([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setTextSug((data?.suggestions || []).slice(0, 8));
      } catch { setTextSug([]); }
    }, 140);
    return () => clearTimeout(t);
  }, [input, focused]);

  /* Live previews */
  useEffect(() => {
    const q = input.trim();
    if (!focused || q.length < 1 || !wantsAnyPreview(q)) return;
    setLoadingPanel(true);
    const src = axios.CancelToken.source();
    (async () => {
      try {
        const [rn, rw, rc, ri, ry] = await Promise.all([
          wantsNews(q)    ? axios.post(`${API_BASE}/realtime`, { query: q, intent:"news" }, { cancelToken: src.token }).catch(()=>null):null,
          wantsWeather(q) ? axios.post(`${API_BASE}/realtime`, { query: q, intent:"weather" }, { cancelToken: src.token }).catch(()=>null):null,
          wantsCrypto(q)  ? axios.post(`${API_BASE}/realtime`, { query: q, intent:"crypto" }, { cancelToken: src.token }).catch(()=>null):null,
          wantsImages(q)  ? axios.post(`${API_BASE}/realtime`, { query: q, intent:"images"}, { cancelToken: src.token }).catch(()=>null):null,
          wantsYouTube(q) ? axios.post(`${API_BASE}/search-youtube`, { prompt: q }, { cancelToken: src.token }).catch(()=>null):null,
        ]);
        setNews(rn ? rankAndTrim(rn?.data?.cards || [], 10, true) : []);
        setWeather(rw ? rw?.data?.cards?.[0] : null);
        setCrypto(rc ? (rc?.data?.cards||[]).slice(0,6) : []);
      } finally { setLoadingPanel(false); }
    })();
    return () => src.cancel();
  }, [input, focused]);

  /* Auto scroll on new message */
  useEffect(() => {
    if (!messages.length) return;
    const el = scrollRef.current;
    requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior:"smooth" }));
  }, [messages]);

  /* --- handlers --- */
  const copyMessage = async (i) => {
    try {
      await navigator.clipboard.writeText(messages[i].content || "");
      setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1000);
    } catch {}
  };

  const handleSend = async (text = input) => {
    const content = text.trim(); if (!content) return;
    setMessages((p) => [...p, { role: "user", content }]);
    setInput(""); setTyping(true);
    try {
      const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
      const cards = rankAndTrim((r.data?.cards || []).map((c)=>({ ...c, image:firstImageUrl(c) })),12,true);
      setMessages((p)=>[...p,{ role:"assistant", content:r.data?.reply||r.data?.text||"", cards }]);
    } catch {
      setMessages((p)=>[...p,{ role:"assistant", content:"⚠️ Error retrieving response." }]);
    } finally { setTyping(false); }
  };

  /* --- UI --- */
  const SmartImage = ({ url, title }) => !url ? null : <img src={prox(url)} alt="" className="w-full h-full object-cover" loading="lazy" />;
  const SmartCard = ({ card }) => {
    const pv = bestPreview(card, true);
    return (
      <a href={card.url} target="_blank" rel="noreferrer" className="block glass rounded-lg p-3">
        {pv && <div className="tile mb-2"><SmartImage url={pv.prox} title={card.title} /></div>}
        {card.title && <div className="text-sm font-semibold">{card.title}</div>}
        <div className="text-xs text-gray-400">{card.source || host(card.url)}</div>
      </a>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col" style={{ height:"100svh" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
        </div>
      </header>

      {/* Scroll container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg,i)=>(
            <div key={i} className={`rounded-xl p-4 ${msg.role==="user"?"glass-2":"glass"}`}>
              <div className="flex justify-between mb-2">
                <div className="text-[11px] uppercase text-gray-400">{msg.role==="user"?"You":"Droxion"}</div>
                {msg.role!=="user" && <button onClick={()=>copyMessage(i)} className="text-xs text-gray-400 hover:text-white"><FaRegCopy /> {copiedIdx===i?"Copied":"Copy"}</button>}
              </div>
              {msg.content && <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>}
              {msg.cards?.length>0 && <div className="grid gap-3 mt-3">{msg.cards.map((c,j)=><SmartCard key={j} card={c}/>)}</div>}
            </div>
          ))}
          {typing && <div className="glass rounded-xl p-4 text-gray-400">Thinking...</div>}
        </div>
      </div>

      {/* Composer */}
      <div ref={composerRef} className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-3 py-2">
          <div className="flex items-center gap-2">
            <textarea
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onFocus={()=>setFocused(true)}
              onBlur={()=>setTimeout(()=>setFocused(false),150)}
              onKeyDown={(e)=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();} }}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 rounded-xl bg-white/5 border border-white/12 px-3 py-2 resize-none leading-snug"
              style={{ height: 38, maxHeight: 38 }}
            />
            <button onClick={()=>handleSend(input)} className="h-9 px-3 rounded-xl bg-white text-black font-semibold">➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;