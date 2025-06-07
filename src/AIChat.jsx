// AIChat.jsx with export to .txt
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, Download } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const chatRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
      if (window.innerWidth < 768) setSidebarOpen(false);
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
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: input });
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
      alert("❌ Chat failed. Check your backend.");
    }
    setLoading(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied to clipboard");
  };

  const exportChat = () => {
    const fullText = messages.map(m => `${m.role === "user" ? "🧑 You" : "🤖 AI"} • ${m.timestamp}\n${m.content}\n\n`).join("");
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen text-white">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-50 lg:hidden bg-gray-800 text-white p-2 rounded"
      >
        ☰
      </button>

      {sidebarOpen && (
        <div className="w-64 bg-[#1f2937] border-r border-gray-700 p-4 space-y-2 overflow-y-auto">
          <button onClick={startNewChat} className="w-full bg-green-600 hover:bg-green-700 p-2 rounded">+ New Chat</button>
          <button onClick={exportChat} className="w-full mt-2 bg-purple-600 hover:bg-purple-700 p-2 rounded flex items-center gap-2 justify-center">
            <Download size={16} /> Export Chat
          </button>
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
      )}

      <div className="flex-1 flex flex-col bg-[#0e0e10] p-4">
        <h1 className="text-3xl font-bold text-center text-purple-400 mb-4">🤖 Droxion AI Chatboard</h1>

        <div ref={chatRef} className="flex-1 overflow-y-auto bg-[#111827] rounded-xl p-6 space-y-4">
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
                  },
                }}
              />
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
