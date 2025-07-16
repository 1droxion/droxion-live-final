import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        message: input,
      });
      const botMsg = { role: "assistant", content: res.data.response };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const ToolButton = ({ title }) => (
    <button
      onClick={() => {
        setInput(title.toLowerCase());
        sendMessage();
      }}
      className="border px-3 py-1 rounded-full text-white text-sm hover:bg-white hover:text-black transition"
    >
      {title}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative">
      {/* Top Logo */}
      <div className="text-center pt-4 pb-2">
        <h1 className="text-2xl font-semibold text-gray-400">Droxion</h1>
      </div>

      {/* Chat Area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 pb-32 w-full max-w-3xl mx-auto"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`my-4 text-sm whitespace-pre-wrap ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <ReactMarkdown
              className="prose prose-invert"
              rehypePlugins={[rehypeRaw]}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black z-10 px-2 py-3">
        <div className="flex justify-center mb-2 flex-wrap gap-2">
          <ToolButton title="Create Images" />
          <ToolButton title="Research" />
          <ToolButton title="Edit Image" />
          <ToolButton title="Latest News" />
          <ToolButton title="Personas" />
        </div>
        <div className="flex max-w-3xl mx-auto bg-[#111] rounded-full px-4 py-2 items-center">
          <input
            type="text"
            placeholder="Type your question..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="ml-3 px-3 py-1 rounded-full bg-white text-black text-sm hover:bg-gray-300 transition"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
