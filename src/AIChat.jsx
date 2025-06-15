import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download, Clock, Trash2, Plus } from "lucide-react";

const API = "https://droxion-backend.onrender.com";

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef();
  const fileInputRef = useRef();

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      setPrompt(event.results[0][0].transcript);
    };
  };

  const handleSend = async () => {
    if (!prompt.trim() && !image) return;
    const userMsg = { role: "user", content: prompt };
    if (image) userMsg.imageUrl = URL.createObjectURL(image);
    const updatedChat = [...chat, userMsg];
    setChat(updatedChat);
    setPrompt("");
    setLoading(true);

    try {
      const classify = await axios.post(`${API}/classify`, { prompt });
      const type = classify.data.type;
      let res;

      if (type === "image" || image) {
        if (image) {
          const formData = new FormData();
          formData.append("image", image);
          formData.append("prompt", prompt);
          res = await axios.post(`${API}/analyze-image`, formData);
        } else {
          res = await axios.post(`${API}/generate-image`, { prompt });
        }
        updatedChat.push({ role: "assistant", content: `🖼️ ![Image](${res.data.image_url})` });
      } else if (type === "youtube") {
        res = await axios.post(`${API}/search-youtube`, { prompt });
        updatedChat.push({
          role: "assistant",
          content: `🎬 [${res.data.title}](${res.data.url})`,
          youtube: res.data.url
        });
      } else if (type === "news") {
        res = await axios.post(`${API}/news`, { prompt });
        updatedChat.push({
          role: "assistant",
          content: res.data.headlines.map(h => `📰 ${h}`).join("\n\n")
        });
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
        updatedChat.push({ role: "assistant", content: res.data.reply });
      }

      setChat(updatedChat);
      localStorage.setItem("chat-history", JSON.stringify(updatedChat));
    } catch {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }

    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
  };

  const handleDownload = () => {
    const content = chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  const handleNewChat = () => {
    setChat([]);
    setPrompt("");
  };

  const handleClearAll = () => {
    localStorage.removeItem("chat-history");
    setChat([]);
    alert("🗑 All history cleared");
  };

  const renderMessage = (msg, i) => {
    const isYouTubeLink = msg.youtube || (msg.content && msg.content.includes("youtube.com/watch?v="));
    const videoId = isYouTubeLink
      ? (msg.youtube || msg.content.match(/v=([\w-]{11})/)?.[1])
      : null;

    return (
      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
          {msg.imageUrl && <img src={msg.imageUrl} alt="upload" className="rounded max-w-xs mb-2" />}
          {videoId ? (
            <div className="rounded overflow-hidden mt-2">
              <iframe
                width="100%"
                height="220"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <ReactMarkdown
              children={msg.content}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" />
                ),
                code: ({ node, ...props }) => (
                  <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                    <code {...props}>{props.children}</code>
                  </pre>
                )
              }}
            />
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  return (
    <div className="w-full h-screen flex flex-col bg-black text-white">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold">💬 AI Chat (Droxion)</div>
        <div className="flex items-center gap-4">
          <Clock onClick={() => setSidebarOpen(!sidebarOpen)} title="History" className="cursor-pointer" />
          <Plus onClick={handleNewChat} title="New Chat" className="cursor-pointer" />
          <Trash2 onClick={handleClearAll} title="Clear All" className="cursor-pointer" />
          <Download onClick={handleDownload} title="Download Chat" className="cursor-pointer" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => renderMessage(msg, i))}
        {loading && <div className="text-left text-sm text-gray-500 px-4 animate-pulse">Typing<span className="animate-bounce">...</span></div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="border-t border-gray-700 p-3 flex items-center gap-2">
        <button onClick={handleVoiceInput}><Mic className="text-white" /></button>
        <button onClick={() => fileInputRef.current.click()}><ImageIcon className="text-white" /></button>
        <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" hidden />
        <input
          type="text"
          placeholder="Type anything..."
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
