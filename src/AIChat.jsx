import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone,
  FaUpload,
  FaCamera,
  FaSun,
  FaMoon,
  FaTrash
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
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
  }, [messages]);

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

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📎 Uploaded: ${file.name}` }
      ]);
    }
  };

  const handleScreenshot = () => {
    alert("📸 Screenshot captured (simulate). Add real logic if needed.");
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
    setInput("");
  };

  return (
    <div ref={chatRef} className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col justify-center items-center flex-1 px-4">
          <div className="max-w-md w-full bg-[#111] border border-gray-700 p-6 rounded-2xl shadow-xl text-center">
            <input
              type="text"
              placeholder="Ask anything..."
              className="w-full bg-transparent text-white text-sm outline-none border border-gray-700 rounded-full px-4 py-3 mb-4"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ fontSize: 16 }}
            />
            {filteredSuggestions.length > 0 && (
              <div className="bg-[#222] rounded-xl text-sm p-2 mb-4">
                {filteredSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-2 cursor-pointer hover:bg-gray-800 rounded text-left"
                    onClick={() => sendMessage(s)}
                  >
                    {s}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-center gap-2 flex-wrap mb-4">
              {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((title) => (
                <button
                  key={title}
                  onClick={() => sendMessage(title)}
                  className="border border-gray-700 bg-black text-white px-3 py-1 rounded-full text-xs hover:bg-white hover:text-black transition"
                >
                  {title}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-4 text-white text-lg">
              <FaMicrophone onClick={startVoice} className="cursor-pointer" />
              <FaUpload onClick={() => fileInputRef.current.click()} className="cursor-pointer" />
              <FaCamera onClick={handleScreenshot} className="cursor-pointer" />
              <button onClick={() => setDarkMode(!darkMode)}>
                {darkMode ? <FaSun /> : <FaMoon />}
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              style={{ display: "none" }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 pb-36">
            {messages.map((msg, i) => (
              <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
                <div
                  className={`inline-block p-3 rounded-xl max-w-full break-words ${
                    msg.role === "user" ? "bg-blue-700" : darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"
                  }`}
                >
                  <ReactMarkdown className="prose prose-invert text-sm" rehypePlugins={[rehypeRaw]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="my-3 text-left text-sm text-gray-400 px-2">
                <div className="flex gap-1 animate-pulse text-2xl">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar with tools */}
          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-3 py-3 z-50">
            <div className="flex justify-between items-center max-w-3xl mx-auto mb-2 px-1">
              <div className="flex gap-3">
                <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
                <FaUpload onClick={() => fileInputRef.current.click()} className="text-white text-lg cursor-pointer" />
                <FaCamera onClick={handleScreenshot} className="text-white text-lg cursor-pointer" />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUpload}
                  style={{ display: "none" }}
                />
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
        </>
      )}
    </div>
  );
}

export default AIChat;