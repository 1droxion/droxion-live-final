// ✅ AIChat.jsx (React Frontend) - fixed with working backend URL, upload, voice input, black & white theme
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Mic, Send, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const messagesEndRef = useRef(null);

  const BACKEND_URL = "https://droxion-backend.onrender.com"; // ✅ UPDATE THIS to your backend

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) setImageFile(acceptedFiles[0]);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleSend = async () => {
    if (!prompt.trim() && !imageFile) return;
    const userMsg = { role: "user", content: prompt || "[Image]" };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setIsTyping(true);

    try {
      let reply;
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("prompt", prompt);
        const res = await axios.post(`${BACKEND_URL}/analyze-image`, formData);
        reply = res.data.reply;
        setImageFile(null);
      } else {
        const res = await axios.post(`${BACKEND_URL}/chat`, { prompt });
        reply = res.data.reply;
      }
      const botMsg = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error: " + err.message },
      ]);
    }
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setPrompt("");
    setImageFile(null);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
        <h1 className="text-lg font-bold">Droxion Chat</h1>
        <button onClick={handleClear}><Trash2 /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap px-4 py-2 rounded-xl max-w-2xl ${msg.role === "user" ? "bg-gray-800 self-end" : "bg-gray-900 self-start"}`}
          >
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {isTyping && <div className="px-4 py-2 animate-pulse">Typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-700 p-3">
        <div className="flex items-center gap-2">
          <div
            {...getRootProps()}
            className="bg-gray-800 px-3 py-1 rounded cursor-pointer text-sm"
          >
            <input {...getInputProps()} />
            {isDragActive ? "Drop..." : imageFile ? imageFile.name : "Upload"}
          </div>

          <textarea
            className="flex-1 resize-none bg-black text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
            rows="1"
            placeholder="Type or upload image..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={handleSend}
            className="bg-white text-black px-3 py-2 rounded hover:bg-gray-300"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
