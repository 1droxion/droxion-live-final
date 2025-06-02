import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Welcome! I’m your Droxion AI Assistant. Ask me anything about using the system — like creating videos, generating scripts, or managing reels.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com"}/chat`,
        { message: input }
      );

      const reply = res?.data?.reply || "No reply.";
      const assistantMessage = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (err) {
      console.error("❌ Chat Error:", err.message || err);
      alert("❌ Chat system failed to respond. Please check connection or server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="p-4 md:p-6 text-white h-[calc(100vh-80px)] flex flex-col">
      <h1 className="text-3xl font-bold text-center text-purple-400 mb-6 animate-fade-in">
        🤖 Droxion AI Chatboard
      </h1>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto bg-[#111827] rounded-xl p-6 shadow-2xl border border-gray-800 space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-xl px-5 py-4 rounded-2xl shadow-md relative animate-fade-in ${
              msg.role === "user"
                ? "ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                : "mr-auto bg-gradient-to-br from-purple-700 to-pink-700 text-white"
            }`}
          >
            <div className="text-sm opacity-80 mb-1">
              {msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}
            </div>
            <div className="whitespace-pre-wrap text-md font-medium">{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="text-gray-400 italic animate-pulse">✍️ AI is typing...</div>
        )}
      </div>

      <div className="mt-5 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about Droxion..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-grow bg-[#1f2937] p-4 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className={`px-8 py-3 text-lg rounded-xl font-bold transition-all ${
            loading
              ? "bg-gray-500 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
