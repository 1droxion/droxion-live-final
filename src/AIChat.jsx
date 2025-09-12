// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

// If a card has only a URL and no image, use a small preview screenshot so the user sees something visual.
const linkScreenshot = (url) =>
  url ? `https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(url)}` : null;

function AIChat() {
  const [messages, setMessages] = useState([]); // [{role, content?, cards?, followups?}]
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [vvh, setVvh] = useState(
    (typeof window !== "undefined" && window.visualViewport?.height) || (typeof window !== "undefined" && window.innerHeight) || 700
  ); // visual viewport height (for keyboard-aware sizing)

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const userId = useRef("");
  const suggestTimer = useRef(null);

  // Helpers
  const pushAssistant = (content, extra = {}) =>
    setMessages((prev) => [...prev, { role: "assistant", content, ...extra }]);
  const pushUser = (content) =>
    setMessages((prev) => [...prev, { role: "user", content }]);

  const logAction = async (action, inputText) => {
    try {
      await axios.post(`${API_BASE}/track`, {
        user_id: userId.current,
        action,
        input: inputText,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };

  // YouTube id helper
  const getYouTubeId = (raw) => {
    try {
      const txt = raw.trim();
      if (/^[A-Za-z0-9_-]{11}$/.test(txt)) return txt;
      const hasHttp = /^https?:\/\//i.test(txt);
      const u = new URL(hasHttp ? txt : `https://youtube.com/results?search_query=${encodeURIComponent(txt)}`);
      const h = u.hostname.replace("www.", "");
      if (h.includes("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        const p = u.pathname.split("/").filter(Boolean);
        if (p[0] === "shorts" || p[0] === "embed") return p[1];
      }
      if (h.includes("youtu.be")) {
        const p = u.pathname.split("/").filter(Boolean);
        if (p[0]) return p[0];
      }
    } catch {}
    const m = raw.match(/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  };

  // Effects
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

  // global styles
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html, body { height: 100%; overscroll-behavior-y: contain; touch-action: pan-y; }
      * { -webkit-tap-highlight-color: transparent; }
      textarea, input { font-size: 16px !important; }
      img, iframe, video { max-width: 100% !important; height: auto !important; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position: absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%);
                 background-size:400% 100%; animation: shimmer 1.4s ease infinite; border-radius: 8px; }
      @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      .glass { background: var(--glass); border: 1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border: 1px solid var(--border); backdrop-filter: blur(10px); }
      textarea { min-height: 40px; line-height: 1.6; }
      .pill { font-size: 11px; padding: 2px 8px; border: 1px solid rgba(255,255,255,.12);
              background: rgba(255,255,255,.06); border-radius: 999px; }
      /* suggestions */
      .suggestions-wrap { pointer-events: none; }
      .suggestions-panel {
        pointer-events: auto;
        overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y;
        overscroll-behavior: contain;
      }
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

  // keyboard-aware size (iOS)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setVvh(vv.height);
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Hide suggestions on ESC or page scroll
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setSuggestions([]); };
    const onScroll = () => setSuggestions([]);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onScroll); };
  }, []);

  // autoresize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // suggestions (debounced)
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(suggestTimer.current);
    if (!q) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setSuggestions((data?.suggestions || []).slice(0, 8));
      } catch {}
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [input]);

  // ---- Cards ----
  const SmartCard = ({ card }) => {
    if (!card) return null;

    const primaryImg =
      card.image_url || card.image || card.thumbnail || card.thumb || card.thumb_url || card.ogImage;

    // YouTube
    if (card.type === "youtube") {
      const vid = getYouTubeId(card.url || "");
      if (!vid) return null;
      return (
        <div className="embed-responsive embed-16by9 rounded overflow-hidden glass">
          <iframe
            src={`https://www.youtube.com/embed/${vid}`}
            title={card.title || "YouTube"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      );
    }

    // Weather (live)
    if (card.type === "weather") {
      return (
        <div className="glass rounded-lg p-3">
          <div className="flex items-center gap-3">
            {card.icon && <img src={card.icon} alt="" width={48} height={48} referrerPolicy="no-referrer" />}
            <div>
              <div className="text-sm font-semibold leading-snug">{card.title || "Weather"}</div>
              <div className="text-xs text-gray-400">{card.subtitle || card.meta}</div>
              {card.description && <div className="text-xs text-gray-300 mt-1">{card.description}</div>}
            </div>
          </div>
          {Array.isArray(card.hourly) && card.hourly.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {card.hourly.slice(0, 8).map((h, i) => (
                <div key={i} className="rounded glass-2 p-2">
                  <div className="text-[11px] text-gray-400">{h.time}</div>
                  <div className="text-sm font-medium">{h.temp}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Email
    if (card.type === "email") {
      return (
        <div className="glass rounded-lg p-3">
          {card.title && <div className="text-sm font-semibold leading-snug">{card.title}</div>}
          {card.subtitle && <div className="text-xs text-gray-400 mt-1">{card.subtitle}</div>}
          {card.description && <div className="text-xs text-gray-300 mt-1">{card.description}</div>}
          {card.meta && <div className="text-[11px] text-gray-400 mt-1">{card.meta}</div>}
        </div>
      );
    }

    // Gallery — strings or {url,thumbnail}
    if (card.type === "gallery" && Array.isArray(card.images)) {
      const urls = card.images
        .map((it) => (typeof it === "string" ? it : (it.url || it.thumbnail || it.thumb)))
        .filter(Boolean);
      if (!urls.length) return null;
      return (
        <div className="grid grid-cols-2 gap-2">
          {urls.slice(0, 10).map((u, i) => (
            <img
              key={i}
              src={u}
              alt=""
              className="w-full rounded-lg glass"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ))}
        </div>
      );
    }

    // Image-only
    if (card.type === "image" && (primaryImg || card.url)) {
      return (
        <img
          src={primaryImg || card.url}
          alt={card.alt || ""}
          className="w-full rounded-lg glass"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      );
    }

    // Generic link/news/wiki/stock — with screenshot fallback
    if (["web", "link", "wiki", "news", "stock", "weather"].includes(card.type)) {
      const preview = primaryImg || linkScreenshot(card.url);
      return (
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          className="block glass rounded-lg p-3 hover:bg-white/10 transition"
        >
          {preview && (
            <img
              src={preview}
              alt=""
              className="w-full rounded mb-2"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          {card.title && <div className="text-sm font-semibold leading-snug">{card.title}</div>}
          <div className="text-xs text-gray-400 mt-1">
            {card.source || host(card.url)}{card.time ? ` • ${card.time}` : ""}
          </div>
          {card.snippet && <div className="text-xs text-gray-300 mt-1">{card.snippet}</div>}
          {card.description && <div className="text-xs text-gray-300 mt-1">{card.description}</div>}
          {card.meta && <div className="text-[11px] text-gray-400 mt-1">{card.meta}</div>}
        </a>
      );
    }

    if (card.html) {
      return (
        <div
          className="prose prose-invert max-w-none glass rounded-lg p-3"
          dangerouslySetInnerHTML={{ __html: card.html }}
        />
      );
    }

    if (card.text) return <div className="glass rounded-lg p-3 text-sm">{card.text}</div>;
    return null;
  };

  const renderCards = (cards) =>
    !cards?.length ? null : (
      <div className="grid grid-cols-1 gap-3">
        {cards.map((c, idx) => <SmartCard key={idx} card={c} />)}
      </div>
    );

  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1200);
    } catch {}
  };

  // Followups
  const fetchFollowups = async (query) => {
    try {
      const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q: query, mode: "followup" } });
      const arr = (data?.suggestions || []).filter(Boolean);
      return (arr.length ? arr : ["Explain more", "Pros & cons", "Give steps", "Show sources"]).slice(0, 4);
    } catch {
      return ["Explain more", "Pros & cons", "Give steps", "Show sources"];
    }
  };

  const pushWithFollowups = async (md, cards, query) => {
    setMessages((prev) => [...prev, { role: "assistant", content: md, cards }]);
    const followups = await fetchFollowups(query);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      const patched = [...prev];
      patched[patched.length - 1] = { ...last, followups };
      return patched;
    });
  };

  // Send
  const handleSend = async (textToSend = input) => {
    const content = textToSend.trim(); if (!content) return;
    setTyping(true); pushUser(content); setInput(""); setSuggestions([]); logAction("message", content);
    const lower = content.toLowerCase();

    try {
      // google:
      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: q });
          const cards = Array.isArray(r.data?.cards) ? r.data.cards : [];
          const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;
          await pushWithFollowups(md, cards, content);
        } catch {
          pushAssistant("Google preview is unavailable right now.");
        }
        setTyping(false); return;
      }

      // search:
      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/search`, { prompt: q });
          const results = (r.data?.results || []).map((it) => ({
            type: "web", title: it.title, url: it.url, image: it.image, source: it.source, snippet: it.snippet,
          }));
          await pushWithFollowups(results.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, results, content);
        } catch {
          pushAssistant("Search is unavailable right now.");
        }
        setTyping(false); return;
      }

      // YouTube
      const ytKW = ["youtube", "yt ", "youtu.be", "youtube.com", "video", "trailer", "shorts", "song", "watch "];
      if (ytKW.some((k) => lower.includes(k)) || lower.startsWith("youtube:")) {
        const directId = getYouTubeId(content);
        if (directId) {
          pushAssistant("", { cards: [{ type: "youtube", url: `https://www.youtube.com/watch?v=${directId}` }] });
        } else {
          try {
            const res = await axios.post(`${API_BASE}/search-youtube`, { prompt: content });
            const url = res.data?.url;
            pushAssistant(url ? "" : "I couldn't find a video for that.", { cards: url ? [{ type: "youtube", url }] : [] });
          } catch {
            pushAssistant("YouTube search is unavailable right now.");
          }
        }
        setTyping(false); return;
      }

      // Images
      const imageTrigger =
        /^(image:|images:|show (me )?images|show (me )?image|wallpaper|artwork)/i.test(lower) ||
        lower.includes(" google image") || lower.includes(" images ");
      if (imageTrigger) {
        const q = content.replace(/^image[s]?:\s*/i, "") || content;
        try {
          const rr = await axios.post(`${API_BASE}/realtime`, { query: q, intent: "images" });
          let cards = Array.isArray(rr.data?.cards) ? rr.data.cards.filter(Boolean) : [];
          if (!cards.length && Array.isArray(rr.data?.images) && rr.data.images.length) {
            cards = [{ type: "gallery", images: rr.data.images }];
          }
          if (!cards.length) {
            const page = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
            cards = [{ type: "web", title: `Google Images – ${q}`, url: page, source: "google.com", snippet: "Open to view high-res images." }];
          }
          await pushWithFollowups(`### Images for **${q}**`, cards, content);
        } catch {
          const page = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
          await pushWithFollowups(`### Images for **${q}**`, [
            { type: "web", title: `Google Images – ${q}`, url: page, source: "google.com", snippet: "Open to view high-res images." }
          ], content);
        }
        setTyping(false); return;
      }

      // Default chat
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
      const md = res.data?.reply || res.data?.text || "";
      const cards = res.data?.cards || [];
      await pushWithFollowups(md, cards, content);
    } catch (err) {
      console.error(err);
      pushAssistant("⚠️ Error or connection failed.");
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ---------- UI ----------
  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Top Bar (tools removed per request) */}
      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur bg-black/60">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
        </div>
      </header>

      {/* Messages */}
      <div className="max-w-4xl mx-auto w-full px-3 py-4">
        <div className="space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const hasCards = !!msg.cards?.length;

            return (
              <div key={i} className={`rounded-xl p-4 ${isUser ? "glass-2" : "glass"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wider text-gray-400">{isUser ? "You" : "Droxion"}</div>
                  {!isUser && msg.content && (
                    <button
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(msg.content || "");
                          setCopiedIdx(i);
                          setTimeout(() => setCopiedIdx(null), 1200);
                        } catch {}
                      }}
                      className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                      title="Copy"
                    >
                      <FaRegCopy /> {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>

                {msg.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      img: (props) => (
                        <img
                          {...props}
                          className="rounded-lg my-2 w-full glass"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      ),
                      iframe: (props) => (
                        <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass">
                          <iframe {...props} allowFullScreen />
                        </div>
                      ),
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          className="underline decoration-gray-600 hover:text-gray-200"
                          target="_blank"
                          rel="noreferrer"
                        />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : null}

                {/* Pills */}
                {!isUser && msg.cards?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.cards
                      .filter((c) => ["web", "news", "link", "wiki", "stock", "weather"].includes(c.type))
                      .slice(0, 5)
                      .map((c, idx) => (
                        <a
                          key={idx}
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="pill hover:bg-white hover:text-black transition"
                        >
                          {c.source || (c.url ? host(c.url) : "source")}
                        </a>
                      ))}
                  </div>
                ) : null}

                {hasCards && <div className="mt-3">{renderCards(msg.cards)}</div>}

                {/* Follow-ups */}
                {!isUser && Array.isArray(msg.followups) && msg.followups.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {msg.followups.map((f, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(f)}
                        className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition"
                      >
                        {f}
                      </button>
                    ))}
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

      {/* Spacer */}
      <div style={{ height: "140px" }} />

      {/* Suggestions — keyboard aware height, scrollable */}
      {suggestions.length > 0 && (
        <div
          className="fixed inset-x-0 z-35 suggestions-wrap"
          style={{
            bottom: "calc(72px + max(env(safe-area-inset-bottom), 12px))"
          }}
        >
          <div className="max-w-4xl mx-auto px-3">
            <div
              className="glass rounded-xl p-2 suggestions-panel"
              style={{
                backdropFilter: "blur(10px)",
                maxHeight: Math.min(Math.floor(vvh * 0.44), 360) + "px"
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full text-left text-sm border border-white/10 rounded-md px-3 py-2 hover:bg-white/10 transition mb-2 last:mb-0"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2 focus-within:border-white/25 transition">
              {/* placeholder intentionally empty */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                onBlur={() => setSuggestions([])}
                rows={1}
                inputMode="text"
                placeholder=""
                className="w-full bg-transparent outline-none resize-none leading-[1.6] placeholder-white/30"
                aria-label="Type your message"
              />
            </div>
            <button
              onClick={() => handleSend(input)}
              className="shrink-0 h-10 px-4 rounded-2xl bg-white text-black font-semibold hover:bg-gray-200 active:scale-[0.99] transition"
              title="Send"
            >
              ➤
            </button>
          </div>

          {/* Quick style buttons */}
          <div className="flex gap-2 flex-wrap mt-2">
            {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((s) => (
              <button
                key={s}
                onClick={() => handleSend(`steps to do ${s.toLowerCase()} project`)}
                className="px-3 py-1 rounded-full text-sm border border-white/12 bg-white/5 hover:bg-white hover:text-black transition"
              >
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