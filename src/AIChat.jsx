import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, Trash2 } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!activeChatId) startNewChat();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const cleanInput = (text) => text.trim().toLowerCase();

  const startNewChat = () => {
    const id = Date.now();
    const newChat = { id, title: "New Chat", messages: [] };
    const updated = [newChat, ...chats];
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
    setMessages([
      {
        role: "assistant",
        content: "\ud83d\udca1 Welcome to Droxion. Ask anything: draw, real news, YouTube, or create images!",
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
    const filtered = chats.filter((chat) => chat.id !== id);
    setChats(filtered);
    localStorage.setItem("droxion_chats", JSON.stringify(filtered));
    if (id === activeChatId) startNewChat();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const raw = input;
    const lower = cleanInput(raw);

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
    setShowSidebar(false);

    try {
      let reply = "";

      if (lower.includes("who made you") || lower.includes("who owns you") || lower.includes("who created you")) {
        const aiMsg = {
          role: "assistant",
          content: "I was created by **Dhruv Patel** and powered by **Droxion\u2122**. Owned by Dhruv Patel.",
          timestamp: new Date().toLocaleTimeString(),
        };
        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);
        updateChat(finalMessages);
        setLoading(false);
        return;
      }

      if (lower.includes("news")) {
        const newsRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/news`, { prompt: raw });
        const headlines = newsRes?.data?.headlines || [];
        if (headlines.length > 0) {
          reply += "\n\n\ud83d\uddfe\ufe0f **Latest News:**\n" + headlines.map((h) => `- [${h.title}](${h.url})`).join("\n");
        } else {
          reply += "❌ No news found.";
        }
      }

      if (lower.includes("youtube") || lower.match(/ep\d+/i)) {
        const ytPrompt = lower.match(/ep\d+/i) ? `tmkoc ${raw}` : raw;
        const ytRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/youtube`, { prompt: ytPrompt });
        const ytLink = ytRes?.data?.url;
        const ytTitle = ytRes?.data?.title || "YouTube Video";
        if (ytLink) {
          reply += `\n\n\ud83c\udfa5 **${ytTitle}**\n\n[▶️ Watch on YouTube](${ytLink})`;
        } else {
          reply += "❌ Couldn't find a video.";
        }
      }

      if (lower.includes("image") || lower.includes("draw")) {
        const imgRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, { prompt: raw });
        const imageUrl = imgRes?.data?.image_url || "";
        if (imageUrl) reply += `\n\n![Generated Image](${imageUrl})`;
      }

      if (!reply) {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: raw });
        reply = res?.data?.reply || "No reply.";
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
      alert("❌ Chat failed. Check your backend/API keys.");
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#0e0e10] text-white">
      <div className="w-12 flex flex-col p-2 bg-[#1f2937] border-r border-gray-800">
        <button onClick={() => setShowSidebar(!showSidebar)} title="Toggle chat history" className="text-white mb-4">
          💬
        </button>
        <button onClick={startNewChat} title="New Chat" className="text-green-400">＋</button>
      </div>

      {showSidebar && (
        <div className="w-60 bg-[#111827] p-3 overflow-y-auto border-r border-gray-700">
          <h3 className="text-sm font-semibold mb-2 text-purple-300">💾 History</h3>
          {chats.map((chat) => (
            <div key={chat.id} className="flex items-center justify-between mb-2 bg-gray-800 p-2 rounded text-sm">
              <button onClick={() => {
                setActiveChatId(chat.id);
                setMessages(chat.messages);
                setShowSidebar(false);
              }} className="text-left text-white truncate w-full">
                {chat.title}
              </button>
              <button onClick={() => deleteChat(chat.id)} className="text-red-500 ml-2">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-3xl px-5 py-2 rounded-2xl shadow-md relative whitespace-pre-wrap ${
                msg.role === "user" ? "ml-auto bg-blue-800" : "mr-auto bg-purple-700"
              }`}
            >
              <div className="text-sm opacity-80 mb-2">
                {msg.role === "user" ? "🧍 You" : "🤖 AI"} • {msg.timestamp}
              </div>
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
            </div>
          ))}
          {loading && <div className="text-center text-gray-400 italic animate-pulse">🟣 Typing...</div>}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything: draw, movie, video, YouTube..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-black text-white p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white border border-white shadow"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-white text-black px-5 py-3 rounded-full hover:bg-black hover:text-white border border-white shadow-lg transition"
            title="Send"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
