// ✅ AIChat.jsx – Real-time Smart UI (Final Version)
// Built by Dhruv Patel | Droxion AI – with Live Cards, Previews, & Full Query Understanding

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone,
  FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";

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

  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    const user_id = localStorage.getItem("droxion_uid");
    if (!user_id) window.location.href = "/";
    const justPaid = window.location.href.includes("/chatboard");
    if (justPaid) return;
    axios.post("https://droxion-backend.onrender.com/check-paid", { user_id })
      .then((res) => { if (!res.data.paid) window.location.href = "/"; })
      .catch(() => window.location.href = "/");
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

  const handleSend = async () => {
    if (!input.trim()) return;
    const textToSend = input;
    const userMsg = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: textToSend,
        user_id: userId.current
      });

      const reply = res.data.reply;
      const cardMatches = [];

      const markdownCard = (label, content, link) => `\n> **${label}**\n${content}\n[Open Link](${link})`;

      // Auto-render based on keywords
      if (/https:\/\/.*youtube\.com\/watch\?v=/.test(reply)) {
        const videoId = reply.split("v=")[1];
        cardMatches.push(`<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${videoId}' allowfullscreen></iframe>`);
      } else if (reply.includes("https://") && reply.includes("news")) {
        cardMatches.push(markdownCard("📰 Live News", "Top headline fetched.", reply.match(/https:\/\/[^ )\n]+/g)?.[0]));
      } else if (reply.includes("https://") && reply.includes("wikipedia")) {
        cardMatches.push(markdownCard("📚 Wikipedia", "Summary preview from Wiki:", reply.match(/https:\/\/[^ )\n]+/g)?.[0]));
      } else if (reply.includes("https://") && reply.includes("coin") || reply.includes("stock")) {
        cardMatches.push(markdownCard("📈 Market", "Live price or info:", reply.match(/https:\/\/[^ )\n]+/g)?.[0]));
      } else if (reply.includes("https://") && reply.includes("weather")) {
        cardMatches.push(markdownCard("🌤️ Weather", "Live forecast:", reply.match(/https:\/\/[^ )\n]+/g)?.[0]));
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply },
        ...cardMatches.map((c) => ({ role: "assistant", content: c }))
      ]);
      speak(reply);
    } catch (err) {
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
        <FaPlus onClick={() => setTopToolsOpen(!topToolsOpen)} className="cursor-pointer" />
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
  );
}

export default AIChat;
