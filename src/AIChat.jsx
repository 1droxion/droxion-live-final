// ✅ Final AIChat.jsx file with:
// - Memory (chat history)
// - Real voice selector
// - Bookmark replies
// - Tap-to-speak per AI reply (mobile-safe)
// - Image + YouTube preview

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone,
  FaStar, FaPlay
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem("bookmarked_messages");
    return saved ? JSON.parse(saved) : [];
  });
  const [availableVoices, setAvailableVoices] = useState([]);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const [typingDots, setTypingDots] = useState(".");

  useEffect(() => {
    const loadVoices = () => {
      const voices = synth.getVoices();
      setAvailableVoices(voices);
    };
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }, []);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("bookmarked_messages", JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    if (typing) {
      const interval = setInterval(() => {
        setTypingDots((dots) => (dots.length === 3 ? "." : dots + "."));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [typing]);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    if (selectedVoice) {
      utterance.voice = synth.getVoices().find((v) => v.name === selectedVoice);
    }
    synth.cancel();
    synth.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode,
        history: updatedMessages,
      });

      const reply = res.data.reply;
      const aiMsg = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, aiMsg]);

      const lower = input.toLowerCase();
      const ytKeywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
      const imgKeywords = ["image", "picture", "draw", "photo", "create", "generate"];

      if (ytKeywords.some((k) => lower.includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `
🎬 [Watch on YouTube](${yt.data.url})
<div style="margin-top: 10px; border-radius: 10px; overflow: hidden; max-width: 480px; box-shadow: 0 0 10px rgba(0,0,0,0.4);">
  <iframe width="100%" height="200" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>`
            }
          ]);
        }
      }

      if (imgKeywords.some((k) => lower.includes(k))) {
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: input });
        if (imgRes.data?.image_url) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `🖼️\n\n![result](${imgRes.data.image_url})`
            }
          ]);
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Mic not supported");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (e) => setInput(e.results[0][0].transcript);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleBookmark = (msg) => {
    const already = bookmarks.find((b) => b.content === msg.content);
    const updated = already ? bookmarks.filter((b) => b.content !== msg.content) : [...bookmarks, msg];
    setBookmarks(updated);
  };

  const isBookmarked = (msg) => bookmarks.some((b) => b.content === msg.content);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">
          💬 <span className="text-white">AI Chat </span>
          <span className="text-white">(Droxion)</span>
        </div>
        <div className="flex space-x-2 items-center">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="text-black text-xs px-2 py-1 rounded"
            title="Select Voice"
          >
            <option value="">Default</option>
            {availableVoices.map((voice, idx) => (
              <option key={idx} value={voice.name}>{voice.name}</option>
            ))}
          </select>
          <FaClock className="cursor-pointer" />
          <FaPlus className="cursor-pointer" onClick={() => setMessages([])} />
          <FaTrash className="cursor-pointer" onClick={() => setMessages([])} />
          <FaDownload className="cursor-pointer" onClick={() => {
            const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "chat.txt";
            link.click();
          }} />
          <FaMicrophone className="cursor-pointer" onClick={handleMic} />
          {voiceMode ? <FaVolumeUp className="cursor-pointer" onClick={() => setVoiceMode(false)} /> : <FaVolumeMute className="cursor-pointer" onClick={() => setVoiceMode(true)} />}
          <FaVideo className={`cursor-pointer ${videoMode ? 'text-green-500' : ''}`} onClick={() => setVideoMode(!videoMode)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap px-2 relative ${msg.role === "user" ? "text-white text-right self-end" : "text-left self-start"}`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{ img: ({ node, ...props }) => (<img {...props} alt="Generated" className="max-w-xs rounded-lg my-2" />) }}>
              {msg.content}
            </ReactMarkdown>
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mt-1">
                <FaStar
                  className={`cursor-pointer ${isBookmarked(msg) ? "text-yellow-400" : "text-gray-500"}`}
                  title="Bookmark"
                  onClick={() => toggleBookmark(msg)}
                />
                {voiceMode && (
                  <FaPlay
                    className="cursor-pointer text-green-400"
                    title="Tap to speak"
                    onClick={() => speak(msg.content)}
                  />
                )}
              </div>
            )}
          </div>
        ))}
        {typing && <div className="text-gray-500">Typing{typingDots}</div>}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-gray-900 text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
