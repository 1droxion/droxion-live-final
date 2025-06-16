import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        videoMode: videoMode,
        voiceMode: audioOn,
      });
      const reply = res.data.reply;
      const voiceEnabled = res.data.voiceMode;
      const videoEnabled = res.data.videoMode;

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (voiceEnabled) {
        const audioRes = await axios.post("https://droxion-backend.onrender.com/speak", {
          text: reply,
        });
        const audio = new Audio(audioRes.data.url);
        audio.play();
      }

      if (videoEnabled) {
        const avatar = await axios.post("https://droxion-backend.onrender.com/talk-avatar", {
          prompt: reply,
        }, {
          headers: { "Content-Type": "application/json" },
        });
        if (avatar.data.video_url) {
          const videoEmbed = `<video src="${avatar.data.video_url}" controls autoplay muted class="rounded-lg w-full max-w-md" />`;
          setMessages((prev) => [...prev, { role: "assistant", content: videoEmbed }]);
        }
      }

      if (input.toLowerCase().includes("image")) {
        const image = await axios.post("https://droxion-backend.onrender.com/generate-image", {
          prompt: input,
        });
        if (image.data.image_url) {
          const imageEmbed = `🖼 ![image](${image.data.image_url})`;
          setMessages((prev) => [...prev, { role: "assistant", content: imageEmbed }]);
        }
      }

      if (input.toLowerCase().includes("video") || input.toLowerCase().includes("watch")) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt: input,
        });

        if (yt.data?.url) {
          const videoId = yt.data.url.split("v=")[1];
          const ytEmbed = `
<iframe width="100%" height="315" 
  src="https://www.youtube.com/embed/${videoId}" 
  title="YouTube video" 
  frameborder="0" 
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
  allowfullscreen></iframe>
          `;
          setMessages((prev) => [...prev, { role: "assistant", content: ytEmbed }]);
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

  const toggleAudio = () => setAudioOn(!audioOn);
  const toggleVideoMode = () => setVideoMode(!videoMode);
  const downloadChat = () => {
    const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat.txt";
    link.click();
  };
  const clearChat = () => setMessages([]);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">
          💬 <span className="text-white">AI Chat (Droxion)</span>
        </div>
        <div className="flex items-center gap-4 text-white text-md">
          <FaClock title="History" className="cursor-pointer" />
          <FaPlus title="New Chat" className="cursor-pointer" onClick={clearChat} />
          <FaTrash title="Clear Chat" className="cursor-pointer" onClick={clearChat} />
          <FaDownload title="Download Chat" className="cursor-pointer" onClick={downloadChat} />
          {audioOn ? (
            <FaVolumeUp title="Voice On" className="cursor-pointer" onClick={toggleAudio} />
          ) : (
            <FaVolumeMute title="Voice Off" className="cursor-pointer" onClick={toggleAudio} />
          )}
          <FaVideo
            title="Avatar Mode"
            className={`cursor-pointer ${videoMode ? "text-gray-400" : ""}`}
            onClick={toggleVideoMode}
          />
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[90%] px-4 py-3 rounded-xl shadow 
              ${msg.role === "user"
                ? "bg-white text-black ml-auto"
                : "bg-[#1f1f1f] text-white mr-auto"}`}
          >
            <ReactMarkdown
              components={{
                iframe: ({ node, ...props }) => (
                  <div className="my-2">
                    <iframe {...props} className="w-full max-w-md rounded-lg" />
                  </div>
                ),
                video: ({ node, ...props }) => (
                  <div className="my-2">
                    <video {...props} controls className="w-full max-w-md rounded-lg" />
                  </div>
                ),
                img: ({ node, ...props }) => (
                  <img {...props} className="rounded-lg my-2 max-w-full h-auto" />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-500 italic animate-pulse px-4 py-2">Typing...</div>
        )}
        <div ref={chatRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type or say anything..."
            className="flex-1 min-w-[250px] bg-[#1a1a1a] text-white p-3 rounded-lg border border-gray-600 focus:outline-none resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-200 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
