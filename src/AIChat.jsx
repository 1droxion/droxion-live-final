// ✅ AIChat.jsx with Dhruv Patel credit + compact prompt bar (unchanged layout)
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

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [topToolsOpen, setTopToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;

  const speak = (text) => {
    if (voiceMode && text) {
      const utterance = new SpeechSynthesisUtterance(text);
      synth.speak(utterance);
    }
  };

  const handleSend = async (prompt) => {
    if (!prompt.trim()) return;
    const userMessage = { role: "user", content: prompt };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt,
        video: videoMode,
      });

      let reply = res.data.reply;
      if (/who.*(made|created|owner|built).*you/i.test(prompt)) {
        reply = "I was created and managed by **Dhruv Patel**, powered by OpenAI.";
      }

      const botMessage = { role: "assistant", content: reply };
      setMessages([...newMessages, botMessage]);
      speak(reply);
    } catch (err) {
      console.error("Error:", err);
    }
    setTyping(false);
  };

  const handlePromptClick = (style) => {
    const styledPrompt = `Generate an image in ${style} style.`;
    handleSend(styledPrompt);
  };

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="bg-black text-white min-h-screen p-4">
      <div className="text-2xl font-bold mb-2">Droxion</div>
      <div className="text-sm text-blue-400 mb-4">Hello! How can I assist you today?</div>

      {messages.map((msg, i) => (
        <div key={i} className={`my-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
          <div
            className={`inline-block p-2 rounded-lg max-w-[80%] ${
              msg.role === "user" ? "bg-gray-800" : "bg-gray-700"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        </div>
      ))}

      {typing && <div className="text-gray-500">Typing...</div>}
      <div ref={chatRef} />

      {/* 👇 Prompt buttons just above input box */}
      <div className="flex gap-2 mt-4 mb-2 flex-wrap justify-start">
        {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((style) => (
          <button
            key={style}
            onClick={() => handlePromptClick(style)}
            className="px-3 py-1 border border-white rounded-full text-sm hover:bg-white hover:text-black"
          >
            {style}
          </button>
        ))}
      </div>

      {/* 👇 Chat input bar and plus icon */}
      <div className="flex items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or say anything..."
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          className="flex-1 bg-black border border-gray-600 rounded px-3 py-2 text-white"
        />
        <button onClick={() => handleSend(input)} className="ml-2 px-4 py-2 bg-white text-black rounded">
          ➤
        </button>
        <div className="relative ml-3">
          <button onClick={() => setTopToolsOpen(!topToolsOpen)} className="text-white text-lg">
            <FaPlus />
          </button>
          {topToolsOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-gray-700 rounded shadow-lg z-10">
              <button onClick={() => { setMessages([]); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">🗑 Clear</button>
              <button onClick={() => setTopToolsOpen(false)} className="block w-full text-left px-4 py-2 hover:bg-gray-800">⬇️ Download</button>
              <button onClick={() => setTopToolsOpen(false)} className="block w-full text-left px-4 py-2 hover:bg-gray-800"><FaClock /> History</button>
              <button onClick={() => { setVoiceMode(!voiceMode); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                {voiceMode ? <FaVolumeMute /> : <FaVolumeUp />} Speaker {voiceMode ? "Off" : "On"}
              </button>
              <button onClick={() => { setVideoMode(!videoMode); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                <FaVideo /> Video Mode
              </button>
              <button onClick={() => { alert("Mic activated"); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                <FaMicrophone /> Mic
              </button>
              <button onClick={() => { alert("Upload clicked"); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                <FaUpload /> Upload
              </button>
              <button onClick={() => { alert("Camera opened"); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                <FaCamera /> Take Photo
              </button>
              <button onClick={() => { alert("Screenshot captured"); setTopToolsOpen(false); }} className="block w-full text-left px-4 py-2 hover:bg-gray-800">
                <FaDesktop /> Screenshot
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-400 mt-4">
        Created by Dhruv Patel | Powered by Droxion AI
      </div>
    </div>
  );
}

export default AIChat;
