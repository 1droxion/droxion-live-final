// ✅ Full AIChat.jsx with enhanced Style Photo UI
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
  const [styleImage, setStyleImage] = useState(null);
  const [stylePrompt, setStylePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Pixar");
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

    try {
      const lower = input.toLowerCase();
      const ytKeywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
      const imgKeywords = ["image", "picture", "draw", "photo", "create", "generate"];

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

    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleStyleSubmit = async () => {
    if (!styleImage || !stylePrompt) return;
    setTyping(true);
    const formData = new FormData();
    formData.append("image", styleImage);
    formData.append("prompt", stylePrompt);
    formData.append("style", selectedStyle);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/style-photo", formData);
      if (res.data.image_url) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `![Styled Image](${res.data.image_url})`
        }]);
      } else {
        throw new Error("Style API error");
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Style API error." }]);
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ node, ...props }) => (
                <img {...props} alt="Generated" className="rounded-lg my-2 max-w-xs" />
              ),
              iframe: ({ node, ...props }) => (
                <iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />
              )
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && (
          <div className="text-left ml-4">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-[ping_2s_ease-in-out_infinite]" />
          </div>
        )}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        {/* Input */}
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type or say anything..."
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>

        {/* Style Photo */}
        <div className="mt-6 space-y-3">
          <div className="text-sm text-pink-400 font-semibold">🎨 Style My Photo</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setStyleImage(e.target.files[0])}
              className="bg-gray-900 text-white p-2 rounded border border-gray-600"
            />
            <input
              type="text"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="Describe your style (e.g. me as Iron Man)"
              className="flex-1 p-2 rounded bg-gray-900 border border-gray-600 text-white"
            />
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="p-2 bg-gray-900 text-white rounded border border-gray-600"
            >
              {["Pixar", "Anime", "Cinematic", "Oil Painting", "Cyberpunk", "Sketch"].map((style) => (
                <option key={style}>{style}</option>
              ))}
            </select>
            <button
              onClick={handleStyleSubmit}
              className="bg-white text-black font-bold px-4 py-2 rounded hover:bg-gray-300"
            >
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
