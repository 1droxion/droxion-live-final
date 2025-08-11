import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaMicrophone,
  FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

// Common name → ticker map (US + a few IN)
const STOCK_MAP = {
  tesla: { symbol: "TSLA", exchange: "NASDAQ" },
  apple: { symbol: "AAPL", exchange: "NASDAQ" },
  google: { symbol: "GOOGL", exchange: "NASDAQ" },
  alphabet: { symbol: "GOOGL", exchange: "NASDAQ" },
  microsoft: { symbol: "MSFT", exchange: "NASDAQ" },
  amazon: { symbol: "AMZN", exchange: "NASDAQ" },
  meta: { symbol: "META", exchange: "NASDAQ" },
  facebook: { symbol: "META", exchange: "NASDAQ" },
  nvidia: { symbol: "NVDA", exchange: "NASDAQ" },
  netflix: { symbol: "NFLX", exchange: "NASDAQ" },
  // India (works in Google Finance embeds)
  reliance: { symbol: "RELIANCE", exchange: "NSE" },
  tcs: { symbol: "TCS", exchange: "NSE" },
  infosys: { symbol: "INFY", exchange: "NSE" },
  hdfc: { symbol: "HDFCBANK", exchange: "NSE" },
  adani: { symbol: "ADANIENT", exchange: "NSE" }
};

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatEndRef = useRef(null);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const userId = useRef("");

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
    } catch { /* no-op */ }
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

  // ---------- Stock helpers (natural language) ----------
  const detectStockQuery = (txt) => {
    const l = txt.toLowerCase();
    const looksLikeStock =
      l.includes("stock") || l.includes("share") || l.includes("price") || l.startsWith("stock:");
    if (!looksLikeStock) return null;

    // 1) explicit "stock:SYMBOL" still supported
    if (l.startsWith("stock:")) {
      const raw = txt.slice(6).trim().toUpperCase();
      const [symbol, exchange] = raw.split(":");
      return { symbol: symbol || raw, exchange };
    }

    // 2) company name keyword map
    for (const key of Object.keys(STOCK_MAP)) {
      if (l.includes(key)) return STOCK_MAP[key];
    }

    // 3) uppercase ticker in text (1–5 letters)
    const upperTokens = txt.match(/\b[A-Z]{1,5}\b/g);
    if (upperTokens && upperTokens.length) {
      // choose the first that is not common word
      const bad = new Set(["I", "AM", "A", "AND", "THE", "IN", "AT", "ON", "FOR", "WITH", "TO"]);
      const pick = upperTokens.find(t => !bad.has(t));
      if (pick) return { symbol: pick };
    }
    return null;
  };

  // ---------- Weather/Time helpers (natural language) ----------
  const extractCityAfter = (txt, anchor) => {
    const idx = txt.toLowerCase().indexOf(anchor);
    if (idx === -1) return null;
    return txt.slice(idx + anchor.length).trim().replace(/[?.!]+$/, "");
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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // iOS zoom + responsive embeds
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      textarea, input { font-size: 16px !important; }
      img, iframe, video { max-width: 100% !important; height: auto !important; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position: absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .msg { word-wrap: break-word; overflow-wrap: anywhere; }
    `;
    document.head.appendChild(style);

    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
    return () => { document.head.removeChild(style); };
  }, []);

  // ---------- Cards ----------
  const CardNews = ({ item }) => (
    <a href={item.url} target="_blank" rel="noreferrer"
       className="block border border-gray-700 rounded-lg p-3 hover:bg-gray-900 transition">
      {item.image && <img src={item.image} alt="" className="w-full rounded mb-2" loading="lazy" />}
      <div className="text-sm font-semibold">{item.title}</div>
      <div className="text-xs text-gray-400 mt-1">{item.source} {item.time ? `• ${item.time}` : ""}</div>
    </a>
  );

  const CardWeather = ({ data }) => (
    <div className="border border-gray-700 rounded-lg p-3">
      <div className="text-sm font-semibold mb-1">Weather in {data.city}</div>
      <div className="text-lg">{data.temp} — {data.condition}</div>
      {data.extra && <div className="text-xs text-gray-400 mt-1">{data.extra}</div>}
    </div>
  );

  const CardTime = ({ data }) => (
    <div className="border border-gray-700 rounded-lg p-3">
      <div className="text-sm font-semibold">Time in {data.city}</div>
      <div className="text-lg">{data.time}</div>
      {data.date && <div className="text-xs text-gray-400 mt-1">{data.date}</div>}
    </div>
  );

  const CardFinance = ({ data }) => (
    <div className="border border-gray-700 rounded-lg p-3">
      <div className="text-sm font-semibold mb-2">📈 {data.symbol}{data.exchange ? ` (${data.exchange})` : ""}</div>
      {data.price && <div className="text-lg mb-1">{data.price}{data.change ? ` (${data.change})` : ""}</div>}
      <div className="embed-responsive embed-16by9 rounded overflow-hidden">
        <iframe
          src={`https://www.google.com/finance/quote/${encodeURIComponent(data.symbol)}${data.exchange ? ":"+encodeURIComponent(data.exchange) : ""}`}
          title={data.symbol}
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );

  const renderCards = (cards) => {
    if (!cards || !cards.length) return null;
    return (
      <div className="grid grid-cols-1 gap-3 mt-2">
        {cards.map((c, idx) => {
          if (c.type === "news") return <CardNews key={idx} item={c} />;
          if (c.type === "weather") return <CardWeather key={idx} data={c} />;
          if (c.type === "time") return <CardTime key={idx} data={c} />;
          if (c.type === "finance") return <CardFinance key={idx} data={c} />;
          if (c.type === "youtube") {
            const vid = getYouTubeId(c.url || "");
            if (!vid) return null;
            return (
              <div key={idx} className="embed-responsive embed-16by9 rounded overflow-hidden">
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
            return <img key={idx} src={c.image_url} alt="" className="w-full rounded" loading="lazy" />;
          }
          if (c.html) return <div key={idx} className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: c.html }} />;
          if (c.text) return <div key={idx} className="text-sm">{c.text}</div>;
          return null;
        })}
      </div>
    );
  };

  // ---------- Main send ----------
  const handleSend = async (textToSend = input) => {
    const content = textToSend.trim();
    if (!content) return;

    const lower = content.toLowerCase();
    setTyping(true);
    pushUser(content);
    setInput("");
    logAction("message", content);

    try {
      let handled = false;

      // GOOGLE/search trigger -> backend smart cards (news, stocks, weather, etc.)
      if (lower.startsWith("google:") || lower.startsWith("search:")) {
        const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
        const reply = res.data?.reply || "";
        const cards = res.data?.cards || [];
        pushAssistant(reply || "Here are the results:", { cards });
        speak(reply);
        handled = true;
      }

      // YOUTUBE: natural keywords or direct link/ID
      if (!handled) {
        const ytKW = ["youtube", "yt ", "video", "watch", "trailer", "music", "song", "shorts", "youtu.be", "youtube.com"];
        if (ytKW.some(k => lower.includes(k))) {
          const directId = getYouTubeId(content);
          if (directId) {
            pushAssistant("", { cards: [{ type: "youtube", url: `https://www.youtube.com/watch?v=${directId}` }] });
          } else {
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
          }
          handled = true;
        }
      }

      // IMAGE generation (Replit key on backend)
      if (!handled) {
        const imgKW = ["image", "photo", "draw", "picture", "generate", "art", "wallpaper"];
        if (imgKW.some(k => lower.includes(k))) {
          const im = await axios.post(`${API_BASE}/generate-image`, { prompt: content });
          if (im.data?.image_url) {
            pushAssistant("", { cards: [{ type: "image", image_url: im.data.image_url }] });
          } else {
            pushAssistant("I couldn't generate that image right now.");
          }
          handled = true;
        }
      }

      // STOCK: natural language (e.g., "Tesla stock", "price of AAPL", "GOOG stock today")
      if (!handled) {
        const stockHit = detectStockQuery(content);
        if (stockHit) {
          pushAssistant("", { cards: [{ type: "finance", ...stockHit }] });
          handled = true;
        }
      }

      // WEATHER: any text with "weather" tries to extract city
      if (!handled && lower.includes("weather")) {
        let city = extractCityAfter(content, "weather in ");
        if (!city) city = extractCityAfter(content, "in ");
        try {
          const w = await axios.post(`${API_BASE}/realtime/weather`, { city: city || "" });
          pushAssistant("", { cards: [{ type: "weather", city: w.data?.city || (city || "Your location"), temp: w.data?.temp, condition: w.data?.condition, extra: w.data?.extra }] });
        } catch {
          pushAssistant("Couldn't fetch weather right now.");
        }
        handled = true;
      }

      // TIME: natural "time in <city>" or "current time <city>"
      if (!handled && (lower.includes("time in ") || lower.includes("current time"))) {
        const city = extractCityAfter(content, "time in ") || extractCityAfter(content, "current time ");
        if (city) {
          const t = await axios.post(`${API_BASE}/realtime/time`, { city });
          pushAssistant("", { cards: [{ type: "time", city: t.data?.city || city, time: t.data?.time, date: t.data?.date }] });
          handled = true;
        }
      }

      // NEWS: natural mentions
      if (!handled && (lower.includes("news") || lower.includes("headlines"))) {
        const n = await axios.post(`${API_BASE}/realtime/news`, {});
        const headlines = (n.data?.headlines || []).map(h => ({
          type: "news",
          title: h.title || h,
          url: h.url,
          source: h.source,
          image: h.image,
          time: h.time
        }));
        if (headlines.length) pushAssistant("Top headlines:", { cards: headlines });
        else pushAssistant("Couldn't fetch news right now.");
        handled = true;
      }

      // DEFAULT chat (also supports cards)
      if (!handled) {
        const res = await axios.post(`${API_BASE}/chat`, { prompt: content, voiceMode });
        let reply = res.data?.reply || "";
        if (/who.*(made|created)/i.test(content)) {
          reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
        }
        const cards = res.data?.cards || [];
        pushAssistant(reply, { cards });
        speak(reply);
      }
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
        <div className="relative">
          {topToolsOpen && (
            <div className="flex gap-4 bg-black border border-gray-700 px-2 py-1 rounded z-20 text-sm">
              <FaTrash onClick={() => setMessages([])} className="cursor-pointer" title="Clear" />
              <FaDownload className="cursor-pointer" title="Download" />
              <FaClock className="cursor-pointer" title="History" />
              <FaMicrophone className="cursor-pointer" onClick={handleMic} title="Voice to text" />
              {voiceMode
                ? <FaVolumeUp onClick={() => setVoiceMode(false)} title="Voice off" />
                : <FaVolumeMute onClick={() => setVoiceMode(true)} title="Voice on" />}
              <FaUpload onClick={() => document.getElementById("fileUpload").click()} title="Upload" />
              <FaCamera title="Screenshot" />
              <FaDesktop title="Desktop" />
              <input type="file" id="fileUpload" hidden accept="image/*" />
            </div>
          )}
          <FaPlus onClick={() => setTopToolsOpen(!topToolsOpen)} className="cursor-pointer" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 msg whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "self-end text-right ml-auto" : "self-start text-left"}`}
          >
            {msg.content ? (
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                img: (props) => <img {...props} className="rounded-lg my-2 w-full" loading="lazy" />,
                iframe: (props) => (
                  <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2">
                    <iframe {...props} allowFullScreen />
                  </div>
                )
              }}>
                {msg.content}
              </ReactMarkdown>
            ) : null}

            {msg.cards && renderCards(msg.cards)}
          </div>
        ))}
        {typing && <div className="ml-4 text-left">💬 Thinking...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* Quick style buttons */}
      <div className="px-3 pb-1">
        <div className="flex gap-2 flex-wrap">
          {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map(s => (
            <button
              key={s}
              onClick={() => handlePromptClick(s)}
              className="px-3 py-1 border border-white rounded-full text-sm hover:bg-white hover:text-black"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            inputMode="text"
            className="flex-1 p-3 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type here… try: Tesla stock, latest AI news, weather in Chicago, time in Mumbai, a YouTube query, or google: <anything>"
          />
          <button
            onClick={() => handleSend(input)}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;