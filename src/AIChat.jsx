import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, Trash2, Download, Mic } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [upload, setUpload] = useState(null);
  const [typingText, setTypingText] = useState("");
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!activeChatId) startNewChat();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typingText]);

  const startNewChat = () => {
    const id = Date.now();
    const newChat = { id, title: "New Chat", messages: [] };
    const updated = [newChat, ...chats];
    setChats(updated);
    localStorage.setItem("droxion_chats", JSON.stringify(updated));
    setMessages([
      {
        role: "assistant",
        content: "💡 Welcome to Droxion. Ask anything — draw, video, YouTube, or upload an image!",
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

  const handleVoiceInput = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.start();
    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setInput(speechText);
      sendMessage(speechText);
    };
  };

  const downloadMessage = (text) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "message.txt";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const sendMessage = async (overrideInput = null) => {
    const raw = overrideInput || input;
    if (!raw.trim() && !upload) return;

    const userMsg = {
      role: "user",
      content: raw,
      timestamp: new Date().toLocaleTimeString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    updateChat(updatedMessages);
    setInput("");
    setTypingText("...");
    setLoading(true);
    setShowSidebar(false);

    try {
      let reply = "";

      if (upload) {
        const form = new FormData();
        form.append("image", upload);
        form.append("prompt", raw);
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/analyze-image`, form);
        reply = res?.data?.reply || "❌ Image analysis failed.";
        setUpload(null);
      } else {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, {
          prompt: raw,
          language: "auto",
        });
        reply = res?.data?.reply || "No reply.";
      }

      let current = "";
      let i = 0;
      const interval = setInterval(() => {
        if (i < reply.length) {
          current += reply[i];
          setTypingText(current);
          i++;
        } else {
          clearInterval(interval);
          const aiMsg = {
            role: "assistant",
            content: reply,
            timestamp: new Date().toLocaleTimeString(),
          };
          const finalMessages = [...updatedMessages, aiMsg];
          setMessages(finalMessages);
          updateChat(finalMessages);
          setTypingText("");
        }
      }, 15);
    } catch (err) {
      alert("❌ Failed. Check backend/API keys.");
      setTypingText("");
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar Toggle */}
      <div className="w-12 flex flex-col p-2 bg-[#111] border-r border-gray-800">
        <button onClick={() => setShowSidebar(!showSidebar)} title="Toggle chat history" className="text-white mb-4">
          💬
        </button>
        <button onClick={startNewChat} title="New Chat" className="text-green-400">＋</button>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="w-64 bg-[#0e0e10] p-3 overflow-y-auto border-r border-gray-700">
          <h3 className="text-sm font-semibold mb-2 text-green-300">🕘 History</h3>
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

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-3xl px-5 py-3 rounded-2xl relative whitespace-pre-wrap shadow ${
                msg.role === "user" ? "ml-auto bg-[#222]" : "mr-auto bg-[#333]"
              }`}
            >
              <div className="text-sm opacity-70 mb-2 flex justify-between items-center">
                <span>{msg.role === "user" ? "🧍 You" : "🤖 AI"} • {msg.timestamp}</span>
                {msg.role === "assistant" && (
                  <button onClick={() => downloadMessage(msg.content)} title="Download">
                    <Download size={16} />
                  </button>
                )}
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
                            height="300"
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
                    return <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 underline">{children}</a>;
                  },
                  img({ src, alt }) {
                    return <img src={src} alt={alt} className="rounded-lg w-[180px]" />;
                  },
                  code({ inline, className, children }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const content = String(children).replace(/\n$/, "");
                    return !inline && match ? (
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
                        {content}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="bg-black/20 px-1 py-0.5 rounded">{children}</code>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          ))}
          {typingText && (
            <div className="text-gray-400 italic animate-pulse">
              <span className="ml-2">🤖 {typingText}</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-gray-800 flex items-center gap-3 bg-[#111]">
          <button onClick={handleVoiceInput} className="text-white" title="Voice Input">
            <Mic size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type anything or upload image..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-[#222] p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input type="file" accept="image/*" onChange={(e) => setUpload(e.target.files[0])} className="hidden" id="file-upload" />
          <label htmlFor="file-upload" className="cursor-pointer text-green-400 font-bold">📁</label>
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="px-5 py-3 rounded-full bg-white text-black font-semibold"
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
