import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Download, History, Plus, Trash, Volume2 } from "lucide-react";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoMode, setVideoMode] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text) => {
    if (!videoMode) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    synth.speak(utterance);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { type: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await axios.post("/chat", { prompt: userMessage.text });
      const reply = res.data.reply || "Error: No response";
      const aiMessage = { type: "ai", text: reply };
      setMessages((prev) => [...prev, aiMessage]);
      speak(reply);
    } catch (err) {
      setMessages((prev) => [...prev, { type: "error", text: "Something went wrong." }]);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4 text-lg font-bold border-b border-white/10">
        <span className="flex items-center gap-2">
          <span className="text-purple-300">💬 AI Chat</span>
          <span className="text-fuchsia-400">(Droxion)</span>
        </span>
        <div className="flex gap-4">
          <Volume2
            className={`cursor-pointer ${videoMode ? "text-white" : "text-white/30"}`}
            onClick={() => setVideoMode((v) => !v)}
          />
          <History className="cursor-pointer" />
          <Plus className="cursor-pointer" />
          <Trash className="cursor-pointer" />
          <Download className="cursor-pointer" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`my-2 p-3 rounded-lg max-w-xl whitespace-pre-wrap ${
              msg.type === "user"
                ? "bg-white text-black ml-auto"
                : msg.type === "error"
                ? "bg-red-800 text-white"
                : "bg-gray-900 text-white"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type or say anything..."
          className="flex-1 bg-black border border-white/20 p-3 rounded-md text-white"
        />
        <button
          onClick={sendMessage}
          className="bg-purple-600 px-4 py-2 rounded-md hover:bg-purple-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
