import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newUserMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        message: input,
      });
      const botReply = { role: "assistant", content: res.data.response };
      setMessages((prev) => [...prev, botReply]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Error: Something went wrong. Please try again.",
        },
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
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const ToolButton = ({ title }) => (
    <button
      className="border px-3 py-1 rounded-full text-white text-sm hover:bg-white hover:text-black transition"
      onClick={() => {
        setInput(title.toLowerCase());
        sendMessage();
      }}
    >
      {title}
    </button>
  );

  return (
    <div className="flex flex-col bg-black min-h-screen text-white relative">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-2xl text-gray-300 font-semibold">Droxion</h1>
      </div>

      {/* Top Tools */}
      <div className="flex justify-center gap-4 mb-3 flex-wrap">
        <ToolButton title="DeepSearch" />
        <ToolButton title="Think" />
      </div>

      {/* Input Section */}
      <div className="flex justify-center mb-4">
        <div className="bg-[#111] p-4 rounded-xl max-w-2xl w-full mx-4 shadow-md">
          <input
            className="w-full bg-transparent text-white outline-none text-sm"
            placeholder="What do you want to know?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <ToolButton title="Create Images" />
            <ToolButton title="Research" />
            <ToolButton title="Edit Image" />
            <ToolButton title="Latest News" />
            <ToolButton title="Personas" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-40"
        ref={chatContainerRef}
        style={{ maxHeight: "calc(100vh - 300px)" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-4 px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]} className="prose prose-invert">
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-black">
        <div className="flex max-w-2xl mx-auto bg-[#111] rounded-full items-center px-4 py-2 shadow-md">
          <input
            type="text"
            placeholder="Type your question..."
            className="flex-1 bg-transparent text-white outline-none text-sm"
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
