// src/pages/AIChat.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const prompt = input;
    const lower = prompt.toLowerCase();
    const userMsg = {
      role: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      let reply = "";

      if (lower.includes("who made you") || lower.includes("who created you") || lower.includes("who owns you")) {
        reply = "I was created by **Dhruv Patel** and powered by **Droxion™**.";
      }

      const movieWords = ["video", "movie", "film", "episode", "web series", "show"];
      const isVideoPrompt = movieWords.some((w) => lower.includes(w)) && lower.includes("create");

      if (isVideoPrompt) {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate`, { prompt });
        const link = res?.data?.video;
        if (link) {
          reply += `🎬 Here's your video:\n\n[▶️ Watch Video](${link})`;
        } else {
          reply += "❌ Couldn't generate a video.";
        }
      }

      if (lower.includes("image") || lower.includes("draw")) {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, { prompt });
        const url = res?.data?.image_url;
        if (url) reply += `\n\n![Generated Image](${url})`;
      }

      if (lower.includes("youtube") || lower.match(/ep\d+/i)) {
        const ytPrompt = lower.match(/ep\d+/i) ? `tmkoc ${prompt}` : prompt;
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/youtube`, { prompt: ytPrompt });
        const ytUrl = res?.data?.url;
        const title = res?.data?.title || "YouTube Video";
        if (ytUrl) {
          reply += `\n\n**${title}**\n\n[▶️ Watch on YouTube](${ytUrl})`;
        } else {
          reply += "\n❌ Couldn't find a video.";
        }
      }

      if (lower.includes("news")) {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/news`, { prompt });
        const headlines = res?.data?.headlines || [];
        if (headlines.length > 0) {
          reply += "\n\n**Latest News:**\n" + headlines.map((n) => `- [${n.title}](${n.url})`).join("\n");
        }
      }

      if (lower.includes("google") || lower.includes("search")) {
        const q = prompt.replace(/google|search/gi, "").trim();
        const link = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        reply += `\n\n[🔍 Google Search for **${q}**](${link})`;
      }

      if (!reply) {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt });
        reply = res?.data?.reply || "No reply.";
      }

      const aiMsg = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages([...updated, aiMsg]);
    } catch (err) {
      setMessages([
        ...updated,
        { role: "assistant", content: "❌ Error! Check backend/API.", timestamp: new Date().toLocaleTimeString() },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen text-white bg-[#0e0e10]">
      <h1 className="text-2xl text-center py-3 font-bold text-green-400">💬 Droxion Smart AI Chat</h1>

      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-3xl px-5 py-3 rounded-xl shadow-md ${
              msg.role === "user" ? "ml-auto bg-blue-700" : "mr-auto bg-purple-800"
            }`}
          >
            <div className="text-xs opacity-60 mb-1">
              {msg.role === "user" ? "🧍 You" : "🤖 AI"} • {msg.timestamp}
            </div>
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                a({ href, children }) {
                  if (href.includes("youtube.com/watch")) {
                    const videoId = new URL(href).searchParams.get("v");
                    return (
                      <div className="mt-2">
                        <iframe
                          width="100%"
                          height="315"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title="YouTube Video"
                          className="rounded-xl"
                          allowFullScreen
                        ></iframe>
                      </div>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                      {children}
                    </a>
                  );
                },
                img({ src }) {
                  return <img src={src} alt="" className="w-48 h-auto rounded-lg my-2" />;
                },
                code({ inline, className, children }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const code = String(children).replace(/\n$/, "");
                  return !inline && match ? (
                    <div className="relative group">
                      <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="absolute top-2 right-2 text-xs bg-black/60 px-2 py-1 rounded hidden group-hover:block"
                      >
                        <ClipboardCopy size={14} className="inline-block mr-1" />
                        Copy
                      </button>
                      <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div">
                        {code}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-black/20 px-1 py-0.5 rounded text-green-400">{children}</code>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {loading && <p className="text-center text-gray-400 italic animate-pulse">✍️ AI is typing...</p>}
      </div>

      <div className="p-4 border-t border-gray-700 flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything: video, image, YouTube, news..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-[#1f2937] p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-6 py-3 text-lg rounded-lg bg-green-600 hover:bg-green-700 font-bold"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
