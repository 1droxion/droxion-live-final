// ✅ AIChat.jsx — logs every action to /track (DAU/WAU/MAU enabled)
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;

  const userId = useRef(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    return id;
  })();

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const logAction = async (action, inputText) => {
    try {
      await axios.post("https://droxion-backend.onrender.com/track", {
        user_id: userId,
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

  const handleImageUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    setMessages((prev) => [...prev, { role: "user", content: "[Image uploaded]" }]);
    setTyping(true);
    logAction("upload_image", file.name);
    try {
      const res = await axios.post("https://droxion-backend.onrender.com/analyze-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const reply = res.data.reply || "No response from AI.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Couldn't analyze the image." }]);
    } finally {
      setTyping(false);
    }
  };

  const iconStyle = "text-white hover:text-white";

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
        <div className="flex space-x-2 items-center">
          <FaClock title="History" className={`cursor-pointer ${iconStyle}`} />
          <FaPlus title="New Chat" className={`cursor-pointer ${iconStyle}`} onClick={() => setMessages([])} />
          <FaTrash title="Clear" className={`cursor-pointer ${iconStyle}`} onClick={() => setMessages([])} />
          <FaDownload title="Download" className={`cursor-pointer ${iconStyle}`} onClick={() => {
            const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "chat.txt";
            link.click();
          }} />
          {voiceMode ? (
            <FaVolumeUp title="Speaker On" className={`cursor-pointer ${iconStyle}`} onClick={() => setVoiceMode(false)} />
          ) : (
            <FaVolumeMute title="Speaker Off" className={`cursor-pointer ${iconStyle}`} onClick={() => setVoiceMode(true)} />
          )}
          <FaVideo title="Video Mode" className={`cursor-pointer ${iconStyle} ${videoMode ? 'text-white' : ''}`} onClick={() => setVideoMode(!videoMode)} />
        </div>
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

      <div className="p-3 border-t border-gray-700 relative">
        {toolsOpen && (
          <div className="absolute bottom-14 left-2 bg-gray-800 text-white p-2 rounded space-y-2 z-10 min-w-[140px]">
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleMic}><FaMicrophone /> Mic</div>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => document.getElementById('fileUpload').click()}><FaUpload /> Upload</div>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => alert("Take Photo")}> <FaCamera /> Take Photo</div>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => alert("Screenshot")}> <FaDesktop /> Screenshot</div>
            <input type="file" id="fileUpload" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files[0])} />
          </div>
        )}
        <div className="flex items-center space-x-2">
          <button onClick={() => setToolsOpen(!toolsOpen)} className="text-white font-bold">➕</button>
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
