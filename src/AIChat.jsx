import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, RefreshCcw, Heart } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
    const stored = localStorage.getItem("droxion_chat");
    return stored
      ? JSON.parse(stored)
      : [
          {
            role: "assistant",
            content:
              "👋 Welcome! I’m your Droxion AI Assistant. Ask me anything — like how to create videos, use voice, or manage styles.",
            timestamp: new Date().toLocaleTimeString(),
            favorite: false,
            origin: "system",
          },
        ];
  });

  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
    localStorage.setItem("droxion_chat", JSON.stringify(messages));
  }, [messages]);

  const sendMessage = async (customMessage = null) => {
    const content = customMessage || input.trim();
    if (!content) return;

    const userMessage = {
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/chat`,
        { message: content }
      );

      let reply = res?.data?.reply || "No reply.";
      if (/who (made|created) you|who's your creator/i.test(content)) {
        reply = "I was created by Dhruv Patel and powered by Droxion™.";
      }

      const assistantMessage = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
        favorite: false,
        origin: content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("❌ Chat Error:", err.message || err);
      alert("❌ Chat system failed. Check backend or network.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (index) => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === index ? { ...msg, favorite: !msg.favorite } : msg
      )
    );
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied!");
  };

  const regenerate = (originalMessage) => {
    sendMessage(originalMessage);
  };

  return (
    <div className="p-4 md:p-6 text-white h-[calc(100vh-80px)] flex flex-col">
      <h1 className="text-3xl font-bold text-center text-purple-400 mb-6 animate-fade-in">
        🤖 Droxion AI Chatboard
      </h1>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto bg-[#111827] rounded-xl p-6 shadow-2xl border border-gray-800 space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`relative max-w-xl px-5 py-4 rounded-2xl shadow-md animate-fade-in ${
              msg.role === "user"
                ? "ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                : "mr-auto bg-gradient-to-br from-purple-700 to-pink-700 text-white"
            }`}
          >
            <div className="text-sm opacity-80 mb-1">
              {msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}
            </div>

            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      children={String(children).replace(/\n$/, "")}
                      {...props}
                    />
                  ) : (
                    <code className="bg-black/30 px-1 py-0.5 rounded text-sm">{children}</code>
                  );
                },
              }}
            >
              {msg.content}
            </ReactMarkdown>

            {msg.role === "assistant" && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="p-1 bg-black/30 hover:bg-black/60 rounded"
                  title="Copy"
                >
                  <ClipboardCopy size={16} />
                </button>
                <button
                  onClick={() => regenerate(msg.origin)}
                  className="p-1 bg-black/30 hover:bg-black/60 rounded"
                  title="Regenerate"
                >
                  <RefreshCcw size={16} />
                </button>
                <button
                  onClick={() => toggleFavorite(i)}
                  className="p-1 bg-black/30 hover:bg-black/60 rounded"
                  title={msg.favorite ? "Unsave" : "Save to Favorites"}
                >
                  <Heart
                    size={16}
                    color={msg.favorite ? "red" : "white"}
                    fill={msg.favorite ? "red" : "none"}
                  />
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="text-gray-400 italic animate-pulse">✍️ AI is typing...</div>
        )}
      </div>

      <div className="mt-5 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about Droxion..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-grow bg-[#1f2937] p-4 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading}
          className={`px-8 py-3 text-lg rounded-xl font-bold transition-all ${
            loading ? "bg-gray-500 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
