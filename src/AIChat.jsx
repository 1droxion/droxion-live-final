import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaTrash, FaDownload, FaClock, FaPlus,
  FaVolumeUp, FaVolumeMute, FaVideo, FaMicrophone
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const [typingDots, setTypingDots] = useState(".");

  useEffect(() => {
    if (typing) {
      const interval = setInterval(() => {
        setTypingDots((dots) => (dots.length === 3 ? "." : dots + "."));
      }, 400);
      return () => clearInterval(interval);
    }
  }, [typing]);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel();
    synth.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);

      const keywords = ["video", "watch", "trailer", "movie", "song", "youtube"];
      if (keywords.some((k) => input.toLowerCase().includes(k))) {
        const yt = await axios.post("https://droxion-backend.onrender.com/search-youtube", { prompt: input });
        if (yt.data?.url && yt.data?.title) {
          const videoId = yt.data.url.split("v=")[1];
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `\n\n<iframe width=\"100%\" height=\"200\" src=\"https://www.youtube.com/embed/${videoId}\" frameborder=\"0\" allowfullscreen class='rounded-xl border border-gray-700'></iframe>`
            },
          ]);
        }
      }

      if (input.toLowerCase().startsWith("/img")) {
        const prompt = input.replace("/img", "").trim();
        const imgRes = await axios.post("https://droxion-backend.onrender.com/generate-image", { prompt });
        if (imgRes.data?.image_url) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `![result](${imgRes.data.image_url})`
            }
          ]);
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
    } finally {
      setTyping(false);
    }
  };

  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Mic not supported");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (e) => setInput(e.results[0][0].transcript);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">
          💬 <span className="text-white">AI Chat </span>
          <span className="text-white">(Droxion)</span>
        </div>
        <div className="flex space-x-4">
          <FaClock title="History" className="cursor-pointer" />
          <FaPlus title="New Chat" className="cursor-pointer" onClick={() => setMessages([])} />
          <FaTrash title="Clear" className="cursor-pointer" onClick={() => setMessages([])} />
          <FaDownload title="Download" className="cursor-pointer" onClick={() => {
            const text = messages.map((m) => `${m.role === "user" ? "You" : "AI"}: ${m.content}`).join("\n\n");
            const blob = new Blob([text], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "chat.txt";
            link.click();
          }} />
          <FaMicrophone title="Mic" className="cursor-pointer" onClick={handleMic} />
          {voiceMode ? (
            <FaVolumeUp title="Speaker On" className="cursor-pointer" onClick={() => setVoiceMode(false)} />
          ) : (
            <FaVolumeMute title="Speaker Off" className="cursor-pointer" onClick={() => setVoiceMode(true)} />
          )}
          <FaVideo title="Video Mode" className={`cursor-pointer ${videoMode ? 'text-green-500' : ''}`} onClick={() => setVideoMode(!videoMode)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-xl px-4 py-2 text-sm whitespace-pre-wrap max-w-[80%] ${
              msg.role === "user"
                ? "bg-black text-white self-end text-right border border-gray-600"
                : "bg-black text-white self-start border border-gray-600"
            }`}
          >
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                img: ({ node, ...props }) => (
                  <img {...props} alt="ai-img" className="mt-2 rounded-lg max-w-xs border border-gray-700" />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-gray-400">Typing{typingDots}</div>}
        <div ref={chatRef} />
      </div>

      <div className="p-2 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none text-sm"
            placeholder="Type your message..."
            rows={1}
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
