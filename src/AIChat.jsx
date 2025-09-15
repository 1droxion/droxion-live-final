// src/AIChat.jsx — Droxion Power Edition
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const host = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};

const isPlaceholderUrl = (u = "") => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "");
    return ["example.com", "example.org"].includes(h);
  } catch { return true; }
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const cn = (...xs) => xs.filter(Boolean).join(" ");

const copyText = async (t = "") => {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
};

const imgProxy = (url = "") => {
  if (!url) return "";
  // Use backend img proxy if available, else return original
  try {
    const u = new URL(url);
    if (u.protocol.startsWith("http")) {
      return `${API_BASE}/img?u=${encodeURIComponent(url)}`;
    }
  } catch {}
  return url;
};

/* ---------------------- UI cards ---------------------- */
const LinkCard = ({ item }) => {
  if (!item?.url || isPlaceholderUrl(item.url)) return null;
  const h = host(item.url);
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="card link-card">
      {item.image && (
        <img
          loading="lazy"
          src={imgProxy(item.image)}
          alt={item.title || h}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
      <div className="card-body">
        <div className="card-title">{item.title || h}</div>
        {item.snippet && <div className="card-snippet">{item.snippet}</div>}
        <div className="card-meta">{h}</div>
      </div>
    </a>
  );
};

const ImageCard = ({ src, alt }) => {
  if (!src) return null;
  return (
    <div className="card img-card">
      <img
        loading="lazy"
        src={imgProxy(src)}
        alt={alt || "image"}
        onError={(e) => { e.currentTarget.src = "https://source.unsplash.com/800x600/?abstract"; }}
      />
    </div>
  );
};

const YouTubeCard = ({ videoId, title }) => {
  if (!videoId) return null;
  const src = `https://www.youtube.com/embed/${videoId}`;
  return (
    <div className="card yt-card">
      <div className="yt-wrap">
        <iframe
          src={src}
          title={title || "YouTube"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      {title && <div className="card-meta">{title}</div>}
    </div>
  );
};

/* ---------------------- component ---------------------- */
export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I’m Droxion — ask me anything. Try: *news, weather, crypto, YouTube, images*." }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [preview, setPreview] = useState(null); // live cards beneath composer
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const chatRef = useRef(null);
  const composerRef = useRef(null);
  const typingRef = useRef(false); // prevent scroll fights
  const vvListenerSet = useRef(false);

  /* ----- keyboard-aware (mobile) ----- */
  useEffect(() => {
    if (vvListenerSet.current) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      document.body.style.setProperty("--vvh", `${vv.height}px`);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    vvListenerSet.current = true;
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  /* ----- fetch live suggestions (debounced) ----- */
  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); setPreview(null); return; }

    const id = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q: input.trim() } });
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 10) : []);
        setPreview(data?.preview || null); // { news:[], images:[], youtube:[], links:[] }
      } catch (e) {
        // soft fail — suggestions are optional
      }
    }, 180);

    return () => clearTimeout(id);
  }, [input]);

  /* ----- scroll to bottom AFTER a send or bot reply, not while typing ----- */
  const scrollToBottom = () => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    if (!typingRef.current) return; // only scroll when we flagged a send/reply
    scrollToBottom();
    const t = setTimeout(() => (typingRef.current = false), 250);
    return () => clearTimeout(t);
  }, [messages]);

  /* ----- send message ----- */
  const onSend = async (text) => {
    const q = (text ?? input).trim();
    if (!q || sending) return;
    setError("");
    setSending(true);
    setShowSuggestions(false);

    const userMsg = { role: "user", content: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    typingRef.current = true;

    try {
      const { data } = await axios.post(`${API_BASE}/chat`, {
        q,
        // Let backend decide: realtime/weather/news/cards/youtube/images based on prompt
      });

      // data: { answer, links[], images[], youtube[], cards{news,weather,crypto,stocks}, sources[] }
      const botParts = [];

      if (data?.answer) {
        botParts.push({ type: "markdown", value: data.answer });
      }

      // Cards: news/weather/crypto/stocks
      if (data?.cards?.news?.length) {
        botParts.push({ type: "links", value: data.cards.news });
      }
      if (data?.cards?.weather) {
        botParts.push({ type: "weather", value: data.cards.weather });
      }
      if (data?.cards?.crypto?.length) {
        botParts.push({ type: "links", value: data.cards.crypto });
      }
      if (data?.cards?.stocks?.length) {
        botParts.push({ type: "links", value: data.cards.stocks });
      }

      if (Array.isArray(data?.images) && data.images.length) {
        botParts.push({ type: "images", value: data.images });
      }

      if (Array.isArray(data?.youtube) && data.youtube.length) {
        // support items as {id,title} or {url}
        const items = data.youtube.map((y) => {
          if (y.id) return y;
          if (y.url) {
            try {
              const u = new URL(y.url);
              const id = u.searchParams.get("v");
              return id ? { id, title: y.title } : null;
            } catch { return null; }
          }
          return null;
        }).filter(Boolean);
        if (items.length) botParts.push({ type: "youtube", value: items });
      }

      if (Array.isArray(data?.links) && data.links.length) {
        botParts.push({ type: "links", value: data.links });
      }

      setMessages((m) => [...m, { role: "assistant", content: botParts }]);
      typingRef.current = true;
    } catch (e) {
      setError(e?.response?.data?.error || "Something went wrong. Try again.");
    } finally {
      setSending(false);
      setPreview(null);
    }
  };

  /* ----- render message ----- */
  const renderMsg = (msg, idx) => {
    if (msg.role === "user") {
      return (
        <div className="bubble bubble-user" key={idx}>
          <div className="bubble-content">{msg.content}</div>
        </div>
      );
    }

    // assistant: either string markdown or structured parts array
    if (typeof msg.content === "string") {
      return (
        <div className="bubble bubble-bot" key={idx}>
          <MessageHeader text={msg.content} />
          <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      );
    }

    const parts = Array.isArray(msg.content) ? msg.content : [];
    return (
      <div className="bubble bubble-bot" key={idx}>
        {parts.map((p, i) => {
          if (p.type === "markdown") {
            return (
              <div className="md" key={i}>
                <MessageHeader text={p.value} />
                <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                  {p.value}
                </ReactMarkdown>
              </div>
            );
          }
          if (p.type === "links") {
            const list = (p.value || []).filter((x) => x?.url && !isPlaceholderUrl(x.url));
            if (!list.length) return null;
            return (
              <div className="grid links" key={i}>
                {list.slice(0, 8).map((item, k) => (
                  <LinkCard key={k} item={item} />
                ))}
              </div>
            );
          }
          if (p.type === "images") {
            const imgs = (p.value || []).map((x) => typeof x === "string" ? { url: x } : x);
            if (!imgs.length) return null;
            return (
              <div className="grid images" key={i}>
                {imgs.slice(0, 6).map((im, k) => (
                  <ImageCard key={k} src={im.url} alt={im.alt || "image"} />
                ))}
              </div>
            );
          }
          if (p.type === "youtube") {
            const vids = p.value || [];
            if (!vids.length) return null;
            return (
              <div className="grid youtube" key={i}>
                {vids.slice(0, 3).map((v, k) => (
                  <YouTubeCard key={k} videoId={v.id} title={v.title} />
                ))}
              </div>
            );
          }
          if (p.type === "weather" && p.value) {
            const w = p.value;
            return (
              <div className="card weather-card" key={i}>
                <div className="card-title">Weather</div>
                <div className="card-snippet">{w.location || ""}</div>
                <div className="weather-row">
                  <div className="weather-big">{w.temp_now ?? "--"}°</div>
                  <div className="weather-minor">
                    H {w.high ?? "--"}° · L {w.low ?? "--"}° · {w.condition || ""}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  /* ----- composer actions ----- */
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const onSuggestionClick = (s) => {
    setInput(s);
    setShowSuggestions(false);
    // don’t send immediately; let user hit enter
  };

  /* ----- memo UI bits ----- */
  const hasPreview = !!preview && (preview.news?.length || preview.links?.length || preview.images?.length || preview.youtube?.length);

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">Droxion</div>
        <div className="sub">AI • Realtime • Images • YouTube</div>
      </header>

      <main className="chat" ref={chatRef}>
        {messages.map(renderMsg)}
        {sending && (
          <div className="bubble bubble-bot">
            <div className="typing">Thinking…</div>
          </div>
        )}
        {error && (
          <div className="bubble bubble-bot error">{error}</div>
        )}
        <div style={{ height: 12 }} />
      </main>

      <footer className="composer" ref={composerRef}>
        <div className="input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask anything… (news, weather, crypto, images, YouTube)"
            rows={1}
          />
          <button
            className="send"
            disabled={sending || !input.trim()}
            onClick={() => onSend()}
            aria-label="Send"
            title="Send"
          >
            Send
          </button>
        </div>

        {/* scrollable suggestions below input; never blocks keyboard */}
        {showSuggestions && (suggestions?.length > 0 || hasPreview) && (
          <div className="suggestion-panel">
            {suggestions?.length > 0 && (
              <div className="suggestions scroller">
                {suggestions.map((s, i) => (
                  <button key={i} className="suggestion" onClick={() => onSuggestionClick(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Live preview cards under suggestions (non-blinky) */}
            {hasPreview && (
              <div className="preview">
                {preview?.news?.length > 0 && (
                  <div className="grid links">
                    {preview.news.slice(0, 6).map((n, i) => <LinkCard key={`pn${i}`} item={n} />)}
                  </div>
                )}
                {preview?.images?.length > 0 && (
                  <div className="grid images">
                    {preview.images.slice(0, 6).map((im, i) => <ImageCard key={`pi${i}`} src={im.url || im} alt={im.alt || "image"} />)}
                  </div>
                )}
                {preview?.youtube?.length > 0 && (
                  <div className="grid youtube">
                    {preview.youtube.slice(0, 3).map((v, i) => <YouTubeCard key={`py${i}`} videoId={v.id} title={v.title} />)}
                  </div>
                )}
                {preview?.links?.length > 0 && (
                  <div className="grid links">
                    {preview.links.slice(0, 6).map((l, i) => <LinkCard key={`pl${i}`} item={l} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}

/* ---------------------- tiny header w/ copy ---------------------- */
function MessageHeader({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="msg-head">
      <button
        className="copy-btn"
        onClick={async () => {
          const ok = await copyText(text);
          setCopied(ok);
          setTimeout(() => setCopied(false), 1000);
        }}
        title="Copy"
        aria-label="Copy"
      >
        <FaRegCopy />
      </button>
      {copied && <span className="copied">Copied</span>}
    </div>
  );
}