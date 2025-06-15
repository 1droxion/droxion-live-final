import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, FolderOpen, Trash2 } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (!activeChatId) startNewChat();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const startNewChat = () => {
    const id = Date.now();
    const newChat = { id, title: "New Chat", messages: [] };
    const updated = [newChat, ...chats];
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
    setMessages([
      {
        role: "assistant",
        content: "💡 Welcome to Droxion. Ask anything: draw, real news, YouTube, or create images!",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
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
    if (id === activeChatId) startNewChat();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const raw = input;
    const lower = raw.toLowerCase();
    const userMsg = {
      role: "user",
      content: raw,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    updateChat(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      let reply = "";

      if (lower.includes("who made you") || lower.includes("who owns you") || lower.includes("who created you")) {
        reply = "I was created by **Dhruv Patel** and powered by **Droxion™**. Owned by Dhruv Patel.";
      }

      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: raw });
      if (!reply) reply = res?.data?.reply || "No reply.";

      const aiMsg = {
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString(),
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      updateChat(finalMessages);
    } catch (err) {
      alert("❌ Chat failed. Check your backend/API keys.");
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#0e0e10] text-white">
      {historyOpen && (
        <div className="w-64 bg-[#111827] border-r border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-lg font-bold mb-4 text-purple-400">📂 Your Chats</h3>
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`mb-2 px-3 py-2 rounded-lg cursor-pointer ${
                chat.id === activeChatId ? "bg-purple-700" : "hover:bg-gray-700"
              } flex justify-between items-center`}
              onClick={() => {
                setActiveChatId(chat.id);
                setMessages(chat.messages);
                if (window.innerWidth < 768) setHistoryOpen(false);
              }}
            >
              <span className="truncate w-40">{chat.title}</span>
              <Trash2 size={16} className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} />
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div className="p-3 bg-[#1f2937] border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-lg font-bold text-purple-400">🤖 Droxion AI Chat</h1>
          <button onClick={() => setHistoryOpen(!historyOpen)}>
            <FolderOpen size={22} className="text-white" />
          </button>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-3xl px-5 py-3 rounded-xl shadow-md relative whitespace-pre-wrap text-sm ${
                msg.role === "user" ? "ml-auto bg-blue-800" : "mr-auto bg-purple-700"
              }`}
            >
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {loading && <div className="text-center text-gray-400 animate-pulse text-lg">●</div>}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask anything..."
            className="flex-1 bg-[#1f2937] text-white p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-6 py-3 text-lg rounded-lg font-bold bg-green-600 hover:bg-green-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
