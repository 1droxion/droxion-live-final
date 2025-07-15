import React, { useState } from "react";
import axios from "axios";

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async (message) => {
    if (!message) return;
    setMessages([...messages, { user: true, text: message }]);
    setInput("");

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", { message });
      const reply = res.data?.reply || "Echo: " + message;
      setMessages((prev) => [...prev, { user: false, text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { user: false, text: "❌ Error: Something went wrong." }]);
    }
  };

  const handleStyleClick = async (style) => {
    try {
      const res = await axios.post("https://droxion-backend.onrender.com/generate-image", {
        prompt: `Generate an image in ${style} style.`,
      });
      const url = res.data?.image_url;
      if (url) {
        setMessages((prev) => [...prev, { user: false, text: `Generate an image in ${style} style.`, image: url }]);
      } else {
        throw new Error("No image");
      }
    } catch (err) {
      setMessages((prev) => [...prev, { user: false, text: "❌ Error: Something went wrong." }]);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">Droxion</div>
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.user ? "user-message" : "ai-message"}>
            {msg.text}
            {msg.image && <img src={msg.image} alt="generated" />}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          placeholder="Type or say anything..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
        />
        <button onClick={() => sendMessage(input)}>▶️</button>
      </div>
      <div className="style-buttons">
        {["Cinematic", "Anime", "Futuristic", "Fantasy", "Realistic"].map((style) => (
          <button key={style} onClick={() => handleStyleClick(style)}>
            {style}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AIChat;