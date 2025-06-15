import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "https://droxion-backend.onrender.com";

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [avatarMode, setAvatarMode] = useState(() => localStorage.getItem("avatar-mode") === "true");
  const fileInputRef = useRef();
  const scrollRef = useRef();

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => setPrompt(event.results[0][0].transcript);
  };

  const handleSend = async () => {
    if (!prompt.trim() && !image) return;

    const userMessage = { role: "user", content: prompt, imageUrl: image ? URL.createObjectURL(image) : null };
    const updatedChat = [...chat, userMessage];
    setChat(updatedChat);
    setPrompt("");
    setImage(null);
    setLoading(true);

    try {
      let res;
      if (image) {
        const formData = new FormData();
        formData.append("image", image);
        formData.append("prompt", prompt);
        res = await axios.post(`${API}/analyze-image`, formData);
      } else if (prompt.toLowerCase().includes("youtube")) {
        res = await axios.post(`${API}/search-youtube`, { prompt });
        updatedChat.push({ role: "assistant", content: `🎬 [${res.data.title}](${res.data.url})` });
        setChat(updatedChat);
        localStorage.setItem("chat-history", JSON.stringify(updatedChat));
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().includes("news")) {
        res = await axios.post(`${API}/news`, { prompt });
        updatedChat.push({ role: "assistant", content: res.data.headlines.map(h => `📰 ${h}`).join("\n\n") });
        setChat(updatedChat);
        localStorage.setItem("chat-history", JSON.stringify(updatedChat));
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().includes("create image")) {
        res = await axios.post(`${API}/generate-image`, { prompt });
        updatedChat.push({ role: "assistant", content: `![Generated Image](${res.data.image_url})` });
        setChat(updatedChat);
        localStorage.setItem("chat-history", JSON.stringify(updatedChat));
        setLoading(false);
        return;
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
      }

      const replyText = res.data.reply || res.data.error;
      const finalBotReply = { role: "assistant", content: replyText };

      // Avatar Mode: generate video
      if (avatarMode) {
        const formData = new FormData();
        const avatarImg = await fetch("https://placehold.co/300x300?text=Avatar").then(r => r.blob());
        formData.append("image", avatarImg, "avatar.jpg");
        formData.append("prompt", replyText);
        const avatarRes = await axios.post(`${API}/talk-avatar`, formData);
        finalBotReply.videoUrl = avatarRes.data.video_url;
      }

      const newChat = [...updatedChat, finalBotReply];
      setChat(newChat);
      localStorage.setItem("chat-history", JSON.stringify(newChat));
    } catch (err) {
      const errorReply = { role: "assistant", content: "❌ Error: Something went wrong." };
      const newChat = [...chat, errorReply];
      setChat(newChat);
    }
    setLoading(false);
  };

  const handleImageSelect = (e) => setImage(e.target.files[0]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    localStorage.setItem("avatar-mode", avatarMode);
  }, [chat, avatarMode]);

  const downloadChat = () => {
    const content = chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  const resetChat = () => {
    setChat([]);
    localStorage.removeItem("chat-history");
  };

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold flex items-center gap-2">
          <span role="img">💬</span> AI Chat (Droxion)
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => setAvatarMode(!avatarMode)} title="Toggle AI Avatar Mode">
            {avatarMode ? <span role="img">🧠</span> : <span role="img">💬</span>}
          </button>
          <button onClick={resetChat} title="Clear Chat">🗑</button>
          <button onClick={() => setChat([])} title="New Chat">➕</button>
          <button onClick={downloadChat} title="Download Chat">⬇</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
              {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-w-xs mb-2" />}
              <ReactMarkdown
                children={msg.content}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  a: ({ node, ...props }) => <a {...props} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" />,
                  code: ({ node, inline, className, children, ...props }) => (
                    <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                      <code {...props}>{children}</code>
                    </pre>
                  )
                }}
              />
              {avatarMode && msg.videoUrl && (
                <video className="mt-2 rounded-lg max-w-xs" controls autoPlay>
                  <source src={msg.videoUrl} type="video/mp4" />
                </video>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-left text-sm text-gray-500 px-4">Typing...</div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="border-t border-gray-700 p-3 flex items-center gap-2">
        <button onClick={handleVoiceInput}><Mic className="text-white" /></button>
        <button onClick={() => fileInputRef.current.click()}><ImageIcon className="text-white" /></button>
        <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" hidden />
        <input
          type="text"
          placeholder='Type or say anything...'
          className="flex-1 p-2 rounded-lg bg-zinc-800 text-white outline-none"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}><SendHorizonal className="text-white" /></button>
      </div>
    </div>
  );
}

export default AIChat;
