import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Send, Loader2 } from "lucide-react";

function Chatboard() {
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMsg = { sender: "user", text: message };
    setChatLog((prev) => [...prev, userMsg]);
    setMessage("");
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/chat`, {
        message,
      });
      const reply = res.data.reply || "⚠️ No reply from AI.";
      setChatLog((prev) => [...prev, { sender: "ai", text: reply }]);
    } catch (err) {
      console.error("❌ Chat error:", err);
      setChatLog((prev) => [...prev, { sender: "ai", text: "❌ Failed to get response." }]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4 text-green-400">💬 AI Chatboard</h1>

      <div className="bg-[#0e0e10] border border-gray-700 rounded-lg p-4 h-[500px] overflow-y-auto space-y-4">
        {chatLog.map((msg, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg max-w-[80%] ${
              msg.sender === "user"
                ? "ml-auto bg-green-600 text-white"
                : "mr-auto bg-gray-800 text-green-300"
            }`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef}></div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <textarea
          rows="2"
          className="flex-grow p-3 rounded-lg bg-[#1e1e1e] text-white border border-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="p-3 bg-green-500 rounded-full text-white hover:bg-green-600 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

export default Chatboard;
