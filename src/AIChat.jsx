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
  const chatRef = useRef(null);

  const speak = (text) => {
    if (!voiceMode) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en";
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { type: "user", text: input }];
    setMessages(newMessages);
    setInput("");

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt: input,
        voiceMode,
        videoMode
      });
      const reply = res.data.reply;
      const replyMessages = [...newMessages, { type: "ai", text: reply }];
      setMessages(replyMessages);
      speak(reply);
    } catch (err) {
      setMessages([...newMessages, { type: "ai", text: "❌ Error: Something went wrong." }]);
    }
  };

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="text-left p-4 text-xl font-bold">
        <span className="text-purple-400">💬 AI Chat</span> <span>(Droxion)</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`my-2 flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-4 py-2 max-w-[90%] whitespace-pre-wrap rounded-xl text-sm break-words ${
                msg.type === "user" ? "bg-white text-black" : "bg-transparent text-white"
              }`}
            >
              <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={chatRef} />
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-black px-4 py-3 flex items-center gap-2 border-t border-gray-700">
        <input
          type="text"
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 rounded-lg text-sm text-white bg-[#0f172a] border border-gray-600 focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>

      <div className="fixed top-3 right-3 flex gap-2 items-center text-sm">
        <span className="text-white">
          <span role="img" aria-label="speaker">🔊</span>
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className="ml-1 underline"
          >
            {voiceMode ? "On" : "Off"}
          </button>
        </span>
        <span className="text-white">
          <span role="img" aria-label="video">🧑‍🎤</span>
          <button
            onClick={() => setVideoMode(!videoMode)}
            className="ml-1 underline"
          >
            {videoMode ? "On" : "Off"}
          </button>
        </span>
      </div>
    </div>
  );
}
