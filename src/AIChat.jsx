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
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");

  const smartButtons = [
    { label: "DeepSearch", prefix: "search:" },
    { label: "Think", prefix: "think:" },
    { label: "Create Images", action: "image" },
    { label: "Research", prefix: "research:" },
    { label: "Edit Image", action: "edit-image" },
    { label: "Latest News", prefix: "news:" },
    { label: "Personas", prefix: "persona:" }
  ];

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
    synth.cancel();
    synth.speak(utter);
  };

  const handleSend = async (customPrompt) => {
    const query = customPrompt || input;
    if (!query.trim()) return;

    setInput("");
    setTyping(true);

    const userMsg = { role: "user", content: query };
    setMessages((prev) => [userMsg, ...prev]);

    try {
      // image detect
      if (query.toLowerCase().includes("generate") && query.toLowerCase().includes("image")) {
        const imgRes = await axios.post(`${backend}/generate-image`, { prompt: query });
        const imageUrl = imgRes.data.image_url;
        setMessages((prev) => [{ role: "assistant", content: `![image](${imageUrl})` }, ...prev]);
        speak("Here is your image");
        setTyping(false);
        return;
      }

      const res = await axios.post(`${backend}/chat`, {
        prompt: query,
        user_id: userId.current,
      });

      const reply = res.data.reply || "⚠️ No live result found.";
      const cards = (res.data.cards || []).map((c) => ({ role: "assistant", content: c }));
      const suggestions = res.data.suggestions || [];

      const suggestionButtons = suggestions.length
        ? `<div class='flex gap-2 flex-wrap mt-3'>${suggestions
            .map((s) => `<button onclick="window.droxionSend('${s}')" class='text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black'>${s}</button>`)
            .join("")}</div>`
        : "";

      const fullReply = [{ role: "assistant", content: reply }, ...cards];
      if (suggestionButtons) fullReply.unshift({ role: "assistant", content: suggestionButtons });

      setMessages((prev) => [...fullReply, ...prev]);
      speak(reply);
    } catch {
      setMessages((prev) => [{ role: "assistant", content: "⚠️ Something went wrong." }, ...prev]);
    } finally {
      setTyping(false);
    }
  };

  const handleSmartClick = (btn) => {
    if (btn.action === "image") window.location.href = "/ai-image";
    else if (btn.action === "edit-image") window.location.href = "/editor";
    else handleSend(btn.prefix + " " + input);
  };

  useEffect(() => {
    window.droxionSend = (text) => handleSend(text);
  }, []);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center px-4 py-4">
      <div className="text-3xl font-bold mb-6 backdrop-blur-md bg-white/10 px-6 py-3 rounded-xl shadow">
        🚀 Droxion
      </div>

      <div className="backdrop-blur-xl bg-white/5 rounded-xl px-5 py-3 w-full max-w-xl flex items-center space-x-2 shadow-lg">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything..."
          className="bg-transparent flex-1 text-white placeholder-gray-400 text-md focus:outline-none"
        />
        <button onClick={() => handleSend()} className="text-white text-2xl px-2">➤</button>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-5 mb-4">
        {smartButtons.map((btn, i) => (
          <button
            key={i}
            onClick={() => handleSmartClick(btn)}
            className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black transition"
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-3xl flex-1 overflow-y-auto flex flex-col-reverse space-y-4-reverse py-4">
        <div ref={chatRef} />
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 whitespace-pre-wrap text-sm ${
              msg.role === "user" ? "text-right" : "text-left"
            }`}
          >
            {msg.content.includes("<div") || msg.content.includes("<iframe") || msg.content.includes("<img") ? (
              <div dangerouslySetInnerHTML={{ __html: msg.content }} />
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                img: ({ node, ...props }) => (
                  <img {...props} alt="img" className="rounded-lg my-2 max-w-full" />
                ),
                iframe: ({ node, ...props }) => (
                  <iframe {...props} className="rounded-lg my-2 max-w-full" allowFullScreen />
                ),
                audio: ({ node, ...props }) => (<audio {...props} controls className="my-2" />),
                button: ({ node, ...props }) => (<button {...props} className="text-xs px-2 py-1 border border-white rounded hover:bg-white hover:text-black mt-2" />)
              }}>{msg.content}</ReactMarkdown>
            )}
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-ping" /></div>}
      </div>

      <div className="mt-6 mb-3">
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
