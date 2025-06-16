// ✅ Final AIChat.jsx with toggle icons, video mode, real-time understanding
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Mic, SendHorizonal, ImageIcon, Download, Trash2, Plus, Clock, Volume2, VolumeX } from "lucide-react";

const API = "https://droxion-backend.onrender.com";

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [videoMode, setVideoMode] = useState(true);
  const fileInputRef = useRef();
  const scrollRef = useRef();

  useEffect(() => {
    localStorage.setItem("chat-history", JSON.stringify(chat));
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (e) => setPrompt(e.results[0][0].transcript);
  };

  const handleSend = async () => {
    if (!prompt.trim() && !image) return;
    const newMsg = { role: "user", content: prompt };
    if (image) newMsg.imageUrl = URL.createObjectURL(image);

    const updatedChat = [...chat, newMsg];
    setChat(updatedChat);
    setPrompt("");
    setLoading(true);

    try {
      let res;
      if (image) {
        const formData = new FormData();
        formData.append("image", image);
        formData.append("prompt", prompt);
        res = await axios.post(`${API}/analyze-image`, formData);
        updatedChat.push({ role: "assistant", content: res.data.reply });
      } else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().startsWith("/yt")) {
        const search = prompt.replace("/yt", "").replace("youtube", "").trim();
        res = await axios.post(`${API}/search-youtube`, { prompt: search });
        updatedChat.push({
          role: "assistant",
          content: `🎬 [${res.data.title}](${res.data.url})`
        });
      } else if (prompt.toLowerCase().includes("news") || prompt.toLowerCase().startsWith("/news")) {
        const search = prompt.replace("/news", "").trim();
        res = await axios.post(`${API}/news`, { prompt: search });
        updatedChat.push({
          role: "assistant",
          content: res.data.headlines.map(h => `📰 ${h}`).join("\n\n")
        });
      } else if (prompt.toLowerCase().includes("image") || prompt.startsWith("/img")) {
        res = await axios.post(`${API}/generate-image`, { prompt });
        updatedChat.push({ role: "assistant", content: `![Generated](${res.data.image_url})` });
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
        updatedChat.push({ role: "assistant", content: res.data.reply });
      }

      setChat(updatedChat);
    } catch {
      setChat([...updatedChat, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    }
    setImage(null);
    setLoading(false);
  };

  const downloadChat = () => {
    const blob = new Blob([
      chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
    ], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  const clearChat = () => {
    setChat([]);
    localStorage.removeItem("chat-history");
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold">💬 AI Chat <span className="text-purple-400">(Droxion)</span></div>
        <div className="flex gap-4 items-center">
          <Clock className="cursor-pointer" title="Chat History" />
          <Plus onClick={clearChat} className="cursor-pointer" title="New Chat" />
          <Trash2 onClick={clearChat} className="cursor-pointer" title="Clear All" />
          {videoMode ? (
            <Volume2 onClick={() => setVideoMode(false)} className="cursor-pointer" title="Avatar Mode ON" />
          ) : (
            <VolumeX onClick={() => setVideoMode(true)} className="cursor-pointer" title="Avatar Mode OFF" />
          )}
          <Download onClick={downloadChat} className="cursor-pointer" title="Download Chat" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-xl max-w-[80%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
              {msg.imageUrl && <img src={msg.imageUrl} alt="uploaded" className="rounded max-w-[200px] mb-2" />}
              <ReactMarkdown
                children={msg.content}
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <div className="mt-2">
                      {videoMode && props.href?.includes("youtube.com") ? (
                        <iframe
                          src={props.href.replace("watch?v=", "embed/")}
                          title="YouTube"
                          className="rounded w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        <a {...props} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" />
                      )}
                    </div>
                  ),
                  code: ({ inline, className, children, ...props }) => (
                    <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                      <code {...props}>{children}</code>
                    </pre>
                  )
                }}
              />
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">⏳ Typing...</div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="border-t border-gray-700 p-3 flex items-center gap-2">
        <button onClick={handleVoiceInput}><Mic /></button>
        <button onClick={() => fileInputRef.current.click()}><ImageIcon /></button>
        <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" hidden />
        <input
          type="text"
          placeholder="Type or say anything..."
          className="flex-1 p-2 rounded bg-zinc-800 text-white"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}><SendHorizonal /></button>
      </div>
    </div>
  );
}

export default AIChat;
