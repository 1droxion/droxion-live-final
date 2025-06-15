import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download, Trash2, Plus, Clock4, Volume2, VolumeX } from "lucide-react";

const API =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://127.0.0.1:5000"
    : "https://droxion-backend.onrender.com");

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [avatarMode, setAvatarMode] = useState(false);
  const fileInputRef = useRef();
  const scrollRef = useRef();

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

    const userMessage = { role: "user", content: prompt };
    if (image) {
      userMessage.imageUrl = URL.createObjectURL(image);
    }

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
      } else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().startsWith("/yt")) {
        const search = prompt.replace("/yt", "").trim();
        res = await axios.post(`${API}/search-youtube`, { prompt: search });
        updatedChat.push({
          role: "assistant",
          content: `🎬 [${res.data.title}](${res.data.url})`
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().includes("google link")) {
        const search = prompt.replace("google link", "").trim();
        updatedChat.push({
          role: "assistant",
          content: `🔎 [Search Google](https://www.google.com/search?q=${encodeURIComponent(search || prompt)})`
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (
        prompt.toLowerCase().startsWith("/img") ||
        prompt.toLowerCase().includes("create image")
      ) {
        res = await axios.post(`${API}/generate-image`, { prompt });
        updatedChat.push({
          role: "assistant",
          content: `🖼️ ![Generated Image](${res.data.image_url})`
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
      }

      updatedChat.push({ role: "assistant", content: res.data.reply || res.data.error });

      if (avatarMode && res.data.reply) {
        const formData = new FormData();
        formData.append("image", image || new Blob());
        formData.append("prompt", res.data.reply);
        const avatar = await axios.post(`${API}/talk-avatar`, formData);
        updatedChat.push({ role: "assistant", content: `<video controls src='${avatar.data.video_url}' width='300'></video>` });
      }

      setChat(updatedChat);
      localStorage.setItem("chat-history", JSON.stringify(updatedChat));
    } catch (err) {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }

    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
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
    localStorage.removeItem("chat-history");
  };

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold flex items-center gap-2">
          <span>💬 AI Chat (Droxion)</span>
          <button onClick={() => setAvatarMode(!avatarMode)}>
            {avatarMode ? <Volume2 className="text-green-400" /> : <VolumeX className="text-gray-500" />}
          </button>
        </div>
        <div className="flex gap-4 items-center">
          <Clock4 className="cursor-pointer" onClick={() => {}} />
          <Plus className="cursor-pointer" onClick={newChat} />
          <Trash2 className="cursor-pointer" onClick={newChat} />
          <Download className="cursor-pointer" onClick={downloadChat} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-w-xs mb-2" />
              )}
              <ReactMarkdown
                children={msg.content}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" />
                  ),
                  code: ({ node, inline, className, children, ...props }) => (
                    <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                      <code {...props}>{children}</code>
                    </pre>
                  )
                }}
              />
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-left text-sm text-gray-500 px-4">Typing...</div>
        )}
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
