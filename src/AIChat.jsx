import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [typingDots, setTypingDots] = useState(".");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setTypingDots((dots) => (dots.length >= 3 ? "." : dots + "."));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "ai", content: reply }]);

      if (voiceMode) {
        const audio = new Audio(`/speak?text=${encodeURIComponent(reply)}`);
        audio.play();
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", content: "❌ Error: Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = (msg) => {
    const hasIframe = msg.content.includes("<iframe");
    const hasImage = msg.content.includes("<img");
    const className = `max-w-xl px-4 py-2 text-sm whitespace-pre-wrap bg-transparent text-white`;

    return (
      <div className={className}>
        <ReactMarkdown
          children={msg.content}
          rehypePlugins={[rehypeRaw]}
          remarkPlugins={[remarkGfm]}
          components={{
            img: (props) => (
              <img
                {...props}
                style={{ maxHeight: "180px", borderRadius: "12px", marginTop: "10px" }}
              />
            ),
            iframe: (props) => (
              <div style={{ borderRadius: "12px", overflow: "hidden", marginTop: "10px" }}>
                <iframe
                  {...props}
                  width="100%"
                  height="200"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ),
          }}
        />
      </div>
    );
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="p-4 text-xl font-semibold">
        <span className="text-white">💬 AI Chat </span>
        <span className="text-purple-400">(Droxion)</span>
        <div className="float-right space-x-4 text-sm">
          <span onClick={() => setVoiceMode(!voiceMode)} className="cursor-pointer">
            🔊 {voiceMode ? "On" : "Off"}
          </span>
          <span onClick={() => setVideoMode(!videoMode)} className="cursor-pointer">
            🎥 {videoMode ? "On" : "Off"}
          </span>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 overflow-y-auto space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {renderContent(msg)}
          </div>
        ))}
        {loading && <div className="text-gray-500 px-4">Typing{typingDots}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 rounded bg-[#1a1a1a] text-white border border-gray-600 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="bg-white text-black font-bold px-4 py-2 rounded"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
