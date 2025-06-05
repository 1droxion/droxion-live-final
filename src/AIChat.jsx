import React, { useState, useEffect, useRef } from "react";
import axios from "../api/axios";
import { Send, ClipboardCopy, RefreshCcw, Heart } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function Chatboard() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("droxion_chat");
    return saved ? JSON.parse(saved) : [
      {
        type: "ai",
        text: "Welcome! I’m your Droxion AI Assistant. Ask me anything — like how to create videos, use voice, or manage styles.",
        time: new Date().toLocaleTimeString(),
        origin: "system",
        favorite: false,
      }
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    localStorage.setItem("droxion_chat", JSON.stringify(messages));
  }, [messages, aiTyping]);

  const sendMessage = async (messageText) => {
    const userMsg = { type: "user", text: messageText, time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, userMsg]);
    setAiTyping(true);

    try {
      const res = await axios.post("/chat", { message: messageText });
      let reply = res.data.reply;

      if (/who (made|created) you|who's your creator/i.test(messageText)) {
        reply = "I was created by Dhruv Patel and powered by Droxion™.";
      }

      const aiMsg = {
        type: "ai",
        text: reply,
        time: new Date().toLocaleTimeString(),
        origin: messageText,
        favorite: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        { type: "ai", text: "⚠️ Something went wrong. Try again.", time: new Date().toLocaleTimeString(), favorite: false },
      ]);
    }

    setAiTyping(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setInput("");
    sendMessage(input.trim());
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied!");
  };

  const handleRegenerate = (originText) => {
    sendMessage(originText);
  };

  const toggleFavorite = (index) => {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === index ? { ...msg, favorite: !msg.favorite } : msg
      )
    );
  };

  const renderMessage = (msg, index) => (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative mb-3 p-4 rounded-xl shadow-md max-w-3xl whitespace-pre-wrap ${
        msg.type === "ai"
          ? "bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white self-start"
          : "bg-[#1e293b] text-white self-end"
      }`}
    >
      <div className="text-xs mb-1 opacity-80">
        {msg.type === "ai" ? "🤖 AI" : "🧑 You"} • {msg.time}
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
              <code className="bg-gray-800 px-1 py-0.5 rounded text-sm">{children}</code>
            );
          },
        }}
      >
        {msg.text}
      </ReactMarkdown>

      {msg.type === "ai" && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={() => handleCopy(msg.text)}
            className="p-1 bg-black/30 hover:bg-black/60 rounded"
            title="Copy"
          >
            <ClipboardCopy size={16} />
          </button>
          <button
            onClick={() => handleRegenerate(msg.origin)}
            className="p-1 bg-black/30 hover:bg-black/60 rounded"
            title="Regenerate"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            onClick={() => toggleFavorite(index)}
            className="p-1 bg-black/30 hover:bg-black/60 rounded"
            title={msg.favorite ? "Unsave" : "Save to Favorites"}
          >
            <Heart size={16} color={msg.favorite ? "red" : "white"} fill={msg.favorite ? "red" : "none"} />
          </button>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="flex flex-col h-screen p-4 bg-[#0e0e10] text-white">
      <div className="text-3xl font-bold text-center mb-4 text-purple-300">
        🤖 Droxion AI Chatboard
      </div>

      <div
        ref={chatRef}
        className="flex flex-col flex-grow overflow-y-auto space-y-2 pb-4 px-2"
      >
        {messages.map(renderMessage)}
        {aiTyping && (
          <div className="text-sm text-white/60 animate-pulse px-4 py-2">🤖 Typing...</div>
        )}
      </div>

      <div className="flex items-center mt-4 gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask me anything about Droxion..."
          className="flex-grow p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-bold transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default Chatboard;
