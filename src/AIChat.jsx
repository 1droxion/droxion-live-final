// src/AIChat.jsx — Droxion (FULL FEATURED + FIXES + CLEAN MENU)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";
import {
  FiMoon, FiSun, FiPlus,
  FiCamera, FiImage, FiFile,
  FiAperture, FiArrowRight
} from "react-icons/fi";
import "./AIChat.css";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------- helpers ---------- */
const normHost = (u="") => { try { return new URL(u).hostname.replace(/^www\./,""); } catch{return"";} };
const firstImageUrl = (c) => c?.image_url || c?.image || c?.thumbnail || c?.thumb || null;
const toProxy = (u="") => (!u||!/^https?:/i.test(u))?u:`${API_BASE}/img?url=${encodeURIComponent(u)}`;
const unsplash = (q) => q ? `https://source.unsplash.com/900x600/?${encodeURIComponent(q)}` : null;
const isYouTube = (raw="") => /youtu\.?be|youtube\.com/.test(raw);
const youTubeIdFromUrl = (raw="") => {
  try {
    const u = new URL(raw);
    if(u.hostname.includes("youtu.be")) return u.pathname.split("/")[1];
    if(u.searchParams.get("v")) return u.searchParams.get("v");
    if(u.pathname.includes("shorts")) return u.pathname.split("/").pop();
  } catch {}
  const m = raw.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

/* ---------- intent detection ---------- */
const wantsNews = (s="") => /\b(news|headline|latest|breaking)\b/i.test(s);
const wantsWeather = (s="") => /\b(weather|temp|forecast|humidity|wind)\b/i.test(s);
const wantsCrypto = (s="") => /\b(crypto|btc|eth|price|stock|chart|coin)\b/i.test(s);
const wantsYouTube = (s="") => /\b(youtube|yt|video|shorts)\b/i.test(s);
const trivialInput = (s="") => /^(hi|hello|hey|ok|\?|yo|sup)$/i.test(s.trim());

/* ---------- Weather Card ---------- */
function WeatherCard({ card }) {
  if (!card) return null;
  return (
    <div className="weather-card glass rounded-xl p-3">
      <div className="flex items-center gap-3">
        {card.icon && <img src={card.icon} className="w-12 h-12 object-contain" alt="" />}
        <div>
          <div className="text-sm font-semibold">{card.title || "Weather"}</div>
          <div className="text-xs text-gray-400">{card.subtitle || ""}</div>
        </div>
      </div>
      {card.temp_c && <div className="mt-2 text-sm">🌡 {Math.round(card.temp_c)}°C / {Math.round(card.temp_f||0)}°F</div>}
      {card.humidity && <div className="text-xs text-gray-400">💧 Humidity: {card.humidity}%</div>}
    </div>
  );
}

/* ---------- Tools Menu ---------- */
function ToolsMenu({ onSendImageFile, onSendAnyFile, onCreateImage, onClearAll, onNewChat, onClose }) {
  const camRef=useRef(null), photosRef=useRef(null), filesRef=useRef(null);
  const pick = (r)=>r.current?.click();
  const handle = (e,fn)=>{const f=e.target.files?.[0]; if(f) fn(f); e.target.value=""; onClose?.();};
  return (
    <div className="menu-panel">
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e)=>handle(e,(f)=>onSendImageFile(f,{source:"camera"}))}/>
      <input ref={photosRef} type="file" accept="image/*" className="hidden" onChange={(e)=>handle(e,(f)=>onSendImageFile(f,{source:"photos"}))}/>
      <input ref={filesRef} type="file" className="hidden" onChange={(e)=>handle(e,onSendAnyFile)}/>
      <button className="menu-item" onClick={()=>pick(camRef)}><FiCamera/><span>Camera</span></button>
      <button className="menu-item" onClick={()=>pick(photosRef)}><FiImage/><span>Photos</span></button>
      <button className="menu-item" onClick={()=>pick(filesRef)}><FiFile/><span>Files</span></button>
      <hr className="menu-sep"/>
      <button className="menu-item" onClick={()=>onCreateImage()}><FiAperture/><span>Create image</span></button>
      <hr className="menu-sep"/>
      <button className="menu-item" onClick={onNewChat}><FiPlus/><span>New chat</span></button>
      <button className="menu-item danger" onClick={onClearAll}><span>Clear chat + memory</span></button>
    </div>
  );
}

/* ---------- Main Chat ---------- */
function AIChat() {
  const [messages,setMessages]=useState([]), [input,setInput]=useState(""), [focused,setFocused]=useState(false);
  const [theme,setTheme]=useState(()=>localStorage.getItem("drox.theme")||"dark");
  const [menuOpen,setMenuOpen]=useState(false);
  const inputRef=useRef(null);

  useEffect(()=>{localStorage.setItem("drox.theme",theme);document.documentElement.dataset.theme=theme;},[theme]);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("droxion.chat.v1")||"[]");if(saved.length) setMessages(saved);}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem("droxion.chat.v1",JSON.stringify(messages.slice(-50)));}catch{}},[messages]);

  const clearAll=()=>{setMessages([]);localStorage.removeItem("droxion.chat.v1");};
  const newChat=()=>{setMessages([]);setInput("");};

  const pushReply=(content,cards=[])=>setMessages(p=>[...p,{role:"assistant",content,cards}]);

  const handleSend=async(text=input)=>{
    const q=(text||"").trim(); if(!q) return;
    setMessages(p=>[...p,{role:"user",content:q}]); setInput("");
    try{
      if(wantsNews(q)){const r=await axios.post(`${API_BASE}/realtime`,{query:q,intent:"news"});return pushReply(r.data?.markdown||"Top news:",r.data?.cards||[]);}
      if(wantsWeather(q)){const r=await axios.post(`${API_BASE}/realtime`,{query:q,intent:"weather"});return pushReply(r.data?.markdown||"Weather:",r.data?.cards||[]);}
      if(wantsCrypto(q)){const r=await axios.post(`${API_BASE}/realtime`,{query:q,intent:"crypto"});return pushReply(r.data?.markdown||"Crypto:",r.data?.cards||[]);}
      if(wantsYouTube(q)){const r=await axios.get(`${API_BASE}/search-youtube`,{params:{q}});const cards=(r.data.items||[]).map(v=>({type:"youtube",videoId:v.id?.videoId||v.videoId||youTubeIdFromUrl(v.url),title:v.title,url:v.url,thumbnail:v.thumbnail}));return pushReply("🎥 YouTube results:",cards);}
      const res=await axios.post(`${API_BASE}/chat`,{prompt:q});
      pushReply(res.data?.reply||"",res.data?.cards||[]);
    }catch{pushReply("⚠️ Error fetching response.");}
  };

  const OrganizedAnswer=({md})=>{
    const title=(md.match(/^#\s+(.+)/m)?.[1])||md.split("\n")[0];
    return(
      <>
        <div className="org-title">{title}</div>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{md}</ReactMarkdown>
      </>
    );
  };

  const MediaBlock=({cards=[]})=>{
    return(
      <div className="grid gap-4 mt-3">
        {cards.map((c,i)=>{
          if(c.type==="weather") return <WeatherCard key={i} card={c}/>;
          if(c.type==="youtube" && c.videoId)
            return(<div key={i} className="embed-responsive embed-16by9 rounded overflow-hidden glass">
              <iframe src={`https://www.youtube.com/embed/${c.videoId}`} title={c.title} allowFullScreen/>
            </div>);
          if(c.type==="gallery"||c.type==="image")
            return <img key={i} src={c.url||c.images?.[0]} className="rounded-lg w-full" alt=""/>;
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-[100svh]">
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-2">
          <div className="brand text-lg font-bold">Droxion</div>
          <div className="ml-auto flex gap-2">
            <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} className="pill-btn">
              {theme==="dark"?<FiMoon/>:<FiSun/>} {theme==="dark"?"Dark":"Light"}
            </button>
            <button onClick={()=>setMenuOpen(v=>!v)} className="pill-btn"><FiPlus/></button>
          </div>
        </div>
      </header>

      {menuOpen && <div className="menu-wrapper">
        <ToolsMenu onSendImageFile={()=>{}} onSendAnyFile={()=>{}} onCreateImage={()=>handleSend("create image")} onClearAll={clearAll} onNewChat={newChat} onClose={()=>setMenuOpen(false)}/>
      </div>}

      <div className="chat-scroll flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-3 pb-28 pt-3 space-y-4">
          {messages.map((m,i)=>(
            <div key={i} className={`msg ${m.role==="user"?"glass-2":"glass"}`}>
              <div className="small-label">{m.role==="user"?"You":"Droxion"}</div>
              {m.role==="user"?<div>{m.content}</div>:<OrganizedAnswer md={m.content}/>}
              {m.cards?.length>0 && <MediaBlock cards={m.cards}/>}
            </div>
          ))}
        </div>
      </div>

      <div className="fixed-bottom bg-black/80 backdrop-blur border-t border-white/10">
        <div className="max-w-4xl mx-auto px-3 py-2 flex gap-2">
          <textarea ref={inputRef} value={input} onChange={(e)=>setInput(e.target.value)}
            onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}}
            onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),150)}
            className="flex-1 bg-transparent outline-none resize-none" placeholder="Type your message..."/>
          <button onClick={()=>handleSend()} className="send-btn"><FiArrowRight/></button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;