import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy } from "lucide-react";

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
    setMessages([
      {
        role: "assistant",
        content: "👋 Welcome to Droxion",
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

  const isImagePrompt = (text) => {
    return /^(create|generate|draw|make)\s+(an?\s+)?image/i.test(text.trim());
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
      let aiMsg;

      if (isImagePrompt(input)) {
        const styledPrompt = `${input}, in cinematic 4K style`;
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, {
          prompt: styledPrompt,
        });

        const imgUrl = res?.data?.image_url;
        if (!imgUrl) throw new Error("Image generation failed.");

        aiMsg = {
          role: "assistant",
          content: `![Generated Image](${imgUrl})\n\nHere is your AI-generated image.`,
          timestamp: new Date().toLocaleTimeString(),
        };
      } else {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: input });
        const reply = res?.data?.reply || "No reply.";
        aiMsg = {
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString(),
        };
      }

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      updateChat(finalMessages);
    } catch (err) {
      alert("❌ Failed to process. Check backend or API key.");
    }

    setLoading(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied to clipboard");
  };

  return (
    <div className="flex flex-col h-screen text-white bg-[#0e0e10]">
      <h1 className="text-2xl text-center py-3 font-bold text-purple-400">
        💡 Droxion Smart AI Bar
      </h1>
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-3xl px-5 py-4 rounded-2xl shadow-md relative whitespace-pre-wrap ${
              msg.role === "user" ? "ml-auto bg-blue-800" : "mr-auto bg-purple-700"
            }`}
          >
            <div className="text-sm opacity-80 mb-2">
              {msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}
            </div>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}
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
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {loading && (
          <div className="text-center text-gray-400 italic animate-pulse">
            ✍️ AI is typing...
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-700 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything: draw, video, chat, YouTube/news..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-[#1f2937] p-3 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className={`px-6 py-3 text-lg rounded-lg font-bold ${
            loading ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
