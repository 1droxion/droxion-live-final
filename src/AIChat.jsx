// AIChat.jsx — Full AGI Integration with All Phases (1–10)
import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { FaMicrophone, FaUpload, FaCamera, FaTrash, FaPlus, FaBrain } from "react-icons/fa";

const AIChat = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatHistory");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    // Detect special triggers
    if (input.toLowerCase().includes("remember my name")) {
      const name = input.split("remember my name is")[1]?.trim();
      await axios.post("/chat", { prompt: input });
      setMessages((prev) => [...prev, { role: "system", content: `🧠 Got it! I’ll remember: ${name}` }]);
      setLoading(false);
      return;
    }

    if (input.toLowerCase().startsWith("goal:")) {
      await axios.post("/chat", { prompt: input });
      setMessages((prev) => [...prev, { role: "system", content: `🎯 Saved your goal!` }]);
      setLoading(false);
      return;
    }

    try {
      // Default chat
      const res = await axios.post("/chat", { prompt: input });
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: "ai", content: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "system", content: "⚠️ Error from AI." }]);
    }
    setLoading(false);
  };

  const analyzeImage = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageUrl = reader.result;
      try {
        const res = await axios.post("/analyze-image", { url: imageUrl });
        setMessages((prev) => [...prev, { role: "ai", content: res.data.analysis }]);
      } catch (err) {
        setMessages((prev) => [...prev, { role: "system", content: "❌ Vision error." }]);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("chatHistory");
  };

  return (
    <div className="ai-chat" style={{ background: "#000", color: "#fff", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="chat-header" style={{ textAlign: "center", padding: "1rem", fontSize: "24px", fontWeight: "bold" }}>Droxion AGI</div>
      <div className="chat-body" style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            background: msg.role === "user" ? "#1e1e1e" : msg.role === "ai" ? "#2a2a2a" : "#333",
            padding: "0.8rem 1rem", borderRadius: 12, marginBottom: "0.8rem", maxWidth: "85%",
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start"
          }}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {loading && <div style={{ color: "gray" }}>🤖 Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer" style={{ display: "flex", alignItems: "center", padding: "0.75rem", borderTop: "1px solid #111" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything or start your goal..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          style={{ flex: 1, padding: "0.75rem", background: "#111", color: "#fff", border: "none", borderRadius: 10 }}
        />
        <button onClick={sendMessage} style={{ marginLeft: 8, background: "#333", color: "white", padding: "0.75rem 1rem", borderRadius: 10 }}>Send</button>
        <input type="file" onChange={analyzeImage} style={{ display: "none" }} id="uploadImg" accept="image/*" />
        <label htmlFor="uploadImg" style={{ marginLeft: 8, cursor: "pointer" }}><FaCamera /></label>
        <button onClick={clearChat} style={{ marginLeft: 8 }}><FaTrash /></button>
      </div>
    </div>
  );
};

export default AIChat;
