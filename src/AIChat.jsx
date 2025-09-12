// src/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { FaRegCopy } from "react-icons/fa";

const API_BASE = "https://droxion-backend.onrender.com";

/* ---------------------- helpers ---------------------- */
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isPlaceholderUrl = (u="") => { try { return /(^|\.)example\.(com|org)$/i.test(new URL(u).hostname); } catch { return false; } };

const firstImageUrl = (c) =>
  c?.image_url || c?.image || c?.thumbnail || c?.thumb || c?.thumb_url || c?.ogImage || null;

// CORS-safe proxy for ANY external image (prevents hotlink blocks)
// (images.weserv.nl just fetches the image server-side and serves it with correct headers)
const IMAGE_PROXY = "https://images.weserv.nl/?output=webp&w=1200&url=";
const prox = (u) => {
  if (!u) return null;
  try {
    const x = new URL(u);
    if (x.protocol === "data:" || x.protocol === "blob:") return u;
    if (x.hostname.endsWith("images.weserv.nl")) return u;
    return IMAGE_PROXY + encodeURIComponent(u);
  } catch {
    return u;
  }
};

const linkScreenshot = (url) =>
  url ? `${IMAGE_PROXY}${encodeURIComponent(`https://image.thum.io/get/width/1200/noanimate/${encodeURIComponent(url)}`)}` : null;

const unsplash = (q) => (q ? `https://source.unsplash.com/800x500/?${encodeURIComponent(q)}` : null);

// on any broken image -> swap once to Unsplash so you never see a broken icon
const ensureVisible = (el, title="image") => {
  if (!el || el.dataset.fallback === "1") return;
  el.dataset.fallback = "1";
  const fb = unsplash(title);
  if (fb) el.src = fb;
};

// YouTube id extractor
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

const bestPreview = (card) => {
  const d = firstImageUrl(card);
  if (d) return prox(d);
  if (card.url) {
    const shot = linkScreenshot(card.url);
    if (shot) return shot;
  }
  return prox(unsplash(card.title || card.source || "preview"));
};

/* ---------------------- component ---------------------- */
function AIChat() {
  const [messages, setMessages] = useState([]); // {role, content?, cards?, followups?}
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [inputFocused, setInputFocused] = useState(false); // show suggestions only when focused

  const inputRef = useRef(null);
  const suggestTimer = useRef(null);

  /* meta + CSS: no keyboard jump, no flicker */
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "viewport"); document.head.appendChild(meta); }
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, interactive-widget=overlays-content"
    );

    const style = document.createElement("style");
    style.innerHTML = `
      :root { --glass: rgba(255,255,255,0.06); --glass-2: rgba(255,255,255,0.10); --border: rgba(255,255,255,0.12); }
      html, body { height: 100%; background:#000; color:#fff; }
      body { overscroll-behavior-y: none; } /* reduce iOS bounce blink */
      * { -webkit-tap-highlight-color: transparent; }
      textarea, input { font-size: 16px !important; } /* prevent iOS zoom */
      img, iframe, video { max-width: 100% !important; height: auto !important; }
      .embed-responsive { position: relative; width: 100%; }
      .embed-16by9 { padding-top: 56.25%; }
      .embed-responsive iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
      .glass { background: var(--glass); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .glass-2 { background: var(--glass-2); border:1px solid var(--border); backdrop-filter: blur(10px); }
      .pill { font-size:11px; padding:2px 8px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:999px; }
      .layer { will-change: transform; transform: translateZ(0); } /* stop iOS repaint flicker */
      /* Suggestions = their own scroll. Never block input */
      .suggestions-panel { overflow-y:auto; -webkit-overflow-scrolling:touch; touch-action:pan-y; max-height:40vh; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  /* autoresize textarea without page shifts */
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    const h = Math.min(el.scrollHeight, 160);
    if (el.style.height !== `${h}px`) el.style.height = `${h}px`;
  }, [input]);

  /* debounced suggestions: only when focused & ≥2 chars */
  useEffect(() => {
    const q = (input || "").trim();
    clearTimeout(suggestTimer.current);
    if (!inputFocused || q.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q } });
        setSuggestions((data?.suggestions || []).slice(0, 8));
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [input, inputFocused]);

  /* utilities */
  const copyMessage = async (i) => {
    try {
      const msg = messages[i]; if (!msg) return;
      await navigator.clipboard.writeText(msg.content || "");
      setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1200);
    } catch {}
  };

  const fetchFollowups = async (q) => {
    try {
      const { data } = await axios.get(`${API_BASE}/suggest`, { params: { q, mode: "followup" } });
      const arr = (data?.suggestions || []).filter(Boolean);
      return (arr.length ? arr : ["Explain more", "Pros & cons", "Give steps", "Show sources"]).slice(0, 4);
    } catch {
      return ["Explain more", "Pros & cons", "Give steps", "Show sources"];
    }
  };

  const pushWithFollowups = async (md, cards, q) => {
    setMessages((p) => [...p, { role: "assistant", content: md, cards }]);
    const followups = await fetchFollowups(q);
    setMessages((p) => {
      const last = p[p.length - 1];
      if (!last || last.role !== "assistant") return p;
      const copy = [...p];
      copy[copy.length - 1] = { ...last, followups };
      return copy;
    });
  };

  /* ---------------------- send ---------------------- */
  const handleSend = async (text = input) => {
    const content = (text || "").trim(); if (!content) return;
    setTyping(true);
    setMessages((p) => [...p, { role: "user", content }]);
    setInput("");
    setSuggestions([]); // close panel after send
    const lower = content.toLowerCase();

    try {
      // google:
      if (lower.startsWith("google:")) {
        const q = content.replace(/^google:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/realtime`, { query: q });
          let cards = Array.isArray(r.data?.cards) ? r.data.cards : [];
          cards = cards
            .filter((c) => !(c?.url && isPlaceholderUrl(c.url)))
            .map((c) => {
              // proxy any image-like fields so they always render
              const u = firstImageUrl(c);
              return u ? { ...c, image: prox(u) } : c;
            });
          const md = r.data?.markdown || r.data?.summary || `Results for **${q}**`;
          await pushWithFollowups(md, cards, content);
        } catch { await pushWithFollowups("Google preview is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      // search:
      if (lower.startsWith("search:")) {
        const q = content.replace(/^search:\s*/i, "");
        try {
          const r = await axios.post(`${API_BASE}/search`, { prompt: q });
          const results = (r.data?.results || [])
            .filter((it) => !isPlaceholderUrl(it.url))
            .map((it) => ({
              type:"web",
              title: it.title,
              url: it.url,
              image: prox(it.image),
              source: it.source,
              snippet: it.snippet
            }));
          await pushWithFollowups(results.length ? `### Sources for **${q}**` : `No sources found for **${q}**.`, results, content);
        } catch { await pushWithFollowups("Search is unavailable right now.", [], content); }
        setTyping(false); return;
      }

      // YouTube:
      const ytKW = ["youtube","yt ","youtu.be","youtube.com","video","trailer","shorts","song","watch "];
      if (ytKW.some((k) => lower.includes(k)) || lower.startsWith("youtube:")) {
        const directId = getYouTubeId(content);
        if (directId) {
          await pushWithFollowups("", [{ type:"youtube", url:`https://www.youtube.com/watch?v=${directId}` }], content);
        } else {
          try {
            const res = await axios.post(`${API_BASE}/search-youtube`, { prompt: content });
            const url = res.data?.url;
            await pushWithFollowups(url ? "" : "I couldn't find a video for that.", url ? [{ type:"youtube", url }] : [], content);
          } catch { await pushWithFollowups("YouTube search is unavailable right now.", [], content); }
        }
        setTyping(false); return;
      }

      // Images trigger
      const imageTrigger = /(^image[s]?:|show (me )?images|show (me )?image|wallpaper|artwork|\bimage(s)?\b)/i.test(lower);
      if (imageTrigger) {
        const q = content.replace(/^image[s]?:\s*/i, "") || content;
        try {
          const rr = await axios.post(`${API_BASE}/realtime`, { query: q, intent: "images" });
          let cards = Array.isArray(rr.data?.cards) ? rr.data.cards.filter(Boolean) : [];
          cards = cards.filter((c) => !(c?.url && isPlaceholderUrl(c.url)));
          if (!cards.length && Array.isArray(rr.data?.images) && rr.data.images.length) {
            cards = [{ type:"gallery", images: rr.data.images }];
          }
          if (!cards.length) cards = [{ type:"gallery", images: [unsplash(q), unsplash(q+" photo")].filter(Boolean) }];
          await pushWithFollowups(`### Images for **${q}**`, cards, content);
        } catch {
          await pushWithFollowups(`### Images for **${q}**`, [{ type:"gallery", images:[unsplash(q)] }], content);
        }
        setTyping(false); return;
      }

      // default chat
      const res = await axios.post(`${API_BASE}/chat`, { prompt: content });
      const md = res.data?.reply || res.data?.text || "";
      let cards = res.data?.cards || [];
      cards = cards
        .filter((c) => !(c?.url && isPlaceholderUrl(c.url)))
        .map((c) => {
          const u = firstImageUrl(c);
          return u ? { ...c, image: prox(u) } : c;
        });
      await pushWithFollowups(md, cards, content);
    } catch {
      await pushWithFollowups("⚠️ Error or connection failed.", [], content);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  /* ---------------------- render ---------------------- */
  const SmartCard = ({ card }) => {
    if (!card) return null;

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

    // Weather (simple)
    if (card.type === "weather") {
      return (
        <div className="glass rounded-lg p-3">
          <div className="flex items-center gap-3">
            {card.icon && (
              <img
                src={prox(card.icon)}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e)=>ensureVisible(e.currentTarget, card.title)}
              />
            )}
            <div>
              <div className="text-sm font-semibold">{card.title || "Weather"}</div>
              <div className="text-xs text-gray-400">{card.subtitle || card.meta}</div>
            </div>
          </div>
        </div>
      );
    }

    // Gallery
    if (card.type === "gallery" && Array.isArray(card.images)) {
      const urls = card.images
        .map((it) => (typeof it === "string" ? it : (it.url || it.thumbnail || it.thumb)))
        .filter(Boolean)
        .map(prox);
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
              crossOrigin="anonymous"
              onError={(e)=>ensureVisible(e.currentTarget, "image")}
            />
          ))}
        </div>
      );
    }

    // Single image
    if (card.type === "image") {
      const u = prox(firstImageUrl(card) || card.url);
      if (!u) return null;
      return (
        <img
          src={u}
          alt={card.alt || ""}
          className="w-full rounded-lg glass"
          loading="lazy"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={(e)=>ensureVisible(e.currentTarget, card.title)}
        />
      );
    }

    // Generic: web/news/wiki/stock
    if (["web","link","wiki","news","stock"].includes(card.type)) {
      if (card.url && isPlaceholderUrl(card.url)) return null;
      const preview = bestPreview(card);
      return (
        <a href={card.url} target="_blank" rel="noreferrer" className="block glass rounded-lg p-3 hover:bg-white/10 transition">
          {preview && (
            <img
              src={preview}
              alt=""
              className="w-full rounded mb-2"
              loading="lazy"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={(e)=>ensureVisible(e.currentTarget, card.title)}
            />
          )}
          {card.title && <div className="text-sm font-semibold leading-snug">{card.title}</div>}
          <div className="text-xs text-gray-400 mt-1">{card.source || (card.url ? host(card.url) : "")}{card.time ? ` • ${card.time}` : ""}</div>
          {card.snippet && <div className="text-xs text-gray-300 mt-1">{card.snippet}</div>}
          {card.description && <div className="text-xs text-gray-300 mt-1">{card.description}</div>}
          {card.meta && <div className="text-[11px] text-gray-400 mt-1">{card.meta}</div>}
        </a>
      );
    }

    if (card.html) return <div className="prose prose-invert max-w-none glass rounded-lg p-3" dangerouslySetInnerHTML={{ __html: card.html }} />;
    if (card.text) return <div className="glass rounded-lg p-3 text-sm">{card.text}</div>;
    return null;
  };

  const renderCards = (cards) =>
    !cards?.length ? null : <div className="grid grid-cols-1 gap-3">{cards.map((c,i)=><SmartCard key={i} card={c} />)}</div>;

  /* ---------------------- UI ---------------------- */
  return (
    <div className="min-h-screen flex flex-col" style={{ minHeight: "100svh" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-black/60 layer">
        <div className="max-w-4xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className="font-bold tracking-tight text-lg">Droxion</div>
          <div className="text-xs text-gray-400">• Lite</div>
        </div>
      </header>

      {/* (Removed the “Hey Droxion” pinned bar as requested) */}

      {/* Main */}
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
                      onClick={() => copyMessage(i)}
                      className="text-xs text-gray-400 hover:text-white inline-flex items-center gap-1"
                      title="Copy"
                    >
                      <FaRegCopy />
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>

                {msg.content && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      img: (props) => (
                        <img
                          {...props}
                          src={prox(props.src)}
                          className="rounded-lg my-2 w-full glass"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e)=>ensureVisible(e.currentTarget, "image")}
                        />
                      ),
                      iframe: (props) => (
                        <div className="embed-responsive embed-16by9 rounded overflow-hidden my-2 glass">
                          <iframe {...props} allowFullScreen />
                        </div>
                      ),
                      a: ({ node, ...props }) => (
                        <a {...props} className="underline decoration-gray-600 hover:text-gray-200" target="_blank" rel="noreferrer" />
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}

                {/* Pills */}
                {!isUser && hasCards && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.cards
                      .filter((c) => ["web","news","link","wiki","stock"].includes(c.type) && !(c.url && isPlaceholderUrl(c.url)))
                      .slice(0, 5)
                      .map((c, idx) => (
                        <a key={idx} href={c.url} target="_blank" rel="noreferrer" className="pill hover:bg-white hover:text-black transition">
                          {c.source || (c.url ? host(c.url) : "source")}
                        </a>
                      ))}
                  </div>
                )}

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
              <div className="h-4 w-24 bg-white/10 mb-2 rounded" />
              <div className="h-3 w-full bg-white/10 mb-1 rounded" />
              <div className="h-3 w-4/5 bg-white/10 mb-1 rounded" />
              <div className="h-3 w-3/5 bg-white/10 rounded" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacer so input never covers last message */}
      <div style={{ height: 140 }} />

      {/* Suggestions: only when focused & ≥2 chars; own scroll; close button */}
      {inputFocused && suggestions.length > 0 && (
        <div className="fixed inset-x-0 bottom-[88px] z-40 layer">
          <div className="max-w-4xl mx-auto px-3">
            <div className="glass rounded-xl p-2 suggestions-panel">
              <div className="flex justify-between items-center px-1 pb-2">
                <div className="text-xs text-gray-400">Suggestions</div>
                <button
                  onClick={() => setSuggestions([])}
                  className="text-xs px-2 py-1 rounded border border-white/12 hover:bg-white hover:text-black transition"
                >
                  Close
                </button>
              </div>
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
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur layer"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <div className="max-w-4xl mx-auto px-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/5 backdrop-blur px-3 py-2 focus-within:border-white/25 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)} // small delay so clicks register
                rows={1}
                inputMode="text"
                placeholder=""
                className="w-full bg-transparent outline-none resize-none leading-[1.6]"
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

          {/* Quick chips */}
          <div className="flex gap-2 flex-wrap mt-2">
            {["Cinematic","Anime","Futuristic","Fantasy","Realistic"].map((s) => (
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