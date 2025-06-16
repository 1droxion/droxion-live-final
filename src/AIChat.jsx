import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });

      const reply = res.data.reply;
      const voice = res.data.voiceUrl;
      const video = res.data.videoUrl;
      const image = res.data.imageUrl;
      const youtube = res.data.youtube;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          voice,
          video,
          image,
          youtube,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error: Something went wrong." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <div className="flex items-center p-4 text-xl font-bold">
        <span className="text-purple-300 text-2xl mr-2">💬</span> AI Chat <span className="text-white ml-1">(Droxion)</span>
      </div>

      <div className="flex-grow px-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`my-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[90%] px-4 py-2 text-sm whitespace-pre-wrap`}>
              <ReactMarkdown
                children={msg.content}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                className="prose prose-invert"
              />
              {msg.image && (
                <img
                  src={msg.image}
                  alt="Generated"
                  className="rounded-lg mt-2 max-w-xs"
                />
              )}
              {msg.youtube && msg.youtube.url && (
                <div className="mt-4 border border-gray-700 rounded-md overflow-hidden">
                  <div className="px-3 py-2 text-sm font-medium">🎬 Watch on YouTube</div>
                  <iframe
                    className="w-full aspect-video"
                    src={`https://www.youtube.com/embed/${msg.youtube.url.split("v=")[1]}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="text-sm text-gray-400 px-4 py-2">Typing<span className="animate-pulse">...</span></div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="flex items-center p-2 border-t border-gray-800">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-grow rounded bg-[#0f172a] p-3 resize-none outline-none"
        />
        <button
          onClick={handleSend}
          className="ml-2 bg-white text-black font-semibold px-4 py-2 rounded"
        >
          Send
        </button>
      </div>

      <div className="absolute bottom-2 right-3 text-xs space-x-3">
        <span className="cursor-pointer" onClick={() => setVoiceMode(!voiceMode)}>
          🔊 {voiceMode ? "On" : "Off"}
        </span>
        <span className="cursor-pointer" onClick={() => setVideoMode(!videoMode)}>
          🧑‍🎤 {videoMode ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}
