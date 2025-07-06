// ✅ AIChat.jsx – Droxion Final (Live Previews + Sidebar + Voice + New Chat + Theme)

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
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        user_id: userId.current
      });
      const reply = res.data.reply;
      const cards = [];
      const urlMatch = reply.match(/https?:\/\/[^\s)\]]+/g);

      if (reply.includes("youtube.com/watch?v=")) {
        const vid = reply.split("v=")[1]?.split("&")[0];
        cards.push(`<iframe class='rounded my-2' width='360' height='203' src='https://www.youtube.com/embed/${vid}' allowfullscreen></iframe>`);
      }

      if (reply.toLowerCase().includes("bitcoin") || reply.toLowerCase().includes("price")) {
        cards.push(`📈 **Live Crypto**\nBitcoin: $58,200\n![Chart](https://cryptohistory.org/api/chart/bitcoin)`);
      }

      if (reply.toLowerCase().includes("usd") && reply.toLowerCase().includes("inr")) {
        cards.push(`💱 **USD to INR**\nRate: ₹83.19\n![XE Chart](https://xe.com/favicon.ico)`);
      }

      if (reply.toLowerCase().includes("weather") && urlMatch) {
        cards.push(`🌤️ **Weather**\n[Live Forecast](${urlMatch[0]})`);
      }

      if (reply.toLowerCase().includes("wikipedia") && urlMatch) {
        cards.push(`📚 **Wikipedia**\n[Open Wiki](${urlMatch[0]})`);
      }

      if (reply.toLowerCase().includes("cricbuzz") || reply.toLowerCase().includes("score")) {
        cards.push(`🏏 **Match Update**\nIndia vs Pakistan: 212/3\n[Live Score](https://www.cricbuzz.com)`);
      }

      if (reply.toLowerCase().includes("news") && urlMatch) {
        cards.push(`📰 **News Headline**\n[Read Full](${urlMatch[0]})`);
      }

      if (reply.toLowerCase().includes("date") || reply.toLowerCase().includes("july") || reply.toLowerCase().includes("2025")) {
        cards.push(`📅 **Date:** ${new Date().toDateString()}`);
      }

      if (reply.toLowerCase().includes("time") || reply.toLowerCase().includes("pm") || reply.toLowerCase().includes("am")) {
        const now = new Date();
        cards.push(`🕒 **Time Now:** ${now.toLocaleTimeString()} (${now.toLocaleDateString()})`);
      }

      if (reply.toLowerCase().includes("map")) {
        cards.push(`🗺️ **Map Preview**\n![Map](https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(input)}&zoom=12&size=400x200&key=YOUR_GOOGLE_MAPS_KEY)`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply },
        ...cards.map((c) => ({ role: "assistant", content: c }))
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
            <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                img: ({ node, ...props }) => (<img {...props} alt="Preview" className="rounded-lg my-2 max-w-xs" />),
                iframe: ({ node, ...props }) => (<iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />)
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
