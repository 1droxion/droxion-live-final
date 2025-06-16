// AIChat.jsx - Final with voice toggle, avatar mode, smart response
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

export default function AIChat() {
  const [messages, setMessages] = useState([
    { type: "ai", text: "Hello! How can I assist you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileRef = useRef();
  const chatRef = useRef();

  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const speak = (text) => {
    if (!videoMode) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { type: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const formData = new FormData();
    const isImage = fileRef.current?.files[0];

    if (isImage) {
      formData.append("image", fileRef.current.files[0]);
      formData.append("prompt", input);
      try {
        const res = await axios.post("/analyze-image", formData);
        const aiMsg = { type: "ai", text: res.data.reply };
        setMessages((prev) => [...prev, aiMsg]);
        speak(res.data.reply);
      } catch (e) {
        setMessages((prev) => [...prev, { type: "error", text: "Something went wrong." }]);
      }
      setLoading(false);
      return;
    }

    try {
      const classify = await axios.post("/classify", { prompt: input });
      const intent = classify.data.intent;

      if (intent === "image") {
        const res = await axios.post("/generate-image", { prompt: input });
        setMessages((prev) => [...prev, { type: "image", url: res.data.image_url }]);
      } else if (intent === "youtube") {
        const res = await axios.post("/search-youtube", { prompt: input });
        setMessages((prev) => [
          ...prev,
          { type: "video", url: res.data.url, title: res.data.title },
        ]);
      } else if (intent === "news") {
        const res = await axios.post("/news", { prompt: input });
        const text = res.data.headlines.join("\n- ");
        setMessages((prev) => [...prev, { type: "ai", text }]);
        speak(text);
      } else {
        const res = await axios.post("/chat", { prompt: input });
        const reply = res.data.reply;
        setMessages((prev) => [...prev, { type: "ai", text: reply }]);
        speak(reply);
      }
    } catch {
      setMessages((prev) => [...prev, { type: "error", text: "Something went wrong." }]);
    }

    setLoading(false);
  };

  useEffect(scrollToBottom, [messages]);

  return (
    <div className="p-4 text-white min-h-screen bg-black">
      <div className="text-2xl font-bold mb-3">
        <span className="text-purple-300">💬 AI Chat </span>
        <span className="text-pink-400">(Droxion)</span>
        <span
          className="ml-2 cursor-pointer"
          title="Toggle Avatar Mode"
          onClick={() => setVideoMode(!videoMode)}
        >
          {videoMode ? "🔊" : "🔈"}
        </span>
        <span className="ml-2 cursor-pointer" onClick={() => fileRef.current?.click()}>
          ➕
        </span>
        <input ref={fileRef} type="file" accept="image/*" hidden />
      </div>

      <div className="space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-xl px-4 py-2 max-w-xl ${m.type === "user" ? "bg-white text-black ml-auto" : m.type === "ai" ? "bg-gray-800" : m.type === "image" ? "" : m.type === "video" ? "bg-blue-900" : "bg-red-900"}`}>
            {m.type === "image" && (
              <img src={m.url} alt="result" className="w-full max-w-xs rounded-lg" />
            )}
            {m.type === "video" && (
              <div>
                <iframe
                  width="300"
                  height="180"
                  src={m.url.replace("watch?v=", "embed/")}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube video"
                  className="rounded-lg"
                ></iframe>
                <p className="text-sm text-white mt-1">{m.title}</p>
              </div>
            )}
            {m.type !== "image" && m.type !== "video" && m.text}
          </div>
        ))}
        {loading && <div className="text-gray-400">Typing...</div>}
        <div ref={chatRef}></div>
      </div>

      <div className="flex items-center mt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or say anything..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-white text-black p-2 rounded-l-lg"
        />
        <button onClick={sendMessage} className="bg-purple-600 px-4 py-2 rounded-r-lg">
          ➤
        </button>
      </div>
    </div>
  );
}
