// ✅ AIChat.jsx — Full Droxion Final Version with GPT-4 Vision, Real-Time Previews, Suggestions, Download, Themes

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaSun, FaMoon, FaTrash, FaDownload
} from "react-icons/fa";

const SUGGESTIONS = [
  "What is AI?",
  "Generate image of a cyberpunk city",
  "Search YouTube for motivational video",
  "Stock: AAPL",
  "Crypto: ETH",
  "weather in London",
  "Tell me a story",
  "Create blog outline",
  "How does quantum computing work?",
  "Latest news"
];

function AIChat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const chatRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  useEffect(() => {
    const val = input.toLowerCase();
    if (val.length > 0) {
      const filtered = SUGGESTIONS.filter((s) => s.toLowerCase().includes(val)).slice(0, 5);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, [input]);

  const sendMessage = async (customInput) => {
    const prompt = customInput || input;
    if (!prompt.trim()) return;
    const userMsg = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setFilteredSuggestions([]);
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt });
      let reply = res.data.reply;
      reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error from AI. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported");
    if (voiceActive) {
      recognitionRef.current.stop();
      setVoiceActive(false);
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setVoiceActive(false);
    recognition.start();
    recognitionRef.current = recognition;
    setVoiceActive(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      setMessages((prev) => [...prev, { role: "user", content: `📷 Uploaded image.` }]);
      setLoading(true);
      try {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: input || "Describe this image",
          image: base64Image,
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error analyzing image." }]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScreenshot = () => {
    const fakeImage = { role: "user", content: `📸 Screenshot captured (simulate).` };
    setMessages((prev) => [...prev, fakeImage]);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
    setInput("");
  };

  const downloadImage = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "droxion-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div ref={chatRef} className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        {messages.map((msg, i) => (
          <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div className={`inline-block p-3 rounded-xl max-w-full break-words ${
              msg.role === "user" ? "bg-blue-700" : darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"
            }`}>
              <ReactMarkdown
                className="prose prose-invert text-sm"
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({ node, ...props }) => (
                    <div>
                      <img {...props} alt="Generated" style={{ maxWidth: "100%", borderRadius: "10px" }} />
                      <button onClick={() => downloadImage(props.src)} className="text-xs mt-1 underline text-blue-400">Download</button>
                    </div>
                  )
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-left text-gray-400 px-2 animate-pulse text-xl">...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-3 py-3 z-50">
        <div className="flex justify-between items-center max-w-3xl mx-auto mb-2 px-1">
          <div className="flex gap-3">
            <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
            <FaUpload onClick={() => fileInputRef.current.click()} className="text-white text-lg cursor-pointer" />
            <FaCamera onClick={handleScreenshot} className="text-white text-lg cursor-pointer" />
            <input type="file" ref={fileInputRef} onChange={handleUpload} style={{ display: "none" }} />
          </div>
          <div className="flex gap-3 items-center">
            <FaTrash onClick={clearChat} className="text-white text-lg cursor-pointer" />
            <button onClick={() => setDarkMode(!darkMode)} className="text-white text-xl">
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </div>

        <div className="flex max-w-3xl mx-auto bg-[#111] rounded-full px-4 py-3 items-center">
          <input
            type="text"
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
          >
            ➤
          </button>
        </div>

        {filteredSuggestions.length > 0 && (
          <div className="bg-[#111] max-w-3xl mx-auto mt-2 rounded-xl text-sm p-2">
            {filteredSuggestions.map((s, i) => (
              <div key={i} className="p-2 cursor-pointer hover:bg-gray-800 rounded" onClick={() => sendMessage(s)}>
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIChat;
