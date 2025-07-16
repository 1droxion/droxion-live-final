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
  const synth = window.speechSynthesis;
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
    synth.cancel();
    synth.speak(utter);
  };

  const handleSend = async (customPrompt) => {
    const query = customPrompt || input;
    if (!query.trim()) return;

    setInput("");
    setTyping(true);
    setMessages((prev) => [{ role: "user", content: query }, ...prev]);

    try {
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
      setMessages((prev) => [{ role: "assistant", content: reply }, ...prev]);
      speak(reply);
    } catch {
      setMessages((prev) => [{ role: "assistant", content: "⚠️ Something went wrong." }, ...prev]);
    } finally {
      setTyping(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center px-4 py-6">
      {/* Droxion Logo */}
      <div className="text-3xl font-bold text-gray-300 mb-8">🚀 Droxion</div>

      {/* Floating Chat Box */}
      <div className="bg-[#111111] w-full max-w-2xl rounded-2xl px-6 py-4 backdrop-blur-xl shadow-xl mb-4">
        <input
          type="text"
          placeholder="What do you want to know?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          className="w-full bg-transparent text-white text-md outline-none placeholder-gray-400"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => handleSend("search: " + input)} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">DeepSearch</button>
          <button onClick={() => handleSend("think: " + input)} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">Think</button>
          <button onClick={() => handleSend()} className="rounded-full border border-white px-4 py-1 text-sm hover:bg-white hover:text-black">↗</button>
        </div>
      </div>

      {/* Secondary Options */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <button onClick={() => handleSend("generate car image")} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black">Create Images</button>
        <button onClick={() => handleSend("research: " + input)} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black">Research</button>
        <button onClick={() => window.location.href='/editor'} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black">Edit Image</button>
        <button onClick={() => handleSend("news: " + input)} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black">Latest News</button>
        <button onClick={() => handleSend("persona: " + input)} className="text-xs px-4 py-1 border border-white rounded-full hover:bg-white hover:text-black">Personas</button>
      </div>

      {/* Messages */}
      <div className="w-full max-w-3xl flex-1 overflow-y-auto flex flex-col-reverse px-2 pb-32">
        {messages.map((msg, i) => (
          <div key={i} className={`whitespace-pre-wrap text-sm my-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left text-sm text-gray-400">Typing...</div>}
      </div>

      {/* Fixed bottom bar (Voice Toggle Only) */}
      <div className="fixed bottom-4 left-0 w-full text-center">
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
