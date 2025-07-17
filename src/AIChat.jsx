import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaMoon, FaSun
} from "react-icons/fa";

const SUGGESTIONS = [
  "Show me latest news",
  "Generate an image of futuristic city",
  "What is the time in Tokyo?",
  "Search YouTube for AI robot dance",
  "Stock: TSLA",
  "Crypto: BTC",
  "weather in New York",
  "Tell me a joke",
  "Create a YouTube thumbnail",
  "Explain quantum computing",
];

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const setHeight = () => {
      if (chatRef.current) {
        chatRef.current.style.height = window.innerHeight + "px";
      }
    };
    window.addEventListener("resize", setHeight);
    setHeight();
    return () => window.removeEventListener("resize", setHeight);
  }, []);

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
      if (prompt.toLowerCase().includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        const imgUrl = res.data.image_url;
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `<div style="margin-top:10px;"><img src="${imgUrl}" style="width:100%; border-radius:12px;" /></div>`,
        }]);
      } else if (prompt.toLowerCase().includes("youtube") || prompt.toLowerCase().includes("video")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt });
        const ytUrl = res.data.url;
        const title = res.data.title;
        const yt = new URL(ytUrl);
        const videoId = yt.searchParams.get("v") || yt.pathname.split("/").pop();
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `<b>📺 ${title}</b><br/><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
        }]);
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt });
        let reply = res.data.reply;
        reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error from AI. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <div ref={chatRef} className={`flex flex-col w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      {/* Header */}
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-3 max-w-3xl mx-auto w-full pb-32">
        {messages.map((msg, i) => (
          <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <div
              className={`inline-block p-3 rounded-xl max-w-full break-words ${
                msg.role === "user"
                  ? "bg-blue-700 text-white"
                  : darkMode ? "bg-[#1a1a1a] text-white" : "bg-gray-200 text-black"
              }`}
            >
              <ReactMarkdown className="prose prose-invert text-sm" rehypePlugins={[rehypeRaw]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="my-3 text-left text-sm px-2 text-gray-400">
            <div className="flex gap-1 animate-pulse text-2xl">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce delay-100">.</span>
              <span className="animate-bounce delay-200">.</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {filteredSuggestions.length > 0 && (
        <div className="absolute bottom-24 left-0 right-0 max-w-xl mx-auto px-4 z-40">
          <div className="bg-[#1a1a1a] text-white rounded-xl border border-gray-700 p-2 text-sm shadow-xl">
            {filteredSuggestions.map((s, i) => (
              <div
                key={i}
                className="p-2 cursor-pointer hover:bg-gray-800 rounded"
                onClick={() => sendMessage(s)}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer input */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-2 py-4 z-50">
        <div className="flex justify-between items-center max-w-2xl mx-auto mb-2 px-1">
          <div className="flex gap-2">
            <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
            <FaUpload className="text-white text-lg cursor-pointer" />
            <FaCamera className="text-white text-lg cursor-pointer" />
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="text-white text-xl">
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
        <div className="flex max-w-2xl mx-auto bg-[#111] rounded-full px-4 py-2 items-center">
          <input
            type="text"
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontSize: 16 }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;