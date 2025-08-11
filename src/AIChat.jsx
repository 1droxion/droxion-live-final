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

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  const userId = useRef("");

  // ----- helpers -----
  const pushAssistant = (content, extra = {}) =>
    setMessages(prev => [...prev, { role: "assistant", content, ...extra }]);
  const pushUser = (content) =>
    setMessages(prev => [...prev, { role: "user", content }]);

  const getYouTubeId = (rawUrlOrQuery) => {
    // supports youtu.be, watch?v=, shorts/, embed/
    try {
      const txt = rawUrlOrQuery.trim();
      // ID directly
      if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;

      // URL parse
      const u = new URL(txt.includes("http") ? txt : "https://youtube.com/results?search_query=" + encodeURIComponent(txt));
      const host = u.hostname.replace("www.","");
      if (host.includes("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const p = u.pathname.split("/").filter(Boolean);
        // /shorts/VIDEOID or /embed/VIDEOID
        if (p[0] === "shorts" || p[0] === "embed") return p[1];
        // /watch
      } else if (host.includes("youtu.be")) {
        const p = u.pathname.split("/").filter(Boolean);
        if (p[0]) return p[0];
      }
    } catch {}
    // last fallback: extract 11-char token
    const m = rawUrlOrQuery.match(/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  const speak = (text) => {
    if (!voiceMode || !text || !synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    synth.cancel();
    synth.speak(u);
  };

  const logAction = async (action, inputText) => {
    try {
      await axios.post(`${API_BASE}/track`, {
        user_id: userId.current,
        action,
        input: inputText,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Tracking failed", e);
    }
  };

  // ----- effects -----
  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // iOS zoom + responsive embeds
  useEffect(() => {
    // enforce 16px font to prevent iOS zoom
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

    // ensure viewport meta exists & correct (prevents zoom)
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "viewport");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // ----- cards renderers from /chat smart previews -----
  const CardNews = ({ item }) => (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="block border border-gray-700 rounded-lg p-3 hover:bg-gray-900 transition"
    >
      {item.image && (
        <img src={item.image} alt="" className="w-full rounded mb-2" loading="lazy" />
      )}
      <div className="text-sm font-semibold">{item.title}</div>
      <div className="text-xs text-gray-400 mt-1">
        {item.source} {item.time ? "• " + item.time : ""}
      </div>
    </a>
  );

  const CardWeather = ({ data }) => (
    <div className="border border-gray-700 rounded-lg p-3">
      <div className="text-sm font-semibold mb-1">Weather in {data.city}</div>
      <div className="text-lg">{data.temp} — {data.condition}</div>
      {data.extra && (
        <div className="text-xs text-gray-400 mt-1">{data.extra}</div>
      )}
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
      <div className="text-sm font-semibold mb-2">📈 {data.symbol} {data.exchange ? `(${data.exchange})` : ""}</div>
      {data.price && <div className="text-lg mb-1">{data.price}{data.change ? ` (${data.change})` : ""}</div>}
      <div className="embed-responsive embed-16by9 rounded overflow-hidden">
        {/* Google Finance preview */}
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
          // default raw html or text
          if (c.html) {
            return <div key={idx} className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: c.html }} />;
          }
          if (c.text) {
            return <div key={idx} className="text-sm">{c.text}</div>;
          }
          return null;
        })}
      </div>
    );
  };

  // ----- main send handler -----
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

      // GOOGLE-style trigger: let backend return smart cards (news, stocks, weather, etc.)
      if (lower.startsWith("google:") || lower.startsWith("search:")) {
        const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
        const reply = res.data?.reply || "";
        const cards = res.data?.cards || [];
        pushAssistant(reply || "Here are the results:", { cards });
        speak(reply);
        handled = true;
      }

      // YOUTUBE: if the user asks for videos or includes a YT link/keyword
      if (!handled) {
        const ytKW = ["youtube", "yt ", "video", "watch", "trailer", "music", "song", "shorts", "youtu.be", "youtube.com"];
        if (ytKW.some(k => lower.includes(k))) {
          // If user pasted a URL, use it; else call your search endpoint
          const directId = getYouTubeId(content);
          if (directId) {
            pushAssistant(
              "",
              {
                cards: [{ type: "youtube", url: `https://www.youtube.com/watch?v=${directId}` }]
              }
            );
          } else {
            const res = await axios.post(`${API_BASE}/search-youtube`, { prompt: content });
            const url = res.data?.url;
            if (url) {
              pushAssistant("", { cards: [{ type: "youtube", url }] });
            } else {
              // fallback ask model
              const r = await axios.post(`${API_BASE}/chat`, { prompt: content });
              const reply = r.data?.reply || "I couldn't find a video for that.";
              pushAssistant(reply);
              speak(reply);
            }
          }
          handled = true;
        }
      }

      // IMAGE generation (uses your Replit key in backend)
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

      // STOCK quick trigger "stock:TSLA" or "stock: TSLA:NDAQ"
      if (!handled && lower.startsWith("stock:")) {
        const raw = content.slice(6).trim().toUpperCase(); // TSLA or TSLA:NDAQ
        const [symbol, exchange] = raw.split(":");
        pushAssistant("", { cards: [{ type: "finance", symbol: symbol || raw, exchange: exchange || undefined }] });
        handled = true;
      }

      // WEATHER quick "weather in City"
      if (!handled && lower.startsWith("weather in ")) {
        const city = content.slice(11).trim();
        const w = await axios.post(`${API_BASE}/realtime/weather`, { city });
        pushAssistant("", { cards: [{ type: "weather", city: w.data?.city || city, temp: w.data?.temp, condition: w.data?.condition, extra: w.data?.extra }] });
        handled = true;
      }

      // TIME quick "time in City"
      if (!handled && lower.includes("time in ")) {
        const city = content.split(/time in /i)[1]?.trim();
        if (city) {
          const t = await axios.post(`${API_BASE}/realtime/time`, { city });
          pushAssistant("", { cards: [{ type: "time", city: t.data?.city || city, time: t.data?.time, date: t.data?.date }] });
          handled = true;
        }
      }

      // NEWS quick mention
      if (!handled && lower.includes("news")) {
        const n = await axios.post(`${API_BASE}/realtime/news`, {});
        const headlines = (n.data?.headlines || []).map(h => ({ type: "news", title: h.title || h, url: h.url, source: h.source, image: h.image, time: h.time }));
        if (headlines.length) {
          pushAssistant("Top headlines:", { cards: headlines });
        } else {
          pushAssistant("Couldn't fetch news right now.");
        }
        handled = true;
      }

      // DEFAULT chat (also returns cards in your backend)
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

  // ----- UI -----
  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* TOP BAR */}
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

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 msg whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "self-end text-right ml-auto" : "self-start text-left"}`}
          >
            {/* text/html via markdown */}
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

            {/* smart preview cards */}
            {msg.cards && renderCards(msg.cards)}
          </div>
        ))}
        {typing && <div className="ml-4 text-left">💬 Thinking...</div>}
        <div ref={chatRef} />
      </div>

      {/* STYLE BUTTONS */}
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

      {/* INPUT */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            inputMode="text"
            className="flex-1 p-3 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type your message… (try: google: latest AI news, weather in Chicago, stock:TSLA, a YouTube query, etc.)"
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