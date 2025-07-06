// ✅ AIChat.jsx – Full Real-Time Cards (News, Stocks, Weather, Suggestions)

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { FaPlus } from "react-icons/fa";
import Sidebar from "./Sidebar";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");

  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const speak = (text) => {
    if (!voiceMode) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    synth.cancel();
    synth.speak(utter);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/realtime", {
        prompt: input,
        user_id: userId.current
      });
      const reply = res.data.reply;
      const cards = res.data.cards || [];
      const suggestions = res.data.suggestions || [];

      const suggestionBlock =
        suggestions.length > 0
          ? `<div class='mt-2'><b>🔎 Try also:</b><br>${suggestions.map((s) => `<span class='text-blue-400 cursor-pointer underline'>${s}</span>`).join(" · ")}</div>`
          : "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
        ...cards.map((c) => ({ role: "assistant", content: c })),
        { role: "assistant", content: suggestionBlock }
      ]);
      speak(reply);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  return (
    <div className={`flex ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onNewChat={handleNewChat}
        voiceMode={voiceMode}
        setVoiceMode={setVoiceMode}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      <div className="flex flex-col flex-1 min-h-screen">
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="text-lg font-bold">Droxion</div>
          <FaPlus onClick={() => setSidebarOpen(!sidebarOpen)} className="cursor-pointer" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-2xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                img: ({ node, ...props }) => (<img {...props} alt="Preview" className="rounded-lg my-2 max-w-xs" />),
                iframe: ({ node, ...props }) => (<iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />),
                span: ({ node, ...props }) => (<span {...props} className="text-blue-400 underline cursor-pointer" />)
              }}>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-ping" /></div>}
          <div ref={chatRef} />
        </div>

        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
              placeholder="Type anything..."
            />
            <button
              onClick={handleSend}
              className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
            >➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
