// ✅ Droxion AIChat.jsx - Final Fixed Version (Black & White Theme)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const bottomRef = useRef(null);

  const speak = (text) => {
    if (!voiceMode) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  };

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userInput = input;
    setMessages((prev) => [...prev, { role: "user", content: userInput }]);
    setInput("");
    setIsLoading(true);

    try {
      let res = await axios.post("/chat", { prompt: userInput });
      let reply = res.data.reply;

      // YouTube search
      if (videoMode) {
        const yt = await axios.post("/search-youtube", { prompt: userInput });
        if (yt.data.url) {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }, { role: "youtube", url: yt.data.url }]);
          setIsLoading(false);
          return;
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", content: "Something went wrong." }]);
    }
    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/20">
        <div className="text-xl font-bold">
          <span className="text-white">AI </span><span className="text-purple-400">Chat</span>
          <span className="text-purple-300 ml-1">(Droxion)</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setVideoMode(!videoMode)} className="text-white text-lg">🎥</button>
          <button onClick={() => setVoiceMode(!voiceMode)} className="text-white text-lg">
            {voiceMode ? "🔊" : "🔇"}
          </button>
          <button onClick={() => window.location.reload()} className="text-white text-lg">➕</button>
        </div>
      </div>

      {/* Chat Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            {msg.role === "youtube" ? (
              <iframe
                width="100%"
                height="300"
                src={msg.url.replace("watch?v=", "embed/")}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
              ></iframe>
            ) : (
              <div className={`inline-block px-4 py-2 rounded-lg ${msg.role === "user" ? "bg-white text-black" : msg.role === "error" ? "bg-red-600" : "bg-gray-800 text-white"}`}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className="text-sm text-white">Typing...</div>}
        <div ref={bottomRef}></div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type or say anything..."
          rows={1}
          className="w-full bg-black text-white border border-white/30 rounded-md px-3 py-2 focus:outline-none"
        />
      </div>
    </div>
  );
}
