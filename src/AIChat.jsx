import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import {
  FaMicrophone, FaUpload, FaCamera, FaDesktop, FaTrash
} from "react-icons/fa";

function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const chatRef = useRef(null);

  const baseSuggestions = [
    "What is AI?",
    "Search YouTube for motivational video",
    "Crypto: ETH",
    "weather in London",
    "How does quantum computing work?",
  ];

  const tools = [
    "DeepSearch", "Think", "Create Images",
    "Research", "Edit Image", "Latest News", "Personas"
  ];

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const filtered = baseSuggestions.filter((s) =>
      s.toLowerCase().startsWith(input.toLowerCase())
    );
    setSuggestions(filtered.length ? filtered : baseSuggestions);
  }, [input]);

  const sendMessage = async (customInput) => {
    const prompt = customInput || input;
    if (!prompt.trim()) return;

    const userMsg = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const res = await axios.post("https://droxion-backend.onrender.com/chat", {
        prompt,
      });
      setMessages((prev) => [...prev, { role: "ai", content: res.data.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "❌ Error. Please try again." },
      ]);
    }

    setLoading(false);
  };

  const handleScreenshot = () => {
    const fakeImg = {
      role: "user",
      content: "📸 Screenshot captured (simulate). Add real logic if needed.",
    };
    setMessages((prev) => [...prev, fakeImg]);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const uploadedMsg = {
          role: "user",
          content: `📎 Uploaded: ${file.name}`,
        };
        setMessages((prev) => [...prev, uploadedMsg]);
      }
    };
    input.click();
  };

  return (
    <div style={{
      background: "#000", color: "#fff", height: "100vh", display: "flex", flexDirection: "column"
    }}>
      <div style={{
        textAlign: "center", fontSize: "22px", fontWeight: "600",
        padding: "1rem", color: "#aaa", letterSpacing: "1px"
      }}>
        Droxion
      </div>

      <div ref={chatRef} style={{
        flex: 1, overflowY: "auto", padding: "1rem", display: "flex",
        flexDirection: "column", gap: "0.75rem"
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            background: msg.role === "user" ? "#1e1e1e" : "#2a2a2a",
            padding: "10px 14px", borderRadius: "16px", maxWidth: "75%", fontSize: "14px"
          }}>
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: "flex-start", background: "#2a2a2a",
            padding: "10px 14px", borderRadius: "16px", maxWidth: "75%", fontSize: "14px"
          }}>
            <span>...</span>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div style={{ padding: "0 1rem 0.5rem" }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => sendMessage(s)}
              style={{
                background: "#111", padding: "10px", marginBottom: "5px",
                borderRadius: "12px", cursor: "pointer", fontSize: "14px"
              }}>
              {s}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "0 1rem 0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        {tools.map((tool, i) => (
          <button key={i} onClick={() => sendMessage(tool)} style={{
            background: "#111", color: "#fff", padding: "6px 12px",
            borderRadius: "12px", fontSize: "13px", border: "none"
          }}>
            {tool}
          </button>
        ))}
      </div>

      <div style={{
        display: "flex", alignItems: "center", padding: "0.5rem 1rem",
        borderTop: "1px solid #111", gap: "0.5rem"
      }}>
        <FaMicrophone color="white" />
        <FaUpload color="white" onClick={handleUpload} style={{ cursor: "pointer" }} />
        <FaCamera color="white" onClick={handleScreenshot} style={{ cursor: "pointer" }} />
        <FaDesktop color="white" />
        <input
          style={{
            flex: 1, background: "#000", color: "white", border: "none",
            fontSize: "15px", padding: "10px"
          }}
          placeholder="Ask anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={() => sendMessage()} style={{
          background: "white", color: "black", border: "none",
          borderRadius: "50%", width: "38px", height: "38px"
        }}>➤</button>
      </div>
    </div>
  );
}

export default AIChat;