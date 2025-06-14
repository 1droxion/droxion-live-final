import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ClipboardCopy, Mic, Heart } from "lucide-react";

function AIChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Cinematic 4K");
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("droxion_chats")) || []);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const chatRef = useRef(null);

  const styles = [
    "Cinematic 4K",
    "Pixel Art",
    "Cyberpunk",
    "Fantasy Landscape",
    "Anime",
    "Watercolor"
  ];

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
      content: "👋 Welcome to Droxion",
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

  const detectImageRequest = (text) => {
    const lower = text.toLowerCase();
    return (
      lower.includes("draw") ||
      lower.includes("create image") ||
      lower.includes("show image") ||
      lower.includes("generate image")
    );
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

      if (detectImageRequest(input)) {
        const styledPrompt = `${input}, in ${selectedStyle} style`;
        const imgRes = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-image`, { prompt: styledPrompt });
        aiMsg = {
          role: "assistant",
          content: `🖼️ Here is your image:\n\n![Generated Image](${imgRes.data.image_url})\n\n[⬇️ Download Image](${imgRes.data.image_url})`,
          timestamp: new Date().toLocaleTimeString(),
        };
      } else {
        const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat`, { prompt: input });
        let reply = res?.data?.reply || "No reply.";

        reply = reply.replace(/(https?:\/\/www\.youtube\.com\/watch\?v=[\w-]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">▶️ Watch Video</a>');
        reply = reply.replace(/(https?:\/\/[^\s]+news[^\s]*)/gi, '[📰 News Link]($1)');

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
      alert("❌ Chat failed. Check your backend.");
    }

    setLoading(false);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("✅ Copied to clipboard");
  };

  const handleVoiceInput = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();
    recognition.onresult = (event) => {
      const speech = event.results[0][0].transcript;
      setInput(speech);
    };
    recognition.onerror = () => alert("🎤 Voice input failed");
  };

  return (
    <div className="flex flex-col h-screen text-white bg-[#0e0e10]">
      <h1 className="text-2xl text-center py-3 font-bold text-purple-400">💡 Droxion Smart AI Bar</h1>

      <div className="px-6 py-2 text-sm text-center">
        <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="bg-black text-white p-2 rounded border border-purple-500">
          {styles.map(style => <option key={style}>{style}</option>)}
        </select>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`max-w-3xl px-5 py-4 rounded-2xl shadow-md relative whitespace-pre-wrap ${msg.role === "user" ? "ml-auto bg-blue-800" : "mr-auto bg-purple-700"}`}>
            <div className="text-sm opacity-80 mb-2 flex justify-between items-center">
              <span>{msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}</span>
              <button className="opacity-60 hover:opacity-100"><Heart size={14} /></button>
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
              }}>
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {loading && <div className="text-center text-gray-400 italic animate-pulse">✍️ AI is typing...</div>}
      </div>

      <div className="p-4 border-t border-gray-700 flex gap-3">
        <button onClick={handleVoiceInput} className="bg-black text-purple-400 px-4 rounded-lg border border-purple-500"><Mic size={18} /></button>
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
          className={`px-6 py-3 text-lg rounded-lg font-bold ${loading ? "bg-gray-600" : "bg-green-600 hover:bg-green-700"}`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
