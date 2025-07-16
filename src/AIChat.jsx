// Final Droxion Chat UI - Grok Style
// Includes: fixed bottom input, animated X loader, mobile PWA fix, smart reply logic

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import './AIChat.css'; // Assume style file contains dark mode, mobile responsive layout

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newUserMsg = { sender: 'user', text: input };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { prompt: input });
      const reply = res.data.reply || "Sorry, I couldn’t understand that.";
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { sender: 'bot', text: "Error fetching response." }]);
    }
    setTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="logo">Droxion</div>
      <div className="chat-window" ref={chatRef}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`message ${msg.sender === 'user' ? 'user' : 'bot'}`}
          >
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
          </div>
        ))}
        {typing && <div className="loader-x"></div>}
      </div>
      <div className="chat-input">
        <div className="button-bar">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((btn, i) => (
            <button key={i} onClick={() => setInput(btn)}>{btn}</button>
          ))}
        </div>
        <div className="input-box">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to know?"
          />
          <button onClick={handleSend}>
            <span className="send-icon">▶</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
