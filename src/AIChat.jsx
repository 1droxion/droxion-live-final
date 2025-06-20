// ✅ FULL FIXED AIChat.jsx
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
  const [stylePrompt, setStylePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("Pixar");
  const [styleImage, setStyleImage] = useState(null);
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
    if (!styleImage || !stylePrompt.trim()) return alert("Upload image and enter prompt");
    const form = new FormData();
    form.append("file", styleImage); // ✅ Fixed field name
    form.append("prompt", stylePrompt);
    form.append("style", selectedStyle);
    form.append("user_id", userId.current);

    setTyping(true);
    setMessages((prev) => [...prev, { role: "user", content: `[Style Photo] ${stylePrompt}` }]);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/style-photo", form);
      if (res.data?.image_url) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `![Styled Image](${res.data.image_url})`
        }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `❌ Failed: ${res.data?.error || "Unknown error"}` }]);
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.error || "Style API error.";
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${errorMsg}` }]);
    } finally {
      setTyping(false);
      setStylePrompt("");
      setStyleImage(null);
    }
  };

  const styles = ["Pixar", "Anime", "Cinematic", "Oil Painting", "Cyberpunk", "Sketch"];

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
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
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>

        <div className="mt-4 border-t border-gray-600 pt-4">
          <h4 className="text-sm mb-2">🎨 Style My Photo</h4>
          <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setStyleImage(e.target.files[0])}
              className="bg-gray-800 text-white p-1 rounded"
            />
            <input
              type="text"
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="Describe your style (e.g. me as Iron Man)"
              className="flex-1 p-2 bg-gray-900 border border-gray-600 rounded"
            />
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="p-2 bg-gray-900 border border-gray-600 rounded text-white"
            >
              {styles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={handleStyleSubmit}
              className="bg-white text-black px-4 py-2 rounded hover:bg-gray-300"
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
