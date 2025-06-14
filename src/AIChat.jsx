import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, Download } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: input });
      let reply = res?.data?.reply || "No reply.";

      if (/youtube|video|watch/i.test(input)) {
        const q = encodeURIComponent(input);
        reply += `<br/><a href="https://www.youtube.com/results?search_query=${q}" target="_blank">📺 YouTube Results</a>`;
      }

      if (/news|headline|breaking/i.test(input)) {
        const q = encodeURIComponent(input);
        reply += `<br/><a href="https://news.google.com/search?q=${q}" target="_blank">📰 News Results</a>`;
      }

      const aiMsg = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ Error fetching reply. Check backend.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }

    setLoading(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied to clipboard");
  };

  return (
    <div className="flex flex-col h-screen bg-[#0e0e10] text-white">
      <h1 className="text-3xl font-bold text-center text-purple-400 py-4">💡 Droxion Smart AI Bar</h1>

      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-3xl px-5 py-4 rounded-2xl shadow-md relative animate-fade-in whitespace-pre-wrap ${
              msg.role === "user"
                ? "ml-auto bg-gradient-to-br from-blue-600 to-indigo-600"
                : "mr-auto bg-gradient-to-br from-purple-700 to-pink-700"
            }`}
          >
            <div className="text-sm opacity-80 mb-2">
              {msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}
            </div>

            <ReactMarkdown
              children={msg.content}
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeContent = String(children).replace(/\n$/, "");
                  return !inline && match ? (
                    <div className="relative group">
                      <button
                        onClick={() => handleCopy(codeContent)}
                        className="absolute top-2 right-2 text-xs text-white bg-black/60 rounded px-2 py-1 hidden group-hover:block"
                      >
                        <ClipboardCopy size={14} className="inline-block mr-1" /> Copy
                      </button>
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                        {codeContent}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-black/20 px-1 py-0.5 rounded text-green-400">{children}</code>
                  );
                }
              }}
            />
          </div>
        ))}

        {loading && <div className="text-gray-400 italic animate-pulse px-6">✍️ AI is typing...</div>}
      </div>

      <div className="p-4 flex gap-3 border-t border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask anything: draw, video, chat, YouTube/news..."
          className="flex-1 bg-[#1f2937] p-4 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className={`px-6 py-3 text-lg rounded-xl font-bold transition-all ${
            loading ? "bg-gray-500" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
