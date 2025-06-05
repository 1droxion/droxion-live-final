import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Moon, Sun, Save, RefreshCcw, WandSparkles } from "lucide-react";

function Chatboard() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [dark, setDark] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (autoScroll) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("https://droxion-backend1.onrender.com/chat", {
        message: input,
      });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("❌ Chat error", err);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleTheme = () => setDark(!dark);
  const toggleScroll = () => setAutoScroll(!autoScroll);
  const saveChat = () => {
    const text = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}\n`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chat_${Date.now()}.txt`;
    link.click();
  };

  return (
    <div className={dark ? "bg-[#0e0e10] text-white" : "bg-white text-black"}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b bg-black/30 backdrop-blur">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <WandSparkles className="text-green-400" /> Droxion AI Chat
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={toggleTheme} title="Toggle Theme">
            {dark ? <Sun /> : <Moon />}
          </button>
          <button onClick={toggleScroll} title="Toggle Auto Scroll">
            <RefreshCcw />
          </button>
          <button onClick={saveChat} title="Save Chat History">
            <Save />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed border ${
              msg.role === "user"
                ? "bg-green-950/30 border-green-500/30"
                : "bg-white/5 border-white/10"
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
                    <code className="bg-black/50 px-1 py-0.5 rounded text-green-300">
                      {children}
                    </code>
                  );
                },
              }}
            />
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        <textarea
          rows="3"
          placeholder="Type your message..."
          className="w-full p-4 bg-[#1e1e1e] text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-green-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
        ></textarea>
        <button
          onClick={sendMessage}
          disabled={loading}
          className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Generating..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default Chatboard;
