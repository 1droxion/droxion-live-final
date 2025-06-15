// ✅ AI Chat Full File with Real-Time YouTube & Avatar Toggle
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download, Trash2, PlusCircle, Clock, Volume2, VolumeX } from "lucide-react";

const API = import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" ? "http://127.0.0.1:5000" : "https://droxion-backend.onrender.com");

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [videoMode, setVideoMode] = useState(false);
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
    setLoading(true);

    try {
      let res;
      if (image) {
        const formData = new FormData();
        formData.append("image", image);
        formData.append("prompt", prompt);
        res = await axios.post(`${API}/analyze-image`, formData);
      } else if (prompt.toLowerCase().includes("google link")) {
        const query = encodeURIComponent(prompt.replace(/google link/i, "").trim());
        const url = `https://www.google.com/search?q=${query}`;
        updatedChat.push({ role: "assistant", content: `🔗 [Search Google](${url})` });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().startsWith("/yt")) {
        const topic = prompt.replace("/yt", "").trim();
        const yt = await axios.post(`${API}/search-youtube`, { prompt: topic });
        const link = yt.data.url;
        const embed = link.replace("watch?v=", "embed/");
        updatedChat.push({ role: "assistant", content: videoMode ? `<iframe width='100%' height='280' src='${embed}' frameborder='0' allowfullscreen></iframe>` : `▶️ [${yt.data.title}](${link})` });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().startsWith("/img") || prompt.toLowerCase().includes("create image")) {
        res = await axios.post(`${API}/generate-image`, { prompt });
        updatedChat.push({ role: "assistant", content: `🖼️ ![Image](${res.data.image_url})` });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
      }

      updatedChat.push({ role: "assistant", content: res.data.reply });
      setChat(updatedChat);
      localStorage.setItem("chat-history", JSON.stringify(updatedChat));
    } catch (err) {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }
    setLoading(false);
  };

  const handleImageSelect = (e) => setImage(e.target.files[0]);
  const handleToggleVideoMode = () => setVideoMode(!videoMode);
  const downloadChat = () => {
    const content = chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };
  const clearChat = () => { setChat([]); localStorage.removeItem("chat-history"); };

  useEffect(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), [chat]);

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold">💬 AI Chat (Droxion)</div>
        <div className="flex gap-4 items-center">
          <Clock />
          <PlusCircle onClick={clearChat} className="cursor-pointer" />
          <Trash2 onClick={clearChat} className="cursor-pointer" />
          <Download onClick={downloadChat} className="cursor-pointer" />
          {videoMode
            ? <Volume2 onClick={handleToggleVideoMode} className="cursor-pointer" />
            : <VolumeX onClick={handleToggleVideoMode} className="cursor-pointer" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
              {msg.imageUrl && <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-w-[200px] mb-2" />}
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
