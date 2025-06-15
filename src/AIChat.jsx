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
    const filtered = chats.filter((chat) => chat.id !== id);
    setChats(filtered);
    localStorage.setItem("droxion_chats", JSON.stringify(filtered));
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
    setShowSidebar(false);

    try {
      let reply = "";

      if (lower.includes("who made you") || lower.includes("who owns you") || lower.includes("who created you")) {
        const aiMsg = {
          role: "assistant",
          content: "I was created by **Dhruv Patel** and powered by **Droxion™**. Owned by Dhruv Patel.",
          timestamp: new Date().toLocaleTimeString(),
        };
        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);
        updateChat(finalMessages);
        setLoading(false);
        return;
      }

      const movieKeywords = ["video", "movie", "web series", "show", "episode", "film", "scene", "short"];
      const isVideoPrompt = movieKeywords.some((kw) => lower.includes(kw));
      const isCreate = lower.includes("create") || lower.includes("make") || lower.includes("generate");

      if (isCreate && isVideoPrompt) {
        const genRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate`, { prompt: raw });
        const video = genRes?.data?.video;
        if (video) {
          reply += `🎬 Here's your generated video:\n\n[▶️ Watch Video](${video})`;
        } else {
          reply += "❌ Couldn’t generate the video.";
        }
      }

      if (lower.includes("google") || lower.includes("search")) {
        const search = raw.replace("google", "").replace("search", "").trim();
        const link = `https://www.google.com/search?q=${encodeURIComponent(search)}`;
        reply += `Here’s a Google search for **${search}**:\n\n[🔍 Open Google](${link})`;
      }

      if (lower.includes("youtube") || lower.match(/ep\d+/i)) {
        const ytPrompt = lower.match(/ep\d+/i) ? `tmkoc ${raw}` : raw;
        const ytRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/youtube`, { prompt: ytPrompt });
        const ytLink = ytRes?.data?.url;
        const ytTitle = ytRes?.data?.title || "YouTube Video";
        if (ytLink) {
          reply += `\n\n**${ytTitle}**\n\n[▶️ Watch on YouTube](${ytLink})`;
        } else {
          reply += "❌ Couldn't find a video.";
        }
      }

      if (lower.includes("image") || lower.includes("draw")) {
        const imgRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, { prompt: raw });
        const imageUrl = imgRes?.data?.image_url || "";
        if (imageUrl) reply += `\n\n![Generated Image](${imageUrl})`;
      }

      if (lower.includes("news")) {
        const newsRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/news`, { prompt: raw });
        const headlines = newsRes?.data?.headlines || [];
        if (headlines.length > 0) {
          reply += "\n\n**Latest News:**\n" + headlines.map((h) => `- [${h.title}](${h.url})`).join("\n");
        }
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
      {/* Sidebar Toggle */}
      <div className="w-12 flex flex-col p-2 bg-[#1f2937] border-r border-gray-800">
        <button onClick={() => setShowSidebar(!showSidebar)} title="Toggle chat history" className="text-white mb-4">
          💬
        </button>
        <button onClick={startNewChat} title="New Chat" className="text-green-400">＋</button>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="w-60 bg-[#111827] p-3 overflow-y-auto border-r border-gray-700">
          <h3 className="text-sm font-semibold mb-2 text-purple-300">💾 History</h3>
          {chats.map((chat) => (
            <div key={chat.id} className="flex items-center justify-between mb-2 bg-gray-800 p-2 rounded text-sm">
              <button onClick={() => {
                setActiveChatId(chat.id);
                setMessages(chat.messages);
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

      {/* Main Chat */}
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
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  a({ href, children }) {
                    if (href.includes("youtube.com/watch")) {
                      const videoId = new URL(href).searchParams.get("v");
                      return (
                        <div className="mt-2">
                          <iframe
                            key={videoId}
                            width="100%"
                            height="315"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title="YouTube Video"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="rounded-xl"
                          ></iframe>
                        </div>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                        {children}
                      </a>
                    );
                  },
                  img({ src, alt }) {
                    return <img src={src} alt={alt} className="w-[180px] h-auto object-contain rounded-lg" />;
                  },
                  code({ inline, className: cls, children, ...props }) {
                    const match = /language-(\w+)/.exec(cls || "");
                    const codeContent = String(children).replace(/\n$/, "");
                    return !inline && match ? (
                      <div className="relative group">
                        <button
                          onClick={() => navigator.clipboard.writeText(codeContent)}
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
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          ))}
          {loading && <div className="text-center text-gray-400 italic animate-pulse">🟣</div>}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything: draw, movie, video, YouTube..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-[#1f2937] p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-md"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-5 py-3 rounded-full bg-green-600 hover:bg-green-700 shadow-lg text-white flex items-center justify-center"
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
