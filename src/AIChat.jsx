// ✅ Full working AIChat.jsx with "Style My Photo" upload & style prompt
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

  const handleStyleSubmit = async () => {
    if (!styleImage || !stylePrompt.trim()) return alert("Upload image and enter prompt");
    const form = new FormData();
    form.append("image", styleImage);
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
        setMessages((prev) => [...prev, { role: "assistant", content: "❌ Failed to style image." }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Style API error." }]);
    } finally {
      setTyping(false);
      setStylePrompt("");
      setStyleImage(null);
    }
  };

  const styles = ["Pixar", "Anime", "Cinematic", "Oil Painting", "Cyberpunk", "Sketch"];

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* ... your top bar, tools, and chat history unchanged ... */}

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
            onClick={() => handleSend()}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>

        {/* 🎨 Style My Photo Section */}
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
