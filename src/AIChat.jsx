import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaPlus,
  FaVolumeUp, FaVolumeMute, FaMicrophone,
  FaUpload, FaCamera, FaRegCopy
} from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/**
 * AIChat (Lite) — Chat + YouTube + Image only
 * - Removed: stocks/crypto, news, weather, time, google/search cards, finance embeds
 * - Clean mobile-first glass style + black/white icons
 * - Uses your existing Render backend: /chat, /generate-image, /search-youtube
 */

function AIChat() {
  // -------- State --------
  const [messages, setMessages] = useState([]); // [{role, content, cards?}]
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // simple quick suggestions (no stocks/news)
  const [suggestions] = useState([
    "Generate an image: cinematic city at night",
    "YouTube: best startup talk 2025",
    "Write a 5-point plan to grow my cafe",
    "Give me 3 viral reel ideas about productivity",
  ]);

  // refs
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const userId = useRef("");

  // -------- Helpers --------
  const pushAssistant = (content, extra = {}) =>
    setMessages(prev => [...prev, { role: "assistant", content, ...extra }]);
  const pushUser = (content) =>
    setMessages(prev => [...prev, { role: "user", content }]);

  const logAction = async (action, inputText) => {
    try {
      await axios.post(`${API_BASE}/track`, {
        user_id: userId.current,
        action,
        input: inputText,
        timestamp: new Date().toISOString()
      });
    } catch { /* silent */ }
  };

  const speak = (text) => {
    if (!voiceMode || !text || !synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    synth.cancel();
    synth.speak(u);
  };

  // ---------- YouTube helpers ----------
  const getYouTubeId = (raw) => {
    try {
      const txt = raw.trim();
      if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;
      const hasHttp = /^https?:\/\//i.test(txt);
      const u = new URL(hasHttp ? txt : `https://youtube.com/results?search_query=${encodeURIComponent(txt)}`);
      const host = u.hostname.replace("www.", "");
      if (host.includes("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const p = u.pathname.split("/").filter(Boolean);
        if (p[0] === "shorts" || p[0] === "embed") return p[1];
      }
      if (host.includes("youtu.be")) {
        const p = u.pathname.split("/").filter(Boolean);
        if (p[0]) return p[0];
      }
    } catch {}
    const m = raw.match(/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  // ---------- Effects ----------
  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  // Global styles (mobile-safe, smooth embeds) + glass look
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      :root {
        --glass: rgba(255,255,255,0.06);
        --glass-2: rgba(255,255,255,0.10);
        --border: rgba(255,255,255,0.12);
      }
      * { -webkit-tap-highlight-color: transparent; }
      textarea, input { font-size: 16px !important; }
      img, iframe, video { max-width: 100% !important; height: auto !important; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position: absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .msg { word-wrap: break-word; overflow-wrap: anywhere; }
      .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%);
                 background-size:400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 8px; }
      @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      .glass { background: var(--glass); border: 1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border: 1px solid var(--border); backdrop-filter: blur(10px); }
      @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; animation: none !important; } }
    `;
    document.head.appendChild(style);

    // mobile viewport (prevents zoom jump)
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
    return () => { document.head.removeChild(style); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTopToolsOpen(v => !v);
      }
      if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Autoresize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // ---------- Minimal card renderer (YouTube + Image only) ----------
  const renderCards = (cards) => {
    if (!cards || !cards.length) return null;
    return (
      <div className="grid grid-cols-1 gap-3">
        {cards.map((c, idx) => {
          if (c.type === "youtube") {
            const vid = getYouTubeId(c.url || "");
            if (!vid) return null;
            return (
              <div key={idx} className="embed-responsive embed-16by9 rounded overflow-hidden glass">
                <iframe
                  src={`https://www.youtube.com/embed/${vid}`}
                  title={c.title || "YouTube"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            );
          }
          if (c.type === "image" && c.image_url) {
            return <img key={idx} src={c.image_url} alt="" className="w-full rounded glass" loading="lazy" />;
          }
          if (c.html) return <div key={idx} className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: c.html }} />;
          if (c.text) return <div key={idx} className="text-sm">{c.text}</div>;
          return null;
        })}
      </div>
    );
  };

  const copyMessage = async (i) => {
    try {
      const msg = messages[i];
      if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1200);
    } catch {}
  };

  // ---------- Main send ----------
  const handleSend = async (textToSend = input) => {
    const content = textToSend.trim();
    if (!content) return;

    setTyping(true);
    pushUser(content);
    setInput("");
    logAction("message", content);
    const lower = content.toLowerCase();

    try {
      // 1) IMAGE generation trigger (simple keywords)
      const imgKW = ["image", "photo", "draw", "picture", "generate", "art", "wallpaper"];
      if (imgKW.some(k => lower.includes(k))) {
        try {
          const im = await axios.post(`${API_BASE}/generate-image`, { prompt: content });
          if (im.data?.image_url) {
            pushAssistant("", { cards: [{ type: "image", image_url: im.data.image_url }] });
          } else {
            pushAssistant("I couldn't generate that image right now.");
          }
        } catch {
          pushAssistant("Image service is unavailable right now.");
        }
        setTyping(false);
        return;
      }

      // 2) YOUTUBE helper
      const ytKW = ["youtube", "yt ", "video", "watch", "trailer", "music", "song", "shorts", "youtu.be", "youtube.com"];
      if (ytKW.some(k => lower.includes(k))) {
        const directId = getYouTubeId(content);
        if (directId) {
          pushAssistant("", { cards: [{ type: "youtube", url: `https://www.youtube.com/watch?v=${directId}` }] });
        } else {
          try {
            const res = await axios.post(`${API_BASE}/search-youtube`, { prompt: content });
            const url = res.data?.url;
            if (url) {
              pushAssistant("", { cards: [{ type: "youtube", url }] });
            } else {
              const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
              const reply = r.data?.reply || "I couldn't find a video for that.";
              pushAssistant(reply);
              speak(reply);
            }
          } catch {
            pushAssistant("YouTube search is unavailable right now.");
          }
        }
        setTyping(false);
        return;
      }

      // 3) DEFAULT chat
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content, voiceMode });
      let reply = res.data?.reply || "";

      // Keep your brand line when they ask who made it
      if (/who.*(made|created)/i.test(content)) {
        reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
      }

      pushAssistant(reply);
      speak(reply);
    } catch (err) {
      console.error(err);
      pushAssistant("⚠️ Error or connection failed.");
    } finally {
      setTyping(false);
    }
  };

  const handlePromptClick = (style) => handleSend(`Generate an image in ${style} style.`);

  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Mic not supported");
    const recog = new SR();
    recog.lang = "en-US";
    recog.start();
    recog.onresult = e => setInput(e.results[0][0].transcript);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------- LAYOUT (Glassy, centered header; mobile first) ----------
  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
          <div className="ml-auto relative flex items-center gap-2">
            {topToolsOpen && (
              <div className="flex gap-4 glass px-2 py-1 rounded text-sm">
                <FaTrash onClick={() => setMessages([])} className="cursor-pointer" title="Clear chat" />
                <FaDownload className="cursor-pointer" title="Download (todo)" />
                <FaMicrophone className="cursor-pointer" onClick={handleMic} title="Voice to text" />
                {voiceMode
                  ? <FaVolumeUp onClick={() => setVoiceMode(false)} title="Voice off" />
                  : <FaVolumeMute onClick={() => setVoiceMode(true)} title="Voice on" />}
                <FaUpload onClick={() => document.getElementById("fileUpload").click()} title="Upload" />
                <FaCamera title="Screenshot (todo)" />
                <input type="file" id="fileUpload" hidden accept="image/*" />
              </div>
            )}
            <FaPlus onClick={() => setTopToolsOpen(!topToolsOpen)} className="cursor-pointer" title="Tools (⌘/Ctrl+K)" />
          </div>
        </div>

        {/* Centered Search Bar */}
        <div className="max-w-2xl mx-auto px-3 pb-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 glass rounded-xl px-3 py-2 focus-within:border-white/20 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                inputMode="text"
                placeholder='Ask anything… try: "Generate an image: neon cyberpunk street", "YouTube: best startup talk 2025" ( / to focus )'
                className="w-full bg-transparent outline-none resize-none placeholder-gray-500"
              />
            </div>
            <button
              onClick={() => handleSend(input)}
              className="bg-white hover:bg-gray-300 text-black font-semibold py-2 px-4 rounded-xl"
              title="Send"
            >
              ➤
            </button>
          </div>

          {/* Inline suggestions */}
          <div className="flex gap-2 flex-wrap mt-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="px-3 py-1 glass rounded-full text-xs hover:bg-white hover:text-black transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto w-full px-3 py-4">
        <div className="space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const hasCards = !!msg.cards?.length;

            return (
              <div key={i} className={`rounded-xl p-4 ${isUser ? "glass-2" : "glass"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wider text-gray-400">
                    {isUser ? "You" : "Droxion"}
                  </div>
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

                {msg.content ? (
                  <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                    img: (props) => <img {...props} className="rounded-lg my-2 w-full glass" loading="lazy" />,
                    iframe: (props) => (
                      <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass">
                        <iframe {...props} allowFullScreen />
                      </div>
                    ),
                    a: ({node, ...props}) => <a {...props} className="underline decoration-gray-600 hover:text-gray-200" target="_blank" rel="noreferrer" />
                  }}>
                    {msg.content}
                  </ReactMarkdown>
                ) : null}

                {hasCards && (
                  <div className="mt-3">
                    {renderCards(msg.cards)}
                  </div>
                )}
              </div>
            );
          })}

          {typing && (
            <div className="glass rounded-xl p-4">
              <div className="h-4 w-24 shimmer mb-2" />
              <div className="h-3 w-full shimmer mb-1" />
              <div className="h-3 w-4/5 shimmer mb-1" />
              <div className="h-3 w-3/5 shimmer" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Quick style buttons */}
      <div className="max-w-4xl mx-auto w-full px-3 pb-5">
        <div className="flex gap-2 flex-wrap">
          {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map(s => (
            <button
              key={s}
              onClick={() => handlePromptClick(s)}
              className="px-3 py-1 glass rounded-full text-sm hover:bg-white hover:text-black transition"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AIChat;