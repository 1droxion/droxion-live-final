// ✅ Final Smart AIChat.jsx with video, image, and full URL + metadata

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
  const chatRef = useRef(null);
  const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input, timestamp: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      let aiReply = "";
      const lowerInput = input.toLowerCase();
      const now = new Date().toLocaleDateString();

      if (/create image|make image|draw|picture of/i.test(lowerInput)) {
        const prompt = input.replace(/create image|make image|draw|picture of/i, "").trim();
        const imgRes = await axios.post(`${VITE_BACKEND_URL}/generate-image`, { prompt });
        const url = imgRes?.data?.image_url[0] || "";
        aiReply = url
          ? `🖼️ **Image Created: ${prompt}**\n📅 Generated on: ${now}\n\n![Generated Image](${url})\n\n[🔗 Open Full Image](${url})`
          : "❌ Failed to generate image.";

      } else if (/create video|make reel|generate video|reel on/i.test(lowerInput)) {
        const topic = input.replace(/create video|make reel|generate video|reel on/i, "").trim();
        const res = await axios.post(`${VITE_BACKEND_URL}/generate`, {
          topic,
          language: "Hindi",
          voice: "onyx",
          length: "Short",
          mode: "Auto",
        });
        const videoUrl = res?.data?.videoUrl || "";
        aiReply = videoUrl
          ? `🎬 **Reel Created: ${topic}**\n📅 Generated on: ${now}\n[🔗 Click to Watch Full Reel](${VITE_BACKEND_URL}${videoUrl})\n\n<video controls src='${VITE_BACKEND_URL}${videoUrl}' class='rounded-xl mt-4 w-full max-w-lg'></video>`
          : "❌ Failed to generate reel.";

      } else if (lowerInput.includes("youtube") || lowerInput.includes("news")) {
        const query = encodeURIComponent(input);
        aiReply = lowerInput.includes("youtube")
          ? `[🔍 YouTube Results](https://www.youtube.com/results?search_query=${query})`
          : `[📰 News Results](https://www.google.com/search?q=${query})`;

      } else {
        const chatRes = await axios.post(`${VITE_BACKEND_URL}/chat`, { prompt: input });
        aiReply = chatRes?.data?.reply || "No reply.";
        if (/who (made|created) you|who's your creator/i.test(lowerInput)) {
          aiReply = "I was created by Dhruv Patel and powered by Droxion™. Owned by Dhruv Patel.";
        }
      }

      const assistantMsg = { role: "assistant", content: aiReply, timestamp: new Date().toLocaleTimeString() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Something went wrong. Try again.", timestamp: new Date().toLocaleTimeString() }]);
    }

    setLoading(false);
  };

  const handleVoice = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
      const voiceText = event.results[0][0].transcript;
      setInput(voiceText);
    };
  };

  return (
    <div className="flex flex-col h-screen p-4 text-white bg-[#0e0e10]">
      <h1 className="text-3xl font-bold text-center text-purple-400 mb-4">💡 Droxion Smart AI Bar</h1>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111827] rounded-xl">
        {messages.map((msg, i) => (
          <div key={i} className={`p-4 rounded-xl shadow ${msg.role === "user" ? "bg-blue-800 ml-auto" : "bg-purple-700 mr-auto"}`}>
            <div className="text-xs opacity-80 mb-1">{msg.role === "user" ? "🧑 You" : "🤖 AI"} • {msg.timestamp}</div>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}
              children={msg.content}
              components={{
                code({ inline, className, children }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeContent = String(children).replace(/\n$/, "");
                  return !inline && match ? (
                    <div className="relative group">
                      <button
                        onClick={() => navigator.clipboard.writeText(codeContent)}
                        className="absolute top-2 right-2 text-xs text-white bg-black/60 rounded px-2 py-1 hidden group-hover:block"
                      >
                        <ClipboardCopy size={14} className="inline-block mr-1" /> Copy
                      </button>
                      <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
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
        {loading && <div className="text-gray-400 italic animate-pulse">⏳ Processing...</div>}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask anything: draw, video, chat, YouTube/news..."
          className="flex-1 p-4 rounded-lg bg-[#1f2937] placeholder-gray-400 focus:outline-none"
        />
        <button onClick={handleVoice} className="bg-yellow-500 px-4 rounded">🎤</button>
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-6 py-3 font-bold rounded-xl bg-green-500 hover:bg-green-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default AIChat;
