// src/AIChat.jsx — Droxion chat (Chat + YouTube + Image)
// - Env: VITE_BACKEND_URL (fallback: https://droxion-backend.onrender.com)
// - Routes used:
//    POST /chat             -> { reply }
//    GET  /search-youtube?q -> { items: [{id,title,channelTitle,thumbnail,url}] }
//    POST /generate-image   -> { image_url }

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com";

// Small helpers
const trim = (s = "") => (s || "").trim();
const isYouTubeIntent = (s) => /^yt\b|^youtube\s*:/.test(s.toLowerCase());
const isImageIntent = (s) => /^img\b|^image\s*:/.test(s.toLowerCase());

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      type: "text",
      content:
        "Hey Dhruv 👋\n\nAsk me anything.\n\n- **image:** `image: a futuristic red sports car, cinematic 4K`\n- **youtube:** `youtube: 2025 AI news`\n- or just chat normally.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  // autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const push = (m) => setMessages((prev) => [...prev, m]);

  const send = async (forceKind = null) => {
    const raw = trim(input);
    if (!raw || busy) return;

    setBusy(true);
    setInput("");

    // show user bubble
    push({ role: "user", type: "text", content: raw });

    try {
      // detect intent
      const kind =
        forceKind ||
        (isYouTubeIntent(raw) ? "youtube" : isImageIntent(raw) ? "image" : "chat");

      if (kind === "youtube") {
        const q = raw.replace(/^yt\b|^youtube\s*:/i, "").trim() || raw;
        const { data } = await axios.get(`${API_BASE}/search-youtube`, {
          params: { q },
        });
        const items = Array.isArray(data?.items) ? data.items : [];
        push({
          role: "assistant",
          type: "youtube",
          content: items,
        });
      } else if (kind === "image") {
        // allow styles inline, e.g. "image: a car | style: Cinematic 4K"
        const parts = raw.replace(/^img\b|^image\s*:/i, "").split("|");
        const prompt = trim(parts[0] || "");
        const styleLine = parts.find((p) => /style\s*:/i.test(p)) || "";
        const style = trim(styleLine.split(":")[1] || "Cinematic 4K");
        const styledPrompt = style ? `${prompt}, in ${style} style` : prompt;

        const { data } = await axios.post(`${API_BASE}/generate-image`, {
          prompt: styledPrompt,
        });
        if (!data?.image_url) {
          push({
            role: "assistant",
            type: "text",
            content:
              "Hmm, I couldn't get an image URL back. Double-check the backend `/generate-image` route.",
          });
        } else {
          push({
            role: "assistant",
            type: "image",
            content: { url: data.image_url, style, prompt },
          });
        }
      } else {
        // normal chat
        const { data } = await axios.post(`${API_BASE}/chat`, {
          message: raw,
        });
        const reply = data?.reply || data?.message || JSON.stringify(data);
        push({ role: "assistant", type: "text", content: String(reply || "") });
      }
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Unknown error";
      push({
        role: "assistant",
        type: "text",
        content: `⚠️ Error: ${detail}`,
      });
    } finally {
      setBusy(false);
    }
  };

  const quickChat = (text) => {
    setInput(text);
    // send immediately
    setTimeout(() => send(), 0);
  };

  const quickImage = () => {
    setInput("image: a futuristic red sports car at night | style: Cinematic 4K");
    setTimeout(() => send("image"), 0);
  };

  const quickYouTube = () => {
    setInput("youtube: latest AI breakthroughs 2025");
    setTimeout(() => send("youtube"), 0);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#eaeaea] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-black/40 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-extrabold text-lg">Droxion — Chat</div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20"
              onClick={quickYouTube}
              disabled={busy}
              title="youtube: query"
            >
              YouTube
            </button>
            <button
              className="px-3 py-1 text-sm rounded bg-white/10 hover:bg-white/20"
              onClick={quickImage}
              disabled={busy}
              title="image: prompt"
            >
              Create Image
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1">
        <div
          ref={listRef}
          className="max-w-4xl mx-auto px-4 py-6 space-y-4 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 140px)" }}
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {busy && (
            <div className="flex gap-2 items-center text-sm text-white/70">
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse delay-150" />
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse delay-300" />
              <span className="ml-2">Thinking…</span>
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="sticky bottom-0 z-10 border-t border-white/10 bg-black/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message… (try: image: ultra-realistic red supercar | style: Cinematic 4K)"
              className="flex-1 px-4 py-3 rounded bg-[#111] border border-white/10 outline-none focus:border-white/30"
            />
            <button
              type="submit"
              disabled={busy || !trim(input)}
              className={`px-4 py-3 rounded font-semibold ${
                busy || !trim(input)
                  ? "bg-white/10 text-white/50"
                  : "bg-white text-black hover:opacity-90"
              }`}
            >
              Send
            </button>
          </form>
          <div className="mt-2 text-xs text-white/50">
            Tips: start with <code>youtube:</code> or <code>image:</code> to
            trigger tools.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- renderer ---------- */

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";

  if (msg.type === "image") {
    const { url, style, prompt } = msg.content || {};
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] rounded-2xl p-3 ${
            isUser ? "bg-white text-black" : "bg-white/5 border border-white/10"
          }`}
        >
          {!isUser && (
            <div className="text-xs text-white/60 mb-1">
              Generated Image {style ? `• ${style}` : ""}
            </div>
          )}
          <img
            src={url}
            alt={prompt || "AI image"}
            className="rounded-lg border border-white/10 max-w-full"
          />
          {prompt && (
            <div className="mt-2 text-xs opacity-70">Prompt: {prompt}</div>
          )}
        </div>
      </div>
    );
  }

  if (msg.type === "youtube") {
    const items = Array.isArray(msg.content) ? msg.content : [];
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`w-full max-w-[85%] rounded-2xl p-3 ${
            isUser ? "bg-white text-black" : "bg-white/5 border border-white/10"
          }`}
        >
          {!isUser && (
            <div className="text-xs text-white/60 mb-2">
              YouTube results ({items.length})
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {items.slice(0, 6).map((v, idx) => (
              <YouTubeCard key={idx} v={v} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // default text
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl p-3 whitespace-pre-wrap prose prose-invert ${
          isUser ? "bg-white text-black" : "bg-white/5 border border-white/10"
        }`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {String(msg.content || "")}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function YouTubeCard({ v }) {
  const vid = v?.id;
  const url = v?.url || (vid ? `https://www.youtube.com/watch?v=${vid}` : "");
  const thumb = v?.thumbnail;
  const title = v?.title || "YouTube video";
  const ch = v?.channelTitle || "";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition"
    >
      {thumb ? (
        <img src={thumb} alt={title} className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video bg-white/10" />
      )}
      <div className="p-2">
        <div className="text-sm font-semibold line-clamp-2">{title}</div>
        <div className="text-xs opacity-60 mt-1">{ch}</div>
      </div>
    </a>
  );
}