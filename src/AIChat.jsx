// AIChat.jsx (Final Mobile-Friendly Layout)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);
  const bottomRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await axios.post("/chat", { message: input });
      setMessages((prev) => [...prev, { role: "ai", content: res.data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", content: "Something went wrong." }]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  return (
    <div
      className="flex flex-col h-screen w-full bg-black text-white overflow-hidden"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="text-center text-xl py-3 font-semibold text-gray-300">Droxion</div>

      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        style={{ overscrollBehavior: "contain" }}
        ref={chatRef}
      >
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10 text-lg">Ask anything...</div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-2 max-w-[80%] px-4 py-2 rounded-xl text-sm whitespace-pre-wrap break-words ${
              msg.role === "user"
                ? "bg-blue-600 text-white self-end ml-auto"
                : "bg-neutral-800 text-gray-100 self-start mr-auto"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}

        {loading && (
          <div className="text-gray-500 text-sm mt-2">Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="w-full px-2 pb-4 pt-2 bg-black">
        <div className="flex flex-wrap justify-center gap-2 mb-3">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map(
            (btn, i) => (
              <button
                key={i}
                className="border border-white text-white text-sm rounded-full px-3 py-1 hover:bg-white hover:text-black"
                onClick={() => setInput(btn)}
              >
                {btn}
              </button>
            )
          )}
        </div>
        <div className="flex items-center rounded-full px-3 bg-neutral-900 text-white">
          <input
            className="flex-1 bg-transparent outline-none p-2 text-sm placeholder-gray-400"
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            autoFocus
          />
          <button onClick={handleSend} className="text-white text-xl p-2">
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
