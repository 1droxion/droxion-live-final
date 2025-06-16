import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaTrash, FaDownload, FaClock, FaPlus, FaVolumeUp, FaVolumeMute, FaVideo } from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const chatRef = useRef(null);

  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post("/chat", { prompt: input });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (audioOn) {
        const audioRes = await axios.post("/speak", { text: reply });
        const audio = new Audio(audioRes.data.url);
        audio.play();
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleAudio = () => setAudioOn(!audioOn);
  const toggleVideoMode = () => setVideoMode(!videoMode);

  const downloadChat = () => {
    const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat.txt";
    link.click();
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">
          <span className="text-white">💬 AI Chat </span>
          <span className="text-purple-400">(Droxion)</span>
        </div>
        <div className="flex space-x-4">
          <FaClock title="History" className="cursor-pointer" />
          <FaPlus title="New Chat" className="cursor-pointer" onClick={clearChat} />
          <FaTrash title="Clear" className="cursor-pointer" onClick={clearChat} />
          <FaDownload title="Download" className="cursor-pointer" onClick={downloadChat} />
          {audioOn ? (
            <FaVolumeUp title="Voice On" className="cursor-pointer" onClick={toggleAudio} />
          ) : (
            <FaVolumeMute title="Voice Off" className="cursor-pointer" onClick={toggleAudio} />
          )}
          <FaVideo title="Video Mode" className={`cursor-pointer ${videoMode ? 'text-green-500' : ''}`} onClick={toggleVideoMode} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black self-end" : "bg-gray-800 text-white self-start"}`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="text-gray-500">Typing...</div>}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-gray-900 text-white border border-gray-600 focus:outline-none"
            placeholder="Type or say anything..."
          />
          <button
            onClick={handleSend}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
