import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

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

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col pt-6">
      {/* Logo */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-400 tracking-widest">Droxion</h1>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 max-w-3xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-3 text-sm ${
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
        <div ref={bottomRef} />
      </div>

      {/* Fixed input and buttons at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-2 py-4">
        <div className="flex justify-center mb-2 flex-wrap gap-2 max-w-2xl mx-auto">
          <ToolButton title="DeepSearch" />
          <ToolButton title="Think" />
          <ToolButton title="Create Images" />
          <ToolButton title="Research" />
          <ToolButton title="Edit Image" />
          <ToolButton title="Latest News" />
          <ToolButton title="Personas" />
        </div>

        <div className="flex max-w-2xl mx-auto bg-[#111] rounded-full px-4 py-2 items-center">
          <input
            type="text"
            placeholder="What do you want to know?"
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
