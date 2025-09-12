// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./,""); } catch { return ""; } };
const isFilteredSource = (u="") => {
  try {
    const h = new URL(u).hostname.replace(/^www\./,"");
    return ["google.com","news.google.com","maps.google.com","example.com","example.org","wikipedia.org","m.wikipedia.org"].includes(h);
  } catch { return true; }
};
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
const wantsImages = (s="") => /\b(image|photo|picture|wallpaper|gallery)\b/i.test(s);
const wantsNews = (s="") => /\b(news|headlines|latest news|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|temperature|forecast)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|bitcoin|btc|ethereum|eth|price|chart)\b/i.test(s);

const bestPreview = (card, allowFallback=true) => {
  const direct = firstImageUrl(card);
  if (direct) return { prox: prox(direct), orig: direct };
  if (allowFallback && card.url && !isFilteredSource(card.url)) {
    return { prox: prox(`https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(card.url)}`), orig: card.url };
  }
  const ph = unsplash(card.title || card.source || "preview");
  return ph ? { prox: ph, orig: ph } : null;
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
    if (h.includes("youtu.be")) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0]) return p[0];
    }
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

  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);

  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name","viewport"); document.head.appendChild(meta); }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");
  }, []);

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

  useEffect(() => {
    const q = input.trim();
    clearTimeout(previewTimer.current);
    if (!focused || q.length < 1) return;
    setLoadingPanel(true);
    previewTimer.current = setTimeout(async () => {
      try {
        const [rn, rw, rc] = await Promise.all([
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "news" }).catch(()=>null),
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "weather" }).catch(()=>null),
          axios.post(`${API_BASE}/realtime`, { query: q, intent: "crypto" }).catch(()=>null)
        ]);
        setNews((rn?.data?.cards || []).filter(c=>!isFilteredSource(c.url)));
        setWeather((rw?.data?.cards || [])[0] || null);
        setCrypto((rc?.data?.cards || []).slice(0,6));
      } finally { setLoadingPanel(false); }
    }, 150);
    return () => clearTimeout(previewTimer.current);
  }, [input, focused]);

  const copyMessage = async (i) => {
    try {
      const msg = messages[i];
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1000);
    } catch {}
  };

  const pushWithFollowups = (md, cards) => {
    setMessages((p) => [...p, { role: "assistant", content: md, cards }]);
  };

  const handleSend = async (text = input) => {
    const content = text.trim(); if (!content) return;
    setTyping(true);
    setMessages((p) => [...p, { role: "user", content }]);
    setInput(""); setTextSug([]);

    try {
      if (isGreeting(content)) {
        const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
        pushWithFollowups(r.data?.reply || "👋", []);
        setTyping(false); return;
      }

      if (wantsNews(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "news" });
        pushWithFollowups("📰 Latest News", r.data?.cards || []);
        setTyping(false); return;
      }
      if (wantsWeather(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "weather" });
        pushWithFollowups("☁️ Weather", r.data?.cards || []);
        setTyping(false); return;
      }
      if (wantsCrypto(content)) {
        const r = await axios.post(`${API_BASE}/realtime`, { query: content, intent: "crypto" });
        pushWithFollowups("💰 Crypto Prices", r.data?.cards || []);
        setTyping(false); return;
      }

      const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
      pushWithFollowups(res.data?.reply || "", res.data?.cards || []);
    } catch {
      pushWithFollowups("⚠️ Error fetching data.", []);
    } finally { setTyping(false); }
  };

  const SmartImage = ({ url, title }) => {
    if (!url) return null;
    return (
      <img src={prox(url)} alt={title||""} className="w-full rounded-lg glass"
        onError={(e)=>{ e.currentTarget.src = unsplash(title||"image"); }} loading="lazy" />
    );
  };

  const SmartCard = ({ card }) => {
    const pv = bestPreview(card);
    return (
      <a href={card.url} target="_blank" rel="noreferrer" className="block glass rounded-lg p-3 hover:bg-white/10 transition">
        {pv && <img src={pv.prox} alt="" className="w-full rounded mb-2" loading="lazy" />}
        {card.title && <div className="text-sm font-semibold">{card.title}</div>}
        <div className="text-xs text-gray-400">{card.source || (card.url ? host(card.url) : "")}</div>
        {card.snippet && <div className="text-xs text-gray-300 mt-1">{card.snippet}</div>}
      </a>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col" style={{ height:"100svh" }}>
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling:"touch", padding:"12px 0 16px", height:"calc(100svh - 48px - 96px)" }}>
        <div className="max-w-4xl mx-auto w-full px-3 space-y-4">
          {messages.map((msg,i)=>(
            <div key={i} className={`rounded-xl p-4 ${msg.role==="user"?"glass-2":"glass"}`}>
              <div className="flex justify-between mb-2">
                <div className="text-[11px] uppercase text-gray-400">{msg.role==="user"?"You":"Droxion"}</div>
                {msg.role!=="user" && <button onClick={()=>copyMessage(i)} className="text-xs text-gray-400"><FaRegCopy /> {copiedIdx===i?"Copied":"Copy"}</button>}
              </div>
              {msg.content && <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>}
              {msg.cards?.length>0 && (
                <div className="mt-3 grid gap-3">{msg.cards.filter(c=>!isFilteredSource(c.url)).map((c,i)=><SmartCard key={i} card={c} />)}</div>
              )}
            </div>
          ))}
          {typing && <div className="glass rounded-xl p-4"><div className="h-4 w-24 bg-white/10 mb-2 rounded" /></div>}
        </div>
      </div>

      {focused && (loadingPanel || textSug.length>0 || news.length>0 || weather || crypto.length>0) && (
        <div className="fixed inset-x-0 bottom-[88px] z-40">
          <div className="max-w-4xl mx-auto px-3 glass rounded-xl p-2">
            <div className="px-1 text-xs text-gray-400 mb-1">Recent Headlines</div>
            <div className="grid gap-2">{news.map((c,i)=><SmartCard key={i} card={c} />)}</div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur" style={{ paddingBottom:"max(env(safe-area-inset-bottom), 12px)" }}>
        <div className="max-w-4xl mx-auto px-3 pt-2 flex items-center gap-2">
          <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2">
            <textarea value={input} onChange={(e)=>setInput(e.target.value)}
              onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),150)}
              onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}
              rows={1} placeholder="" className="w-full bg-transparent outline-none resize-none"
              style={{ height:44, maxHeight:44 }} />
          </div>
          <button onClick={()=>handleSend(input)} className="h-10 px-4 rounded-2xl bg-white text-black font-semibold">➤</button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;