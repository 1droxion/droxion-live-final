import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import "./AIChat.css";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { message: input });
      const reply = { sender: "ai", text: res.data.reply || "No response." };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [...prev, { sender: "ai", text: "Error fetching response." }]);
    }
    setTyping(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleButton = (text) => {
    setInput(text);
    sendMessage();
  };

  return (
    <div className="chat-container">
      <div className="chat-header">Droxion</div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble ${msg.sender}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
          </div>
        ))}

        {typing && (
          <div className="loader-container">
            <div className="loader-x" />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="chat-footer">
        <div className="prompt-buttons">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((label, idx) => (
            <button key={idx} onClick={() => handleButton(label)}>{label}</button>
          ))}
        </div>

        <div className="input-bar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to know?"
          />
          <button onClick={sendMessage}>
            <span className="play-icon">▶</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
