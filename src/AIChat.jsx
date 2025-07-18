// ✅ Final AIChat.jsx — FIXED Image/YouTube/News Previews with GPT Routing
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaSun, FaMoon, FaTrash
} from "react-icons/fa";

const PERSONAS = ["Coder", "Marketer", "Therapist", "Motivator", "Artist"];

function AIChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [persona, setPersona] = useState(null);
  const [autoSuggest, setAutoSuggest] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const userId = localStorage.getItem("user_id") || "user_" + Math.random().toString(36).substring(2, 12);
  useEffect(() => localStorage.setItem("user_id", userId), []);

  const scrollToBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const savedPersona = localStorage.getItem("selectedPersona");
    if (savedPersona) setPersona(savedPersona);
  }, []);

  useEffect(() => {
    const lower = input.toLowerCase();
    if (lower.includes("weather")) setAutoSuggest("Try: weather in London");
    else if (lower.includes("image")) setAutoSuggest("Try: generate image of a lion");
    else if (lower.includes("youtube")) setAutoSuggest("Try: YouTube: motivation");
    else if (lower.includes("stock")) setAutoSuggest("Try: Stock: AAPL");
    else if (lower.includes("news")) setAutoSuggest("Try: latest news on tech");
    else setAutoSuggest("");
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input }]);
    setInput("");
    setAutoSuggest("");
    setLoading(true);

    try {
      const lower = input.toLowerCase();
      if (lower.includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: input });
        const url = res.data.image_url;
        setMessages(prev => [...prev, { role: "assistant", content: url ? `![Generated Image](${url})` : "⚠️ Image generation failed." }]);
      } else if (lower.includes("youtube")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        const { url, title } = res.data;
        setMessages(prev => [...prev, { role: "assistant", content: `[▶️ ${title}](${url})` }]);
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: persona ? `[${persona}]\n${input}` : input,
          user_id: userId,
          persona,
          save_memory: true
        });
        let reply = res.data.reply;
        reply = reply.replace(/(https?:\/\/[^\s]+)/g, url => `[🔗 ${url}](${url})`);
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Network error or AI failed." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {messages.map((msg, i) => (
          <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block p-3 rounded-xl max-w-full break-words ${msg.role === "user" ? "bg-blue-700" : darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"}`}>
              <ReactMarkdown className="prose prose-invert text-sm" rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && <div className="my-3 text-left text-gray-400 text-xl animate-pulse">● ● ●</div>}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-4 py-3">
        <div className="flex gap-3 justify-between items-center max-w-3xl mx-auto">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 bg-[#111] text-white px-4 py-2 rounded-full text-sm outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            className="bg-white text-black px-4 py-2 rounded-full text-sm hover:bg-gray-300"
          >➤</button>
        </div>
        {autoSuggest && <div className="text-xs text-center text-gray-400 mt-1">💡 {autoSuggest}</div>}
      </div>
    </div>
  );
}

export default AIChat;
