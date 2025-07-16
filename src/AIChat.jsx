import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [userMessage, ...prev]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { message: input });
      const reply = { role: "assistant", content: res.data.response };
      setMessages((prev) => [reply, ...prev]);
    } catch (err) {
      const errorMsg = {
        role: "assistant",
        content: "⚠️ Error: Failed to fetch reply. Please try again.",
      };
      setMessages((prev) => [errorMsg, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const ToolButton = ({ title }) => (
    <button
      className="border px-3 py-1 rounded-full text-white text-sm hover:bg-white hover:text-black transition"
      onClick={() => {
        setInput(title.toLowerCase());
        handleSend();
      }}
    >
      {title}
    </button>
  );

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center relative overflow-hidden">
      {/* Droxion Title */}
      <h1 className="text-gray-300 text-2xl font-semibold mt-4">Droxion</h1>

      {/* Top Tool Buttons */}
      <div className="mt-6 mb-2 flex gap-3 flex-wrap justify-center">
        <ToolButton title="DeepSearch" />
        <ToolButton title="Think" />
      </div>

      {/* Input Card */}
      <div className="w-full max-w-3xl px-4">
        <div className="bg-[#111] rounded-xl p-4 w-full text-white shadow-md text-sm">
          <input
            type="text"
            placeholder="What do you want to know?"
            className="bg-transparent outline-none w-full"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="mt-2 flex justify-start gap-2">
            <ToolButton title="Create Images" />
            <ToolButton title="Research" />
            <ToolButton title="Edit Image" />
            <ToolButton title="Latest News" />
            <ToolButton title="Personas" />
          </div>
        </div>
      </div>

      {/* Message Container */}
      <div className="w-full max-w-3xl flex-1 overflow-y-auto px-4 mt-4 mb-28 flex flex-col-reverse">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`my-2 p-3 rounded-lg text-sm ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]} className="prose prose-invert whitespace-pre-wrap">
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Bottom Input Fixed */}
      <div className="fixed bottom-4 w-full flex justify-center px-4">
        <div className="bg-[#111] max-w-3xl w-full p-4 rounded-xl flex items-center shadow-md">
          <input
            type="text"
            placeholder="Type your question..."
            className="flex-1 bg-transparent outline-none text-white text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="ml-3 px-4 py-1 text-sm rounded-full bg-white text-black hover:bg-gray-300 transition"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
