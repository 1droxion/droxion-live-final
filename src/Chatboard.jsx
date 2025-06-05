import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function Chatboard() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("droxion_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setInput("");
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/chat`,
        { message: input }
      );
      const botMsg = { role: "assistant", content: res.data.reply };
      const newMessages = [...messages, userMsg, botMsg];
      setMessages(newMessages);
      localStorage.setItem("droxion_chat_history", JSON.stringify(newMessages));
    } catch (err) {
      console.error("❌ Chat failed", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg max-w-3xl whitespace-pre-wrap mx-auto shadow ${
              msg.role === "user" ? "bg-[#1f2937] text-green-400" : "bg-[#111827] text-white"
            }`}
          >
            <ReactMarkdown
              children={msg.content}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      children={String(children).replace(/\n$/, "")}
                      {...props}
                    />
                  ) : (
                    <code className="bg-gray-800 text-green-300 px-1 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  );
                },
              }}
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-gray-700 bg-[#111827] flex items-center gap-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 p-3 rounded-lg bg-[#1f2937] text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg text-white"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

export default Chatboard;
