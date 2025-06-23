fix that but dont change anthing else ok // ✅ AIChat.jsx with world data support + dashboard link + credit
// Built by Dhruv Patel | Droxion AI

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone,
  FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");
  const memory = useRef({});

  const styles = [
    "Cinematic 4K", "Anime", "Realistic", "Pixel Art",
    "Fantasy Landscape", "3D Render", "Cyberpunk", "Watercolor"
  ];

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
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

  const handleSend = async (customInput) => {
    const message = customInput || input;
    if (!message.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    memory.current.last = message;
    setInput("");
    setTyping(true);
    const lower = message.toLowerCase();

    // Detect simple chart: Jan 100, Feb 200
    if (/chart|plot|graph/.test(lower) && /:\s*([\w\s]+\s+\d+)/.test(message)) {
      try {
        const data = message.split(":")[1].split(",").map(pair => {
          const [label, value] = pair.trim().split(/ +/);
          return { name: label, value: Number(value) };
        });
        setMessages(prev => [...prev, { role: "assistant", content: "<chart>" }]);
        setMessages(prev => [...prev, { role: "chart", content: data }]);
        setTyping(false);
        return;
      } catch (err) {
        console.error("chart parse error", err);
      }
    }

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: message,
        user_id: userId.current,
        voiceMode,
        videoMode
      });
      const reply = res.data.reply;

      let formatted = reply;
      if (/```/.test(reply)) {
        formatted = reply;
      } else if (/box|highlight/.test(lower)) {
        formatted = `\\`\\`\\`\n${reply}\n\\`\\`\\``;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: formatted }]);
      speak(reply);
    } catch {
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
        <div className="flex items-center space-x-3">
          <a href="https://droxion-backend.onrender.com/dashboard?token=droxion2025" target="_blank" rel="noopener noreferrer" className="text-xs underline text-blue-400">Dashboard</a>
          <FaPlus onClick={() => setTopToolsOpen(!topToolsOpen)} className="cursor-pointer text-white" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
            {msg.role === "chart" ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={msg.content}>
                  <XAxis dataKey="name" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip wrapperClassName="text-black" />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
            )}
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-[ping_2s_ease-in-out_infinite]" /></div>}
        <div ref={chatRef} />
      </div>

      <div className="flex flex-wrap justify-center px-2 py-2 gap-2 border-t border-gray-700">
        {styles.map((style) => (
          <button key={style} onClick={() => handleSend(`A futuristic red car in ${style} style`)} className="text-white border border-white text-xs px-3 py-1 rounded hover:bg-white hover:text-black">
            {style}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none resize-none"
            placeholder="Type or say anything..."
          />
          <button onClick={() => handleSend()} className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
