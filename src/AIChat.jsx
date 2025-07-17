import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialView, setInitialView] = useState(true);
  const chatEndRef = useRef(null);

  const tools = [
    "DeepSearch",
    "Think",
    "Create Images",
    "Research",
    "Edit Image",
    "Latest News",
    "Personas"
  ];

  useEffect(() => {
    if (!initialView) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setInitialView(false);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input
      });
      const reply = res.data?.reply || "No reply.";
      setMessages((prev) => [...prev, { sender: "ai", text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "ai", text: "No reply." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="text-center text-2xl font-semibold text-gray-300 mt-6">Droxion</div>

      <div className="flex-grow overflow-y-auto px-4 py-6">
        {initialView ? (
          <div className="max-w-md mx-auto mt-20 border border-gray-500 p-6 rounded-2xl">
            <p className="text-gray-300 mb-4">What do you want to know?</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {tools.map((tool, idx) => (
                <button
                  key={idx}
                  className="border border-white rounded-full px-4 py-1 text-sm"
                  onClick={() => setInput(tool)}
                >
                  {tool}
                </button>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex items-center bg-[#111] rounded-full overflow-hidden">
              <input
                className="flex-grow p-3 bg-transparent text-white focus:outline-none"
                placeholder="What do you want to know?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" className="px-4 text-white">
                <div className="bg-white text-black w-7 h-7 rounded-full flex items-center justify-center">▶</div>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-lg px-4 py-2 rounded-xl ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white self-end"
                    : "bg-[#222] text-gray-300 self-start"
                }`}
              >
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
              </div>
            ))}
            {loading && (
              <div className="self-start text-gray-400 animate-pulse px-4 py-2">Thinking<span className="animate-ping">.</span></div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {!initialView && (
        <div className="p-4 border-t border-gray-700 bg-black">
          <div className="flex flex-wrap gap-2 mb-2 justify-center">
            {tools.map((tool, idx) => (
              <button
                key={idx}
                className="border border-white rounded-full px-4 py-1 text-sm"
                onClick={() => setInput(tool)}
              >
                {tool}
              </button>
            ))}
          </div>
          <form onSubmit={handleSend} className="flex items-center bg-[#111] rounded-full overflow-hidden">
            <input
              className="flex-grow p-3 bg-transparent text-white focus:outline-none"
              placeholder="What do you want to know?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="px-4 text-white">
              <div className="bg-white text-black w-7 h-7 rounded-full flex items-center justify-center">▶</div>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AIChat;
