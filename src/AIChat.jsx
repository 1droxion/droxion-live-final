// ✅ AIChat.jsx — Smart Previews, Downloadable Images, Clear Memory
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaSun, FaMoon, FaTrash, FaDownload
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
  const recognitionRef = useRef(null);

  const firstMessage = messages.length === 0;

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!localStorage.getItem("user_id")) {
      localStorage.setItem("user_id", "user_" + Math.random().toString(36).substring(2, 12));
    }
    const savedPersona = localStorage.getItem("selectedPersona");
    if (savedPersona) setPersona(savedPersona);
  }, []);

  useEffect(() => {
    const lower = input.toLowerCase();
    if (lower.includes("weather")) setAutoSuggest("Try: 'What's the weather in Paris today?'");
    else if (lower.includes("image")) setAutoSuggest("Try: 'Generate image of a cyberpunk city'");
    else if (lower.includes("stock")) setAutoSuggest("Try: 'Stock: AAPL'");
    else if (lower.includes("news")) setAutoSuggest("Try: 'Latest news about AI'");
    else if (lower.includes("youtube")) setAutoSuggest("Try: 'YouTube: motivation mix'");
    else setAutoSuggest("");
  }, [input]);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userId = localStorage.getItem("user_id");
    const prompt = persona ? `[${persona}]\n${input}` : input;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAutoSuggest("");
    setLoading(true);

    try {
      const lower = input.toLowerCase();

      if (lower.includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt: input });
        const image_url = res.data.image_url;
        if (image_url) {
          const markdown = `![Generated Image](${image_url})\n\n[⬇️ Download Image](${image_url})`;
          setMessages((prev) => [...prev, { role: "assistant", content: markdown }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Failed to generate image." }]);
        }
      } else if (lower.includes("youtube")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        const { url, title } = res.data;
        if (url && title) {
          const markdown = `▶️ **${title}**\n\n[Watch Video](${url})`;
          setMessages((prev) => [...prev, { role: "assistant", content: markdown }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Video not found." }]);
        }
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt,
          user_id: userId,
          persona,
          save_memory: true
        });
        let reply = res.data.reply;
        reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "⚠️ AI Error or connection failed."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearMemory = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported");
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

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
        {loading && (
          <div className="my-3 text-left text-gray-400 text-xl animate-pulse px-2">● ● ●</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-3 py-3 z-50">
        <div className="flex justify-between items-center max-w-3xl mx-auto mb-2 px-1">
          <div className="flex gap-3">
            <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
            <FaUpload onClick={() => fileInputRef.current.click()} className="text-white text-lg cursor-pointer" />
            <FaCamera className="text-white text-lg cursor-pointer" onClick={handleScreenshot} />
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
          </div>
          <div className="flex gap-3 items-center">
            <FaTrash onClick={clearMemory} className="text-white text-lg cursor-pointer" />
            <button onClick={() => setDarkMode(!darkMode)} className="text-white text-xl">
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </div>
        <div className="flex max-w-3xl mx-auto bg-[#111] rounded-full px-4 py-3 items-center">
          <input
            type="text"
            placeholder="Type a message or goal..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
          >
            ➤
          </button>
        </div>
        {autoSuggest && <div className="text-xs text-center text-gray-400 mt-1">💡 {autoSuggest}</div>}
      </div>
    </div>
  );
}

export default AIChat;
