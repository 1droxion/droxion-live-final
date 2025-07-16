import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import "./AIChat.css";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        message: input,
      });

      const reply = res.data.reply || "No reply received.";
      const replyMsg = { sender: "ai", text: reply };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: "ai", text: "⚠️ Server error." }]);
    }
    setTyping(false);
  };

  useEffect(() => {
    chatRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePrompt = (prompt) => {
    setInput(prompt);
    sendMessage();
  };

  return (
    <div className="ai-chat">
      <div className="chat-header">Droxion</div>

      <div className="chat-body">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.sender}`}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text}</ReactMarkdown>
          </div>
        ))}
        {typing && (
          <div className="loading-wrap">
            <div className="loading-x"></div>
          </div>
        )}
        <div ref={chatRef} />
      </div>

      <div className="chat-footer">
        <div className="prompt-bar">
          {["DeepSearch", "Think", "Create Images", "Research", "Edit Image", "Latest News", "Personas"].map((txt) => (
            <button key={txt} onClick={() => handlePrompt(txt)}>{txt}</button>
          ))}
        </div>

        <div className="chat-input-bar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you want to know?"
          />
          <button onClick={sendMessage}>▶</button>
        </div>
      </div>
    </div>
  );
}

export default AIChat;
