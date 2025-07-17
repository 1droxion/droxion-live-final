// ✅ Updated AIChat.jsx — Keeping layout & style, adding GPT-4 Vision, image preview fix, suggestions, real-time previews, and download button

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaSun, FaMoon, FaTrash, FaDownload
} from "react-icons/fa";

const SUGGESTIONS = [
  "What is AI?",
  "Generate image of a cyberpunk city",
  "Search YouTube for motivational video",
  "Stock: AAPL",
  "Crypto: ETH",
  "weather in London",
  "Tell me a story",
  "Create blog outline",
  "How does quantum computing work?",
  "Latest news"
];

function AIChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  useEffect(() => {
    const val = input.toLowerCase();
    if (val.length > 0) {
      const filtered = SUGGESTIONS.filter((s) => s.toLowerCase().includes(val)).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [input]);

  const sendMessage = async (customInput) => {
    const prompt = customInput || input;
    if (!prompt.trim()) return;
    const userMsg = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setFilteredSuggestions([]);
    setLoading(true);

    try {
      const lower = prompt.toLowerCase();

      if (lower.includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        const imgUrl = res.data.image_url;
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `![Generated Image](${imgUrl})`
        }]);
      } else if (lower.includes("youtube") || lower.includes("video")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt });
        const ytUrl = res.data.url;
        const title = res.data.title;
        const yt = new URL(ytUrl);
        const videoId = yt.searchParams.get("v") || yt.pathname.split("/").pop();
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `<b>📺 ${title}</b><br/><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
        }]);
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt });
        let reply = res.data.reply;
        reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error from AI. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported");
    if (voiceActive) {
      recognitionRef.current.stop();
      setVoiceActive(false);
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][
