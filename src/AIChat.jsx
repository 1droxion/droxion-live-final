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
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const logAction = async (action, inputText) => {
    try {
      await axios.post("https://droxion-backend.onrender.com/track", {
        user_id: userId.current,
        action,
        input: inputText,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Tracking failed", e);
    }
  };

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    logAction("message", input);

    const lower = input.toLowerCase();
    const ytKeywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
    const imgKeywords = ["image", "picture", "draw", "photo", "create", "generate"];

    const plan = localStorage.getItem("droxion_plan") || "Starter";
    const chatUsage = parseInt(localStorage.getItem("chat_usage") || "0", 10);
    const imageUsage = parseInt(localStorage.getItem("image_usage") || "0", 10);

    if (plan === "Starter") {
      if (!imgKeywords.some((k) => lower.includes(k)) && chatUsage >= 3) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "⚠️ You’ve used 3 free messages. Upgrade to Pro for unlimited access."
        }]);
        setTyping(false);
        return;
      }

      if (imgKeywords.some((k) => lower.includes(k)) && imageUsage >= 1) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "🖼️ Free plan includes 1 image generation only. Upgrade to Pro to unlock more."
        }]);
        setTyping(false);
        return;
      }
    }

    try {
      let handled = false;

      if (ytKeywords.some((k) => lower.includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `<iframe class='rounded-lg my-2 max-w-xs' width='360' height='203' src='https://www.youtube.com/embed/${videoId}' allowfullscreen></iframe>`
          }]);
          handled = true;
        }
      }

      if (imgKeywords.some((k) => lower.includes(k))) {
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: input });
        if (imgRes.data?.image_url) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `![Generated Image](${imgRes.data.image_url})`
          }]);
          handled = true;
        }
      }

      if (!handled) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: input,
          voiceMode,
          videoMode,
        });
        const reply = res.data.reply;
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        speak(reply);
      }

      if (plan === "Starter") {
        if (!imgKeywords.some((k) => lower.includes(k))) {
          localStorage.setItem("chat_usage", String(chatUsage + 1));
        } else {
          localStorage.setItem("image_usage", String(imageUsage + 1));
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Your chat layout goes here */}
    </div>
  );
}

export default AIChat;
