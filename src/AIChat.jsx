import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

const backend = import.meta.env.VITE_BACKEND_URL || "https://droxion-backend.onrender.com";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const chatRef = useRef(null);
  const synth = window.speechSynthesis;
  const userId = useRef("");

  const promptButtons = [
    "news", "weather", "crypto", "usd to inr",
    "tesla stock", "time", "youtube trending", "generate car image"
  ];

  useEffect(() => {
    let id = localStorage.getItem("droxion_uid");
    if (!id) {
      id = "user-" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("droxion_uid", id);
    }
    userId.current = id;
  }, []);

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".plus-menu")) setShowMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const speak = (text) => {
    if (!voiceOn || !text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    synth.cancel();
    synth.speak(utter);
  };

  const handleSend = async (customPrompt) => {
    const query = customPrompt || input;
    if (!query.trim()) return;

    const userMsg = { role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setShowMenu(false);

    try {
      if (query.toLowerCase().includes("generate") && query.toLowerCase().includes("image")) {
        const imgRes = await axios.post(`${backend}/generate-image`, { prompt: query });
        const imageUrl = imgRes.data.image_url;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `![image](${imageUrl})` }
        ]);
        speak("Here is your image");
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

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
        ...cards,
        ...(suggestionButtons ? [{ role: "assistant", content: suggestionButtons }] : []),
      ]);

      speak(reply);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ No live result found. Try again with something more specific." }
      ]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    window.droxionSend = (text) => handleSend(text);
  }, []);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
        <button
          onClick={() => setVoiceOn(!voiceOn)}
          className="text-xs border border-white px-2 py-1 rounded hover:bg-white hover:text-black"
        >
          {voiceOn ? "Voice On" : "🔇 Voice Off"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 whitespace-pre-wrap text-sm max-w-full ${
              msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"
            }`}
          >
            {msg.content.includes("<div") || msg.content.includes("<iframe") || msg.content.includes("<img") ? (
              <div
                className="my-2 max-w-full"
                dangerouslySetInnerHTML={{ __html: msg.content }}
              />
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
                img: ({ node, ...props }) => (
                  <img {...props} alt="Preview" className="rounded-lg my-2 max-w-[420px] w-full" />
                ),
                iframe: ({ node, ...props }) => (
                  <iframe {...props} className="rounded-lg my-2 max-w-[480px] w-full" allowFullScreen />
                ),
                audio: ({ node, ...props }) => (<audio {...props} controls className="my-2" />),
                button: ({ node, ...props }) => (<button {...props} className="text-sm px-2 py-1 border border-white rounded hover:bg-white hover:text-black mt-2" />)
              }}>
                {msg.content}
              </ReactMarkdown>
            )}
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-ping" /></div>}
        <div ref={chatRef} />
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-gray-700 bg-[#0b0b0b]">
        {promptButtons.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            className="text-xs px-3 py-1 border border-gray-500 rounded hover:bg-white hover:text-black"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-700 flex items-center space-x-2 relative plus-menu">
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="text-white text-xl px-3">+</button>
          {showMenu && (
            <div className="absolute left-0 bottom-full mb-2 bg-black border border-gray-600 rounded shadow-lg text-sm z-50">
              {["Mic", "Upload", "Take Photo", "Screenshot"].map((opt, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setInput(opt);
                    setShowMenu(false);
                  }}
                  className="px-3 py-2 hover:bg-gray-800 cursor-pointer text-white"
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
          placeholder="Type anything..."
        />
        <button
          onClick={() => handleSend()}
          className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

export default AIChat;
