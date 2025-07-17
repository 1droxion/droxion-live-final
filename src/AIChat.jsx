// Updated AIChat.jsx - Grok-style layout with no zoom, no border overflow, perfect mobile experience
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaDesktop
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setTyping(true);
    setInput("");

    try {
      const res = await axios.post("/chat", { message: input });
      setMessages([...newMessages, { role: "assistant", content: res.data.reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Error occurred." }]);
    } finally {
      setTyping(false);
    }
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div className="text-center text-xl font-bold py-3 text-gray-300">Droxion</div>

      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 space-y-4 pb-36"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
              msg.role === "user" ? "bg-blue-600 text-white self-end ml-auto" : "bg-gray-800 text-white self-start"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}

        {typing && (
          <div className="self-start bg-gray-800 text-white px-4 py-2 rounded-2xl text-sm animate-pulse">
            <span className="inline-block w-1 h-1 bg-white rounded-full mr-1"></span>
            <span className="inline-block w-1 h-1 bg-white rounded-full mr-1"></span>
            <span className="inline-block w-1 h-1 bg-white rounded-full"></span>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 w-full bg-black p-3 space-y-2">
        <div className="flex flex-wrap justify-center gap-2">
          {['DeepSearch', 'Think', 'Create Images', 'Research', 'Edit Image', 'Latest News', 'Personas'].map(btn => (
            <button
              key={btn}
              className="border border-gray-500 px-3 py-1 rounded-full text-sm text-white"
              onClick={() => setInput(btn)}
            >
              {btn}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 bg-gray-900 text-white rounded-full px-4 py-2 focus:outline-none"
          />
          <button
            onClick={handleSend}
            className="bg-white text-black p-2 rounded-full"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
