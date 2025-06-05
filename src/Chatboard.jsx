import React, { useState, useEffect, useRef } from "react";
import axios from "../api/axios";
import { Send, ClipboardCopy } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function Chatboard() {
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Welcome! I’m your Droxion AI Assistant. Ask me anything — like how to create videos, use voice, or manage styles.",
      time: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { type: "user", text: input, time: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setAiTyping(true);

    try {
      const res = await axios.post("/chat", { message: input });
      let reply = res.data.reply;

      if (/who (made|created) you|who's your creator/i.test(input)) {
        reply = "I was created by Dhruv Patel and powered by Droxion™.";
      }

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: reply,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        { type: "ai", text: "⚠️ Something went wrong. Try again.", time: new Date().toLocaleTimeString() },
      ]);
    }

    setLoading(false);
    setAiTyping(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied!");
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
        <button
          onClick={() => handleCopy(msg.text)}
          className="absolute top-2 right-2 p-1 bg-black/30 hover:bg-black/50 rounded"
        >
          <ClipboardCopy size={16} />
        </button>
      )}
    </motion.div>
  );

  return (
    <div className="flex justify-center items-center h-screen bg-[#0e0e10] text-white px-4">
      <div className="w-full max-w-4xl h-full flex flex-col">
        <div className="text-3xl font-bold text-center mb-4 text-purple-300">
          🤖 Droxion AI Chatboard
        </div>

        <div
          ref={chatRef}
          className="flex flex-col flex-grow overflow-y-auto space-y-3 px-4 py-4 bg-[#111827] rounded-xl shadow-lg"
        >
          {messages.map(renderMessage)}

          {aiTyping && (
            <div className="text-sm text-white/60 animate-pulse px-4 py-2">
              🤖 Typing...
            </div>
          )}
        </div>

        <div className="flex items-center mt-4 gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything about Droxion..."
            className="flex-grow p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
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
    </div>
  );
}

export default Chatboard;
