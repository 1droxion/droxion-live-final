import React, { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
      });

      const botMsg = { role: "assistant", content: res.data.reply };
      setMessages((prev) => [botMsg, ...prev]);
    } catch (err) {
      setMessages((prev) => [
        { role: "assistant", content: "⚠️ Error from AI. Try again." },
        ...prev,
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

  const ToolButton = ({ title }) => (
    <button
      onClick={() => {
        setInput(title.toLowerCase());
        sendMessage();
      }}
      className="border border-gray-700 bg-black text-white px-3 py-1 rounded-full text-xs hover:bg-white hover:text-black transition"
    >
      {title}
    </button>
  );

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center pt-8 px-2">
      {/* Logo */}
      <h1 className="text-2xl font-bold text-gray-400 mb-4 tracking-widest">Droxion</h1>

      {/* Input Card Centered */}
      <div className="w-full max-w-xl bg-[#111] border border-gray-700 rounded-2xl p-4 shadow-lg">
        <input
          type="text"
          className="w-full bg-transparent text-white outline-none text-sm mb-3"
          placeholder="What do you want to know?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <div className="flex flex-wrap gap-2 mb-3">
          <ToolButton title="DeepSearch" />
          <ToolButton title="Think" />
          <ToolButton title="Create Images" />
          <ToolButton title="Research" />
          <ToolButton title="Edit Image" />
          <ToolButton title="Latest News" />
          <ToolButton title="Personas" />
        </div>

        <div className="text-center">
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-white text-black text-sm px-4 py-1 rounded-full hover:bg-gray-200 transition"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Replies shown below */}
      <div className="mt-6 w-full max-w-3xl flex flex-col items-center px-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`w-full my-3 text-sm ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <div className="inline-block bg-[#1a1a1a] p-3 rounded-xl max-w-full">
              <ReactMarkdown
                className="prose prose-invert text-sm"
                rehypePlugins={[rehypeRaw]}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AIChat;
