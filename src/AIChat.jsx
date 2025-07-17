// ✅ AIChat.jsx — Full Final Version for Droxion
// Features: Persona filters, AI auto-guess, live previews while typing, centered layout before chat, image cards with download

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
  const [voiceActive, setVoiceActive] = useState(false);
  const [persona, setPersona] = useState(null);
  const [livePreview, setLivePreview] = useState(null);
  const [autoSuggest, setAutoSuggest] = useState("");
  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const firstMessage = messages.length === 0;

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [messages]);

  useEffect(() => {
    const val = input.toLowerCase();
    if (!val) {
      setLivePreview(null);
      setAutoSuggest("");
      return;
    }

    if (val.startsWith("stock:")) {
      const symbol = val.replace("stock:", "").trim().toUpperCase();
      setLivePreview(`<b>📈 ${symbol} Stock Preview</b><br/><iframe width='100%' height='200' src='https://www.google.com/finance/quote/${symbol}:NASDAQ' frameborder='0'></iframe>`);
      setAutoSuggest("Show stock preview");
    } else if (val.includes("weather in")) {
      const city = val.split("weather in")[1]?.trim();
      if (city) {
        setLivePreview(`<b>🌤️ Weather Preview for ${city}</b><br/><i>Click ➤ to see full weather data</i>`);
        setAutoSuggest("Get weather forecast");
      }
    } else if (val.includes("image of")) {
      setAutoSuggest("Generate AI image");
    } else if (val.includes("youtube") || val.includes("video")) {
      setAutoSuggest("Search YouTube");
    } else if (val.length > 10) {
      setAutoSuggest("Ask AI to explain or summarize");
    } else {
      setAutoSuggest("");
      setLivePreview(null);
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const prompt = persona ? `[${persona}]
${input}` : input;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAutoSuggest("");
    setLivePreview(null);
    setLoading(true);

    try {
      if (input.toLowerCase().includes("image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        const imgUrl = res.data.image_url;
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `![Generated Image](${imgUrl})`
        }]);
      } else if (input.toLowerCase().includes("youtube") || input.toLowerCase().includes("video")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt });
        const ytUrl = res.data.url;
        const title = res.data.title;
        const yt = new URL(ytUrl);
        const videoId = yt.searchParams.get("v") || yt.pathname.split("/").pop();
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `<b>📺 ${title}</b><br/><iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`
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

  const downloadImage = (url) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "droxion-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      {firstMessage ? (
        <div className="flex flex-col justify-center items-center flex-1 px-4">
          <div className="max-w-md w-full bg-[#111] border border-gray-700 p-6 rounded-2xl shadow-xl text-center">
            <div className="mb-4 flex justify-center gap-2 flex-wrap">
              {PERSONAS.map(p => (
                <button
                  key={p}
                  onClick={() => setPersona(p)}
                  className={`px-3 py-1 text-xs rounded-full border ${persona === p ? 'bg-white text-black' : 'bg-transparent text-white border-gray-600'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ask anything..."
              className="w-full bg-transparent text-white text-sm outline-none border border-gray-700 rounded-full px-4 py-3 mb-2"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {autoSuggest && <p className="text-xs text-gray-400 italic mt-1">💡 {autoSuggest}</p>}
            {livePreview && (
              <div className="text-left text-sm text-green-300 mt-4 p-2 border border-green-700 rounded-xl" dangerouslySetInnerHTML={{ __html: livePreview }} />
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 pb-32">
            {messages.map((msg, i) => (
              <div key={i} className={`my-3 text-sm ${msg.role === "user" ? "text-right" : "text-left"}`}>
                <div className={`inline-block p-3 rounded-xl max-w-full break-words ${msg.role === "user" ? "bg-blue-700" : darkMode ? "bg-[#1a1a1a]" : "bg-gray-200"}`}>
                  <ReactMarkdown
                    className="prose prose-invert text-sm"
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      img: ({ node, ...props }) => (
                        <div>
                          <img {...props} alt="Generated" style={{ maxWidth: "100%", borderRadius: "10px" }} />
                          <button onClick={() => downloadImage(props.src)} className="text-xs text-blue-400 underline mt-1">Download</button>
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

          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-3 py-3 z-50">
            <div className="flex justify-between items-center max-w-3xl mx-auto mb-2 px-1">
              <div className="flex gap-3">
                <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
                <FaUpload onClick={() => fileInputRef.current.click()} className="text-white text-lg cursor-pointer" />
                <FaCamera className="text-white text-lg cursor-pointer" />
                <input type="file" ref={fileInputRef} style={{ display: "none" }} />
              </div>
              <div className="flex gap-3 items-center">
                <FaTrash onClick={() => setMessages([])} className="text-white text-lg cursor-pointer" />
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
                onClick={sendMessage}
                disabled={loading}
                className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
              >
                ➤
              </button>
            </div>
            {autoSuggest && <div className="text-xs text-center text-gray-400 mt-2">💡 {autoSuggest}</div>}
          </div>
        </>
      )}
    </div>
  );
}

export default AIChat;
