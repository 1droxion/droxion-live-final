import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const chatEndRef = useRef(null);

  const speak = (text) => {
    if (!audioEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      let fileAttached = false;
      let imgPrompt = "";

      if (input.includes("/img")) {
        imgPrompt = input.replace("/img", "").trim();
        const res = await axios.post("/generate-image", { prompt: imgPrompt });
        setMessages((prev) => [...prev, { role: "ai", type: "image", content: res.data.image_url }]);
      } else if (input.includes("/yt")) {
        const ytPrompt = input.replace("/yt", "").trim();
        const res = await axios.post("/search-youtube", { prompt: ytPrompt });
        setMessages((prev) => [
          ...prev,
          { role: "ai", type: "video", content: res.data.url, title: res.data.title },
        ]);
      } else if (input.includes("/news")) {
        const res = await axios.post("/news", { prompt: input });
        setMessages((prev) => [
          ...prev,
          { role: "ai", type: "text", content: res.data.headlines.join("\n") },
        ]);
      } else if (input.includes("/google")) {
        const query = input.replace("/google", "").trim();
        const link = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        setMessages((prev) => [
          ...prev,
          { role: "ai", type: "link", content: link, title: query },
        ]);
      } else {
        const res = await axios.post("/chat", { prompt: input });
        const reply = res.data.reply;
        setMessages((prev) => [...prev, { role: "ai", type: "text", content: reply }]);
        speak(reply);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", type: "error", content: "Something went wrong." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-3 bg-black text-white text-lg font-bold shadow">
        <div>
          <span role="img" aria-label="chat">💬</span> AI <span className="text-purple-400">(Droxion)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVideoMode(!videoMode)}>{videoMode ? "📽️" : "🕒"}</button>
          <button onClick={() => setAudioEnabled(!audioEnabled)}>{audioEnabled ? "🔊" : "🔇"}</button>
          <button onClick={() => window.location.reload()}>➕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e0e10]">
        {messages.map((msg, i) => (
          <div key={i} className={
            msg.role === "user" ? "text-right" : "text-left"
          }>
            {msg.type === "text" && (
              <div className={
                msg.role === "user"
                  ? "inline-block bg-white text-black px-4 py-2 rounded-xl"
                  : "inline-block bg-gray-800 text-white px-4 py-2 rounded-xl"
              }>{msg.content}</div>
            )}
            {msg.type === "image" && (
              <img
                src={msg.content}
                alt="Generated"
                className="max-w-xs rounded-xl border border-gray-600"
              />
            )}
            {msg.type === "video" && (
              videoMode ? (
                <iframe
                  className="w-full max-w-md rounded-xl"
                  height="250"
                  src={msg.content.replace("watch?v=", "embed/")}
                  title="YouTube Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <a
                  href={msg.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-xl bg-blue-900 text-white underline"
                >📺 {msg.title}</a>
              )
            )}
            {msg.type === "link" && (
              <a
                href={msg.content}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-xl bg-green-700 text-white underline"
              >🔗 Google: {msg.title}</a>
            )}
            {msg.type === "error" && (
              <div className="inline-block bg-red-700 text-white px-4 py-2 rounded-xl">
                ❌ {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef}></div>
      </div>

      <div className="p-4 bg-black flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type or say anything..."
          className="flex-1 px-4 py-2 rounded-full bg-white text-black"
        />
        <button
          onClick={handleSend}
          className="bg-purple-600 text-white px-4 py-2 rounded-full"
        >Send</button>
      </div>
    </div>
  );
}

export default AIChat;
