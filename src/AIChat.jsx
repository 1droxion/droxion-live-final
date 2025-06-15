import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download, Volume2, VolumeX, Clock, Plus, Trash2 } from "lucide-react";

const API = "https://droxion-backend.onrender.com";

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState(() => JSON.parse(localStorage.getItem("chat-history")) || []);
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const scrollRef = useRef();
  const fileInputRef = useRef();

  const speak = (text) => {
    if (!voiceOn) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      setPrompt(event.results[0][0].transcript);
    };
  };

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSend = async () => {
    if (!prompt.trim() && !fileInputRef.current.files.length) return;

    const userMsg = { role: "user", content: prompt };
    const imageFile = fileInputRef.current.files[0];
    if (imageFile) {
      const base64 = await toBase64(imageFile);
      userMsg.imageBase64 = base64;
    }

    const updatedChat = [...chat, userMsg];
    setChat(updatedChat);
    setPrompt("");
    setLoading(true);
    fileInputRef.current.value = "";

    try {
      const classify = await axios.post(`${API}/classify`, { prompt });
      const type = classify.data.type;
      let res;

      if (type === "image" || userMsg.imageBase64) {
        if (userMsg.imageBase64) {
          const formData = new FormData();
          formData.append("image", imageFile);
          formData.append("prompt", prompt);
          res = await axios.post(`${API}/analyze-image`, formData);
        } else {
          res = await axios.post(`${API}/generate-image`, { prompt });
        }
        updatedChat.push({
          role: "assistant",
          content: `🖼️ ![Image](${res.data.image_url})`
        });
      } else if (type === "youtube") {
        res = await axios.post(`${API}/search-youtube`, { prompt });
        updatedChat.push({
          role: "assistant",
          content: res.data.title,
          youtube: res.data.url
        });
      } else if (type === "google") {
        const q = encodeURIComponent(prompt.replace(/google/i, "").trim());
        updatedChat.push({
          role: "assistant",
          content: `🔎 [Search "${prompt.replace(/google/i, "").trim()}" on Google](https://www.google.com/search?q=${q})`
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
        speak(res.data.reply);
      }

      setChat(updatedChat);
      localStorage.setItem("chat-history", JSON.stringify(updatedChat));
    } catch {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }

    setLoading(false);
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
    localStorage.removeItem("chat-history");
  };

  const renderMessage = (msg, i) => {
    const isYouTube = msg.youtube || msg.content.includes("youtube.com/watch?v=");
    const videoUrl = msg.youtube || msg.content.match(/https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/)?.[0];
    const videoId = videoUrl?.split("v=")[1];

    return (
      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
          {msg.imageBase64 && (
            <img src={msg.imageBase64} alt="Uploaded" className="rounded max-w-[300px] mb-2" />
          )}
          {isYouTube && videoId ? (
            <div className="space-y-2">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
              <img
                src={`https://img.youtube.com/vi/${videoId}/0.jpg`}
                alt="YouTube"
                className="rounded cursor-pointer max-w-xs"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank")}
              />
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline text-sm block text-center"
              >
                ▶️ Watch on YouTube
              </a>
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
      {/* Topbar */}
      <div className="p-3 border-b border-gray-700 flex justify-between items-center">
        <div className="text-xl font-bold">💬 AI Chat (Droxion)</div>
        <div className="flex items-center gap-4">
          <Clock onClick={() => alert("History coming soon")} title="History" className="cursor-pointer" />
          <Plus onClick={handleNewChat} title="New Chat" className="cursor-pointer" />
          <Trash2 onClick={handleNewChat} title="Clear All" className="cursor-pointer" />
          <Download onClick={handleDownload} title="Download Chat" className="cursor-pointer" />
          <button onClick={() => setVoiceOn(!voiceOn)} title="Toggle Voice">
            {voiceOn ? <Volume2 className="text-white" /> : <VolumeX className="text-white" />}
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {chat.map((msg, i) => renderMessage(msg, i))}
        {loading && <div className="text-left text-sm text-gray-400 animate-pulse">Typing...</div>}
        <div ref={scrollRef}></div>
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-700 p-3 flex items-center gap-2">
        <button onClick={handleVoiceInput}><Mic className="text-white" /></button>
        <button onClick={() => fileInputRef.current.click()}><ImageIcon className="text-white" /></button>
        <input type="file" ref={fileInputRef} accept="image/*" hidden />
        <input
          type="text"
          placeholder="Type or say anything..."
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
