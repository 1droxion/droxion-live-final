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
const host = (u) => normHost(u).replace(/^m\./,"");

const BAD_HOSTS = ["google.com","news.google.com","maps.google.com","example.com","example.org","wikipedia.org","m.wikipedia.org","en.wikipedia.org"];
const isBadHost = (h="") => BAD_HOSTS.some(b => h===b || h.endsWith("."+b));
const isFilteredSource = (u="") => { const h = host(u); return !h || isBadHost(h); };

const firstImageUrl = (c) => c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;

const IMAGE_PROXY = `${API_BASE}/img?url=`;
const prox = (u) => (!u || u.startsWith("data:") || u.startsWith(IMAGE_PROXY)) ? u : (IMAGE_PROXY + encodeURIComponent(u));
const unsplash = (q) => q ? `https://source.unsplash.com/900x600/?${encodeURIComponent(q)}` : null;

const timeAgo = (d) => {
  if (!d) return "";
  const t = typeof d === "string" ? new Date(d).getTime() : +d;
  if (!t || Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};

const wantsImages = (s="") => /\b(image|images|photo|wallpaper|picture)\b/i.test(s);
const wantsNews = (s="") => /\b(news|headlines|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|forecast)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|bitcoin|btc|eth|price|chart)\b/i.test(s);
const wantsYouTube = (s="") => /\b(youtube|youtu\.be|video|shorts|trailer)\b/i.test(s);
const wantsPreview = (s="") => wantsNews(s)||wantsWeather(s)||wantsCrypto(s)||wantsImages(s)||wantsYouTube(s);

const dedupeCards = (arr=[]) => {
  const seen = new Set();
  return arr.filter(c => {
    const key = (host(c.url||"")||"") + "::" + (c.title||"").toLowerCase().slice(0,80);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const [focused, setFocused] = useState(false);
  const [textSug, setTextSug] = useState([]);
  const [cardsPreview, setCardsPreview] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(false);

  const scrollRef = useRef(null);
  const panelRef = useRef(null);
  const composerRef = useRef(null);
  const [panelH, setPanelH] = useState(0);
  const [composerH, setComposerH] = useState(96);

  const suggestTimer = useRef(null);
  const previewTimer = useRef(null);
  const cancelPrev = useRef({ cancel: () => {} });

  /* --- CSS + Layout --- */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name","viewport"); document.head.appendChild(meta); }
    meta.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content");
    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html,body{height:100%;background:#000;color:#fff;margin:0;padding:0;}
      .glass{background:var(--glass);border:1px solid var(--border);backdrop-filter:blur(10px);}
      .glass-2{background:var(--glass-2);border:1px solid var(--border);backdrop-filter:blur(10px);}
      .tile{position:relative;width:100%;padding-top:66.6%;overflow:hidden;border-radius:12px;}
      .tile>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
      .pill{font-size:11px;padding:2px 8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);border-radius:999px;}
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (panelRef.current) new ResizeObserver(() => setPanelH(panelRef.current.offsetHeight)).observe(panelRef.current);
    if (composerRef.current) new ResizeObserver(() => setComposerH(composerRef.current.offsetHeight)).observe(composerRef.current);
  }, []);

  /* --- Suggestions --- */
  useEffect(() => {
    const q = input.trim();
    clearTimeout(suggestTimer.current);
    if (!focused || q.length < 1) return setTextSug([]);
    suggestTimer.current = setTimeout(async () => {
      try { const {data}=await axios.get(`${API_BASE}/suggest`,{params:{q}}); setTextSug(data?.suggestions||[]); }
      catch{ setTextSug([]); }
    },150);
  },[input,focused]);

  /* --- Live Previews --- */
  useEffect(() => {
    const q = input.trim();
    clearTimeout(previewTimer.current);
    if (!focused || q.length<1 || !wantsPreview(q)) return setCardsPreview([]);
    setLoadingPanel(true);
    cancelPrev.current.cancel?.();
    const src = axios.CancelToken.source();
    cancelPrev.current = { cancel: () => src.cancel("new query") };
    previewTimer.current = setTimeout(async ()=>{
      try {
        const r = await axios.post(`${API_BASE}/realtime`,{query:q},{cancelToken:src.token});
        setCardsPreview(dedupeCards(r?.data?.cards||[]));
      } catch{ setCardsPreview([]);} finally{setLoadingPanel(false);}
    },150);
  },[input,focused]);

  /* --- Auto Scroll on new messages --- */
  useEffect(() => {
    if (!messages.length) return;
    scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"});
  },[messages]);

  /* --- Send handler --- */
  const handleSend = async (text=input) => {
    const content = text.trim(); if(!content) return;
    setTyping(true);
    setMessages(p=>[...p,{role:"user",content}]);
    setInput(""); setTextSug([]);
    try {
      const r = await axios.post(`${API_BASE}/chat`,{prompt:content});
      setMessages(p=>[...p,{role:"assistant",content:r.data?.reply||r.data?.text||"",cards:dedupeCards(r.data?.cards||[])}]);
    } catch {
      setMessages(p=>[...p,{role:"assistant",content:"⚠️ Error fetching results.",cards:[]}]);
    } finally { setTyping(false); }
  };

  /* --- Components --- */
  const SmartImage = ({url,title}) => url ? <img src={prox(url)} alt={title||""} className="w-full h-full object-cover" onError={e=>e.currentTarget.style.display="none"}/> : null;
  const Card = ({c}) => {
    const img = firstImageUrl(c)||unsplash(c.title);
    return (
      <a href={c.url} target="_blank" rel="noreferrer" className="block glass rounded-lg p-2 hover:bg-white/10">
        {img && <div className="tile mb-2"><SmartImage url={img} title={c.title}/></div>}
        <div className="text-sm font-semibold">{c.title}</div>
        <div className="text-xs text-gray-400">{c.source||host(c.url)}</div>
      </a>
    );
  };

  const SourceChips = ({cards=[]})=>{
    const links=cards.filter(c=>c.url&&!isFilteredSource(c.url));
    if(!links.length) return null;
    return <div className="flex flex-wrap gap-2 mt-2">{links.map((c,i)=><a key={i} href={c.url} target="_blank" rel="noreferrer" className="pill">{c.source||host(c.url)}</a>)}</div>;
  };

  /* --- UI --- */
  const showPanel = focused && (loadingPanel || cardsPreview.length>0 || textSug.length>0);
  const bottomPad = showPanel ? panelH+composerH+20 : composerH+20;

  return (
    <div className="h-screen flex flex-col" style={{height:"100svh"}}>
      <header className="sticky top-0 z-40 bg-black/60 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-3 py-2 font-bold text-lg">Droxion • Live</div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{paddingBottom:bottomPad}}>
        <div className="max-w-4xl mx-auto px-3 space-y-4">
          {messages.map((m,i)=>(
            <div key={i} className={`p-4 rounded-xl ${m.role==="user"?"glass-2":"glass"}`}>
              <div className="flex justify-between mb-1 text-xs text-gray-400">
                <span>{m.role==="user"?"You":"Droxion"}</span>
                {m.role!=="user" && <button onClick={()=>navigator.clipboard.writeText(m.content)} className="hover:text-white"><FaRegCopy/></button>}
              </div>
              {m.content && <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{m.content}</ReactMarkdown>}
              {m.cards && <div className="grid grid-cols-1 gap-3 mt-2">{m.cards.map((c,idx)=><Card key={idx} c={c}/>)}</div>}
              <SourceChips cards={m.cards}/>
            </div>
          ))}
          {typing && <div className="glass p-4 rounded-xl animate-pulse text-sm text-gray-400">Thinking…</div>}
        </div>
      </div>

      {/* Live Preview Panel */}
      {showPanel && (
        <div ref={panelRef} className="fixed inset-x-0 bottom-[88px] z-40">
          <div className="max-w-4xl mx-auto px-3">
            <div className="glass rounded-xl p-2">
              <div className="text-xs text-gray-400 mb-2">Live Results</div>
              <div className="flex gap-3 overflow-x-auto">
                {cardsPreview.map((c,i)=><div key={i} className="min-w-[70%]"><Card c={c}/></div>)}
              </div>
              {textSug.length>0 && (
                <div className="mt-2">
                  {textSug.map((s,i)=><button key={i} onClick={()=>handleSend(s)} className="block w-full text-left text-sm px-3 py-1 hover:bg-white/10 rounded">{s}</button>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={composerRef} className="fixed bottom-0 inset-x-0 bg-black/80 backdrop-blur border-t border-white/10">
        <div className="max-w-4xl mx-auto px-3 py-2 flex gap-2">
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}
            onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),120)}
            className="flex-1 bg-transparent resize-none outline-none text-white" rows={1} placeholder="Type a message…" />
          <button onClick={()=>handleSend()} className="bg-white text-black rounded-2xl px-4 font-semibold">➤</button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;