import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/**
 * DROXION – Grok-style Chat UI (mobile-first)
 * Fixes:
 *  1) Suggestion list is scrollable (doesn’t cover input; works on iOS)
 *  2) Live cards render inline: weather/news/crypto/stocks/images/YouTube/web links
 *  3) Input placeholder is empty (no “Try: google: ...”)
 *
 * Notes:
 *  - Expects backend `/chat` to sometimes return {cards: [...]}
 *  - If backend returns `images`, `news`, `weather`, `youtube`, etc., we render them.
 *  - If only markdown/text comes, we render as text.
 *  - YouTube auto-embeds if a youtube URL/id exists in any message or card.
 */

const API_BASE = "https://droxion-backend.onrender.com";

const SUGGESTIONS = [
  "google: latest Ahmedabad weather",
  "google: India stock market today",
  "google: BTC price",
  "google: latest news India",
  "google: Reliance share price",
  "table: Top 5 facts about Ahmedabad",
  "images: Lamborghini Huracan",
  "youtube: India news live",
];

function useAutoStickToBottom(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Smooth-ish keep-to-bottom without fighting user scroll.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
    // Always ensure first paint after render is at bottom on mobile
    const t = setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
    return () => clearTimeout(t);
  }, [dep]);
  return ref;
}

function YouTubeEmbed({ urlOrId }) {
  const id = useMemo(() => {
    if (!urlOrId) return null;
    // try to extract id
    try {
      if (/^[A-Za-z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
      const u = new URL(urlOrId);
      if (u.hostname.includes("youtube.com")) {
        const v = u.searchParams.get("v");
        if (v) return v;
        const parts = u.pathname.split("/");
        const idx = parts.findIndex((p) => p === "embed");
        if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
      }
      if (u.hostname.includes("youtu.be")) {
        const seg = u.pathname.replace("/", "");
        if (seg) return seg;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [urlOrId]);

  if (!id) return null;
  return (
    <div className="yt-container" style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #2a2a2a" }}>
      <iframe
        title="YouTube"
        width="100%"
        height="220"
        src={`https://www.youtube.com/embed/${id}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        style={{ display: "block" }}
      />
    </div>
  );
}

function WeatherCard({ data }) {
  // expected: {location, temp_c, temp_f, condition, icon, hourly:[{time,temp_c}], provider, url}
  if (!data) return null;
  return (
    <div className="card" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {data.icon ? <img src={data.icon} alt="" style={{ width: 36, height: 36 }} /> : null}
        <div style={{ fontWeight: 600 }}>{data.location || "Weather"}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>
          {data.temp_c != null ? `${Math.round(data.temp_c)}°C` : data.temp_f != null ? `${Math.round(data.temp_f)}°F` : ""}
        </div>
        <div style={{ opacity: 0.8 }}>{data.condition}</div>
      </div>
      {Array.isArray(data.hourly) && data.hourly.length ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
          {data.hourly.slice(0, 12).map((h, i) => (
            <div key={i} style={{ minWidth: 64, padding: 8, borderRadius: 8, border: "1px solid #2a2a2a", textAlign: "center" }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{h.time}</div>
              <div style={{ fontWeight: 600 }}>{Math.round(h.temp_c ?? h.temp_f) }°</div>
            </div>
          ))}
        </div>
      ) : null}
      {data.url ? (
        <a href={data.url} target="_blank" rel="noreferrer" style={linkStyle}>
          Source: {data.provider || "Weather"}
        </a>
      ) : null}
    </div>
  );
}

function NewsCard({ items, title = "Latest news" }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div className="card" style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {items.slice(0, 6).map((n, i) => (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" style={newsItemStyle}>
            {n.thumbnail ? <img src={n.thumbnail} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} /> : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.title}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.source} {n.time ? "• " + n.time : ""}
              </div>
              {n.summary ? <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>{n.summary}</div> : null}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ImagesGrid({ images, title = "Images" }) {
  if (!Array.isArray(images) || !images.length) return null;
  return (
    <div className="card" style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {images.slice(0, 12).map((im, i) => (
          <a key={i} href={im.url || im.link || im.contextLink} target="_blank" rel="noreferrer" style={{ borderRadius: 8, overflow: "hidden" }}>
            <img
              src={im.thumb || im.thumbnail || im.url}
              alt={im.title || ""}
              style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
              loading="lazy"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

function WebLinks({ links, title = "Top results" }) {
  if (!Array.isArray(links) || !links.length) return null;
  return (
    <div className="card" style={cardStyle}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {links.slice(0, 5).map((w, i) => (
          <a key={i} href={w.url} target="_blank" rel="noreferrer" style={webItemStyle}>
            <div style={{ fontWeight: 600 }}>{w.title || w.site || w.url}</div>
            {w.snippet ? <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{w.snippet}</div> : null}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{w.site || w.url}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function TextBubble({ role, children }) {
  const mine = role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        background: mine ? "#1F6FEB" : "#0f0f10",
        border: "1px solid #2a2a2a",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 12,
        maxWidth: "92%",
        whiteSpace: "pre-wrap",
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}

export default function AIChat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi Dhruv — what should we check first?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCenter, setShowCenter] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const scrollRef = useAutoStickToBottom(messages.length + (loading ? 1 : 0));

  const filteredSuggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return SUGGESTIONS;
    return SUGGESTIONS.filter((s) => s.toLowerCase().includes(q));
  }, [input]);

  // Close center mode after first user message
  useEffect(() => {
    if (messages.some((m) => m.role === "user")) setShowCenter(false);
  }, [messages]);

  async function sendMessage(text) {
    if (!text.trim()) return;
    const userMsg = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { prompt: text.trim() });
      // Expected flexible shape:
      // { reply: "text", cards?: [ {type, data}, ... ], images?:[], news?:[], weather?:{}, youtube?:{}, web?:[] }
      const data = res.data || {};
      const assistantBlocks = [];

      if (data.reply) assistantBlocks.push({ role: "assistant", content: data.reply });

      // Normalize possible direct fields into cards
      const cards = Array.isArray(data.cards) ? [...data.cards] : [];
      if (data.weather) cards.push({ type: "weather", data: data.weather });
      if (Array.isArray(data.news)) cards.push({ type: "news", data: data.news });
      if (Array.isArray(data.images)) cards.push({ type: "images", data: data.images });
      if (Array.isArray(data.web)) cards.push({ type: "web", data: data.web });
      if (data.youtube) cards.push({ type: "youtube", data: data.youtube });
      if (data.crypto) cards.push({ type: "crypto", data: data.crypto });
      if (data.stock) cards.push({ type: "stock", data: data.stock });

      if (cards.length) assistantBlocks.push({ role: "assistant", content: "", cards });

      setMessages((m) => [...m, ...assistantBlocks]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Search is unavailable right now." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderAssistant(msg, idx) {
    if (msg.cards && Array.isArray(msg.cards)) {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          {msg.cards.map((c, i) => {
            const t = c.type?.toLowerCase();
            if (t === "weather") return <WeatherCard key={i} data={c.data} />;
            if (t === "news") return <NewsCard key={i} items={c.data} />;
            if (t === "images") return <ImagesGrid key={i} images={c.data} />;
            if (t === "youtube") return <YouTubeEmbed key={i} urlOrId={c.data?.id || c.data?.url} />;
            if (t === "web") return <WebLinks key={i} links={c.data} />;
            if (t === "crypto" || t === "stock") {
              // simple ticker card
              const d = c.data || {};
              return (
                <div key={i} className="card" style={cardStyle}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.symbol || d.ticker || "Ticker"}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{d.price ?? "--"}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{d.change ? `${d.change} (${d.changePct})` : ""}</div>
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" style={linkStyle}>
                      Source
                    </a>
                  ) : null}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }

    // also auto-embed YT link in plain reply
    const yt = extractYouTubeFromText(msg.content || "");
    return (
      <>
        {msg.content ? <TextBubble role="assistant">{msg.content}</TextBubble> : null}
        {yt ? <YouTubeEmbed urlOrId={yt} /> : null}
      </>
    );
  }

  function extractYouTubeFromText(t) {
    if (!t) return null;
    const m =
      t.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/) ||
      t.match(/https?:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  return (
    <div className="droxion-page" style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>Droxion</div>
        <div style={{ opacity: 0.6, fontSize: 12 }}>• Lite</div>
      </div>

      {/* Centered first view */}
      {showCenter ? (
        <div style={centerBoxStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>What do you want to check?</div>
          <div style={{ opacity: 0.8, marginBottom: 16 }}>Try “google: latest Ahmedabad weather”</div>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scrollRef} style={chatScroll}>
        <div style={{ display: "grid", gap: 10 }}>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <TextBubble role="user" key={i}>
                {m.content}
              </TextBubble>
            ) : (
              <div key={i}>{renderAssistant(m, i)}</div>
            )
          )}
          {loading ? <TextBubble role="assistant">Thinking…</TextBubble> : null}
          <div style={{ height: 12 }} />
        </div>
      </div>

      {/* Suggestions Panel (scrollable) */}
      {suggestOpen && filteredSuggestions.length ? (
        <div style={suggestionPanelStyle} onMouseDown={(e) => e.preventDefault()}>
          <div style={{ maxHeight: "40vh", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingRight: 4 }}>
            {filteredSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSuggestOpen(false);
                  sendMessage(s);
                }}
                style={suggestionItemStyle}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom Input Bar */}
      <div style={inputBarStyle}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}
        >
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
            placeholder="" // empty placeholder as requested
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck
            style={inputStyle}
          />
          <button type="submit" disabled={!input.trim() || loading} style={sendBtnStyle} aria-label="Send">
            ▶
          </button>
        </form>

        {/* style prompt buttons (unchanged) */}
        <div style={chipsRowStyle}>
          {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => sendMessage(`style:${c}`)}
              style={chipStyle}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */

const pageStyle = {
  background: "#0b0b0c",
  color: "#fff",
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 16px",
  background: "rgba(11,11,12,0.9)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid #161616",
};

const centerBoxStyle = {
  textAlign: "center",
  padding: "16px 18px 0",
  color: "#dcdcdc",
};

const chatScroll = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "10px 12px 94px", // space for input bar
};

const inputBarStyle = {
  position: "sticky",
  bottom: 0,
  zIndex: 30,
  padding: "8px 10px 12px",
  background: "rgba(11,11,12,0.96)",
  backdropFilter: "blur(10px)",
  borderTop: "1px solid #161616",
};

const inputStyle = {
  flex: 1,
  background: "#0f0f10",
  color: "#fff",
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: "14px 14px",
  fontSize: 16,
  outline: "none",
};

const sendBtnStyle = {
  height: 44,
  minWidth: 44,
  borderRadius: 14,
  border: "1px solid #2a2a2a",
  background: "#ffffff",
  color: "#000",
  fontWeight: 800,
};

const chipsRowStyle = {
  display: "flex",
  gap: 10,
  marginTop: 8,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

const chipStyle = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#121214",
  border: "1px solid #2a2a2a",
  color: "#fff",
  whiteSpace: "nowrap",
};

const suggestionPanelStyle = {
  position: "fixed",
  left: 10,
  right: 10,
  bottom: 74, // sits above input bar
  zIndex: 40,
  background: "#0f0f10",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 8,
  boxShadow: "0 6px 30px rgba(0,0,0,0.5)",
};

const suggestionItemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  background: "transparent",
  border: "1px solid #1a1a1b",
  color: "#fff",
  borderRadius: 10,
  marginBottom: 8,
};

const cardStyle = {
  background: "#0f0f10",
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 12,
};

const linkStyle = {
  display: "inline-block",
  marginTop: 8,
  fontSize: 12,
  color: "#9ecbff",
};

const newsItemStyle = {
  display: "grid",
  gridTemplateColumns: "64px 1fr",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #1f1f20",
  color: "#fff",
  textDecoration: "none",
};

const webItemStyle = {
  display: "block",
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #1f1f20",
  color: "#fff",
  textDecoration: "none",
};