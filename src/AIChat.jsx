// AIChat.jsx with Avatar Talking Video (D-ID like feature integrated)

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, Download, ImageIcon, Trash2, Plus, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost"
  ? "http://127.0.0.1:5000"
  : "https://droxion-backend.onrender.com");

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const fileInputRef = useRef();
  const scrollRef = useRef();
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(null);

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setPrompt(spoken);
    };
  };

  const handleSend = async () => {
    if (!prompt.trim() && !image) return;
    const userMessage = { role: "user", content: prompt, imageUrl: image ? URL.createObjectURL(image) : null };
    const updatedChat = [...chat, userMessage];
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
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
      }

      const replyText = res.data.reply || res.data.error;
      updatedChat.push({ role: "assistant", content: replyText });
      setChat(updatedChat);
      localStorage.setItem("chat-history", JSON.stringify(updatedChat));

      // Request avatar talking video
      const videoRes = await axios.post(`${API}/avatar-video`, { text: replyText });
      setAvatarVideoUrl(videoRes.data.video_url);
    } catch (err) {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }

    setImage(null);
    setLoading(false);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const downloadChat = () => {
    const content = chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  const newChat = () => {
    setChat([]);
    setAvatarVideoUrl(null);
    localStorage.removeItem("chat-history");
  };

  const deleteHistory = () => {
    localStorage.removeItem("chat-history");
    window.location.reload();
  };

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold">💬 AI Chat (Droxion)</div>
        <div className="flex gap-4 items-center">
          <Clock className="cursor-pointer" onClick={() => alert("History is auto-saved.")} />
          <Plus className="cursor-pointer" onClick={newChat} />
          <Trash2 className="cursor-pointer" onClick={deleteHistory} />
          <Download className="cursor-pointer" onClick={downloadChat} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
              {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-w-xs max-h-40 mb-2" />}
              <ReactMarkdown children={msg.content} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{
                a: ({ node, ...props }) => <a {...props} className="text-blue-400 underline" target="_blank" />,
                code: ({ node, inline, className, children, ...props }) => (
                  <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                    <code {...props}>{children}</code>
                  </pre>
                )
              }} />
            </div>
          </div>
        ))}
        {avatarVideoUrl && (
          <div className="text-center">
            <video src={avatarVideoUrl} autoPlay controls className="rounded-xl mt-4 w-72" />
          </div>
        )}
        {loading && <div className="text-left text-sm text-gray-500 px-4">Typing...</div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="border-t border-gray-700 p-3 flex items-center gap-2">
        <button onClick={handleVoiceInput}><Mic className="text-white" /></button>
        <button onClick={() => fileInputRef.current.click()}><ImageIcon className="text-white" /></button>
        <input type="file" ref={fileInputRef} onChange={(e) => setImage(e.target.files[0])} accept="image/*" hidden />
        <input
          type="text"
          placeholder='Type a message or upload an image'
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
