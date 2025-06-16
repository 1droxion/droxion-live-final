// ✅ Final fixed AIChat.jsx with original style preserved
// - user text on right
// - AI text on left
// - black background
// - no borders on messages
// - perfect YouTube preview
// - perfect image preview
// - small input bar + blinking "Typing..." dots

import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [typingText, setTypingText] = useState("Typing");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTypingText((prev) => (prev.length < 10 ? prev + "." : "Typing"));
    }, 300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await axios.post("/chat", {
        prompt: input,
        voiceMode,
        videoMode,
      });

      const reply = res.data.reply;
      const videoURL = res.data.url;
      const imageURL = res.data.image;

      let content = reply;
      if (videoURL) {
        content += `\n\n<iframe width='100%' height='240' src='${videoURL.replace("watch?v=", "embed/")}' frameborder='0' allowfullscreen></iframe>`;
      }
      if (imageURL) {
        content += `\n\n<img src='${imageURL}' style='max-width:100%; border-radius:12px;' alt='result'/>`;
      }

      setMessages((prev) => [...prev, { role: "assistant", content }]);

      if (voiceMode) {
        const audioRes = await axios.post("/speak", { text: reply });
        const audio = new Audio(audioRes.data.url);
        audio.play();
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col p-4">
      <div className="text-xl font-bold text-white mb-4">
        <span className="text-purple-300">💬 AI Chat </span>
        <span className="text-white">(Droxion)</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-xl px-3 py-2 rounded-lg whitespace-pre-wrap break-words ${
              msg.role === "user"
                ? "self-end text-right ml-auto"
                : "self-start text-left mr-auto"
            }`}
            style={{ backgroundColor: "transparent" }}
          >
            <ReactMarkdown
              children={msg.content}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                iframe: ({ node, ...props }) => (
                  <div className="mt-2 rounded-xl overflow-hidden border border-gray-700">
                    <iframe {...props} className="w-full h-[200px]" />
                  </div>
                ),
                img: ({ node, ...props }) => (
                  <img {...props} className="mt-3 rounded-xl max-w-xs" />
                ),
              }}
            />
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-400 text-sm animate-pulse ml-2">{typingText}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex items-center space-x-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type your message..."
          className="flex-1 p-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-white text-black px-4 py-2 rounded font-semibold"
        >
          ➤
        </button>
      </div>

      <div className="flex justify-end space-x-2 mt-2">
        <button onClick={() => setVoiceMode(!voiceMode)} className="text-sm">
          🔊 {voiceMode ? "On" : "Off"}
        </button>
        <button onClick={() => setVideoMode(!videoMode)} className="text-sm">
          🎥 {videoMode ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
