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
    const text = input.toLowerCase();
    if (text.includes("weather")) setAutoSuggest("Try: What's the weather in Paris?");
    else if (text.includes("image")) setAutoSuggest("Try: Generate image of a futuristic city");
    else if (text.includes("stock")) setAutoSuggest("Try: Stock: AAPL");
    else if (text.includes("youtube")) setAutoSuggest("Try: Search YouTube for Mr Beast");
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
    const userInput = input.trim();
    const prompt = persona ? `[${persona}]\n${userInput}` : userInput;
    const userMsg = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAutoSuggest("");
    setLoading(true);

    try {
      let reply = "";

      if (userInput.toLowerCase().includes("generate image")) {
        const res = await axios.post("https://droxion-backend.onrender.com/generate-image", {
          prompt: userInput,
          user_id: userId
        });
        reply = `![AI Image](${res.data.image_url})`;
      } else if (userInput.toLowerCase().includes("search youtube")) {
        const res = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt: userInput,
          user_id: userId
        });
        reply = res.data.video_cards.join("\n");
      } else if (
        userInput.toLowerCase().startsWith("stock:") ||
        userInput.toLowerCase().startsWith("crypto:") ||
        userInput.toLowerCase().includes("weather") ||
        userInput.toLowerCase().includes("news") ||
        userInput.toLowerCase().includes("time in")
      ) {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt: userInput,
          user_id: userId,
          persona,
          save_memory: true
        });
        reply = res.data.reply;
      } else {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          prompt,
          user_id: userId,
          persona,
          save_memory: true
        });
        reply = res.data.reply;
      }

      reply = reply.replace(/(https?:\/\/[^\s]+)/g, (url) => `[🔗 ${url}](${url})`);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Error or connection failed." }]);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = () => {
    if (!("webkitSpeechRecognition" in window)) return alert("Voice not supported");
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.start();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      setMessages((prev) => [...prev, { role: "user", content: "📷 Uploaded Image" }]);
      setLoading(true);
      try {
        const res = await axios.post("https://droxion-backend.onrender.com/chat", {
          image_base64: base64,
          user_id: localStorage.getItem("user_id"),
          vision: true,
          save_memory: true
        });
        setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Image analysis failed." }]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      canvas.toBlob((blob) => {
        const file = new File([blob], "screenshot.png", { type: "image/png" });
        const fakeEvent = { target: { files: [file] } };
        handleFileChange(fakeEvent);
      });
    } catch {
      alert("❌ Screenshot failed.");
    }
  };

  const handlePersonaChange = (p) => {
    setPersona(p);
    localStorage.setItem("selectedPersona", p);
    axios.post("https://droxion-backend.onrender.com/save-persona", {
      user_id: localStorage.getItem("user_id"),
      persona: p
    });
  };

  return (
    <div className={`flex flex-col min-h-screen w-full ${darkMode ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-bold tracking-widest text-gray-400">Droxion</h1>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col justify-center items-center flex-1 px-4">
          <div className="max-w-md w-full bg-[#111] border border-gray-700 p-6 rounded-2xl shadow-xl text-center">
            <div className="mb-4 flex justify-center gap-2 flex-wrap">
              {PERSONAS.map(p => (
                <button key={p} onClick={() => handlePersonaChange(p)} className={`px-3 py-1 text-xs rounded-full border ${persona === p ? 'bg-white text-black' : 'bg-transparent text-white border-gray-600'}`}>{p}</button>
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
                      img: ({...props}) => <img {...props} className="rounded-xl my-2 max-w-xs" />,
                      iframe: ({...props}) => <iframe {...props} className="rounded-xl my-2 max-w-xs" allowFullScreen />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-left text-gray-400 px-2 my-3 text-sm">
                <div className="flex gap-1 animate-pulse text-2xl"><span>.</span><span className="delay-100">.</span><span className="delay-200">.</span></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-3 py-3 z-50">
            <div className="flex justify-between items-center max-w-3xl mx-auto mb-2">
              <div className="flex gap-3">
                <FaMicrophone onClick={startVoice} className="text-white text-lg cursor-pointer" />
                <FaUpload onClick={() => fileInputRef.current.click()} className="text-white text-lg cursor-pointer" />
                <FaCamera className="text-white text-lg cursor-pointer" onClick={handleScreenshot} />
                <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
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
                placeholder="Type a message or goal..."
                className="flex-1 bg-transparent text-white text-sm outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300"
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
