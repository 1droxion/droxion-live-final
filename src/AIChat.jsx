// AIChat.jsx
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length > 0) setImageFile(acceptedFiles[0]);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleSend = async () => {
    if (!prompt.trim() && !imageFile) return;

    const userMessage = { role: "user", content: prompt || "[Image]" };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setIsTyping(true);

    try {
      let response;
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("prompt", prompt);
        response = await axios.post("/analyze-image", formData);
        setImageFile(null);
      } else {
        response = await axios.post("/chat", { prompt });
      }

      const replyMessage = {
        role: "assistant",
        content: response.data.reply || "❌ No reply received.",
      };
      setMessages((prev) => [...prev, replyMessage]);
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
      {/* Top Bar */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
        <h1 className="text-lg font-semibold">Droxion Chat</h1>
        <button onClick={handleClear} title="Clear chat">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap px-4 py-2 rounded-xl max-w-2xl ${
              msg.role === "user"
                ? "bg-gray-800 self-end"
                : "bg-gray-900 self-start animate-pulse"
            }`}
          >
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {isTyping && (
          <div className="px-4 py-2 bg-gray-900 rounded-xl max-w-2xl self-start animate-pulse">
            <span className="text-gray-400">Typing</span>
            <span className="animate-bounce">...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex items-center gap-2">
          {/* Image Upload */}
          <div
            {...getRootProps()}
            className="bg-gray-800 text-sm px-3 py-1 rounded-lg cursor-pointer"
          >
            <input {...getInputProps()} />
            {isDragActive
              ? "Drop image..."
              : imageFile
              ? imageFile.name
              : "📎 Upload Image"}
          </div>

          {/* Text Input */}
          <textarea
            className="flex-1 resize-none bg-black text-white border border-gray-700 rounded-lg px-3 py-2 focus:outline-none"
            rows="1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
          />

          {/* Mic Icon (future) */}
          <button className="bg-gray-800 text-white px-2 py-2 rounded-lg" disabled>
            <Mic size={18} />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            className="bg-white text-black px-3 py-2 rounded-lg hover:bg-gray-300"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
