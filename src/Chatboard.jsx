import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "👋 Welcome! I’m your Droxion AI Assistant. Ask me anything about using the system — like creating videos, generating scripts, or managing reels.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful and friendly assistant for Droxion. Help users understand how to use Droxion's AI features: video generation, voiceovers, scripting, uploading, reels, and posting.",
            },
            ...newMessages,
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const reply = res?.data?.choices?.[0]?.message?.content || "No reply.";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("❌ Chat Error:", err.message || err);
      alert("❌ AI failed to respond. Please check API key or internet.");
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
      <h1 className="text-3xl font-bold text-center text-purple-400 mb-4 md:mb-6">
        🤖 Droxion AI Chatboard
      </h1>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto bg-[#111827] rounded-xl p-5 shadow-xl border border-gray-800 space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap max-w-2xl px-5 py-3 rounded-2xl shadow-md ${
              msg.role === "user"
                ? "ml-auto bg-blue-600 text-white text-right"
                : "mr-auto bg-gradient-to-br from-purple-700 to-indigo-700 text-white"
            }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="text-gray-400 italic animate-pulse">
            ✍️ AI is typing...
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col md:flex-row gap-3">
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
          className={`px-8 py-3 text-lg rounded-xl font-bold transition-all text-white ${
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
