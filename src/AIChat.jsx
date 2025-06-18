import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone,
  FaMemory
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(() => {
    return localStorage.getItem("droxion_memory") === "true";
  });
  const [memoryData, setMemoryData] = useState(() => {
    const data = localStorage.getItem("droxion_memory_data");
    return data ? JSON.parse(data) : [];
  });

  const chatRef = useRef(null);
  const synth = window.speechSynthesis;

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
  };

  const saveToMemory = (text) => {
    if (text.toLowerCase().includes("my name is")) {
      const name = text.split("my name is")[1].trim().split(" ")[0];
      const updated = [...memoryData, `User's name is ${name}`];
      setMemoryData(updated);
      localStorage.setItem("droxion_memory_data", JSON.stringify(updated));
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setTyping(true);
    saveToMemory(input);

    const systemPrompt = memoryEnabled && memoryData.length
      ? `Use this memory about user: ${memoryData.join(" | ")}`
      : "";

    try {
      const res = await axios.post("/api/chat", {
        messages: [
          { role: "system", content: systemPrompt },
          ...newMessages
        ]
      });
      const aiReply = res.data.reply;
      const aiMessage = { role: "assistant", content: aiReply };
      setMessages((prev) => [...prev, aiMessage]);
      speak(aiReply);
    } catch (err) {
      console.error("API error:", err);
    } finally {
      setTyping(false);
    }
  };

  const toggleMemory = () => {
    const newState = !memoryEnabled;
    setMemoryEnabled(newState);
    localStorage.setItem("droxion_memory", newState);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">AI Chat</h1>
        <button
          onClick={toggleMemory}
          className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700"
        >
          <FaMemory /> Memory {memoryEnabled ? "On" : "Off"}
        </button>
      </div>

      <div className="space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`p-3 rounded max-w-xl ${msg.role === "user" ? "ml-auto bg-blue-800" : "bg-gray-800"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        ))}

        {typing && <div className="text-gray-400 animate-pulse">Typing...</div>}
        <div ref={chatRef}></div>
      </div>

      <div className="mt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="w-full p-3 bg-gray-900 rounded resize-none h-24 text-white"
        ></textarea>
        <div className="flex justify-between mt-2">
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
