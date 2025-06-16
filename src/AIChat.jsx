import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [listening, setListening] = useState(false);
  const synth = window.speechSynthesis;
  const recognitionRef = useRef(null);
  const [typingDots, setTypingDots] = useState("");

  useEffect(() => {
    let dotInterval;
    if (typing) {
      let dots = "";
      dotInterval = setInterval(() => {
        dots = dots.length < 3 ? dots + "." : "";
        setTypingDots(dots);
      }, 400);
    }
    return () => clearInterval(dotInterval);
  }, [typing]);

  const scrollToBottom = () => {
    const chatEnd = document.getElementById("chat-end");
    if (chatEnd) chatEnd.scrollIntoView({ behavior: "smooth" });
  };

  const speak = (text) => {
    if (!voiceMode || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    synth.cancel(); // clear old
    synth.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { from: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setTyping(true);
    scrollToBottom();

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });

      const aiReply = res.data.reply;
      const replyMessage = { from: "ai", text: aiReply };
      setMessages((prev) => [...prev, replyMessage]);
      setTyping(false);
      speak(aiReply);

      const keywords = ["youtube", "watch", "video", "trailer", "song"];
      if (keywords.some((k) => input.toLowerCase().includes(k))) {
        const ytRes = await axios.post("https://droxion-backend.onrender.com/search-youtube", {
          prompt: input,
        });

        if (ytRes?.data?.url) {
          const videoId = ytRes.data.url.split("v=")[1];
          const videoMessage = {
            from: "ai",
            text: `[🎬 Watch Now](${ytRes.data.url})`,
            videoId,
          };
          setMessages((prev) => [...prev, videoMessage]);
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { from: "ai", text: "❌ Something went wrong." }]);
      setTyping(false);
    }
  };

  const handleMic = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech Recognition not supported");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
    };

    recognition.onerror = (e) => console.error("Mic error:", e.error);
    recognition.start();
    setListening(true);
    recognitionRef.current = recognition;

    recognition.onend = () => setListening(false);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend();
    }
  };

  return (
    <div className="bg-black text-white p-4 h-screen flex flex-col">
      <div className="flex justify-between mb-2">
        <div className="text-xl font-bold">Droxion AI Chat</div>
        <div className="flex gap-2">
          <button onClick={() => setVoiceMode(!voiceMode)} className="bg-white text-black px-2 rounded">
            🔊 {voiceMode ? "On" : "Off"}
          </button>
          <button onClick={() => setVideoMode(!videoMode)} className="bg-white text-black px-2 rounded">
            🎥 {videoMode ? "On" : "Off"}
          </button>
          <button onClick={handleMic} className="bg-white text-black px-2 rounded">
            🎤 {listening ? "..." : "Mic"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl max-w-xl ${
              m.from === "user" ? "bg-white text-black self-end" : "bg-gray-800 text-white self-start"
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{m.text}</ReactMarkdown>
            {m.videoId && (
              <div className="mt-2">
                <iframe
                  width="100%"
                  height="200"
                  src={`https://www.youtube.com/embed/${m.videoId}`}
                  title="YouTube Video"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                ></iframe>
              </div>
            )}
          </div>
        ))}
        {typing && <div className="text-gray-400">Typing{typingDots}</div>}
        <div id="chat-end" />
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 p-2 rounded bg-gray-800 text-white"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type your message..."
        />
        <button onClick={handleSend} className="bg-white text-black px-4 py-2 rounded">
          Send
        </button>
      </div>
    </div>
  );
}
