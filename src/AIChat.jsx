// AIChat.jsx – Droxion Real-Time Full Preview Chat
// Built by Dhruv Patel | Droxion AI

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);
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

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const speak = (text) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    synth.cancel();
    synth.speak(utter);
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
        user_id: userId.current
      });
      const reply = res.data.reply;

      const cards = [];

      // Smart detection for live preview content
      if (reply.includes("youtube.com/watch?v=")) {
        const vidId = reply.split("v=")[1]?.split("&")[0];
        cards.push(`<iframe class='rounded my-2' width='360' height='203' src='https://www.youtube.com/embed/${vidId}' allowfullscreen></iframe>`);
      }

      if (reply.includes("http") && reply.includes("coin")) {
        cards.push(`📈 **Crypto Market Live**\n[See More](${reply.match(/https:\\/\\/[^ )\\n]+/g)?.[0]})`);
      }

      if (reply.includes("cricbuzz") || reply.toLowerCase().includes("score")) {
        cards.push(`🏏 **Cricket Live Score**\n[View Match](${reply.match(/https:\\/\\/[^ )\\n]+/g)?.[0]})`);
      }

      if (reply.toLowerCase().includes("weather") && reply.includes("http")) {
        cards.push(`🌤️ **Live Weather**\n[Check Forecast](${reply.match(/https:\\/\\/[^ )\\n]+/g)?.[0]})`);
      }

      if (reply.toLowerCase().includes("wikipedia") && reply.includes("http")) {
        cards.push(`📚 **Wikipedia Info**\n[View Wiki](${reply.match(/https:\\/\\/[^ )\\n]+/g)?.[0]})`);
      }

      if (reply.toLowerCase().includes("date") || reply.toLowerCase().includes("time")) {
        cards.push(`🕒 **${reply}**`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply },
        ...cards.map((c) => ({ role: "assistant", content: c }))
      ]);
      speak(reply);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "❌ Error: Something went wrong." }]);
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

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="text-lg font-bold">Droxion</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`px-3 whitespace-pre-wrap text-sm max-w-xl ${msg.role === "user" ? "text-right self-end ml-auto" : "text-left self-start"}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{
              img: ({ node, ...props }) => (<img {...props} alt="Preview" className="rounded-lg my-2 max-w-xs" />),
              iframe: ({ node, ...props }) => (<iframe {...props} className="rounded-lg my-2 max-w-xs" allowFullScreen />)
            }}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="text-left ml-4"><span className="inline-block w-2 h-2 bg-white rounded-full animate-ping" /></div>}
        <div ref={chatRef} />
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 p-2 rounded bg-black text-white border border-gray-600 focus:outline-none"
            placeholder="Type anything..."
          />
          <button
            onClick={handleSend}
            className="bg-white hover:bg-gray-300 text-black font-bold py-2 px-4 rounded"
          >➤</button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
