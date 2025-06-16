import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [avatarMode, setAvatarMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const fileInputRef = useRef();
  const bottomRef = useRef();

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("/chat", { prompt: input });
      const reply = response.data.reply;

      const classification = await axios.post("/classify", { prompt: input });
      const type = classification.data.type;

      if (type === "youtube") {
        const yt = await axios.post("/search-youtube", { prompt: input });
        const url = yt.data.url;
        const title = yt.data.title;
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: reply },
          { sender: "yt", text: title, url }
        ]);
        setVideoUrl(url);
        if (voiceMode && avatarMode) handleVoice(reply);
        return;
      }

      if (type === "image") {
        const img = await axios.post("/generate-image", { prompt: input });
        const url = img.data.image_url;
        setMessages((prev) => [
          ...prev,
          { sender: "ai", text: reply },
          { sender: "img", url }
        ]);
        setImageUrl(url);
        if (voiceMode && avatarMode) handleVoice(reply);
        return;
      }

      setMessages((prev) => [...prev, { sender: "ai", text: reply }]);
      if (voiceMode && avatarMode) handleVoice(reply);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: "❌ Error: Something went wrong." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = async (text) => {
    try {
      const res = await axios.post("/talk-avatar", 
        Object.assign(new FormData(), {
          image: fileInputRef.current.files[0],
          prompt: text
        }),
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setMessages((prev) => [...prev, { sender: "avatar", url: res.data.video_url }]);
    } catch (e) {
      console.error("Voice error", e);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <div className="px-4 py-2 border-b border-gray-800 text-lg font-bold flex items-center">
        <span className="text-2xl mr-2">💬</span> AI Chat <span className="text-purple-400 ml-2">(Droxion)</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setVoiceMode(!voiceMode)}>{voiceMode ? "🔊" : "🔇"}</button>
          <button onClick={() => setAvatarMode(!avatarMode)}>{avatarMode ? "🎭" : "👤"}</button>
          <input type="file" accept="image/*" hidden ref={fileInputRef} />
          <button onClick={() => fileInputRef.current.click()}>➕</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.sender === "user" ? "text-right" : "text-left"}`}>
            {msg.sender === "yt" && (
              <div className="bg-purple-700 text-white p-2 rounded-lg inline-block">
                <a href={msg.url} target="_blank" rel="noopener noreferrer">📺 {msg.text}</a>
              </div>
            )}
            {msg.sender === "img" && <img src={msg.url} alt="Result" className="w-72 rounded-lg" />}
            {msg.sender === "avatar" && (
              <video src={msg.url} controls className="w-80 rounded-lg" />
            )}
            {msg.sender !== "yt" && msg.sender !== "img" && msg.sender !== "avatar" && (
              <div className={`inline-block px-4 py-2 rounded-lg ${msg.sender === "user" ? "bg-white text-black" : "bg-gray-800 text-white"}`}>
                {msg.text}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-gray-500">⏳ Droxion is thinking...</div>}
        <div ref={bottomRef}></div>
      </div>
      <div className="p-2 border-t border-gray-800 flex">
        <input
          className="flex-1 bg-black text-white p-2 rounded border border-gray-700"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or say anything..."
        />
        <button
          className="ml-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          onClick={handleSend}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default AIChat;
