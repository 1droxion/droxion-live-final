import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mic, SendHorizonal, ImageIcon, Download, Trash2, Plus, Clock } from "lucide-react";

// ✅ FINAL FIXED: Always use production backend
const API = "https://droxion-backend.onrender.com";

function AIChat() {
  const [prompt, setPrompt] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [sessions, setSessions] = useState(() => JSON.parse(localStorage.getItem("chat-sessions")) || []);
  const [currentSession, setCurrentSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef();
  const scrollRef = useRef();

  const handleVoiceInput = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setPrompt(spoken);
    };
  };

  const saveSession = (messages) => {
    const name = messages[0]?.content?.slice(0, 30) || "New Chat";
    const session = { id: Date.now(), name, messages };
    const updated = [session, ...sessions];
    setSessions(updated);
    localStorage.setItem("chat-sessions", JSON.stringify(updated));
    setCurrentSession(session.id);
  };

  const handleSend = async () => {
    if (!prompt.trim() && !image) return;

    const userMessage = { role: "user", content: prompt };
    if (image) userMessage.imageUrl = URL.createObjectURL(image);

    const updatedChat = [...chat, userMessage];
    setChat(updatedChat);
    setPrompt("");
    setLoading(true);

    try {
      let res;

      if (image) {
        const formData = new FormData();
        formData.append("image", image);
        formData.append("prompt", prompt);
        res = await axios.post(`${API}/analyze-image`, formData);
      } else if (prompt.toLowerCase().startsWith("/yt")) {
        const search = prompt.replace("/yt", "").trim();
        res = await axios.post(`${API}/search-youtube`, { prompt: search });
        updatedChat.push({
          role: "assistant",
          content: `🎬 [${res.data.title}](${res.data.url})`
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (prompt.toLowerCase().startsWith("/news")) {
        const search = prompt.replace("/news", "").trim();
        res = await axios.post(`${API}/news`, { prompt: search });
        updatedChat.push({
          role: "assistant",
          content: res.data.headlines.map(h => `📰 ${h}`).join("\n\n")
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else if (
        prompt.toLowerCase().startsWith("/img") ||
        prompt.toLowerCase().includes("create image")
      ) {
        res = await axios.post(`${API}/generate-image`, { prompt });
        updatedChat.push({
          role: "assistant",
          content: `🖼️ ![Generated Image](${res.data.image_url})`
        });
        setChat(updatedChat);
        setLoading(false);
        return;
      } else {
        res = await axios.post(`${API}/chat`, { prompt });
      }

      updatedChat.push({ role: "assistant", content: res.data.reply || res.data.error });
      setChat(updatedChat);
    } catch (err) {
      updatedChat.push({ role: "assistant", content: "❌ Error: Something went wrong." });
      setChat(updatedChat);
    }

    setLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setImage(file);
  };

  const handleNewChat = () => {
    if (chat.length > 0) saveSession(chat);
    setChat([]);
    setPrompt("");
    setCurrentSession(null);
  };

  const handleClearHistory = () => {
    localStorage.removeItem("chat-sessions");
    setSessions([]);
    alert("🗑️ All chat history cleared!");
  };

  const downloadChat = () => {
    const content = chat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chat.txt";
    a.click();
  };

  const handleSelectSession = (session) => {
    setChat(session.messages);
    setCurrentSession(session.id);
    setSidebarOpen(false);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  return (
    <div className="w-full h-screen flex bg-black text-white relative">
      {sidebarOpen && (
        <div className="w-64 bg-zinc-900 p-4 border-r border-gray-800 absolute z-10 h-full">
          <div className="text-lg font-bold mb-2">🧠 Chat History</div>
          <div className="space-y-2 overflow-y-auto max-h-[80vh] pr-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`cursor-pointer p-2 rounded hover:bg-zinc-800 ${currentSession === s.id ? "bg-zinc-800" : ""}`}
                onClick={() => handleSelectSession(s)}
              >
                {s.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-700 flex justify-between items-center">
          <div className="text-xl font-bold">💬 AI Chat (Droxion)</div>
          <div className="flex gap-4 items-center">
            <Clock onClick={() => setSidebarOpen(!sidebarOpen)} title="Chat History" className="cursor-pointer" />
            <Plus onClick={handleNewChat} title="New Chat" className="cursor-pointer" />
            <Trash2 onClick={handleClearHistory} title="Clear History" className="cursor-pointer" />
            <Download onClick={downloadChat} title="Download Chat" className="cursor-pointer" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {chat.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`p-3 rounded-xl max-w-[75%] whitespace-pre-wrap ${msg.role === "user" ? "bg-white text-black" : "bg-zinc-800 text-white"}`}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-w-xs mb-2" />
                )}
                <ReactMarkdown
                  children={msg.content}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} className="text-blue-400 underline" target="_blank" rel="noopener noreferrer" />
                    ),
                    code: ({ node, inline, className, children, ...props }) => (
                      <pre className="bg-gray-900 p-2 rounded text-green-300 overflow-x-auto">
                        <code {...props}>{children}</code>
                      </pre>
                    )
                  }}
                />
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-left text-sm text-gray-500 px-4 animate-pulse">Typing<span className="animate-bounce">...</span></div>
          )}
          <div ref={scrollRef}></div>
        </div>

        <div className="border-t border-gray-700 p-3 flex items-center gap-2">
          <button onClick={handleVoiceInput}><Mic className="text-white" /></button>
          <button onClick={() => fileInputRef.current.click()}><ImageIcon className="text-white" /></button>
          <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" hidden />
          <input
            type="text"
            placeholder='Type message or try /yt Messi or /img waterfall'
            className="flex-1 p-2 rounded-lg bg-zinc-800 text-white outline-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button onClick={handleSend}><SendHorizonal className="text-white" /></button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
