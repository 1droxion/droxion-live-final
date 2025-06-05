// ✅ Updated Chatboard.jsx to include full code assistant capability and formatting
import React, { useState } from "react";
import axios from "axios";
import { Loader2, SendHorizonal, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function Chatboard() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMsg = { role: "user", content: message };
    setChatHistory((prev) => [...prev, userMsg]);
    setMessage("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/chat`,
        { message }
      );
      const reply = res.data.reply;
      setChatHistory((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("❌ Chat error:", err);
    }
    setLoading(false);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-400 mb-4">🤖 Droxion AI Chatboard</h1>

      <div className="space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`p-4 rounded-lg ${msg.role === "user" ? "bg-[#1e1e1e] text-white" : "bg-[#0e0e10] text-green-300 border border-gray-700 relative"}`}>
            {msg.role === "assistant" && (
              <button
                onClick={() => handleCopy(msg.content, index)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                title="Copy reply"
              >
                {copiedIndex === index ? <Check size={18} /> : <Copy size={18} />}
              </button>
            )}
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
                    <code className="bg-gray-800 text-green-400 px-1 py-0.5 rounded text-sm">
                      {children}
                    </code>
                  );
                },
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <input
          type="text"
          placeholder="Ask anything or request code..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 bg-[#1e1e1e] text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-md transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <SendHorizonal size={20} />}
        </button>
      </div>
    </div>
  );
}

export default Chatboard;
