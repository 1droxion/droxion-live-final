// AIChat.jsx (with chat history, reset, delete, identity reply)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!activeChatId) startNewChat();
  }, []);

  const startNewChat = () => {
    const id = Date.now();
    const newChat = { id, title: "New Chat", messages: [] };
    const updated = [newChat, ...chats];
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
    setMessages([{
      role: "assistant",
      content: "👋 Welcome! I’m your Droxion AI Assistant. Ask me anything — like how to create videos, use voice, or manage styles.",
      timestamp: new Date().toLocaleTimeString(),
    }]);
    setActiveChatId(id);
  };

  const updateChat = (updatedMessages) => {
    const updated = chats.map((chat) =>
      chat.id === activeChatId ? { ...chat, messages: updatedMessages } : chat
    );
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
  };

  const deleteChat = (id) => {
    const updated = chats.filter((c) => c.id !== id);
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
    if (id === activeChatId) {
      setMessages([]);
      setActiveChatId(null);
    }
  };

  const loadChat = (id) => {
    const found = chats.find((c) => c.id === id);
    if (found) {
      setActiveChatId(id);
      setMessages(found.messages);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = {
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    updateChat(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { message: input });
      let reply = res?.data?.reply || "No reply.";

      if (/who (made|created) you|who's your creator/i.test(input)) {
        reply = "I was created by Dhruv Patel and powered by Droxion™. Owned by Dhruv Patel.";
      }

      const aiMsg = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      updateChat(finalMessages);
    } catch (err) {
      console.error("❌ Chat Error:", err);
      alert("❌ Chat failed. Check backend or network.");
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen text-white">
      {/* Sidebar */}
      <div className="w-64 bg-[#1f2937] border-r border-gray-700 p-4 space-y-2 overflow-y-auto">
        <button onClick={startNewChat} className="w-full bg-green-600 hover:bg-green-700 p-2 rounded">+ New Chat</button>
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => loadChat(chat.id)}
            className={`p-2 rounded cursor-pointer ${activeChatId === chat.id ? "bg-purple-700" : "bg-gray-800 hover:bg-gray-700"}`}
          >
            <div className="flex justify-between items-center">
              <span className="truncate w-36">{chat.title}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} className="text-red-400">🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-[#0e0e10] p-4">
        <h1 className="text-3xl font-bold text-center text-purple-400 mb-4">🤖 Droxion AI Chatboard</h1>

        <div ref={chatRef} className="flex-1 overflow-y-auto bg-[#111827] rounded-xl p-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-xl px-5 py-4 rounded-2xl shadow-md relative animate-fade-in ${
                msg.role === "user"
                  ? "ml-auto bg-gradient-to-br from-blue-600 to-indigo-600"
                  : "mr-auto bg-gradient-to-br from-purple-700 to-pink-700"
              }`}
            >
              <div className="text-sm opacity-80 mb-1">
                {msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}
              </div>
              <div className="whitespace-pre-wrap text-md font-medium">{msg.content}</div>
            </div>
          ))}

          {loading && <div className="text-gray-400 italic animate-pulse">✍️ AI is typing...</div>}
        </div>

        <div className="mt-5 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about Droxion..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-grow bg-[#1f2937] p-4 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className={`px-8 py-3 text-lg rounded-xl font-bold transition-all ${loading ? "bg-gray-500" : "bg-green-500 hover:bg-green-600"}`}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
