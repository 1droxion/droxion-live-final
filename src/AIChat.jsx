// AIChat.jsx – Final working Grok-style Droxion layout with all confirmed behaviors

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { FaPlay } from "react-icons/fa";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasChatStarted, setHasChatStarted] = useState(false);
  const chatRef = useRef(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const userMessage = { type: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput("");
    setHasChatStarted(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt: userMessage.text });
      const reply = { type: "bot", text: res.data.response || "No reply." };
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setMessages((prev) => [...prev, { type: "bot", text: "Error. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const renderMessages = () => (
    <div className="flex flex-col px-4 gap-4 pt-16 pb-32">
      {messages.map((msg, i) => (
        <div key={i} className={`max-w-[80%] px-4 py-2 rounded-xl text-sm ${msg.type === "user" ? "bg-blue-600 text-white self-end" : "bg-neutral-800 text-white self-start"}`}>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
        </div>
      ))}
      {loading && (
        <div className="self-center text-white animate-pulse text-2xl">×</div>
      )}
      <div ref={chatRef}></div>
    </div>
  );

  const renderCenterInput = () => (
    <div className="flex flex-col items-center justify-center h-screen text-white gap-4">
      <h1 className="text-2xl font-bold text-center text-gray-300">Droxion</h1>
      <div className="p-4 border rounded-2xl bg-black/50 backdrop-blur max-w-md w-full">
        <p className="mb-3 text-sm text-gray-400">What do you want to know?</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((btn) => (
            <button key={btn} onClick={() => setInput(btn)} className="border px-3 py-1 rounded-full text-white text-xs hover:bg-white hover:text-black transition-all">
              {btn}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-black border rounded-full px-4 py-2">
          <input
            type="text"
            className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
            placeholder="What do you want to know?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button onClick={handleSubmit} className="text-white text-lg">
            <FaPlay />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-black min-h-screen text-white">
      {!hasChatStarted ? renderCenterInput() : (
        <>
          <div className="text-center pt-4 text-xl font-semibold text-gray-300">Droxion</div>
          {renderMessages()}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-black border-t border-neutral-800 flex flex-col items-center">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((btn) => (
                <button key={btn} onClick={() => setInput(btn)} className="border px-3 py-1 rounded-full text-white text-xs hover:bg-white hover:text-black transition-all">
                  {btn}
                </button>
              ))}
            </div>
            <div className="flex items-center bg-neutral-900 border rounded-full px-4 py-2 w-full max-w-xl">
              <input
                type="text"
                className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
                placeholder="What do you want to know?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button onClick={handleSubmit} className="text-white text-lg">
                <FaPlay />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
