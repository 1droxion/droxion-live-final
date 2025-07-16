import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

const backend = import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const userId = useRef("");

  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  const speak = (text) => {
    if (!voiceOn) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleSend = async (customPrompt) => {
    const query = customPrompt || input;
    if (!query.trim()) return;
    setInput("");
    setTyping(true);
    setMessages((prev) => [ { role: "user", content: query }, ...prev ]);

    try {
      if (query.toLowerCase().includes("generate") && query.toLowerCase().includes("image")) {
        const imgRes = await axios.post(`${backend}/generate-image`, { prompt: query });
        const imageUrl = imgRes.data.image_url;
        setMessages((prev) => [ { role: "assistant", content: `![image](${imageUrl})` }, ...prev ]);
        speak("Here is your image");
        return;
      }

      const res = await axios.post(`${backend}/chat`, {
        prompt: query,
        user_id: userId.current
      });

      const reply = res.data.reply || "⚠️ No result found.";
      setMessages((prev) => [ { role: "assistant", content: reply }, ...prev ]);
      speak(reply);
    } catch {
      setMessages((prev) => [ { role: "assistant", content: "⚠️ Something went wrong." }, ...prev ]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSend();
  };

  const buttons = [
    { label: "DeepSearch", prefix: "search:" },
    { label: "Think", prefix: "think:" },
    { label: "Create Images", value: "generate car image" },
    { label: "Research", prefix: "research:" },
    { label: "Edit Image", action: () => window.location.href = "/editor" },
    { label: "Latest News", prefix: "news:" },
    { label: "Personas", prefix: "persona:" }
  ];

  const sendButton = (btn) => {
    if (btn.action) return btn.action();
    if (btn.value) return handleSend(btn.value);
    if (btn.prefix) return handleSend(`${btn.prefix} ${input}`);
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center px-4 pt-10">
      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-semibold text-gray-300">Droxion</h1>
      </div>

      {/* Input Box */}
      <div className="bg-[#111] w-full max-w-2xl rounded-xl px-6 py-4 shadow-lg backdrop-blur">
        <input
          type="text"
          value={input}
          placeholder="What do you want to know?"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="w-full bg-transparent text-white placeholder-gray-400 outline-none mb-4"
        />
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => sendButton(buttons[0])} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">DeepSearch</button>
          <button onClick={() => sendButton(buttons[1])} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">Think</button>
          <button onClick={() => handleSend()} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">↗</button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 mb-8">
        {buttons.slice(2).map((btn, i) => (
          <button key={i} onClick={() => sendButton(btn)} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black transition">{btn.label}</button>
        ))}
      </div>

      {/* Replies (Top-down) */}
      <div className="w-full max-w-3xl px-2 flex flex-col gap-4 pb-32">
        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : "text-left"} whitespace-pre-wrap text-sm`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left text-sm text-gray-400">Typing...</div>}
      </div>

      {/* Voice Toggle Bottom */}
      <div className="fixed bottom-4 text-center">
        <button
          onClick={() => setVoiceOn(!voiceOn)}
          className="text-xs border border-white px-3 py-1 rounded hover:bg-white hover:text-black"
        >
          {voiceOn ? "Voice On" : "🔇 Voice Off"}
        </button>
      </div>
    </div>
  );
}

export default AIChat;
