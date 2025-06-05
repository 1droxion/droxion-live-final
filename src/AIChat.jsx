import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { ClipboardCopy, RefreshCcw, Heart, Sun, Moon, Download, Star } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
    const stored = localStorage.getItem("droxion_chat");
    return stored ? JSON.parse(stored) : [
      {
        role: "assistant",
        content: "👋 Welcome! I’m your Droxion AI Assistant. Ask me anything — like how to create videos, use voice, or manage styles.",
        timestamp: new Date().toLocaleTimeString(),
        favorite: false,
        origin: "system"
      }
    ];
  });
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [viewOnlyFavorites, setViewOnlyFavorites] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    localStorage.setItem("droxion_chat", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  const sendMessage = async (customMessage = null) => {
    const content = customMessage || input.trim();
    if (!content) return;

    const userMessage = { role: "user", content, timestamp: new Date().toLocaleTimeString() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { message: content });
      let reply = res?.data?.reply || "No reply.";

      if (/who (made|created) you|who's your creator/i.test(content)) {
        reply = "I was created by Dhruv Patel and powered by Droxion™.";
      }

      const assistantMessage = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
        origin: content,
        favorite: false
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      alert("❌ Chat failed. Check your backend.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied!");
  };

  const regenerate = (original) => {
    sendMessage(original);
  };

  const toggleFavorite = (i) => {
    setMessages((prev) => prev.map((m, index) => index === i ? { ...m, favorite: !m.favorite } : m));
  };

  const exportChat = () => {
    const data = messages.map(m => `${m.role === "user" ? "You" : "AI"} [${m.timestamp}]:\n${m.content}`).join("\n\n");
    const blob = new Blob([data], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "droxion-chat.txt";
    link.click();
  };

  const filteredMessages = viewOnlyFavorites
    ? messages.filter((m) => m.role === "assistant" && m.favorite)
    : messages;

  return (
    <div className={`p-4 md:p-6 text-white h-[calc(100vh-80px)] flex flex-col ${theme === "light" ? "bg-white text-black" : "bg-[#0e0e10] text-white"}`}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-purple-400">🤖 Droxion AI Chatboard</h1>
        <div className="flex gap-2">
          <button onClick={exportChat} title="Export Chat"><Download /></button>
          <button onClick={() => setViewOnlyFavorites(!viewOnlyFavorites)} title="View Favorites"><Star fill={viewOnlyFavorites ? "gold" : "none"} /></button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle Theme">
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto rounded-xl p-4 border border-gray-800 space-y-4">
        {filteredMessages.map((msg, i) => (
          <div key={i} className={`relative max-w-xl px-5 py-4 rounded-2xl shadow-md animate-fade-in ${msg.role === "user" ? "ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white" : "mr-auto bg-gradient-to-br from-purple-700 to-pink-700 text-white"}`}>
            <div className="text-sm opacity-80 mb-1">{msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}</div>
            <ReactMarkdown components={{
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                return !inline && match ? (
                  <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-black/30 px-1 py-0.5 rounded text-sm">{children}</code>
                );
              }
            }}>{msg.content}</ReactMarkdown>

            {msg.role === "assistant" && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => copyToClipboard(msg.content)} title="Copy"><ClipboardCopy size={16} /></button>
                <button onClick={() => regenerate(msg.origin)} title="Regenerate"><RefreshCcw size={16} /></button>
                <button onClick={() => toggleFavorite(i)} title={msg.favorite ? "Unsave" : "Save"}><Heart size={16} color={msg.favorite ? "red" : "white"} fill={msg.favorite ? "red" : "none"} /></button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-gray-400 italic animate-pulse">✍️ AI is typing...</div>}
      </div>

      <div className="mt-5 flex flex-col md:flex-row gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about Droxion..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-grow bg-[#1f2937] p-4 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
        />
        <button onClick={() => sendMessage()} disabled={loading}
          className={`px-8 py-3 text-lg rounded-xl font-bold transition-all ${loading ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"}`}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
