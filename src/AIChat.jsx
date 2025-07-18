// ✅ AIChat.jsx — Full Fix: YouTube, Image, Real-time, GPT Vision, Layout + Working YouTube block
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaSun, FaMoon, FaTrash
} from "react-icons/fa";

const PERSONAS = ["Coder", "Marketer", "Therapist", "Motivator", "Artist"];

function AIChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [persona, setPersona] = useState(null);
  const [autoSuggest, setAutoSuggest] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!localStorage.getItem("user_id")) {
      localStorage.setItem("user_id", "user_" + Math.random().toString(36).substring(2, 12));
    }
    const savedPersona = localStorage.getItem("selectedPersona");
    if (savedPersona) setPersona(savedPersona);
  }, []);

  useEffect(() => {
    const text = input.toLowerCase();
    if (text.includes("weather")) setAutoSuggest("Try: What's the weather in Paris?");
    else if (text.includes("image")) setAutoSuggest("Try: Generate image of a futuristic city");
    else if (text.includes("stock")) setAutoSuggest("Try: Stock: AAPL");
    else if (text.includes("youtube")) setAutoSuggest("Try: Search YouTube for Mr Beast");
    else setAutoSuggest("");
  }, [input]);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userId = localStorage.getItem("user_id");
    const userInput = input.trim();
    const prompt = persona ? `[${persona}]\n${userInput}` : userInput;
    const userMsg = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAutoSuggest("");
    setLoading(true);

    try {
      let reply = "";

      if (userInput.toLowerCase().includes("generate image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", {
          prompt: userInput,
          user_id: userId
        });
        reply = `![AI Image](${res.data.image_url})`;
      } else if (userInput.toLowerCase().includes("search youtube")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt: userInput,
          user_id: userId
        });
        reply = res.data.video_cards.join("\n");
      } else if (["youtube", "video", "watch", "trailer", "music"].some(k => userInput.toLowerCase().includes(k))) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt: userInput,
          user_id: userId
        });
        if (res.data?.url) {
          const videoId = res.data.url.split("v=")[1];
          reply = `<iframe width='360' height='203' class='rounded-lg my-2 max-w-xs' src='https://www.youtube.com/embed/${videoId}' allowfullscreen></iframe>`;
        }
      } else if (
        userInput.toLowerCase().startsWith("stock:") ||
        userInput.toLowerCase().startsWith("crypto:") ||
        userInput.toLowerCase().includes("weather") ||
        userInput.toLowerCase().includes("news") ||
        userInput.toLowerCase().includes("time in")
      ) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: userInput,
          user_id: userId,
          persona,
          save_memory: true
        });
        reply = res.data.reply;
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt,
          user_id: userId,
          persona,
          save_memory: true
        });
        reply = res.data.reply;
      }

      reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error or connection failed." }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    if (!("webkitSpeechRecognition" in window)) return alert("Voice not supported");
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.start();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      setMessages((prev) => [...prev, { role: "user", content: "📷 Uploaded Image" }]);
      setLoading(true);
      try {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          image_base64: base64,
          user_id: localStorage.getItem("user_id"),
          vision: true,
          save_memory: true
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Image analysis failed." }]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      canvas.toBlob((blob) => {
        const file = new File([blob], "screenshot.png", { type: "image/png" });
        const fakeEvent = { target: { files: [file] } };
        handleFileChange(fakeEvent);
      });
    } catch {
      alert("❌ Screenshot failed.");
    }
  };

  const handlePersonaChange = (p) => {
    setPersona(p);
    localStorage.setItem("selectedPersona", p);
    axios.post("https://droxion-backend.onrender.com/save-persona", {
      user_id: localStorage.getItem("user_id"),
      persona: p
    });
  };

  return (
    <div className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      ...
    </div>
  );
}

export default AIChat;
