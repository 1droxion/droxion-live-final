import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const chatRef = useRef(null);

  const scrollToBottom = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post("/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });
      const reply = res.data.reply;
      const replyMessage = { role: "assistant", content: reply };

      setMessages((prev) => [...prev, replyMessage]);

      if (voiceMode) {
        const speak = await axios.post("/speak", { text: reply });
        const audio = new Audio(speak.data.url);
        audio.play();
      }

      if (input.toLowerCase().includes("image")) {
        const img = await axios.post("/generate-image", { prompt: input });
        if (img.data.image_url) {
          setMessages((prev) => [
            ...prev,
            {
              role: "image",
              content: img.data.image_url,
            },
          ]);
        }
      }

      if (
        input.toLowerCase().includes("youtube") ||
        input.toLowerCase().includes("video")
      ) {
        const yt = await axios.post("/search-youtube", { prompt: input });
        if (yt.data.url) {
          setMessages((prev) => [
            ...prev,
            {
              role: "youtube",
              content: yt.data.url,
              title: yt.data.title,
            },
          ]);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error: Something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => setVoiceMode((v) => !v);
  const toggleVideo = () => setVideoMode((v) => !v);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">
          <span className="text-purple-300">💬 AI Chat</span>{" "}
          <span className="text-white">(Droxion)</span>
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={toggleVoice} className="text-white text-sm">
            🔊 {voiceMode ? "On" : "Off"}
          </button>
          <button onClick={toggleVideo} className="text-white text-sm">
            🎥 {videoMode ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((msg, i) => {
          if (msg.role === "image") {
            return (
              <div key={i} className="flex justify-start">
                <img
                  src={msg.content}
                  alt="generated"
                  className="w-[250px] h-auto rounded-lg"
                />
              </div>
            );
          }

          if (msg.role === "youtube") {
            const videoId = msg.content.split("v=")[1];
            return (
              <div key={i} className="flex justify-start">
                <div className="w-full max-w-[420px] border border-gray-700 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="215"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={msg.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              className={`px-4 py-2 max-w-[85%] rounded-lg ${
                msg.role === "user"
                  ? "bg-white text-black self-end text-right ml-auto"
                  : "bg-black text-white self-start text-left mr-auto"
              }`}
            >
              {msg.content}
            </div>
          );
        })}
        {isLoading && (
          <div className="text-gray-400 px-4 py-2">Typing<span className="animate-pulse">...</span></div>
        )}
        <div ref={chatRef} />
      </div>

      <div className="pt-3">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder="Type your message..."
            className="flex-1 p-2 rounded-md bg-[#1a1a1a] border border-gray-700 text-white focus:outline-none resize-none"
          />
          <button
            onClick={handleSend}
            className="bg-white text-black px-4 py-2 rounded-md"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
